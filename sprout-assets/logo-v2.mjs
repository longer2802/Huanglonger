import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
const R = (d) => (d * Math.PI) / 180;

function rounded(g, w, r) { g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, w, r); g.arcTo(w, w, 0, w, r); g.arcTo(0, w, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath(); }

// A finger that is also a feather: rounded base, slightly wider middle, round tip.
function feather(g, len, wid) {
  g.beginPath();
  g.moveTo(0, -wid * 0.42);
  g.bezierCurveTo(len * 0.35, -wid * 0.62, len * 0.8, -wid * 0.55, len - wid * 0.45, -wid * 0.42);
  g.arc(len - wid * 0.45, 0, wid * 0.42, -Math.PI / 2, Math.PI / 2);
  g.bezierCurveTo(len * 0.8, wid * 0.55, len * 0.35, wid * 0.5, 0, wid * 0.42);
  g.arc(0, 0, wid * 0.42, Math.PI / 2, -Math.PI / 2);
  g.closePath();
}

function heart(g, cx, cy, sz) {
  g.save(); g.translate(cx, cy); g.scale(sz / 100, sz / 100);
  g.beginPath(); g.moveTo(0, 38);
  g.bezierCurveTo(-58, 4, -52, -46, -22, -46); g.bezierCurveTo(-8, -46, 0, -36, 0, -26);
  g.bezierCurveTo(0, -36, 8, -46, 22, -46); g.bezierCurveTo(52, -46, 58, 4, 0, 38); g.closePath();
  g.restore();
}

// One wing-hand. Origin = middle of the palm; +x points outward, -x toward
// the centre. Wrist rises from below, four fingers fan out like a wing,
// the thumb points up toward the middle.
function handPath(g) {
  // palm + wrist as one smooth shape
  g.beginPath();
  g.moveTo(-40, -30);
  g.bezierCurveTo(-10, -52, 40, -50, 52, -22);
  g.bezierCurveTo(62, 6, 50, 40, 22, 54);
  g.bezierCurveTo(6, 64, 0, 120, 4, 240);
  g.lineTo(-70, 240);
  g.bezierCurveTo(-60, 120, -60, 52, -56, 20);
  g.bezierCurveTo(-54, -6, -52, -22, -40, -30);
  g.closePath();
}
function wingHand(g, { fill, stroke, lw, palmFill, shade }) {
  const F = [ // angle from +x (negative = up), length, width, base point
    [-80, 142, 40, [-18, -22]], [-55, 162, 40, [8, -20]], [-31, 154, 38, [26, -8]], [-8, 128, 36, [34, 14]],
  ];
  const paint = (path, f) => { path(); g.fillStyle = f; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  for (let i = F.length - 1; i >= 0; i--) {
    const [a, l, w, [bx, by]] = F[i];
    g.save(); g.translate(bx, by); g.rotate(R(a));
    paint(() => feather(g, l, w), typeof fill === "function" ? fill(i, l) : fill);
    if (shade) { g.strokeStyle = shade; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(l * 0.3, 0); g.lineTo(l * 0.72, 0); g.stroke(); }
    g.restore();
  }
  // thumb: from the inner side of the palm, up and in
  g.save(); g.translate(-44, 22); g.rotate(R(-142)); paint(() => feather(g, 70, 38), palmFill); g.restore();
  paint(() => handPath(g), palmFill);
  if (shade) { // palm crease
    g.strokeStyle = shade; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(-30, -8); g.bezierCurveTo(-8, 10, 14, 10, 30, -2); g.stroke();
  }
}

function bubbles(g, list) {
  for (const [x, y, r, col] of list) {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.38, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2); g.fill();
  }
}

