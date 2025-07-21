let waves;
let env;

let base;
let bloom;

// Oracle system
let oracleMessages = [
  "The river remembers.",
  "Let go, and drift.",
  "You are already becoming.",
  "Not all who vanish are lost.",
  "The current carries secrets."
];

let currentMessage = "";
let showMessage = false;
let messageTimer = 0;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  base = createFramebuffer({ antialias: false, depth: false });
  bloom = createFramebuffer({ antialias: false, depth: false });

  // Background gradient
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

  // Shader
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
}

function draw() {
  // Draw water surface with lighting
  base.begin();
  // orbitControl(); ← Removed to stop user pan/zoom
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

  // Oracle Message Overlay (2D mode)
  if (showMessage) {
    resetMatrix();
    camera();
    ortho();
    push();
    textFont('Georgia');
    textAlign(CENTER, CENTER);
    textSize(24);
    fill(255);
    text(currentMessage, 0, 0);
    pop();

    if (millis() - messageTimer > 4000) showMessage = false;
  }
}

function touchStarted() {
  let i = floor(random(oracleMessages.length));
  currentMessage = oracleMessages[i];
  showMessage = true;
  messageTimer = millis();
  return false;
}
