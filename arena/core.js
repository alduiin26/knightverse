// KnightVerse Arena - shared helpers: game clock, tweens, easing, random

export const clock = {
  speed: 1,        // x1 / x2 / x3
  paused: false,
  slowMo: 1,       // temporary slow motion for ultimates
  get scale() { return this.paused ? 0 : this.speed * this.slowMo; },
};

const tweens = [];

export const ease = {
  linear: k => k,
  inOut: k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  outBack: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  outElastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};

// Runs fn(k) with k going 0..1 over `dur` game-seconds. Resolves when finished.
export function tween(dur, fn, easing = ease.inOut) {
  return new Promise(resolve => {
    tweens.push({ t: 0, dur: Math.max(0.0001, dur), fn, easing, resolve });
  });
}

export function wait(sec) { return tween(sec, () => {}); }

export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    try { tw.fn(tw.easing(k), k); } catch (e) { console.error(e); }
    if (k >= 1) { tweens.splice(i, 1); tw.resolve(); }
  }
}

export function clearTweens() {
  for (const tw of tweens.splice(0)) tw.resolve();
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