function halo(g, x, y, rx, ry, w) {
  g.strokeStyle = "#F7C24A"; g.lineWidth = w; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "rgba(255,240,190,.9)"; g.lineWidth = w * 0.35; g.beginPath(); g.ellipse(x, y - ry * 0.2, rx * 0.9, ry * 0.7, 0, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
}

// ---- A: white wing-hands on pink, cradling a sleeping baby ----
function A(g) {
  const bg = g.createLinearGradient(0, 0, 512, 512); bg.addColorStop(0, "#FF9EC0"); bg.addColorStop(1, "#F2558E");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  bubbles(g, [[70, 80, 26, "rgba(255,255,255,.22)"], [450, 450, 34, "rgba(255,255,255,.18)"], [455, 70, 16, "rgba(255,255,255,.25)"]]);
  for (const d of [-1, 1]) {
    g.save(); g.translate(256 + d * 100, 338); g.rotate(d * R(-6)); g.scale(d * 0.84, 0.84);
    wingHand(g, { fill: (i) => ["#FFFFFF", "#FFF4F8", "#FFE8F0", "#FFDCE8"][i], palmFill: "#FFFFFF", stroke: null, shade: "rgba(242,85,142,.18)", lw: 8 });
    g.restore();
  }
  // baby
  g.fillStyle = "#FFE6D6"; g.beginPath(); g.arc(256, 262, 64, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#E0507F"; g.lineWidth = 6; g.lineCap = "round";
  for (const x of [232, 280]) { g.beginPath(); g.arc(x, 262, 11, R(20), R(160)); g.stroke(); }
  g.fillStyle = "rgba(255,130,160,.45)"; for (const x of [218, 294]) { g.beginPath(); g.ellipse(x, 284, 12, 8, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(256, 288, 7, R(20), R(160)); g.stroke();
  g.strokeStyle = "#E0507F"; g.lineWidth = 7; g.beginPath(); g.moveTo(250, 200); g.bezierCurveTo(240, 186, 262, 178, 266, 192); g.stroke();
  halo(g, 256, 166, 58, 15, 13);
}

// ---- B: a heart made by two hands, with feather fingers as wings ----
function B(g) {
  const bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, "#FFF1F6"); bg.addColorStop(1, "#FFD9E7");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  bubbles(g, [[78, 86, 28, "rgba(255,170,200,.55)"], [446, 92, 20, "rgba(186,222,255,.8)"], [448, 440, 26, "rgba(255,170,200,.5)"], [66, 438, 16, "rgba(255,200,222,.9)"]]);
  for (const d of [-1, 1]) {
    g.save(); g.translate(256 + d * 100, 338); g.rotate(d * R(-6)); g.scale(d * 0.84, 0.84);
    const grd = (i, l) => { const x = g.createLinearGradient(0, 0, l, 0); x.addColorStop(0, ["#F25C93", "#F57AA6", "#F799BB", "#F9B5CD"][i]); x.addColorStop(1, ["#FF8FB8", "#FFA3C4", "#FFB8D1", "#FFCCDD"][i]); return x; };
    wingHand(g, { fill: grd, palmFill: "#F25C93", stroke: "#FFFFFF", lw: 7, shade: null });
    g.restore();
  }
  g.fillStyle = "#FFFFFF"; heart(g, 256, 300, 150); g.fill();
  g.fillStyle = "#F04A86"; heart(g, 256, 302, 108); g.fill();
  g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(232, 278, 11, 6, -0.6, 0, Math.PI * 2); g.fill();
  halo(g, 256, 186, 54, 14, 12);
}

// ---- C: minimal flat silhouette, white on rose, for a clean app icon ----
function C(g) {
  const bg = g.createRadialGradient(256, 200, 40, 256, 256, 380); bg.addColorStop(0, "#FFB3CD"); bg.addColorStop(1, "#E8457F");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#FFFFFF";
  for (const d of [-1, 1]) {
    g.save(); g.translate(256 + d * 100, 338); g.rotate(d * R(-6)); g.scale(d * 0.84, 0.84);
    wingHand(g, { fill: "#FFFFFF", palmFill: "#FFFFFF", stroke: "#E8457F", lw: 9, shade: null });
    g.restore();
  }
  g.fillStyle = "#E8457F"; heart(g, 256, 302, 112); g.fill();
  g.fillStyle = "#FFFFFF"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("E", 256, 296);
  halo(g, 256, 190, 50, 13, 12);
}

export function render(fn, size, maskable = false) {
  const c = createCanvas(size, size); const g = c.getContext("2d");
  g.scale(size / 512, size / 512);
  if (maskable) { fn(g); return c; }
  fn(g); return c;
}

const designs = { A, B, C };
// comparison sheet: big + small (home-screen size) + masked rounded corners
const sheet = createCanvas(3 * 560, 760); const sg = sheet.getContext("2d");
sg.fillStyle = "#ffffff"; sg.fillRect(0, 0, sheet.width, sheet.height);
Object.entries(designs).forEach(([k, fn], i) => {
  const big = render(fn, 512); const x = 24 + i * 560;
  sg.save(); sg.translate(x, 24); rounded(sg, 512, 112); sg.clip(); sg.drawImage(big, 0, 0); sg.restore();
  const small = render(fn, 120);
  sg.save(); sg.translate(x + 60, 580); rounded(sg, 120, 27); sg.clip(); sg.drawImage(small, 0, 0); sg.restore();
  const tiny = render(fn, 60);
  sg.save(); sg.translate(x + 230, 610); rounded(sg, 60, 14); sg.clip(); sg.drawImage(tiny, 0, 0); sg.restore();
  sg.fillStyle = "#333"; sg.font = "bold 48px sans-serif"; sg.fillText(k, x + 360, 670);
  fs.writeFileSync(`v2/${k}-512.png`, big.toBuffer("image/png"));
});
fs.writeFileSync("v2/compare.png", sheet.toBuffer("image/png"));

// Final export of design A. Maskable: art shrunk into the 80% safe zone.
function out(name, size, maskable) {
  const c = createCanvas(size, size); const g = c.getContext("2d"); g.scale(size / 512, size / 512);
  if (maskable) {
    const bg = g.createLinearGradient(0, 0, 512, 512); bg.addColorStop(0, "#FF9EC0"); bg.addColorStop(1, "#F2558E");
    g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
    g.save(); g.beginPath(); g.rect(0, 0, 512, 512); g.clip(); g.translate(256, 256); g.scale(0.8, 0.8); g.translate(-256, -256); A(g); g.restore();
  } else A(g);
  fs.writeFileSync(`v2/${name}`, c.toBuffer("image/png"));
}
out("mhb-angel-512.png", 512, false); out("mhb-angel-192.png", 192, false); out("mhb-angel-180.png", 180, false); out("mhb-angel-maskable-512.png", 512, true);
