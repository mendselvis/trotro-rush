"use client";
let ac: AudioContext | null = null;

function ctx() {
  if (!ac) ac = new AudioContext();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, delay = 0) {
  const a = ctx();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + delay);
  o.stop(a.currentTime + delay + dur);
}

export function play(s: "horn" | "crash" | "coin" | "whistle") {
  try {
    if (s === "horn") { tone(392, 0.18, "sawtooth", 0.07); tone(392, 0.25, "sawtooth", 0.07, 0.24); }
    if (s === "coin") { tone(988, 0.08, "square", 0.05); tone(1319, 0.15, "square", 0.05, 0.08); }
    if (s === "crash") { tone(90, 0.35, "sawtooth", 0.12); tone(60, 0.4, "square", 0.08, 0.05); }
    if (s === "whistle") { tone(2200, 0.15, "sine", 0.08); tone(2200, 0.35, "sine", 0.08, 0.2); }
  } catch {}
}

export function unlockAudio() {
  try { ctx().resume(); } catch {}
}
