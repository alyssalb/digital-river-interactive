console.log("handPoseDetection:", handPoseDetection);


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
  let w = min(windowWidth, 1280);
  let h = min(windowHeight, 720);
  createCanvas(w, h, WEBGL);

  base = createGraphics(windowWidth, windowHeight, WEBGL);
  bloom = createGraphics(windowWidth, windowHeight, WEBGL);

  fogLayer = createGraphics(windowWidth, windowHeight);
  fogLayer.noStroke();

const modelConfig = {
  runtime: 'tfjs',
  modelType: 'lite'
};

handPoseDetection.createDetector(
  handPoseDetection.SupportedModels.MediaPipeHands,
  modelConfig
).then(det => {
  detector = det;
});

  let constraints = {
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 }
    }
  };

  video = createCapture(constraints);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fogLayer.resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(30, 60, 90); // fallback background
  drawWaves();

  drawRipples();
  drawFloatingText();
  drawFog();

  if (detector && frameCount % 20 === 0) {
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

function drawWaves() {
  push();
  rotateX(PI / 2);
  fill('#1f2c40');
  noStroke();
  rectMode(CENTER);
  rect(0, 0, width * 2, height * 2);
  pop();
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
  for (let i = 0; i < 40; i++) {
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
