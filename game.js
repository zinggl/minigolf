// Raphaels Minigolf – die Spiellogik.

const FIELD_W = 400;
const FIELD_H = 700;
const BALL_R = 9;
const HOLE_R = 15;
const FRICTION = 0.985;   // wie schnell der Ball langsamer wird (kleiner = schneller stoppen)
const MAX_POWER = 18;     // stärkster möglicher Schlag
const MAX_PULL = 160;     // so weit kann man ziehen

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const holeInfo = document.getElementById("hole-info");
const strokesEl = document.getElementById("strokes");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const overlayButton = document.getElementById("overlay-button");

let scale = 1;
let holeIndex = 0;
let strokes = 0;
let scores = [];
let ball = { x: 0, y: 0, vx: 0, vy: 0 };
let aiming = false;
let pull = { x: 0, y: 0 };
let sinking = 0; // > 0 während der Ball ins Loch fällt
let aimStart = { x: 0, y: 0 };

// ---------- Grösse an den Bildschirm anpassen ----------

function resize() {
  const main = document.querySelector("main");
  const availW = main.clientWidth;
  const availH = main.clientHeight;
  scale = Math.min(availW / FIELD_W, availH / FIELD_H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = FIELD_W * scale + "px";
  canvas.style.height = FIELD_H * scale + "px";
  canvas.width = Math.round(FIELD_W * scale * dpr);
  canvas.height = Math.round(FIELD_H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

window.addEventListener("resize", resize);

// ---------- Loch starten ----------

function currentHole() {
  return HOLES[holeIndex];
}

function startHole(index) {
  holeIndex = index;
  strokes = 0;
  sinking = 0;
  const h = currentHole();
  ball = { x: h.start.x, y: h.start.y, vx: 0, vy: 0 };
  updateHud();
}

function updateHud() {
  const h = currentHole();
  holeInfo.textContent = `Loch ${holeIndex + 1}/${HOLES.length} · ${h.name} · Par ${h.par}`;
  strokesEl.textContent = `Schläge: ${strokes}`;
}

function ballIsMoving() {
  return Math.hypot(ball.vx, ball.vy) > 0.05;
}

// ---------- Steuerung mit dem Finger ----------

function toField(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

canvas.addEventListener("pointerdown", (e) => {
  if (ballIsMoving() || sinking || !overlay.classList.contains("hidden")) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  aiming = true;
  pull = { x: 0, y: 0 };
  aimStart = toField(e);
});

canvas.addEventListener("pointermove", (e) => {
  if (!aiming) return;
  const p = toField(e);
  let dx = p.x - aimStart.x;
  let dy = p.y - aimStart.y;
  const len = Math.hypot(dx, dy);
  if (len > MAX_PULL) {
    dx = (dx / len) * MAX_PULL;
    dy = (dy / len) * MAX_PULL;
  }
  pull = { x: dx, y: dy };
});

function endAim() {
  if (!aiming) return;
  aiming = false;
  const len = Math.hypot(pull.x, pull.y);
  if (len < 8) return; // zu kurz gezogen: kein Schlag
  const power = (len / MAX_PULL) * MAX_POWER;
  // Der Ball fliegt in die Gegenrichtung vom Ziehen (wie eine Steinschleuder)
  ball.vx = (-pull.x / len) * power;
  ball.vy = (-pull.y / len) * power;
  strokes++;
  updateHud();
}

canvas.addEventListener("pointerup", endAim);
canvas.addEventListener("pointercancel", () => { aiming = false; });

// ---------- Physik ----------

function collideWalls() {
  // Rand vom Spielfeld
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * 0.8; }
  if (ball.x > FIELD_W - BALL_R) { ball.x = FIELD_W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.8; }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * 0.8; }
  if (ball.y > FIELD_H - BALL_R) { ball.y = FIELD_H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.8; }

  // Hindernisse
  for (const w of currentHole().walls) {
    const cx = Math.max(w.x, Math.min(ball.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(ball.y, w.y + w.h));
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < BALL_R && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = cx + nx * BALL_R;
      ball.y = cy + ny * BALL_R;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.8;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.8;
      }
    }
  }
}

function step() {
  if (sinking) {
    sinking++;
    if (sinking > 30) {
      sinking = 0;
      holeDone();
    }
    return;
  }

  // In kleinen Schritten bewegen, damit der Ball nicht durch Wände fliegt
  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil(speed / 4));
  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx / steps;
    ball.y += ball.vy / steps;
    collideWalls();
  }

  ball.vx *= FRICTION;
  ball.vy *= FRICTION;
  if (Math.hypot(ball.vx, ball.vy) < 0.08) { ball.vx = 0; ball.vy = 0; }

  // Ist der Ball im Loch? Nur wenn er nicht zu schnell ist.
  const h = currentHole().hole;
  const d = Math.hypot(ball.x - h.x, ball.y - h.y);
  if (d < HOLE_R && Math.hypot(ball.vx, ball.vy) < 7) {
    ball.vx = 0;
    ball.vy = 0;
    ball.x = h.x;
    ball.y = h.y;
    sinking = 1;
  }
}

