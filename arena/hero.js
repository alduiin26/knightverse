// KnightVerse Arena - 3D heroes
// Procedural low-poly heroes for every faction + class, with a hook for real .glb models.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RARITIES } from './data.js';
import { tween, ease } from './core.js';

// ---------------------------------------------------------------------------
// 3D MODEL HOOK
// When a .glb model is ready, put the file in arena/models/ and add its path here.
// Example:  'human-mage': 'arena/models/human-mage.glb',
// Heroes without a model keep using the procedural model below.
// Optional animation clips are picked up by name: idle, attack, cast, hit, death.
// ---------------------------------------------------------------------------
export const MODEL_LIBRARY = {
  // 'human-warrior': 'arena/models/human-warrior.glb',
  // 'orc-warrior':   'arena/models/orc-warrior.glb',
  // 'human-rogue':   'arena/models/human-rogue.glb',
  // 'orc-rogue':     'arena/models/orc-rogue.glb',
  // 'human-mage':    'arena/models/human-mage.glb',
  // 'orc-mage':      'arena/models/orc-mage.glb',
  // 'human-priest':  'arena/models/human-priest.glb',
  // 'orc-priest':    'arena/models/orc-priest.glb',
};

// Skill effect colors per faction + class
export const THEME = {
  'human-warrior': 0xffcf5a, 'orc-warrior': 0xff3d8a,
  'human-rogue': 0xb45cff, 'orc-rogue': 0xff6a1f,
  'human-mage': 0xff7a1a, 'orc-mage': 0x9b5cff,
  'human-priest': 0xffe7a0, 'orc-priest': 0x4fd8ff,
};

const PALETTE = {
  human: {
    skin: 0xe9b995, armor: 0xd9a93e, armorM: 0.85, armorR: 0.3, trim: 0xf6e3a2, dark: 0x3b3442, metal: 0xc4ccd6,
    cloth: { warrior: 0x8e1d2c, rogue: 0x5e2649, mage: 0xd4621e, priest: 0xefe6cf }, hair: 0xf1f1f1,
  },
  orc: {
    skin: 0x6e8f45, armor: 0x2f2c35, armorM: 0.75, armorR: 0.4, trim: 0xb8873a, dark: 0x1c191f, metal: 0x55505c,
    cloth: { warrior: 0x2c4a2a, rogue: 0x6a2a1c, mage: 0x3b2962, priest: 0x2a2e63 }, hair: 0x1a1410,
  },
};

const gltfCache = {};

export async function preloadModels() {
  const entries = Object.entries(MODEL_LIBRARY).filter(([, url]) => !!url);
  if (!entries.length) return;
  const loader = new GLTFLoader();
  await Promise.all(entries.map(async ([key, url]) => {
    try { gltfCache[key] = await loader.loadAsync(url); }
    catch (e) { console.warn('[arena] model failed to load, using procedural hero:', key, e); }
  }));
}

export function buildHero(nft) {
  const key = `${nft.faction}-${nft.cls}`;
  return gltfCache[key] ? buildFromGLTF(nft, gltfCache[key]) : buildProcedural(nft);
}

// ---------------------------------------------------------------------------
// shared hero behaviour
// ---------------------------------------------------------------------------
class HeroBase {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.flashMats = [];
    this.allMats = [];
    this.emitters = [];
    this.act = { armLX: 0, armLZ: 0, armRX: 0, armRZ: 0, elbowL: 0, elbowR: 0, torsoX: 0, torsoY: 0, headX: 0, crouch: 0, capeX: 0, legL: 0, legR: 0 };
    this.t = Math.random() * 10;
    this.phase = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  // smoothly blend pose values (keys of this.act)
  pose(target, dur = 0.2, easing = ease.inOut) {
    const from = {};
    for (const k in target) from[k] = this.act[k];
    return tween(dur, kk => { for (const k in target) this.act[k] = from[k] + (target[k] - from[k]) * kk; }, easing);
  }
  rest(dur = 0.25) {
    const z = {}; for (const k in this.act) z[k] = 0;
    return this.pose(z, dur);
  }

  setFlash(color, amount) {
    for (const m of this.flashMats) { m.emissive.setHex(color); m.emissiveIntensity = amount; }
  }

