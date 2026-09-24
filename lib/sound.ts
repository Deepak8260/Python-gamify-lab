// Tiny synthesized sound effects (no audio files needed).

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; delay?: number; vol?: number; to?: number } = {}) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.12, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  hop(backward = false) {
    tone(backward ? 520 : 420, 0.16, { to: backward ? 300 : 700, type: "triangle", vol: 0.1 });
  },
  land() {
    tone(180, 0.08, { type: "sine", vol: 0.08 });
  },
  success() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { delay: i * 0.1, type: "triangle", vol: 0.12 }));
    tone(1568, 0.35, { delay: 0.45, type: "sine", vol: 0.06 });
  },
  fail() {
    tone(330, 0.18, { type: "triangle", vol: 0.1 });
    tone(247, 0.3, { delay: 0.16, type: "triangle", vol: 0.1 });
  },
  fall() {
    tone(600, 0.6, { to: 90, type: "sawtooth", vol: 0.05 });
  },
  pump(down = false) {
    tone(down ? 700 : 260, 0.18, { to: down ? 420 : 520, type: "sine", vol: 0.1 });
    tone(down ? 520 : 390, 0.1, { delay: 0.08, type: "triangle", vol: 0.05 });
  },
  launch() {
    tone(90, 1.6, { to: 400, type: "sawtooth", vol: 0.05 });
    tone(140, 1.4, { delay: 0.2, to: 900, type: "triangle", vol: 0.05 });
  },
  pop() {
    tone(880, 0.1, { to: 1400, type: "sine", vol: 0.12 });
  },
};
