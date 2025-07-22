
let waves, env, base, bloom;
let video, detector, detections = [];
let lastHandCenter = null;

let oracleMessages = [
  "The river remembers.",
  "Let go, and drift.",
  "You are already becoming.",
  "Not all who vanish are lost.",
  "The current carries secrets."
];

let floatingTexts = [];
let ripples = [];
let fogLayer;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  base = createFramebuffer({ antialias: false, depth: false });
  bloom = createFramebuffer({ antialias: false, depth: false });

  fogLayer = createGraphics(windowWidth, windowHeight);
  fogLayer.noStroke();

  handPoseDetection.load(handPoseDetection.SupportedModels.MediaPipeHands, {
    runtime: 'tfjs',
    modelType: 'lite'
  }).then(model => {
    detector = model;
  });

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  let envBuf = createFramebuffer({ width: 400, height: 200 });
  envBuf.draw(() => {
    noStroke();
    beginShape(QUAD_STRIP);
    fill(255, 160, 90);
    vertex(-envBuf.width / 2, -envBuf.height / 2);
    vertex(envBuf.width / 2, -envBuf.height / 2);
    fill('#8faec9');
    vertex(-envBuf.width / 2, 1);
    vertex(envBuf.width / 2, 1);
    vertex(-envBuf.width / 2, envBuf.height / 2);
    vertex(envBuf.width / 2, envBuf.height / 2);
    endShape();
  });
  env = envBuf.get();
  envBuf.remove();

  waves = baseMaterialShader().modify(() => {
    const bumpHeightScale = 40;
    const t = uniformFloat(() => millis());
    function mod289(x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    function perm(x) { return mod289(((x * 34.0) + 1.0) * x); }
    function noise3(p) {
      let a = floor(p);
      let d = p - a;
      d = d * d * (3.0 - 2.0 * d);
      let b = [a.x, a.x, a.y, a.y] + vec4(0.0, 1.0, 0.0, 1.0);
      let k1 = perm([b.x, b.y, b.x, b.y]);
      let k2 = perm([k1.x, k1.y, k1.x, k1.y] + [b.z, b.z, b.w, b.w]);
      let c = k2 + [a.z, a.z, a.z, a.z];
      let k3 = perm(c);
      let k4 = perm(c + 1.0);
      let o1 = fract(k3 * (1.0 / 41.0));
      let o2 = fract(k4 * (1.0 / 41.0));
      let o3 = o2 * d.z + o1 * (1.0 - d.z);
      let o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
      return smoothstep(0, 1, o4.y * d.y + o4.x * (1.0 - d.y));
    }
    const fractalNoise3 = (v1, v2, t) => {
      const s = 0.35;
      return noise3([v1, v2, t]) +
        s * noise3([v1 * 2, v2 * 2, t * 2]) +
        s * s * noise3([v1 * 4, v2 * 4, t * 4]) +
        s * s * s * noise3([v1 * 8, v2 * 8, t * 8]) +
        s * s * s * s * 0.5 * noise3([v1 * 16, v2 * 16, t * 16]);
    };
    getPixelInputs((inputs) => {
      const pos = inputs.texCoord * 150 + t * 0.0001;
      const bumpHeight = (x, y) => bumpHeightScale * fractalNoise3(x, y, t * 0.001);
      const h = bumpHeight(pos.x, pos.y);
      const hR = bumpHeight(pos.x + 0.01, pos.y);
      const hD = bumpHeight(pos.x, pos.y + 0.01);
      const norm = normalize(cross([1, hR - h, 0], [0, hD - h, 1]));
      const origNorm = inputs.normal;
      const w = [1, 0, 0];
      const v = normalize(cross(w, origNorm));
      const u = normalize(cross(v, origNorm));
      inputs.normal = u * norm.x + v * norm.z + origNorm * -norm.y;
      return inputs;
    });
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fogLayer.resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  base.begin();
  panorama(env);
  directionalLight(100, 100, 100, 0, 1, 0.15);
  pointLight(255, 255, 255, 0, -height, -5000);
  ambientLight(150);

  push();
  emissiveMaterial(255);
  translate(0, -height, -5000);
  noStroke();
  sphere(150);
  pop();

  push();
  shader(waves);
  noStroke();
  fill('#1f2c40');
  ambientMaterial(120, 210, 180, 100);
  specularMaterial('#113023');
  shininess(100);
  translate(0, width * 0.08);
  rotateX(PI / 2);
  plane(width * 16, width * 16);
  pop();
  base.end();

  imageMode(CENTER);
  bloom.begin();
  image(base, 0, 0);
  filter(THRESHOLD, 0.9);
  filter(BLUR, 5);
  bloom.end();

  image(base, 0, 0);
  push();
  blendMode(ADD);
  image(bloom, 0, 0);
  pop();

  drawRipples();
  drawFloatingText();
  drawFog();

  if (detector && frameCount % 10 === 0) {
    detector.estimateHands(video.elt).then(hands => {
      detections = hands;
      if (hands.length > 0) {
        let finger = hands[0].keypoints[8];
        let x = map(finger.x, 0, video.width, -width / 2, width / 2);
        let y = map(finger.y, 0, video.height, -height / 2, height / 2);
        triggerOracle(x, y);

        let cx = hands[0].keypoints[0].x;
        let cy = hands[0].keypoints[0].y;
        if (lastHandCenter) {
          let d = dist(cx, cy, lastHandCenter.x, lastHandCenter.y);
          if (d > 30) {
            ripples.push({ x, y, r: 0, alpha: 255 });
          }
        }
        lastHandCenter = { x: cx, y: cy };
      }
    });
  }
}

function triggerOracle(x, y) {
  let i = floor(random(oracleMessages.length));
  floatingTexts.push({ msg: oracleMessages[i], x, y, alpha: 255 });
}

function drawFloatingText() {
  resetMatrix();
  camera();
  ortho();
  textFont('Georgia');
  textAlign(CENTER, CENTER);
  textSize(24);
  for (let t of floatingTexts) {
    fill(255, t.alpha);
    text(t.msg, t.x, t.y);
    t.y -= 0.4;
    t.alpha -= 1.5;
  }
  floatingTexts = floatingTexts.filter(t => t.alpha > 0);
}

function drawRipples() {
  resetMatrix();
  camera();
  ortho();
  noFill();
  stroke(200, 200, 255, 100);
  strokeWeight(2);
  for (let r of ripples) {
    ellipse(r.x, r.y, r.r);
    r.r += 2;
    r.alpha -= 4;
  }
  ripples = ripples.filter(r => r.alpha > 0);
}

function drawFog() {
  fogLayer.clear();
  for (let i = 0; i < 100; i++) {
    let x = noise(i * 0.1, frameCount * 0.001) * width;
    let y = noise(i * 0.2, frameCount * 0.001) * height;
    fogLayer.fill(255, 30);
    fogLayer.ellipse(x, y, 80, 80);
  }
  resetMatrix();
  camera();
  ortho();
  image(fogLayer, 0, 0);
}