  setOpacity(o) {
    for (const m of this.allMats) { m.transparent = o < 1; m.opacity = o; m.depthWrite = o > 0.5; }
  }

  trigger() {}

  _updateCommon(dt, fx) {
    this.t += dt;
    if (this.aura) { this.aura.rotation.z += dt * 0.6; }
    if (!fx || this.dead || !this.root.visible) return;
    for (const e of this.emitters) {
      e.acc = (e.acc || 0) + dt * e.rate;
      if (e.acc < 1) continue;
      const n = Math.floor(e.acc); e.acc -= n;
      const p = new THREE.Vector3(); e.obj.getWorldPosition(p);
      if (e.kind === 'flame') fx.emit({ pos: p, count: n, colors: [e.color, 0xffd27a], speed: [0.1, 0.5], up: 1.4, life: [0.25, 0.55], size: [0.15, 0.3], spread: 0.06, drag: 1 });
      else if (e.kind === 'aura') fx.emit({ pos: p, count: n, colors: [e.color, 0xffffff], speed: [0.05, 0.2], up: 1.2, life: [0.6, 1.3], size: [0.06, 0.14], ring: 0.7, spread: 0.1, drag: 0.5 });
      else fx.emit({ pos: p, count: n, colors: [e.color, 0xffffff], speed: [0.2, 0.9], up: 0.3, life: [0.2, 0.5], size: [0.08, 0.18], spread: 0.08 });
    }
  }
}

// ---------------------------------------------------------------------------
// procedural hero
// ---------------------------------------------------------------------------
function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.6, metalness: o.m ?? 0.1, flatShading: o.flat ?? true,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide,
  });
}

class ProceduralHero extends HeroBase {
  constructor(nft) {
    super();
    const fac = nft.faction, cls = nft.cls, P = PALETTE[fac], rar = RARITIES[nft.rarity];
    const theme = this.theme = THEME[`${fac}-${cls}`];
    const orc = fac === 'orc';
    const W = orc ? 1.14 : 1.0;
    const robe = cls === 'mage' || cls === 'priest';
    const heavy = cls === 'warrior' || (orc && cls === 'priest');
    this.cls = cls; this.faction = fac;

    const M = (color, o = {}) => { const m = std(color, o); this.allMats.push(m); if (!o.e) this.flashMats.push(m); return m; };
    const skin = M(P.skin, { r: 0.75 });
    const armor = M(P.armor, { m: P.armorM, r: P.armorR });
    const trim = M(P.trim, { m: 0.85, r: 0.28 });
    const dark = M(P.dark, { r: 0.85 });
    const metal = M(P.metal, { m: 0.9, r: 0.25 });
    const cloth = M(P.cloth[cls], { r: 0.9, side: THREE.DoubleSide });
    const hair = M(P.hair, { r: 0.8 });
    const bone = M(0xe6dcc4, { r: 0.6 });
    const glow = M(theme, { e: theme, ei: 2.4 });
    const gem = M(rar.hex, { e: rar.hex, ei: 1.8 });
    const eyeCol = orc ? (cls === 'mage' ? 0xc07bff : cls === 'priest' ? 0x6fe7ff : 0xffa133) : 0x2a1d16;
    const eyeMat = orc ? M(eyeCol, { e: eyeCol, ei: 3 }) : M(eyeCol, { r: 0.4 });

    const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
      m.castShadow = true; parent.add(m); return m;
    };
    const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    const body = this.body;
    const hips = grp(body, 0, 0.95, 0);

    // legs
    const legs = [];
    for (const side of [1, -1]) {
      const leg = grp(hips, 0.19 * side * W, 0, 0);
      add(leg, new THREE.CapsuleGeometry(0.13 * W, 0.28, 4, 8), robe ? dark : cloth, 0, -0.24, 0);
      add(leg, new THREE.CylinderGeometry(0.15 * W, 0.13 * W, 0.42, 8), armor, 0, -0.66, 0);
      add(leg, new THREE.BoxGeometry(0.23 * W, 0.13, 0.38), armor, 0, -0.89, 0.06);
      if (heavy) add(leg, new THREE.SphereGeometry(0.1, 8, 6), trim, 0, -0.46, 0.1);
      legs.push(leg);
    }
    this.legL = legs[0]; this.legR = legs[1];

