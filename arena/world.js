// KnightVerse Arena - renderer, sky, arena environment, lights and camera director
import * as THREE from 'three';
import { lerp, rand } from './core.js';

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function ringPath(g, cx, cy, r0, r1) {
  g.beginPath();
  g.arc(cx, cy, r1, 0, Math.PI * 2);
  g.arc(cx, cy, r0, 0, Math.PI * 2, true);
}

function makeFloorTextures(maxAniso) {
  const S = 2048, C = S / 2, R = S / 2;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const E = 1024, ec = document.createElement('canvas'); ec.width = ec.height = E;
  const ge = ec.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, E, E);
  const rnd = seeded(7);

  // base stone
  let grd = g.createRadialGradient(C, C, 0, C, C, R);
  grd.addColorStop(0, '#b3a994'); grd.addColorStop(0.55, '#958b79'); grd.addColorStop(1, '#6a6152');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);

  // tile bands
  const bands = [[0.12, 0.30, 12], [0.42, 0.55, 30], [0.62, 0.78, 44], [0.86, 0.985, 60]];
  for (const [r0, r1, n] of bands) {
    const off = rnd() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a0 = off + (i / n) * Math.PI * 2, a1 = off + ((i + 1) / n) * Math.PI * 2;
      g.beginPath();
      g.arc(C, C, R * r1, a0, a1);
      g.arc(C, C, R * r0, a1, a0, true);
      g.closePath();
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(40,30,20,${0.04 + rnd() * 0.1})` : `rgba(255,245,225,${0.03 + rnd() * 0.08})`;
      g.fill();
      g.strokeStyle = 'rgba(28,20,14,0.55)'; g.lineWidth = 5; g.stroke();
      // bevel highlight
      g.beginPath(); g.arc(C, C, R * r1 - 6, a0 + 0.01, a1 - 0.01);
      g.strokeStyle = 'rgba(255,240,215,0.12)'; g.lineWidth = 3; g.stroke();
    }
  }

  // speckle / weathering
  for (let i = 0; i < 70000; i++) {
    const x = rnd() * S, y = rnd() * S, v = rnd();
    g.fillStyle = v < 0.55 ? `rgba(0,0,0,${rnd() * 0.07})` : `rgba(255,250,235,${rnd() * 0.05})`;
    const w = 1 + rnd() * 3; g.fillRect(x, y, w, w);
  }
  // cracks
  g.strokeStyle = 'rgba(25,18,12,0.35)'; g.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }

  // gold band helper
  const goldBand = (r0, r1, teal) => {
    const gg = g.createRadialGradient(C, C, R * r0, C, C, R * r1);
    gg.addColorStop(0, '#7a5214'); gg.addColorStop(0.25, '#e9bf55'); gg.addColorStop(0.5, '#fbe08a');
    gg.addColorStop(0.75, '#d8a23c'); gg.addColorStop(1, '#6b4510');
    ringPath(g, C, C, R * r0, R * r1); g.fillStyle = gg; g.fill();
    g.strokeStyle = 'rgba(50,30,8,0.8)'; g.lineWidth = 4;
    g.beginPath(); g.arc(C, C, R * r0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(C, C, R * r1, 0, Math.PI * 2); g.stroke();
    if (teal) {
      const n = Math.round(48 * r1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rm = R * (r0 + r1) / 2, s = R * (r1 - r0) * 0.32;
        const x = C + Math.cos(a) * rm, y = C + Math.sin(a) * rm;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4);
        g.fillStyle = '#1aa3a0'; g.fillRect(-s / 2, -s / 2, s, s);
        g.strokeStyle = '#5a3a0a'; g.lineWidth = 3; g.strokeRect(-s / 2, -s / 2, s, s);
        g.restore();
        const ex = E / 2 + Math.cos(a) * rm / 2, ey = E / 2 + Math.sin(a) * rm / 2;
        ge.fillStyle = 'rgba(40,220,210,0.55)'; ge.beginPath(); ge.arc(ex, ey, s / 4, 0, Math.PI * 2); ge.fill();
      }
    }
  };
  goldBand(0.30, 0.345, false);
  goldBand(0.36, 0.40, true);
  goldBand(0.55, 0.565, false);
  goldBand(0.78, 0.835, true);
  goldBand(0.985, 1.0, false);

  // rune band (carved, glows in emissive)
  const r0 = 0.405, r1 = 0.42;
  ringPath(g, C, C, R * 0.40, R * 0.42); g.fillStyle = 'rgba(40,30,22,0.6)'; g.fill();
  const runeBand = (rMid, n, size) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const strokes = [];
      const k = 3 + Math.floor(rnd() * 3);
      for (let s = 0; s < k; s++) strokes.push([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      const draw = (ctx, cx, cy, rr, sz, color, lw) => {
        ctx.save(); ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2);
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of strokes) { ctx.moveTo(x0 * sz, y0 * sz * 1.3); ctx.lineTo(x1 * sz, y1 * sz * 1.3); }
        ctx.stroke(); ctx.restore();
      };
      draw(g, C, C, R * rMid, size, 'rgba(30,20,12,0.85)', 7);
      draw(ge, E / 2, E / 2, (R * rMid) / 2, size / 2, 'rgba(255,190,90,0.95)', 4);
    }
  };
  runeBand(0.465, 36, 46);
  runeBand(0.70, 56, 40);

  // inner sigil: 8 point star + medallion
  const star = (ctx, cx, cy, rOut, rIn, n, rot) => {
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const rr = i % 2 === 0 ? rOut : rIn, a = rot + (i / (n * 2)) * Math.PI * 2;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  star(g, C, C, R * 0.29, R * 0.13, 8, 0);
  g.fillStyle = 'rgba(214,170,70,0.25)'; g.fill();
  g.strokeStyle = '#c99a3b'; g.lineWidth = 10; g.stroke();
  star(g, C, C, R * 0.22, R * 0.1, 8, Math.PI / 8);
  g.strokeStyle = 'rgba(120,80,20,0.9)'; g.lineWidth = 5; g.stroke();
  const med = g.createRadialGradient(C, C, 0, C, C, R * 0.1);
  med.addColorStop(0, '#fff1b8'); med.addColorStop(0.5, '#e2b04a'); med.addColorStop(1, '#7a5214');
  g.beginPath(); g.arc(C, C, R * 0.1, 0, Math.PI * 2); g.fillStyle = med; g.fill();
  g.strokeStyle = '#4a300a'; g.lineWidth = 6; g.stroke();
  star(g, C, C, R * 0.075, R * 0.03, 4, 0); g.fillStyle = '#8a5d18'; g.fill();
  // emissive sigil
  star(ge, E / 2, E / 2, (R * 0.29) / 2, (R * 0.13) / 2, 8, 0);
  ge.strokeStyle = 'rgba(255,200,90,0.35)'; ge.lineWidth = 3; ge.stroke();
  ge.beginPath(); ge.arc(E / 2, E / 2, (R * 0.1) / 2, 0, Math.PI * 2);
  ge.fillStyle = 'rgba(255,210,110,0.35)'; ge.fill();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = maxAniso;
  const emissive = new THREE.CanvasTexture(ec);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

function makeStoneTexture(w, h, base, rows, cols, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const rnd = seeded(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const bw = w / cols, off = (r % 2) * bw / 2;
    for (let i = -1; i <= cols; i++) {
      const x = i * bw + off, y = r * bh;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},${0.05 + rnd() * 0.1})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.strokeStyle = 'rgba(20,14,10,0.6)'; g.lineWidth = 3; g.strokeRect(x, y, bw, bh);
    }
  }
  for (let i = 0; i < w * h / 60; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

export function makeCircleTexture(variant = 0) {
  const S = 512, C = S / 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); const rnd = seeded(31 + variant);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
  circ(240, 8); circ(222, 3); circ(160, 5); circ(110, 3);
  // glyphs between rings
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.save(); g.translate(C + Math.cos(a) * 191, C + Math.sin(a) * 191); g.rotate(a + Math.PI / 2);
    g.lineWidth = 4; g.beginPath();
    for (let s = 0; s < 3; s++) { g.moveTo((rnd() - 0.5) * 22, (rnd() - 0.5) * 26); g.lineTo((rnd() - 0.5) * 22, (rnd() - 0.5) * 26); }
    g.stroke(); g.restore();
  }
  // star lines
  const n = variant === 1 ? 6 : 5;
  g.lineWidth = 4; g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + ((i * 2) % n) * (Math.PI * 2 / n);
    const x = C + Math.cos(a) * 158, y = C + Math.sin(a) * 158;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.arc(C + Math.cos(a) * 231, C + Math.sin(a) * 231, 6, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export function makeTargetTexture() {
  const S = 256, C = S / 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 7; g.beginPath(); g.arc(C, C, 108, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.save(); g.translate(C, C); g.rotate(a);
    g.beginPath(); g.moveTo(0, -122); g.lineTo(-16, -96); g.lineTo(16, -96); g.closePath(); g.fill();
    g.restore();
  }
  g.lineWidth = 3; g.beginPath(); g.arc(C, C, 86, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}

// Additive "light column" material (beams, light pillars)
export function makeBeamMaterial(color, intensity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz); vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        float f = pow(abs(dot(vN, vV)), 2.2);
        float fade = smoothstep(0.0, 0.08, vY) * pow(1.0 - vY, 1.4);
        float flick = 0.85 + 0.15 * sin(uTime * 3.0 + vY * 18.0);
        gl_FragColor = vec4(uColor, clamp(f * fade * uIntensity * flick, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}

// ---------------------------------------------------------------------------
// Camera director: smooth shots, orbit (lobby), shake
// ---------------------------------------------------------------------------
class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.home = { pos: new THREE.Vector3(0, 12.2, 19.5), look: new THREE.Vector3(0, 0.4, -1.4), fov: 40 };
    this.mode = 'orbit';
    this.pos = this.home.pos.clone(); this.look = this.home.look.clone(); this.fov = 40;
    this.tPos = this.pos.clone(); this.tLook = this.look.clone(); this.tFov = 40;
    this.smooth = 3;
    this.shakeAmt = 0;
    this.orbitAngle = 0;
    this.aspectFactor = 1;
  }
  shot(pos, look, fov = 40, smooth = 3) {
    this.mode = 'shot';
    this.tPos.copy(pos); this.tLook.copy(look); this.tFov = fov; this.smooth = smooth;
  }
  goHome(smooth = 2.5) { this.shot(this.home.pos, this.home.look, this.home.fov, smooth); }
  cut(pos, look, fov) {
    this.mode = 'shot';
    this.pos.copy(pos); this.look.copy(look); this.fov = fov;
    this.tPos.copy(pos); this.tLook.copy(look); this.tFov = fov;
  }
  orbit() { this.mode = 'orbit'; }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  update(dt, t) {
    if (this.mode === 'orbit') {
      this.orbitAngle += dt * 0.07;
      const r = 27, a = this.orbitAngle;
      this.tPos.set(Math.sin(a) * r, 10.5 + Math.sin(t * 0.2) * 1.2, Math.cos(a) * r);
      this.tLook.set(0, 0.5, 0); this.tFov = 42; this.smooth = 1.5;
    }
    const k = 1 - Math.exp(-this.smooth * dt);
    this.pos.lerp(this.tPos, k); this.look.lerp(this.tLook, k);
    this.fov = lerp(this.fov, this.tFov, k);
    // portrait screens: pull camera back so the whole arena fits
    const dir = this.pos.clone().sub(this.look).multiplyScalar(this.aspectFactor);
    const p = this.look.clone().add(dir);
    p.x += Math.sin(t * 0.5) * 0.12; p.y += Math.sin(t * 0.37) * 0.08;
    if (this.shakeAmt > 0.001) {
      p.x += (Math.random() - 0.5) * this.shakeAmt; p.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 7);
    }
    this.camera.position.copy(p);
    this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look);
  }
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export class World {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd9905a, 55, 150);
    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 600);
    this.director = new CameraDirector(this.camera);
    this.raycaster = new THREE.Raycaster();
    this.glowTex = makeGlowTexture();
    this.time = 0;
    this.dim = 0; this.dimTarget = 0;
    this.braziers = [];
    this.rocks = [];
    this.animated = [];

    this._sky();
    this._lights();
    this._arena();
    this._surroundings();
    this._embers();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setShadows(on) {
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(x => (x.needsUpdate = true)); } });
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const aspect = w / h, d = this.director;
    if (aspect < 0.9) {
      // phones in portrait: higher, more top-down view so the two rows don't overlap
      d.home.pos.set(0, 21, 13); d.home.look.set(0, 0, 0.3); d.home.fov = 50;
      d.aspectFactor = Math.min(1.45, 1.25 * Math.pow(0.6 / aspect, 0.3));
    } else {
      d.home.pos.set(0, 12.2, 19.5); d.home.look.set(0, 0.4, -1.4); d.home.fov = 40;
      d.aspectFactor = aspect < 1.35 ? Math.pow(1.35 / aspect, 0.85) : 1;
    }
  }

  _sky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDim: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform float uDim; varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 top = vec3(0.20,0.13,0.30), mid = vec3(0.86,0.46,0.22), hor = vec3(1.0,0.76,0.45), low = vec3(0.42,0.22,0.20);
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, h));
          col = mix(col, top, smoothstep(0.16, 0.8, h));
          if (h < 0.0) col = mix(hor * 0.85, low, smoothstep(0.0, -0.35, h));
          vec3 sunDir = normalize(vec3(-0.25, 0.10, -1.0));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0,0.8,0.45) * pow(s, 60.0) * 1.6 + vec3(1.0,0.55,0.25) * pow(s, 6.0) * 0.35;
          vec2 uv = d.xz / (abs(d.y) + 0.22);
          float c = fbm(uv * 1.3 + vec2(uTime * 0.012, uTime * 0.004));
          float upper = smoothstep(0.42, 0.78, c) * smoothstep(0.0, 0.2, h) * (1.0 - smoothstep(0.45, 0.85, h));
          col = mix(col, mix(vec3(1.0,0.84,0.62), vec3(0.58,0.34,0.38), smoothstep(0.05, 0.45, h)), upper * 0.75);
          float sea = smoothstep(0.35, 0.7, fbm(uv * 0.9 - vec2(uTime * 0.01, 0.0))) * smoothstep(0.0, -0.08, h);
          col = mix(col, vec3(1.0,0.78,0.6), sea * 0.55);
          col *= 1.0 - uDim * 0.75;
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.skyMat = mat;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xffe2c4, 0x3a2b3a, 1.05);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffd2a2, 2.6);
    sun.position.set(-14, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -19; sc.right = 19; sc.top = 19; sc.bottom = -19; sc.near = 2; sc.far = 70;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.rim = new THREE.DirectionalLight(0x9fb6ff, 0.75);
    this.rim.position.set(12, 14, -22);
    this.scene.add(this.rim);
    this.baseIntensity = { hemi: this.hemi.intensity, sun: sun.intensity, rim: this.rim.intensity };
  }

  _arena() {
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const { map, emissive } = makeFloorTextures(Math.min(8, aniso));
    const side = makeStoneTexture(1024, 128, '#6b6153', 2, 16, 3);
    side.repeat.set(6, 1);
    const top = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.6,
      roughness: 0.82, metalness: 0.08, bumpMap: map, bumpScale: 0.6,
    });
    this.floorMat = top;
    const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.9, color: 0xbfb3a0 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.5, 1.4, 128, 1), [sideMat, top, sideMat]);
    plat.position.y = -0.7; plat.receiveShadow = true;
    this.scene.add(plat);
    this.floor = plat;

    // lower step ring
    const stepTex = makeStoneTexture(1024, 256, '#544b40', 4, 24, 5);
    stepTex.repeat.set(8, 1);
    const stepMat = new THREE.MeshStandardMaterial({ map: stepTex, roughness: 0.95, color: 0xa89a86 });
    const step = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.8, 1.2, 96, 1, false), stepMat);
    step.position.y = -1.3; step.receiveShadow = true;
    this.scene.add(step);
    const stepTop = new THREE.Mesh(new THREE.RingGeometry(14.4, 18.2, 96, 1),
      new THREE.MeshStandardMaterial({ color: 0x5b5246, roughness: 0.95 }));
    stepTop.rotation.x = -Math.PI / 2; stepTop.position.y = -0.69; stepTop.receiveShadow = true;
    this.scene.add(stepTop);

    // parapet blocks (not in front of the camera)
    const blockGeo = new THREE.BoxGeometry(2.2, 1.0, 0.9);
    const blockMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(256, 128, '#6d6355', 2, 3, 9), roughness: 0.9 });
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const deg = ((a * 180 / Math.PI) + 360) % 360;
      if (deg < 50 || deg > 310) continue;           // keep the front open (+z)
      if (i % 6 === 0) continue;                      // gaps
      const b = new THREE.Mesh(blockGeo, blockMat);
      b.position.set(Math.sin(a) * 17.6, -0.2, Math.cos(a) * 17.6);
      b.rotation.y = a; b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 1.05), new THREE.MeshStandardMaterial({ color: 0xc9a55a, metalness: 0.6, roughness: 0.4 }));
      cap.position.copy(b.position); cap.position.y = 0.38; cap.rotation.y = a;
      this.scene.add(cap);
    }
  }

  _pillar(x, z, h, broken, brazier) {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.85, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x5f574b, roughness: 0.9, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a046, metalness: 0.75, roughness: 0.35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 2.8), darkMat); base.position.y = 0.5; g.add(base);
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.5, 12), stoneMat); base2.position.y = 1.25; g.add(base2);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, h, 12, 1), stoneMat);
    shaft.position.y = 1.5 + h / 2; g.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 6, 20), goldMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.5 + h * 0.3; g.add(ring);
    if (!broken) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.95, 0.7, 12), stoneMat); cap.position.y = 1.5 + h + 0.35; g.add(cap);
      const cap2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), darkMat); cap2.position.y = 1.5 + h + 0.95; g.add(cap2);
      if (brazier) {
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.45, 0.6, 10, 1, true), goldMat);
        bowl.position.y = 1.5 + h + 1.5; g.add(bowl);
        const coal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10), new THREE.MeshBasicMaterial({ color: 0xff7a22 }));
        coal.rotation.x = -Math.PI / 2; coal.position.y = 1.5 + h + 1.65; g.add(coal);
        this.braziers.push(new THREE.Vector3(x, 1.5 + h + 1.8, z));
      }
    } else {
      const chunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), stoneMat);
      chunk.position.set(1.8, 0.6, 0.6); chunk.rotation.set(0.3, 0.4, 1.4); g.add(chunk);
    }
    g.position.set(x, -0.7, z);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  _statue(x, z, rotY) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: 0.8, flatShading: true });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x4f483f, roughness: 0.9 }));
    ped.position.y = 0.7; g.add(ped);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.6, 8, 1, true), m); robe.position.y = 3.2; g.add(robe);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.6, 8), m); torso.position.y = 4.6; g.add(torso);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 8), m); hood.position.y = 6.0; g.add(hood);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x1d1a18 })); head.position.set(0, 5.65, 0.25); g.add(head);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.12), m); sword.position.set(0, 3.6, 1.0); g.add(sword);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.2), m); guard.position.set(0, 5.4, 1.0); g.add(guard);
    const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x4ff0e6 }));
    eyes.position.set(0, 5.7, 0.68); g.add(eyes);
    g.position.set(x, -0.7, z); g.rotation.y = rotY;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.scene.add(g);
  }

  _surroundings() {
    // pillars around the back/sides
    const pillars = [
      [-120, 12, false, true], [-90, 9, true, false], [-60, 13, false, true], [-30, 10, false, false],
      [30, 10, false, false], [60, 13, false, true], [90, 8, true, false], [120, 12, false, true],
      [150, 11, false, false], [-150, 11, false, false],
    ];
    for (const [deg, h, broken, brazier] of pillars) {
      const a = (deg + 180) * Math.PI / 180; // 0deg = back (-z)
      this._pillar(Math.sin(a) * 22.5, Math.cos(a) * 22.5, h, broken, brazier);
    }
    this._statue(-9, -21, 0.25); this._statue(9, -21, -0.25);
    this._statue(-19, -12, 0.9); this._statue(19, -12, -0.9);

    // back gate + light column
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x7c7263, roughness: 0.85, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd2a84a, metalness: 0.75, roughness: 0.3 });
    for (const sx of [-4.2, 4.2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 16, 1.8), gateMat); p.position.set(sx, 7.3, -30); this.scene.add(p);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 4), goldMat); c.position.set(sx, 16.5, -30); c.rotation.y = Math.PI / 4; this.scene.add(c);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.6, 2.0), gateMat); lintel.position.set(0, 14.2, -30); this.scene.add(lintel);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0x40e8ff, emissive: 0x18b8e0, emissiveIntensity: 2 }));
    gem.position.set(0, 14.2, -28.9); this.scene.add(gem); this.animated.push(t => { gem.rotation.y = t * 0.8; });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 120, 24, 1, true), makeBeamMaterial(0xfff1c4, 1.2));
    beam.position.set(0, 58, -31); this.scene.add(beam); this.lightBeam = beam;
    const beamGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe9b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 }));
    beamGlow.scale.set(16, 10, 1); beamGlow.position.set(0, 2, -31); this.scene.add(beamGlow);

    // floating rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a6656, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2), d = rand(32, 75);
      if (Math.cos(a) > 0.6 && d < 45) continue;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.6, 2.6), 0), rockMat);
      r.position.set(Math.sin(a) * d, rand(-2, 22), -Math.abs(Math.cos(a) * d) * 0.9 + rand(-10, 10));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      r.userData = { y: r.position.y, ph: rand(0, 6), sp: rand(0.2, 0.5) };
      r.castShadow = false;
      this.scene.add(r); this.rocks.push(r);
    }
  }

  _embers() {
    const N = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-28, 28); pos[i * 3 + 1] = rand(-2, 18); pos[i * 3 + 2] = rand(-30, 18);
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMap: { value: this.glowTex }, uPR: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        attribute float seed; uniform float uTime; uniform float uPR; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (0.25 + seed * 0.35) + seed * 40.0;
          p.y = mod(p.y + t * 2.2, 22.0) - 3.0;
          p.x += sin(t * 0.7 + seed * 9.0) * 1.2;
          p.z += cos(t * 0.5 + seed * 5.0) * 1.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.25 + seed * 0.35) * uPR * 260.0 / -mv.z;
          vA = 0.35 + 0.65 * abs(sin(t * 3.0 + seed * 20.0));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(1.0, 0.62, 0.25, c.a * vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.emberMat = mat;
    this.scene.add(new THREE.Points(geo, mat));
  }

  update(realDt, gameDt) {
    this.time += realDt;
    const t = this.time;
    this.skyMat.uniforms.uTime.value = t;
    this.emberMat.uniforms.uTime.value = t;
    this.lightBeam.material.uniforms.uTime.value = t;
    this.floorMat.emissiveIntensity = 0.45 + Math.sin(t * 1.4) * 0.15 + this.dim * 0.4;
    for (const r of this.rocks) {
      const u = r.userData; r.position.y = u.y + Math.sin(t * u.sp + u.ph) * 0.8; r.rotation.y += realDt * 0.05;
    }
    for (const f of this.animated) f(t);
    // ultimate dimming
    this.dim = lerp(this.dim, this.dimTarget, 1 - Math.exp(-realDt * 6));
    const k = 1 - this.dim * 0.72;
    this.hemi.intensity = this.baseIntensity.hemi * k;
    this.sun.intensity = this.baseIntensity.sun * (1 - this.dim * 0.6);
    this.rim.intensity = this.baseIntensity.rim * (1 + this.dim * 1.5);
    this.skyMat.uniforms.uDim.value = this.dim;
    this.director.update(realDt, t);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  project(v) {
    const p = v.clone().project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1 && p.z > -1 };
  }

  raycast(clientX, clientY, objects) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, false);
  }
}