// ---------- Loch geschafft ----------

function praise(strokes, par) {
  if (strokes === 1) return "Hole in One!!! 🎉";
  const diff = strokes - par;
  if (diff <= -1) return "Super, unter Par! 🌟";
  if (diff === 0) return "Par – sehr gut! 👍";
  if (diff === 1) return "Gut gemacht!";
  return "Geschafft!";
}

function holeDone() {
  scores[holeIndex] = strokes;
  const h = currentHole();
  const last = holeIndex === HOLES.length - 1;
  overlayTitle.textContent = praise(strokes, h.par);
  overlayText.textContent = `Loch ${holeIndex + 1} in ${strokes} ${strokes === 1 ? "Schlag" : "Schlägen"}.`;
  if (last) {
    const total = scores.reduce((a, b) => a + b, 0);
    const par = HOLES.reduce((a, b) => a + b.par, 0);
    overlayText.textContent += ` Alle Löcher: ${total} Schläge (Par ${par}).`;
    overlayButton.textContent = "Nochmal spielen";
  } else {
    overlayButton.textContent = "Nächstes Loch";
  }
  overlay.classList.remove("hidden");
}

overlayButton.addEventListener("click", () => {
  overlay.classList.add("hidden");
  if (holeIndex === HOLES.length - 1) {
    scores = [];
    startHole(0);
  } else {
    startHole(holeIndex + 1);
  }
});

// ---------- Zeichnen ----------

function draw() {
  // Rasen mit Streifen
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? "#4caf50" : "#55b859";
    ctx.fillRect(0, i * 50, FIELD_W, 50);
  }

  // Loch mit Fahne
  const h = currentHole().hole;
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(h.x, h.y, HOLE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  ctx.lineTo(h.x, h.y - 55);
  ctx.stroke();
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.moveTo(h.x, h.y - 55);
  ctx.lineTo(h.x + 30, h.y - 46);
  ctx.lineTo(h.x, h.y - 37);
  ctx.fill();

  // Hindernisse (Holzbalken)
  for (const w of currentHole().walls) {
    ctx.fillStyle = "#8d5a2b";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = "#5d3a1a";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  }

  // Zielhilfe
  if (aiming) {
    const len = Math.hypot(pull.x, pull.y);
    if (len > 8) {
      const strength = len / MAX_PULL;
      // gelb = sanft, rot = ganz fest
      const g = Math.round(230 * (1 - strength));
      ctx.strokeStyle = `rgb(255, ${g}, 0)`;
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x - pull.x * 1.4, ball.y - pull.y * 1.4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Ball
  const r = sinking ? BALL_R * (1 - sinking / 32) : BALL_R;
  if (!sinking) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 3, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, Math.max(r, 0), 0, Math.PI * 2);
  ctx.fill();
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}

resize();
startHole(0);
loop();