    if (robe) {
      add(hips, new THREE.CylinderGeometry(0.34 * W, 0.64 * W, 1.0, 12, 1, true), cloth, 0, -0.46, 0);
      add(hips, new THREE.BoxGeometry(0.16, 0.98, 0.04), trim, 0, -0.46, 0.5 * W, -0.27);
    } else {
      add(hips, new THREE.CylinderGeometry(0.33 * W, 0.44 * W, 0.34, 10, 1, true), cls === 'rogue' ? dark : armor, 0, -0.12, 0);
    }

    const torso = this.torso = grp(hips, 0, 0.02, 0);
    add(torso, new THREE.CylinderGeometry(0.4 * W, 0.31 * W, 0.74, 10), cls === 'rogue' ? cloth : armor, 0, 0.4, 0);
    add(torso, new THREE.TorusGeometry(0.33 * W, 0.06, 6, 16), trim, 0, 0.05, 0, Math.PI / 2);
    add(torso, new THREE.BoxGeometry(0.6 * W, 0.42, 0.16), cls === 'rogue' ? dark : armor, 0, 0.5, 0.27 * W, -0.12);
    add(torso, new THREE.OctahedronGeometry(0.085, 0), gem, 0, 0.5, 0.37 * W);
    if (!robe && cls !== 'rogue') add(torso, new THREE.PlaneGeometry(0.32 * W, 0.6), cloth, 0, -0.27, 0.42 * W, -0.1);

    // pauldrons
    const pr = (heavy ? 0.3 : cls === 'rogue' ? 0.2 : 0.24) * W;
    for (const side of [1, -1]) {
      add(torso, new THREE.SphereGeometry(pr, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), cls === 'rogue' ? dark : armor,
        0.47 * W * side, 0.7, 0, 0, 0, -0.38 * side, 1.15, 0.85, 1.1);
      if (heavy && orc) {
        for (let i = 0; i < 3; i++) add(torso, new THREE.ConeGeometry(0.05, 0.28, 5), bone, (0.47 + 0.02 * i) * W * side, 0.86, -0.12 + i * 0.12, 0, 0, -0.5 * side);
      } else if (heavy) {
        add(torso, new THREE.TorusGeometry(pr * 0.98, 0.025, 4, 16), trim, 0.47 * W * side, 0.7, 0, Math.PI / 2, 0.38 * side, 0, 1.15, 1.1, 1);
      }
    }

    // arms
    const arms = [];
    for (const side of [1, -1]) {
      const arm = grp(torso, 0.52 * W * side, 0.64, 0);
      add(arm, new THREE.CapsuleGeometry(0.1 * W, 0.26, 4, 8), robe || cls === 'rogue' ? cloth : dark, 0, -0.19, 0);
      const elbow = grp(arm, 0, -0.4, 0);
      add(elbow, new THREE.CylinderGeometry(0.13 * W, 0.105 * W, 0.34, 8), armor, 0, -0.16, 0);
      add(elbow, new THREE.SphereGeometry(0.105 * W, 8, 6), heavy ? armor : skin, 0, -0.38, 0);
      const socket = grp(elbow, 0, -0.4, 0);
      arms.push({ arm, elbow, socket });
    }
    this.armL = arms[0].arm; this.elbowL = arms[0].elbow;
    this.armR = arms[1].arm; this.elbowR = arms[1].elbow;

    // head
    const head = this.head = grp(torso, 0, 0.86, 0);
    add(head, new THREE.IcosahedronGeometry(0.31, 1), skin, 0, 0.22, 0.02, 0, 0, 0, orc ? 1.12 : 1, orc ? 0.97 : 1.05, 1);
    for (const side of [1, -1]) add(head, new THREE.SphereGeometry(0.045, 6, 6), eyeMat, 0.11 * side, 0.25, 0.285);
    if (orc) {
      add(head, new THREE.BoxGeometry(0.42, 0.16, 0.26), skin, 0, 0.07, 0.13);
      for (const side of [1, -1]) {
        add(head, new THREE.ConeGeometry(0.035, 0.14, 5), bone, 0.13 * side, 0.17, 0.27, 0.15, 0, -0.1 * side);
        add(head, new THREE.ConeGeometry(0.06, 0.24, 5), skin, 0.36 * side, 0.27, -0.02, 0, 0, -1.35 * side);
      }
    } else {
      add(head, new THREE.BoxGeometry(0.06, 0.09, 0.07), skin, 0, 0.18, 0.32);
    }

