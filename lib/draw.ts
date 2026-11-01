import type { Game } from "./game";

const PPM = 5.2; // pixels per metre
const LANE_W = 86;

function hash(n: number) {
  let x = (n | 0) * 374761393;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.fillStyle = "rgba(60,25,5,0.28)";
  rr(ctx, x + 7, y + 9, w, h, r);
  ctx.fill();
}

export function drawGame(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  const t = g.time / g.duration; // 0 → 1, day to sunset
  const roadW = LANE_W * 3 + 24;
  const roadL = Math.round(w / 2 - roadW / 2);
  const roadR = roadL + roadW;
  const baseY = h * 0.74;
  const toY = (pos: number) => baseY - (pos - g.dist) * PPM;
  const laneX = (lane: number) => roadL + 12 + LANE_W * (lane + 0.5);

  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * g.shake, (Math.random() - 0.5) * 14 * g.shake);

  // laterite ground, warming toward sunset
  ctx.fillStyle = mix("#D99A5B", "#C9663F", t);
  ctx.fillRect(-20, -20, w + 40, h + 40);

  // gutters
  ctx.fillStyle = "#9C5A34";
  ctx.fillRect(roadL - 14, -20, 10, h + 40);
  ctx.fillRect(roadR + 4, -20, 10, h + 40);

  // road
  ctx.fillStyle = mix("#4A4E5A", "#3F3A4E", t);
  ctx.fillRect(roadL, -20, roadW, h + 40);
  // kerb paint
  const kerbOffset = (g.dist * PPM) % 40;
  for (let y = -40 + kerbOffset; y < h + 40; y += 40) {
    ctx.fillStyle = "#F4F1E8";
    ctx.fillRect(roadL - 4, y, 4, 20);
    ctx.fillRect(roadR, y, 4, 20);
    ctx.fillStyle = "#E53935";
    ctx.fillRect(roadL - 4, y + 20, 4, 20);
    ctx.fillRect(roadR, y + 20, 4, 20);
  }
  // lane dashes
  ctx.fillStyle = "rgba(255,246,224,0.7)";
  const dashOffset = (g.dist * PPM) % 60;
  for (let l = 1; l < 3; l++) {
    const x = roadL + 12 + LANE_W * l - 2;
    for (let y = -60 + dashOffset; y < h + 60; y += 60) ctx.fillRect(x, y, 4, 30);
  }

  // roadside scenery, placed every 22 m from a hash so it scrolls consistently
  const first = Math.floor((g.dist - h / PPM) / 22) - 2;
  const last = Math.floor((g.dist + h / PPM) / 22) + 2;
  for (let k = first; k <= last; k++) {
    const y = toY(k * 22);
    drawLeftScenery(ctx, roadL - 30, y, hash(k), k);
    if (!g.stops.some((s) => Math.abs(s.pos - k * 22) < 18)) drawRightScenery(ctx, roadR + 30, y, hash(k + 999));
    // outer rows so wide screens feel like a busy street, not empty dirt
    drawRightScenery(ctx, roadR + 150, y, hash(k + 5000) * 0.7);
    drawRightScenery(ctx, roadL - 230, y, hash(k + 7000) * 0.7);
    drawLeftScenery(ctx, roadR + 320, y, hash(k + 9000), k);
  }

  // bus stops
  for (const s of g.stops) {
    const y = toY(s.pos);
    if (y < -120 || y > h + 120) continue;
    drawStop(ctx, roadR, y, s.name, s.waiting, g.called.has(s.idx), s.served);
    // painted bus bay on the road
    const bx = laneX(2) - LANE_W / 2 + 6, by = toY(s.pos + 10), bw = LANE_W - 12, bh = 24 * PPM;
    ctx.strokeStyle = s.served ? "#4FD08A" : "#F6C21B";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = s.served ? "rgba(79,208,138,0.8)" : "rgba(246,194,27,0.85)";
    ctx.font = "700 20px Bungee, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BUS STOP", 0, 0);
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  // obstacles
  for (const o of g.obstacles) {
    const y = toY(o.pos);
    if (y < -100 || y > h + 100) continue;
    if (o.kind === "pothole") drawPothole(ctx, laneX(o.lane), y);
    if (o.kind === "car") drawCar(ctx, laneX(o.lane), y, o.color);
    if (o.kind === "police") drawPolice(ctx, roadL, roadR, y);
  }

  // the trotro
  const tx = roadL + 12 + LANE_W * (g.laneVis + 0.5);
  drawTrotro(ctx, tx, baseY, g.braking, g.time);

  ctx.restore();

  // sunset glow
  ctx.fillStyle = `rgba(255,110,60,${0.18 * t})`;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(40,10,40,${0.25 + 0.2 * t})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawTrotro(ctx: CanvasRenderingContext2D, cx: number, cy: number, braking: boolean, time: number) {
  const W = 60, L = 120;
  const x = cx - W / 2, y = cy - L / 2;
  const bob = Math.sin(time * 18) * 0.8;
  shadow(ctx, x, y, W, L, 14);
  // body
  ctx.fillStyle = "#F6C21B";
  rr(ctx, x, y + bob, W, L, 14);
  ctx.fill();
  // side stripes
  ctx.fillStyle = "#2E6FD8";
  ctx.fillRect(x, y + 30 + bob, 5, L - 44);
  ctx.fillRect(x + W - 5, y + 30 + bob, 5, L - 44);
  // windscreen
  ctx.fillStyle = "#24364F";
  rr(ctx, x + 6, y + 6 + bob, W - 12, 20, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  rr(ctx, x + 10, y + 9 + bob, 14, 5, 3);
  ctx.fill();
  // roof
  ctx.fillStyle = "#FFD84D";
  rr(ctx, x + 6, y + 30 + bob, W - 12, L - 44, 6);
  ctx.fill();
  // roof rack and luggage
  ctx.strokeStyle = "#8C6A10";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 36 + i * 14 + bob);
    ctx.lineTo(x + W - 8, y + 36 + i * 14 + bob);
    ctx.stroke();
  }
  ctx.fillStyle = "#B5452B";
  rr(ctx, x + 12, y + 40 + bob, 18, 14, 3);
  ctx.fill();
  ctx.fillStyle = "#3D7A3A";
  rr(ctx, x + 32, y + 58 + bob, 16, 22, 3);
  ctx.fill();
  ctx.fillStyle = "#E8DCC0";
  rr(ctx, x + 14, y + 72 + bob, 14, 12, 3);
  ctx.fill();
  // rear sticker
  ctx.fillStyle = "#16213E";
  ctx.font = "700 8px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GOD DEY", cx, y + L - 6 + bob);
  // brake lights
  ctx.fillStyle = braking ? "#FF3B30" : "#7A1E1E";
  ctx.fillRect(x + 4, y + L - 4 + bob, 10, 4);
  ctx.fillRect(x + W - 14, y + L - 4 + bob, 10, 4);
  if (braking) {
    ctx.fillStyle = "rgba(255,59,48,0.35)";
    ctx.beginPath();
    ctx.arc(x + 9, y + L + bob, 12, 0, Math.PI * 2);
    ctx.arc(x + W - 9, y + L + bob, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const W = 46, L = 78;
  const x = cx - W / 2, y = cy - L / 2;
  shadow(ctx, x, y, W, L, 12);
  ctx.fillStyle = color;
  rr(ctx, x, y, W, L, 12);
  ctx.fill();
  ctx.fillStyle = "#24364F";
  rr(ctx, x + 6, y + 12, W - 12, 14, 5);
  ctx.fill();
  rr(ctx, x + 6, y + L - 22, W - 12, 10, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  rr(ctx, x + 8, y + 30, W - 16, 22, 4);
  ctx.fill();
}

function drawPothole(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = "#6B5A4A";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 30, 18, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2A2420";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 2, 22, 12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,170,200,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 4, 10, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPolice(ctx: CanvasRenderingContext2D, l: number, r: number, y: number) {
  // barrier with a gap? no gap, everyone slows down
  for (let x = l; x < r; x += 24) {
    ctx.fillStyle = Math.round((x - l) / 24) % 2 ? "#F4F1E8" : "#E53935";
    ctx.fillRect(x, y - 5, 24, 10);
  }
  // officer
  ctx.fillStyle = "rgba(60,25,5,0.3)";
  ctx.beginPath();
  ctx.arc(l - 16, y + 6, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2F4A3A";
  ctx.beginPath();
  ctx.arc(l - 20, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16213E";
  ctx.beginPath();
  ctx.arc(l - 20, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16213E";
  rr(ctx, l - 70, y - 34, 56, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#FFF6E0";
  ctx.font = "700 11px Bungee, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POLICE", l - 42, y - 20);
}

function drawStop(ctx: CanvasRenderingContext2D, roadR: number, y: number, name: string, waiting: number, called: boolean, served: boolean) {
  const x = roadR + 18;
  // concrete pad
  ctx.fillStyle = "#CFC4B0";
  rr(ctx, x - 6, y - 60, 92, 120, 8);
  ctx.fill();
  // shelter roof
  shadow(ctx, x + 40, y - 50, 40, 100, 6);
  ctx.fillStyle = served ? "#0E7C4A" : "#D7263D";
  rr(ctx, x + 40, y - 50, 40, 100, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 40, y - 44 + i * 26, 40, 6);
  // waiting people (top-down heads)
  const tones = ["#5A3A22", "#7A4B2A", "#3E2A1A", "#8A5A35"];
  const cloth = ["#2E6FD8", "#F6C21B", "#0E7C4A", "#D7263D", "#7A4EAB"];
  for (let i = 0; i < waiting; i++) {
    const px = x + 10 + (i % 2) * 18, py = y - 30 + i * 18;
    ctx.fillStyle = cloth[i % cloth.length];
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // name sign
  ctx.font = "700 14px Bungee, sans-serif";
  const tw = ctx.measureText(name).width + 18;
  ctx.fillStyle = called ? "#F6C21B" : "#16213E";
  rr(ctx, x - 4, y - 88, tw, 24, 5);
  ctx.fill();
  ctx.fillStyle = called ? "#16213E" : "#FFF6E0";
  ctx.textAlign = "left";
  ctx.fillText(name, x + 5, y - 70);
}

function drawLeftScenery(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number) {
  if (r < 0.3) {
    // palm tree
    ctx.fillStyle = "rgba(60,25,5,0.25)";
    ctx.beginPath();
    ctx.arc(x - 34, y + 8, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2F7D3A";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k;
      ctx.beginPath();
      ctx.ellipse(x - 40 + Math.cos(a) * 12, y + Math.sin(a) * 12, 16, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6B4A2A";
    ctx.beginPath();
    ctx.arc(x - 40, y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (r < 0.62) {
    // kiosk with umbrella
    const colors = ["#F6C21B", "#2E6FD8", "#0E7C4A", "#D7263D"];
    const c = colors[Math.floor(r * 40) % colors.length];
    shadow(ctx, x - 70, y - 22, 50, 44, 4);
    ctx.fillStyle = c;
    rr(ctx, x - 70, y - 22, 50, 44, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - 70, y - 22, 50, 8);
    ctx.fillStyle = "#FFF6E0";
    ctx.beginPath();
    ctx.arc(x - 12, y + 18, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 18);
      ctx.arc(x - 12, y + 18, 15, (i * Math.PI) / 2, (i * Math.PI) / 2 + Math.PI / 4);
      ctx.fill();
    }
  } else if (r < 0.8) {
    // hawker with head pan
    ctx.fillStyle = "#7A4EAB";
    ctx.beginPath();
    ctx.arc(x - 10, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C0C0C0";
    ctx.beginPath();
    ctx.arc(x - 10, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F2A541";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x - 10 + Math.cos(i * 1.3) * 6, y + Math.sin(i * 1.3) * 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRightScenery(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  if (r < 0.45) {
    const colors = ["#E8DCC0", "#F0B67F", "#BFD7EA", "#E9C46A"];
    const c = colors[Math.floor(r * 50) % colors.length];
    shadow(ctx, x + 10, y - 30, 90, 60, 4);
    ctx.fillStyle = c;
    rr(ctx, x + 10, y - 30, 90, 60, 4);
    ctx.fill();
    ctx.fillStyle = "#8C3B2A";
    ctx.fillRect(x + 10, y - 30, 90, 6);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + 22, y - 14, 20, 16);
    ctx.fillRect(x + 62, y - 14, 20, 16);
  } else if (r < 0.65) {
    ctx.fillStyle = "#3C8D2F";
    ctx.beginPath();
    ctx.arc(x + 30, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4FA83D";
    ctx.beginPath();
    ctx.arc(x + 26, y - 4, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}
