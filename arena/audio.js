// KnightVerse Arena - music + synthesized sound effects (no extra audio files needed)
import { MUSIC } from './assets.js';

export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.music = new Audio(MUSIC);
    this.music.loop = true;
    this.music.volume = 0.32;
    this.noiseBuf = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn) this.music.play().catch(() => {});
  }

  setMusic(on) {
    this.musicOn = on;
    if (on) this.music.play().catch(() => {}); else this.music.pause();
  }

  setSfx(on) { this.sfxOn = on; }

  // --- building blocks -----------------------------------------------------
  _env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  _tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noise(filterType, f0, f1, dur, vol = 0.2, delay = 0, q = 1) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this._env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'click':   this._tone('sine', 900, 700, 0.06, 0.12); break;
      case 'select':  this._tone('triangle', 660, 990, 0.12, 0.14); break;
      case 'turn':    this._tone('sine', 1400, 1800, 0.05, 0.06); break;
      case 'whoosh':  this._noise('bandpass', 300, 1600, 0.28, 0.25, 0, 2); break;
      case 'swing':   this._noise('bandpass', 700, 3200, 0.18, 0.3, 0, 3); break;
      case 'hit':
        this._noise('lowpass', 2400, 300, 0.14, 0.4);
        this._tone('sine', 140, 50, 0.18, 0.35); break;
      case 'crit':
        this._noise('lowpass', 3500, 400, 0.2, 0.45);
        this._tone('sine', 120, 40, 0.25, 0.4);
        this._tone('square', 1500, 900, 0.12, 0.06, 0.02); break;
      case 'cast':
        this._tone('sine', 300, 900, 0.45, 0.12);
        this._tone('triangle', 1200, 1600, 0.4, 0.05, 0.05); break;
      case 'fire':    this._noise('lowpass', 400, 2400, 0.5, 0.3); this._tone('sawtooth', 90, 60, 0.4, 0.05); break;
      case 'boom':
        this._noise('lowpass', 900, 80, 1.0, 0.6);
        this._tone('sine', 80, 28, 0.9, 0.5); break;
      case 'holy':
        this._tone('sine', 660, 660, 0.7, 0.1);
        this._tone('sine', 990, 990, 0.7, 0.07, 0.05);
        this._tone('triangle', 1320, 1320, 0.6, 0.04, 0.1); break;
      case 'heal':
        [1047, 1319, 1568, 2093].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.08, i * 0.07)); break;
      case 'stun':    this._tone('square', 1200, 600, 0.25, 0.05); this._tone('square', 900, 1300, 0.25, 0.04, 0.12); break;
      case 'poison':  this._noise('bandpass', 1800, 500, 0.3, 0.12, 0, 6); break;
      case 'death':   this._tone('sawtooth', 300, 50, 0.7, 0.08); this._noise('lowpass', 800, 100, 0.6, 0.15); break;
      case 'ult':
        this._tone('sawtooth', 110, 440, 0.9, 0.06);
        this._noise('highpass', 800, 6000, 0.9, 0.08); break;
      case 'shadow':  this._noise('bandpass', 2000, 300, 0.22, 0.2, 0, 4); break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone('triangle', f, f, 0.35, 0.12, i * 0.11)); break;
      case 'lose':
        [523, 466, 392, 311].forEach((f, i) => this._tone('triangle', f, f * 0.98, 0.45, 0.1, i * 0.18)); break;
      case 'fight':
        this._tone('sawtooth', 220, 440, 0.4, 0.08);
        this._noise('lowpass', 1500, 200, 0.5, 0.3); break;
    }
  }
}