    // class headgear
    if (cls === 'warrior') {
      add(head, new THREE.CylinderGeometry(0.35, 0.33, 0.38, 12), armor, 0, 0.27, 0, 0, 0, 0, orc ? 1.1 : 1, 1, 1);
      add(head, new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), armor, 0, 0.45, 0, 0, 0, 0, orc ? 1.1 : 1, 0.9, 1);
      add(head, new THREE.BoxGeometry(0.32, 0.05, 0.06), orc ? eyeMat : dark, 0, 0.27, 0.335);
      add(head, new THREE.BoxGeometry(0.05, 0.3, 0.06), dark, 0, 0.16, 0.335);
      if (orc) {
        for (const side of [1, -1]) {
          add(head, new THREE.ConeGeometry(0.09, 0.5, 7), bone, 0.42 * side, 0.6, 0, 0, 0, -1.0 * side);
          add(head, new THREE.ConeGeometry(0.05, 0.3, 6), bone, 0.62 * side, 0.85, 0, 0, 0, -0.2 * side);
        }
      } else {
        add(head, new THREE.BoxGeometry(0.07, 0.22, 0.55), cloth, 0, 0.8, -0.03);
        add(head, new THREE.TorusGeometry(0.35, 0.03, 4, 20), trim, 0, 0.3, 0, Math.PI / 2);
      }
    } else if (cls === 'rogue') {
      add(head, new THREE.SphereGeometry(0.39, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth, 0, 0.25, -0.03, -0.35);
      add(head, new THREE.ConeGeometry(0.17, 0.4, 6), cloth, 0, 0.36, -0.33, -1.15);
      add(head, new THREE.BoxGeometry(0.44, 0.15, 0.22), dark, 0, 0.15, 0.19);
      const scarf = add(torso, new THREE.PlaneGeometry(0.22, 0.7), cloth, 0.08, 0.55, -0.32, 0.2, 0, 0.1);
      this.scarf = scarf;
    } else if (cls === 'mage') {
      if (orc) {
        add(head, new THREE.ConeGeometry(0.42, 1.05, 10, 1, true), cloth, 0, 0.75, -0.08, -0.22);
        add(head, new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), cloth, 0, 0.22, -0.02, -0.3);
        add(head, new THREE.TorusGeometry(0.4, 0.03, 4, 20), trim, 0, 0.3, 0, Math.PI / 2 - 0.2);
      } else {
        add(head, new THREE.SphereGeometry(0.335, 12, 8), hair, 0, 0.29, -0.05, 0, 0, 0, 1.05, 1, 1.05);
        add(head, new THREE.BoxGeometry(0.56, 0.85, 0.14), hair, 0, -0.12, -0.24);
        const halo = add(head, new THREE.TorusGeometry(0.47, 0.025, 8, 48), M(0xffd27a, { e: 0xffc65a, ei: 2.5 }), 0, 0.32, -0.24);
        this.halo = halo;
      }
    } else if (cls === 'priest') {
      if (orc) {
        add(head, new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), armor, 0, 0.3, 0, 0, 0, 0, 1.1, 1, 1);
        add(head, new THREE.BoxGeometry(0.34, 0.05, 0.06), eyeMat, 0, 0.27, 0.32);
        for (const side of [1, -1]) {
          add(head, new THREE.ConeGeometry(0.07, 0.38, 6), bone, 0.3 * side, 0.6, 0.12, 0.6, 0, -0.5 * side);
        }
      } else {
        add(head, new THREE.SphereGeometry(0.345, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim, 0, 0.36, 0);
        add(head, new THREE.TorusGeometry(0.34, 0.035, 4, 20), trim, 0, 0.37, 0, Math.PI / 2);
        for (const side of [1, -1]) {
          add(head, new THREE.BoxGeometry(0.035, 0.36, 0.22), trim, 0.34 * side, 0.55, -0.04, 0, 0, -0.45 * side);
          add(head, new THREE.BoxGeometry(0.03, 0.26, 0.18), trim, 0.42 * side, 0.5, -0.06, 0, 0, -0.8 * side);
        }
      }
    }

    // cape
    if (cls !== 'rogue') {
      const cp = this.capePivot = grp(torso, 0, 0.74, -0.31 * W);
      add(cp, new THREE.PlaneGeometry(0.92 * W, robe ? 1.35 : 1.5, 1, 6), cloth, 0, robe ? -0.67 : -0.74, 0);
      cp.rotation.x = 0.12;
    }

    // weapons
    const R = arms[1].socket, L = arms[0].socket;
    this.tip = grp(R, 0, 0, 0);
    if (cls === 'warrior') {
      const w = grp(R); w.rotation.x = -1.14;
      add(w, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), dark, 0, 0, 0);
      add(w, new THREE.SphereGeometry(0.05, 6, 6), trim, 0, 0.17, 0);
      if (orc) {
        add(w, new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), dark, 0, -0.6, 0);
        add(w, new THREE.BoxGeometry(0.6, 0.48, 0.05), metal, 0.22, -1.2, 0);
        add(w, new THREE.BoxGeometry(0.08, 0.48, 0.06), glow, 0.52, -1.2, 0);
        add(w, new THREE.ConeGeometry(0.06, 0.22, 4), metal, 0, -1.45, 0, Math.PI);
        this.tip = grp(w, 0.3, -1.2, 0);
      } else {
        add(w, new THREE.BoxGeometry(0.44, 0.07, 0.1), trim, 0, -0.15, 0);
        add(w, new THREE.BoxGeometry(0.11, 1.15, 0.035), metal, 0, -0.76, 0);
        add(w, new THREE.BoxGeometry(0.035, 1.05, 0.045), glow, 0, -0.73, 0);
        add(w, new THREE.ConeGeometry(0.055, 0.17, 4), metal, 0, -1.42, 0, Math.PI, Math.PI / 4);
        this.tip = grp(w, 0, -1.25, 0);
      }
      // shield on left forearm
      const sh = grp(this.elbowL, 0.17 * W, -0.18, 0.04); sh.rotation.y = -0.5;
      if (orc) {
        add(sh, new THREE.CylinderGeometry(0.46, 0.46, 0.08, 10), armor, 0, 0, 0, 0, 0, Math.PI / 2);
        add(sh, new THREE.TorusGeometry(0.46, 0.04, 4, 20), trim, 0, 0, 0, 0, Math.PI / 2);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          add(sh, new THREE.ConeGeometry(0.05, 0.2, 5), bone, 0.08, Math.sin(a) * 0.28, Math.cos(a) * 0.28, 0, 0, -Math.PI / 2);
        }
        add(sh, new THREE.SphereGeometry(0.09, 8, 6), gem, 0.06, 0, 0);
      } else {
        add(sh, new THREE.CylinderGeometry(0.46, 0.46, 0.07, 6), armor, 0, 0, 0, 0, Math.PI / 6, Math.PI / 2, 1, 1, 1.25);
        add(sh, new THREE.TorusGeometry(0.4, 0.035, 4, 6), trim, 0.04, 0, 0, 0, Math.PI / 2, Math.PI / 6, 1, 1.25, 1);
        add(sh, new THREE.OctahedronGeometry(0.1, 0), gem, 0.07, 0, 0);
      }
    } else if (cls === 'rogue') {
      for (const s of [R, L]) {
        const w = grp(s); w.rotation.x = -0.4;
        if (orc) {
          for (let i = -1; i <= 1; i++) add(w, new THREE.ConeGeometry(0.03, 0.32, 4), glow, 0.06 * i, -0.2, 0.05, 0.3, 0, 0);
          this.emitters.push({ obj: w, color: theme, rate: 14, kind: 'flame' });
        } else {
          add(w, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), dark, 0, 0, 0);
          add(w, new THREE.BoxGeometry(0.2, 0.04, 0.06), trim, 0, -0.1, 0);
          add(w, new THREE.BoxGeometry(0.06, 0.5, 0.02), metal, 0, -0.36, 0);
          add(w, new THREE.BoxGeometry(0.02, 0.46, 0.03), glow, 0, -0.35, 0);
          const tp = grp(w, 0, -0.45, 0);
          this.emitters.push({ obj: tp, color: theme, rate: 10, kind: 'spark' });
        }
      }
      this.tip = grp(R, 0, -0.3, 0.2);
    } else {
      // staff (mage / priest)
      const st = grp(R); st.rotation.set(0.45, 0, 0.3);
      add(st, new THREE.CylinderGeometry(0.04, 0.05, 2.1, 6), cls === 'priest' && !orc ? trim : M(0x4a3020, { r: 0.8 }), 0, 0.5, 0);
      const headY = 1.62;
      const top = grp(st, 0, headY, 0);
      if (cls === 'mage' && !orc) {
        for (const side of [1, -1]) add(top, new THREE.ConeGeometry(0.04, 0.32, 5), trim, 0.09 * side, 0.05, 0, 0, 0, -0.5 * side);
        add(top, new THREE.SphereGeometry(0.12, 10, 8), glow, 0, 0.17, 0);
        this.emitters.push({ obj: top, color: theme, rate: 22, kind: 'flame' });
      } else if (cls === 'mage') {
        add(top, new THREE.OctahedronGeometry(0.18, 0), glow, 0, 0.2, 0, 0, 0, 0, 1, 1.5, 1);
        this.orb = add(top, new THREE.TorusGeometry(0.26, 0.02, 4, 24), glow, 0, 0.2, 0, Math.PI / 2);
        this.emitters.push({ obj: top, color: theme, rate: 12, kind: 'spark' });
      } else if (!orc) {
        add(top, new THREE.SphereGeometry(0.15, 10, 8), trim, 0, 0.05, 0);
        for (let i = 0; i < 4; i++) add(top, new THREE.BoxGeometry(0.03, 0.22, 0.14), trim, 0, 0.05, 0, 0, (i * Math.PI) / 4, 0);
        add(top, new THREE.SphereGeometry(0.08, 8, 6), glow, 0, 0.25, 0);
        this.emitters.push({ obj: top, color: theme, rate: 10, kind: 'spark' });
      } else {
        add(top, new THREE.DodecahedronGeometry(0.17, 0), dark, 0, 0.05, 0);
        add(top, new THREE.OctahedronGeometry(0.11, 0), glow, 0, 0.26, 0, 0, 0, 0, 1, 1.6, 1);
        this.emitters.push({ obj: top, color: theme, rate: 14, kind: 'spark' });
      }
      this.tip = grp(top, 0, 0.2, 0);
    }

    // rarity aura under the feet
    const auraTex = AURA_TEX();
    const op = { common: 0.22, rare: 0.4, epic: 0.5, legendary: 0.65 }[nft.rarity];
    const aura = this.aura = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: auraTex, color: rar.hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; aura.renderOrder = 1;
    this.root.add(aura);
    this.allMats.push(aura.material);
    if (nft.rarity === 'legendary' || nft.rarity === 'epic') {
      const a = grp(this.root, 0, 0.1, 0);
      this.emitters.push({ obj: a, color: rar.hex, rate: nft.rarity === 'legendary' ? 9 : 4, kind: 'aura' });
    }

    // anchors
    this.chest = grp(torso, 0, 0.45, 0.3);
    this.top = grp(head, 0, 0.75, 0);
    this.height = orc ? 2.55 : 2.4;
    if (orc) this.root.scale.setScalar(1.06);

    // base stance per class
    this.base = {
      warrior: { armLX: -0.45, armLZ: 0.25, armRX: -0.35, armRZ: -0.18, elbowL: -1.0, elbowR: -0.6 },
      rogue:   { armLX: -0.3, armLZ: 0.35, armRX: -0.3, armRZ: -0.35, elbowL: -1.2, elbowR: -1.2 },
      mage:    { armLX: -0.35, armLZ: 0.3, armRX: -0.1, armRZ: -0.38, elbowL: -0.9, elbowR: -0.35 },
      priest:  { armLX: -0.35, armLZ: 0.3, armRX: -0.1, armRZ: -0.38, elbowL: -0.9, elbowR: -0.35 },
    }[cls];
  }

  update(dt, fx) {
    this._updateCommon(dt, fx);
    const a = this.act, b = this.base, t = this.t, br = Math.sin(t * 2.2 + this.phase);
    const crouchBase = this.cls === 'rogue' ? 0.12 : 0;
    this.body.position.y = -(a.crouch + crouchBase) * 0.35 + br * 0.02;
    this.torso.rotation.x = a.torsoX + br * 0.015 + crouchBase * 0.6;
    this.torso.rotation.y = a.torsoY + Math.sin(t * 0.9 + this.phase) * 0.04;
    this.head.rotation.y = Math.sin(t * 0.7 + this.phase) * 0.12;
    this.head.rotation.x = a.headX;
    this.armL.rotation.x = b.armLX + a.armLX + br * 0.04; this.armL.rotation.z = b.armLZ + a.armLZ;
    this.armR.rotation.x = b.armRX + a.armRX - br * 0.04; this.armR.rotation.z = b.armRZ + a.armRZ;
    this.elbowL.rotation.x = b.elbowL + a.elbowL; this.elbowR.rotation.x = b.elbowR + a.elbowR;
    this.legL.rotation.x = a.legL - (a.crouch + crouchBase) * 0.4; this.legR.rotation.x = a.legR + (a.crouch + crouchBase) * 0.2;
    if (this.capePivot) this.capePivot.rotation.x = 0.12 + br * 0.04 + Math.sin(t * 1.7) * 0.03 + a.capeX;
    if (this.scarf) this.scarf.rotation.x = 0.25 + Math.sin(t * 2.5 + this.phase) * 0.12;
    if (this.halo) this.halo.rotation.z = t * 0.5;
    if (this.orb) this.orb.rotation.z = t * 2;
  }
}

let _auraTex = null;
function AURA_TEX() {
  if (_auraTex) return _auraTex;
  const S = 256, C = S / 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(C, C, 20, C, C, 120);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.92, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    g.beginPath(); g.arc(C, C, 100, a0 + 0.1, a0 + 0.55); g.stroke();
  }
  _auraTex = new THREE.CanvasTexture(c);
  return _auraTex;
}

function buildProcedural(nft) { return new ProceduralHero(nft); }

// ---------------------------------------------------------------------------
// glTF hero (used automatically when a model is registered in MODEL_LIBRARY)
// ---------------------------------------------------------------------------
class GLTFHero extends HeroBase {
  constructor(nft, gltf) {
    super();
    this.theme = THEME[`${nft.faction}-${nft.cls}`];
    this.cls = nft.cls; this.faction = nft.faction;
    const model = SkeletonUtils.clone(gltf.scene);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(2.4 / Math.max(0.001, size.y));
    const box2 = new THREE.Box3().setFromObject(model), c = box2.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box2.min.y, -c.z);
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.material = o.material.clone();
        this.allMats.push(o.material);
        if (o.material.emissive) this.flashMats.push(o.material);
      }
    });
    this.body.add(model);
    this.mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
    this.clips = {};
    for (const clip of gltf.animations) {
      const n = clip.name.toLowerCase();
      for (const k of ['idle', 'attack', 'cast', 'hit', 'death']) if (n.includes(k) && !this.clips[k]) this.clips[k] = clip;
    }
    if (this.mixer && this.clips.idle) this.mixer.clipAction(this.clips.idle).play();
    const rar = RARITIES[nft.rarity];
    const aura = this.aura = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: AURA_TEX(), color: rar.hex, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; this.root.add(aura);
    const grp = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); this.body.add(g); return g; };
    this.tip = grp(-0.45, 1.5, 0.5); this.chest = grp(0, 1.4, 0.3); this.top = grp(0, 2.55, 0);
    this.height = 2.4;
  }
  trigger(name) {
    if (!this.mixer || !this.clips[name]) return;
    const act = this.mixer.clipAction(this.clips[name]);
    act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = name === 'death'; act.fadeIn(0.1).play();
  }
  update(dt, fx) {
    this._updateCommon(dt, fx);
    if (this.mixer) this.mixer.update(dt);
    const a = this.act, br = Math.sin(this.t * 2.2 + this.phase);
    this.body.position.y = -a.crouch * 0.25 + (this.mixer ? 0 : br * 0.02);
    this.body.rotation.x = a.torsoX * 0.6;
    this.body.rotation.y = a.torsoY * 0.6;
  }
}

function buildFromGLTF(nft, gltf) { return new GLTFHero(nft, gltf); }
