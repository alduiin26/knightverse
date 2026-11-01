// KnightVerse Arena - boss models
// Built-in procedural bosses. When a .glb is registered in MODEL_LIBRARY (hero.js) under
// 'boss-spider' / 'boss-troll' / 'boss-ultima' / 'boss-dragon', that model is used instead.
import * as THREE from 'three';
import { HeroBase, GLTFHero, std, getModel, MODEL_SETTINGS } from './hero.js';

const BOSS_ACT = () => ({
  lunge: 0, rear: 0, jaw: 0, slam: 0, spread: 0, crouch: 0, torsoX: 0, torsoY: 0, headX: 0,
  armRX: 0, armRZ: 0, armLX: 0, armLZ: 0, elbowR: 0, elbowL: 0, tail: 0, neck: 0,
});

// radius: how far heroes stop in front of the boss; hpY: where the floating numbers appear
export const BOSS_BODY = {
  spider: { radius: 3.3 }, troll: { radius: 2.7 }, ultima: { radius: 2.8 }, dragon: { radius: 3.6 },
};

export function buildBoss(boss) {
  const key = boss.model;
  const gltf = getModel(key);
  let b;
  if (gltf) {
    b = new GLTFHero(null, gltf, { key, theme: boss.color, cls: 'boss', faction: 'boss', rarity: 'legendary' });
    b.act = { ...b.act, ...BOSS_ACT() };
  } else {
    b = new ({ spider: SpiderBoss, troll: TrollBoss, ultima: UltimaBoss, dragon: DragonBoss })[boss.id](boss);
  }
  b.isBoss = true;
  if (!gltf && boss.scale && boss.scale !== 1) { b.root.scale.setScalar(boss.scale); b.height = (b.height || 5) * boss.scale; b.sizeScale = boss.scale; }
  b.radius = BOSS_BODY[boss.id].radius;
  b.height = b.height || (MODEL_SETTINGS[key] || {}).height || 5;
  b.radius *= b.sizeScale || 1;
  return b;
}

class ProceduralBoss extends HeroBase {
  constructor(boss) {
    super();
    this.act = BOSS_ACT();
    this.theme = boss.color;
    this.cls = 'boss'; this.faction = 'boss';
    this.parts = {};
  }
  M(color, o = {}) { const m = std(color, o); this.allMats.push(m); if (!o.e) this.flashMats.push(m); return m; }
  add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
    m.castShadow = true; parent.add(m); return m;
  }
  grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  // cylinder from local origin along +x (used for limbs)
  limbX(parent, len, r0, r1, mat) { return this.add(parent, new THREE.CylinderGeometry(r1, r0, len, 8), mat, len / 2, 0, 0, 0, 0, -Math.PI / 2); }
  limbY(parent, len, r0, r1, mat) { return this.add(parent, new THREE.CylinderGeometry(r1, r0, len, 8), mat, 0, -len / 2, 0); }
  // simple ground glow
  groundGlow(color, size) {
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
    })();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.04; this.root.add(m); this.allMats.push(m.material);
    this.aura = m;
    return m;
  }
}

// ============================================================================ SPIDER
class SpiderBoss extends ProceduralBoss {
  constructor(boss) {
    super(boss);
    const shell = this.M(0x22301e, { r: 0.4, m: 0.35 }), dark = this.M(0x1a2216, { r: 0.7 });
    const hair = this.M(0x3e5232, { r: 0.85 }), plate = this.M(0x46603a, { r: 0.45, m: 0.3 });
    const glow = this.M(0x9dff5a, { e: 0x5dff2a, ei: 2.4 }), eye = this.M(0xff3020, { e: 0xff1a10, ei: 3.2 });
    const fangM = this.M(0xe9dcc0, { r: 0.35 });
    const body = this.bodyG = this.grp(this.body, 0, 1.75, 0);
    // abdomen
    const ab = this.abdomen = this.grp(body, 0, 0.35, -1.75);
    this.add(ab, new THREE.SphereGeometry(1.55, 18, 14), shell, 0, 0, 0, 0, 0, 0, 1.12, 0.95, 1.3);
    for (let i = 0; i < 14; i++) {
      const u = (i % 7) / 6, v = Math.floor(i / 7);
      const a = -1.0 + u * 2.0, el = 0.55 + v * 0.45;
      const x = Math.sin(a) * Math.cos(el) * 1.55 * 1.12, y = Math.sin(el) * 1.55 * 0.95, z = Math.cos(a) * Math.cos(el) * 1.55 * 1.3 - 0.4 * v - 0.3;
      this.add(ab, new THREE.SphereGeometry(0.2 + (v ? 0.04 : 0.07), 10, 8), glow, x * 0.98, y * 0.98, z * 0.6 - 0.2, 0, 0, 0, 1.4, 0.7, 1.1);
    }
    for (const sx of [-0.55, 0.55]) this.add(ab, new THREE.SphereGeometry(0.42, 12, 10), glow, sx, -0.75, -0.55);
    this.add(ab, new THREE.ConeGeometry(0.25, 0.6, 8), dark, 0, -0.2, -2.0, -1.9);
    // cephalothorax + head
    this.add(body, new THREE.SphereGeometry(0.95, 16, 12), plate, 0, 0, 0.35, 0, 0, 0, 1.15, 0.8, 1.1);
    for (let i = 0; i < 6; i++) this.add(body, new THREE.ConeGeometry(0.09, 0.42, 5), dark, (i % 3 - 1) * 0.32, 0.72, 0.1 + Math.floor(i / 3) * 0.4, -0.35);
    const head = this.head = this.grp(body, 0, 0.05, 1.25);
    this.add(head, new THREE.SphereGeometry(0.62, 14, 10), shell, 0, 0, 0, 0, 0, 0, 1.1, 0.9, 1);
    const eyes = [[-0.22, 0.28], [0.22, 0.28], [-0.1, 0.38], [0.1, 0.38], [-0.36, 0.14], [0.36, 0.14], [-0.14, 0.18], [0.14, 0.18]];
    for (const [x, y] of eyes) this.add(head, new THREE.SphereGeometry(Math.abs(x) < 0.2 ? 0.09 : 0.07, 8, 6), eye, x, y, 0.55);
    this.fangs = [];
    for (const s of [1, -1]) {
      const f = this.grp(head, 0.2 * s, -0.25, 0.45);
      this.add(f, new THREE.ConeGeometry(0.11, 0.7, 6), fangM, 0, -0.3, 0.1, 0.35, 0, 0);
      this.fangs.push({ g: f, s });
    }
    this.add(head, new THREE.SphereGeometry(0.06, 6, 6), glow, 0, -0.62, 0.62);
    // legs
    this.legs = [];
    const devs = [-0.75, -0.25, 0.22, 0.7];
    for (const side of [1, -1]) {
      devs.forEach((d, i) => {
        const hip = this.grp(body, 0.55 * side, -0.05, 0.55 - i * 0.32);
        hip.rotation.y = side > 0 ? d : Math.PI - d;
        const th = this.grp(hip); th.rotation.z = 0.8;
        this.limbX(th, 2.0, 0.26, 0.19, hair);
        for (let k = 0; k < 3; k++) this.add(th, new THREE.ConeGeometry(0.04, 0.22, 4), dark, 0.5 + k * 0.5, 0.15, 0, 0, 0, -0.3);
        const knee = this.grp(th, 2.0, 0, 0); knee.rotation.z = -2.1;
        this.add(knee, new THREE.SphereGeometry(0.22, 8, 6), plate);
        this.limbX(knee, 3.0, 0.19, 0.05, dark);
        this.add(knee, new THREE.TorusGeometry(0.2, 0.05, 5, 10), glow, 1.2, 0, 0, 0, Math.PI / 2, 0);
        this.legs.push({ th, knee, side, i, ph: i * 1.3 + (side > 0 ? 0 : 0.7) });
      });
    }
    this.groundGlow(0x6dff4a, 7);
    this.chest = this.grp(head, 0, 0, 0.6);
    this.tip = this.grp(head, 0, -0.45, 0.75);
    this.top = this.grp(body, 0, 2.0, 0);
    this.emitters.push({ obj: this.grp(ab, 0, -0.9, -0.4), color: 0x7dff4a, rate: 6, kind: 'aura' });
    this.height = 3.6;
  }
  update(dt, fx) {
    this._updateCommon(dt, fx);
    const a = this.act, t = this.t, br = Math.sin(t * 1.8);
    const b = this.bodyG;
    b.position.y = 1.75 - a.crouch * 0.7 + br * 0.04 + a.rear * 0.5;
    b.position.z = a.lunge * 1.4;
    b.rotation.x = -a.rear * 0.45 + a.lunge * 0.18 + a.torsoX * 0.3;
    b.rotation.y = a.torsoY * 0.4;
    this.abdomen.rotation.x = Math.sin(t * 1.3) * 0.04 + a.rear * 0.25;
    this.head.rotation.x = a.headX * 0.5 + Math.sin(t * 0.9) * 0.05;
    for (const f of this.fangs) f.g.rotation.z = f.s * (0.15 + a.jaw * 0.6 + Math.max(0, Math.sin(t * 3)) * 0.05);
    for (const L of this.legs) {
      const front = L.i < 2 ? 1 : 0;
      L.th.rotation.z = 0.8 + Math.sin(t * 2.4 + L.ph) * 0.05 + a.rear * front * (L.i === 0 ? 0.9 : 0.4) + a.crouch * 0.25;
      L.knee.rotation.z = -2.1 + Math.sin(t * 2.4 + L.ph + 1) * 0.04 - a.rear * front * 0.3;
    }
  }
}

// ============================================================================ HUMANOID BRUTES
class BruteBoss extends ProceduralBoss {
  // shared frame for the Troll King and Mor Ultima
  frame({ skin, hipY, W, legLen, armLen, torsoMat, limbMat, handMat }) {
    const hips = this.hips = this.grp(this.body, 0, hipY, 0);
    this.legsG = [];
    for (const s of [1, -1]) {
      const leg = this.grp(hips, 0.55 * W * s, 0, 0);
      this.add(leg, new THREE.CapsuleGeometry(0.36 * W, legLen * 0.45, 4, 10), limbMat, 0, -legLen * 0.28, 0);
      const knee = this.grp(leg, 0, -legLen * 0.55, 0);
      this.add(knee, new THREE.CapsuleGeometry(0.3 * W, legLen * 0.35, 4, 10), limbMat, 0, -legLen * 0.22, 0.02);
      this.add(knee, new THREE.BoxGeometry(0.62 * W, 0.28, 0.95), handMat, 0, -legLen * 0.45 + 0.02, 0.18);
      this.legsG.push({ leg, knee, s });
    }
    const torso = this.torso = this.grp(hips, 0, 0.05, 0);
    this.arms = [];
    for (const s of [1, -1]) {
      const arm = this.grp(torso, 1.05 * W * s, 1.6, 0);
      this.add(arm, new THREE.CapsuleGeometry(0.33 * W, armLen * 0.38, 4, 10), limbMat, 0, -armLen * 0.25, 0);
      const elbow = this.grp(arm, 0, -armLen * 0.5, 0);
      this.add(elbow, new THREE.CapsuleGeometry(0.3 * W, armLen * 0.33, 4, 10), limbMat, 0, -armLen * 0.22, 0);
      const hand = this.grp(elbow, 0, -armLen * 0.5, 0);
      this.add(hand, new THREE.SphereGeometry(0.33 * W, 10, 8), handMat, 0, -0.1, 0);
      this.arms.push({ arm, elbow, hand, s });
    }
    const head = this.head = this.grp(torso, 0, 2.15, 0.15);
    return { hips, torso, head };
  }
  update(dt, fx) {
    this._updateCommon(dt, fx);
    const a = this.act, b = this.base, t = this.t, br = Math.sin(t * 1.6 + this.phase);
    this.body.position.y = -a.crouch * 0.6 + br * 0.04;
    this.body.position.z = a.lunge * 1.6;
    this.torso.rotation.x = a.torsoX + br * 0.02 + a.lunge * 0.35 - a.rear * 0.25 + a.slam * 0.45;
    this.torso.rotation.y = a.torsoY + Math.sin(t * 0.7) * 0.04;
    this.head.rotation.x = a.headX - a.jaw * 0.25;
    const [R, L] = this.arms[0].s > 0 ? [this.arms[1], this.arms[0]] : [this.arms[0], this.arms[1]];
    R.arm.rotation.x = b.armRX + a.armRX - br * 0.04; R.arm.rotation.z = b.armRZ + a.armRZ;
    L.arm.rotation.x = b.armLX + a.armLX + br * 0.04; L.arm.rotation.z = b.armLZ + a.armLZ;
    R.elbow.rotation.x = b.elbowR + a.elbowR; L.elbow.rotation.x = b.elbowL + a.elbowL;
    for (const g of this.legsG) { g.leg.rotation.x = -a.crouch * 0.5 * (g.s > 0 ? 1 : 0.6); g.knee.rotation.x = a.crouch * 0.7; }
    if (this.jawM) this.jawM.rotation.x = 0.1 + a.jaw * 0.5;
    if (this.shards) this.shards.rotation.y = t * 0.5;
    if (this.crown) this.crown.rotation.y = Math.sin(t * 0.5) * 0.02;
  }
}

class TrollBoss extends BruteBoss {
  constructor(boss) {
    super(boss);
    const skin = this.M(0x5f7a3a, { r: 0.8 }), skinD = this.M(0x4d6530, { r: 0.85 });
    const leather = this.M(0x4a3020, { r: 0.85 }), gold = this.M(0xd8a83a, { m: 0.85, r: 0.3 });
    const metal = this.M(0x3a3a40, { m: 0.8, r: 0.35 }), bone = this.M(0xe6dcc4, { r: 0.5 });
    const wood = this.M(0x5a3a22, { r: 0.9 }), cloth = this.M(0x7a1c1c, { r: 0.9, side: THREE.DoubleSide });
    const eye = this.M(0xff2a1a, { e: 0xff2010, ei: 3 }), scar = this.M(0x8a2a24, { r: 0.8 });
    const { hips, torso, head } = this.frame({ skin, hipY: 2.0, W: 1.0, legLen: 2.0, armLen: 2.6, torsoMat: skin, limbMat: skin, handMat: skinD });
    // belly, chest, belt, loincloth
    this.add(torso, new THREE.SphereGeometry(1.25, 18, 14), skin, 0, 0.75, 0.15, 0, 0, 0, 1.1, 0.95, 0.95);
    this.add(torso, new THREE.SphereGeometry(1.1, 16, 12), skin, 0, 1.55, 0, 0, 0, 0, 1.25, 0.8, 0.85);
    this.add(torso, new THREE.TorusGeometry(1.12, 0.13, 6, 24), leather, 0, 0.3, 0.05, Math.PI / 2);
    this.add(torso, new THREE.BoxGeometry(0.55, 0.42, 0.14), gold, 0, 0.3, 1.15);
    this.add(hips, new THREE.PlaneGeometry(1.2, 1.3), cloth, 0, -0.55, 1.05, -0.12);
    this.add(hips, new THREE.PlaneGeometry(1.0, 1.1), cloth, 0, -0.5, -1.0, 0.12);
    this.add(torso, new THREE.BoxGeometry(0.22, 2.6, 0.12), leather, 0.1, 1.35, 1.0, -0.12, 0, 0.65);
    for (let i = 0; i < 3; i++) this.add(torso, new THREE.BoxGeometry(0.6, 0.06, 0.05), scar, 0.65 + i * 0.12, 1.75 - i * 0.18, 0.92, 0, 0, 0.5);
    // shoulders
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) this.add(torso, new THREE.ConeGeometry(0.1, 0.45, 5), metal, (1.05 + 0.05 * i) * s, 1.95 + (i % 2) * 0.1, -0.35 + i * 0.25, 0, 0, -0.5 * s);
    }
    // head
    this.add(head, new THREE.SphereGeometry(0.62, 14, 12), skin, 0, 0.3, 0, 0, 0, 0, 1.12, 1.0, 1.0);
    this.add(head, new THREE.BoxGeometry(0.75, 0.25, 0.3), skinD, 0, 0.42, 0.5); // brow
    for (const s of [1, -1]) {
      this.add(head, new THREE.SphereGeometry(0.075, 8, 6), eye, 0.2 * s, 0.32, 0.6);
      this.add(head, new THREE.ConeGeometry(0.12, 0.55, 6), skin, 0.68 * s, 0.4, -0.05, 0, 0, -1.3 * s);
      this.add(head, new THREE.TorusGeometry(0.08, 0.02, 4, 10), gold, 0.82 * s, 0.32, 0, 0, Math.PI / 2, 0);
    }
    const jaw = this.jawM = this.grp(head, 0, 0.08, 0.2);
    this.add(jaw, new THREE.BoxGeometry(0.8, 0.3, 0.6), skin, 0, -0.08, 0.15);
    for (const s of [1, -1]) this.add(jaw, new THREE.ConeGeometry(0.08, 0.42, 6), bone, 0.27 * s, 0.18, 0.4, 0.2, 0, -0.25 * s);
    const crown = this.crown = this.grp(head, 0, 0.82, 0);
    this.add(crown, new THREE.CylinderGeometry(0.52, 0.56, 0.22, 14, 1, true), gold, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.add(crown, new THREE.ConeGeometry(0.09, i === 0 ? 0.55 : 0.35, 5), gold, Math.sin(a) * 0.52, 0.22 + (i === 0 ? 0.1 : 0), Math.cos(a) * 0.52);
    }
    this.add(crown, new THREE.OctahedronGeometry(0.09, 0), eye, 0, 0.05, 0.56);
    // bracers
    for (const A of this.arms) {
      this.add(A.elbow, new THREE.CylinderGeometry(0.4, 0.36, 0.55, 10), metal, 0, -0.6, 0);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; this.add(A.elbow, new THREE.ConeGeometry(0.06, 0.3, 5), bone, Math.sin(a) * 0.42, -0.6, Math.cos(a) * 0.42, Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57); }
    }
    // spiked club in the right hand
    const R = this.arms.find(a => a.s < 0) || this.arms[1];
    const club = this.grp(R.hand, 0, -0.1, 0); club.rotation.x = -1.35;
    this.add(club, new THREE.CylinderGeometry(0.13, 0.13, 1.0, 8), leather, 0, -0.1, 0);
    this.add(club, new THREE.CylinderGeometry(0.45, 0.2, 2.4, 10), wood, 0, -1.7, 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 7) * Math.PI * 2 + (i > 6 ? 0.4 : 0), y = -1.6 - (i > 6 ? 0.7 : 0) - (i % 3) * 0.12;
      const r = 0.36 + (i > 6 ? 0.08 : 0);
      this.add(club, new THREE.ConeGeometry(0.07, 0.35, 5), metal, Math.sin(a) * r, y, Math.cos(a) * r, Math.cos(a) * 1.57, 0, -Math.sin(a) * 1.57);
    }
    this.add(club, new THREE.TorusGeometry(0.33, 0.05, 5, 14), leather, 0, -1.2, 0, Math.PI / 2);
    this.tip = this.grp(club, 0, -2.6, 0);
    this.base = { armRX: -0.35, armRZ: -0.2, armLX: -0.15, armLZ: 0.25, elbowR: -0.5, elbowL: -0.3 };
    this.groundGlow(0xffb347, 6);
    this.chest = this.grp(torso, 0, 1.3, 1.0);
    this.top = this.grp(head, 0, 1.3, 0);
    this.height = 5.6;
  }
}

class UltimaBoss extends BruteBoss {
  constructor(boss) {
    super(boss);
    const stone = this.M(0x1c1922, { r: 0.55, m: 0.25 }), stoneL = this.M(0x2a2532, { r: 0.6, m: 0.2 });
    const vio = this.M(0xc05cff, { e: 0xb040ff, ei: 2.6 }), green = this.M(0x6dffb0, { e: 0x3dff9a, ei: 2.2 });
    const { hips, torso, head } = this.frame({ hipY: 2.2, W: 1.05, legLen: 2.2, armLen: 2.7, torsoMat: stone, limbMat: stone, handMat: stoneL });
    this.add(torso, new THREE.CylinderGeometry(1.35, 0.85, 2.3, 7), stone, 0, 1.15, 0, 0, 0, 0, 1, 1, 0.75);
    this.add(torso, new THREE.OctahedronGeometry(0.32, 0), vio, 0, 1.45, 0.72);
    // glowing cracks
    const crack = (parent, x, y, z, rz, len = 0.8) => this.add(parent, new THREE.BoxGeometry(0.06, len, 0.05), vio, x, y, z, 0, 0, rz);
    [[0.35, 1.0, 0.72, 0.5], [-0.35, 1.0, 0.72, -0.5], [0.55, 1.75, 0.66, -0.9], [-0.55, 1.75, 0.66, 0.9], [0, 0.55, 0.62, 0, 0.6]].forEach(c => crack(torso, ...c));
    for (const s of [1, -1]) {
      // spiked shoulders
      for (let i = 0; i < 3; i++) this.add(torso, new THREE.ConeGeometry(0.28 - i * 0.06, 1.4 - i * 0.3, 5), stoneL, (1.25 + i * 0.12) * s, 2.35 + i * 0.1, -0.2 + i * 0.25, -0.3, 0, -0.55 * s);
      this.add(torso, new THREE.OctahedronGeometry(0.16, 0), vio, 1.3 * s, 2.3, 0.2);
    }
    for (const A of this.arms) {
      crack(A.arm, 0.2, -0.6, 0.25, 0.3); crack(A.elbow, -0.15, -0.5, 0.25, -0.3);
      for (let i = 0; i < 3; i++) this.add(A.elbow, new THREE.ConeGeometry(0.11, 0.6, 5), stoneL, 0.3 * A.s, -0.3 - i * 0.35, -0.2, 0, 0, -1.0 * A.s);
      for (let i = 0; i < 4; i++) this.add(A.hand, new THREE.ConeGeometry(0.07, 0.6, 5), stoneL, (i - 1.5) * 0.14, -0.45, 0.12, Math.PI + 0.3, 0, 0);
    }
    for (const g of this.legsG) { crack(g.leg, 0.2, -0.8, 0.35, 0.4); this.add(g.knee, new THREE.ConeGeometry(0.15, 0.7, 5), stoneL, 0, 0.1, 0.35, 0.9, 0, 0); }
    // head
    this.add(head, new THREE.DodecahedronGeometry(0.62, 0), stone, 0, 0.3, 0, 0, 0, 0, 1, 1.15, 0.9);
    this.add(head, new THREE.ConeGeometry(0.35, 1.0, 5), stoneL, 0, 1.0, -0.1, -0.2);
    for (const s of [1, -1]) {
      this.add(head, new THREE.ConeGeometry(0.15, 0.9, 5), stoneL, 0.5 * s, 0.85, -0.05, 0, 0, -0.5 * s);
      this.add(head, new THREE.BoxGeometry(0.2, 0.07, 0.05), vio, 0.2 * s, 0.38, 0.55, 0, 0, -0.25 * s);
    }
    const jaw = this.jawM = this.grp(head, 0, 0.05, 0.3);
    this.add(jaw, new THREE.BoxGeometry(0.5, 0.06, 0.06), vio, 0, 0, 0.25);
    for (let i = 0; i < 5; i++) this.add(jaw, new THREE.ConeGeometry(0.04, 0.14, 4), vio, (i - 2) * 0.1, 0.05, 0.27, Math.PI);
    // orbiting shards
    const sh = this.shards = this.grp(this.body, 0, 3.2, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.add(sh, new THREE.OctahedronGeometry(0.18 + (i % 3) * 0.06, 0), i % 2 ? vio : green, Math.sin(a) * 2.6, Math.sin(i * 1.7) * 0.9, Math.cos(a) * 2.6, 0, 0, 0, 1, 1.8, 1);
    }
    this.emitters.push({ obj: this.grp(torso, 0, 1.45, 0.75), color: 0xc05cff, rate: 10, kind: 'aura' });
    this.emitters.push({ obj: this.grp(head, 0, 0.4, 0.6), color: 0xc05cff, rate: 8, kind: 'spark' });
    this.base = { armRX: -0.25, armRZ: -0.3, armLX: -0.25, armLZ: 0.3, elbowR: -0.45, elbowL: -0.45 };
    this.groundGlow(0xb040ff, 7);
    const R = this.arms.find(a => a.s < 0) || this.arms[1];
    this.tip = this.grp(R.hand, 0, -0.5, 0.2);
    this.chest = this.grp(torso, 0, 1.4, 0.9);
    this.top = this.grp(head, 0, 1.6, 0);
    this.height = 6.0;
  }
}

// ============================================================================ DRAGON
class DragonBoss extends ProceduralBoss {
  constructor(boss) {
    super(boss);
    const scale = this.M(0x8e1c12, { r: 0.55, m: 0.25 }), scaleD = this.M(0x5a0f0a, { r: 0.6, m: 0.2 });
    const belly = this.M(0xd8823a, { r: 0.7 }), horn = this.M(0x2a1a14, { r: 0.5 });
    const glow = this.M(0xffa040, { e: 0xff6a1a, ei: 2.2 }), eye = this.M(0xffd040, { e: 0xffb020, ei: 3.5 });
    const mem = this.M(0xa8281a, { r: 0.8, side: THREE.DoubleSide });
    const body = this.bodyG = this.grp(this.body, 0, 2.35, 0);
    this.add(body, new THREE.CapsuleGeometry(1.05, 2.4, 6, 14), scale, 0, 0, 0, Math.PI / 2, 0, 0, 1.05, 1, 0.95);
    this.add(body, new THREE.CapsuleGeometry(0.8, 2.0, 6, 12), belly, 0, -0.42, 0.1, Math.PI / 2, 0, 0, 1, 1, 0.75);
    this.add(body, new THREE.SphereGeometry(1.1, 14, 12), scale, 0, 0.15, 1.2, 0, 0, 0, 1.0, 1.0, 0.9);
    for (let i = 0; i < 7; i++) this.add(body, new THREE.ConeGeometry(0.16, 0.6, 5), horn, 0, 1.0 - Math.abs(i - 3) * 0.04, 1.6 - i * 0.5, -0.4);
    // legs
    this.legsG = [];
    for (const [z, y] of [[1.2, -0.3], [-1.1, -0.2]]) {
      for (const s of [1, -1]) {
        const leg = this.grp(body, 0.95 * s, y, z);
        this.add(leg, new THREE.CapsuleGeometry(0.38, 0.9, 4, 10), scale, 0, -0.55, 0.1, 0.25, 0, 0);
        const shin = this.grp(leg, 0, -1.15, 0.25);
        this.add(shin, new THREE.CapsuleGeometry(0.25, 0.7, 4, 8), scaleD, 0, -0.35, -0.05, -0.2, 0, 0);
        for (let k = -1; k <= 1; k++) this.add(shin, new THREE.ConeGeometry(0.07, 0.4, 5), horn, k * 0.16, -0.75, 0.3, 1.5);
        this.legsG.push({ leg, s, front: z > 0 });
      }
    }
    // neck + head
    let n = this.neckBase = this.grp(body, 0, 0.55, 1.8);
    this.neck = [];
    for (let i = 0; i < 4; i++) {
      const seg = this.grp(n, 0, 0, i === 0 ? 0 : 0.62); seg.rotation.x = -0.3;
      this.add(seg, new THREE.CylinderGeometry(0.42 - i * 0.04, 0.5 - i * 0.04, 0.8, 10), scale, 0, 0, 0.3, Math.PI / 2);
      this.add(seg, new THREE.ConeGeometry(0.1, 0.42, 5), horn, 0, 0.45, 0.25, -0.5);
      this.neck.push(seg); n = seg;
    }
    const head = this.head = this.grp(n, 0, 0, 0.75); head.rotation.x = 1.0;
    this.add(head, new THREE.BoxGeometry(0.85, 0.6, 1.0), scale, 0, 0.1, 0.2);
    this.add(head, new THREE.BoxGeometry(0.62, 0.36, 0.9), scale, 0, 0.02, 0.95);
    for (const s of [1, -1]) {
      this.add(head, new THREE.SphereGeometry(0.08, 8, 6), eye, 0.33 * s, 0.25, 0.55);
      this.add(head, new THREE.ConeGeometry(0.11, 0.9, 6), horn, 0.3 * s, 0.55, -0.35, -0.9, 0, -0.2 * s);
      this.add(head, new THREE.ConeGeometry(0.07, 0.5, 5), horn, 0.45 * s, 0.25, -0.2, -1.2, 0, -0.7 * s);
    }
    const jaw = this.jawM = this.grp(head, 0, -0.15, 0.4);
    this.add(jaw, new THREE.BoxGeometry(0.55, 0.18, 1.0), scaleD, 0, -0.08, 0.45);
    for (let i = 0; i < 4; i++) for (const s of [1, -1]) this.add(jaw, new THREE.ConeGeometry(0.035, 0.14, 4), this.M(0xf0e6d0), 0.2 * s, 0.06, 0.15 + i * 0.22);
    this.add(head, new THREE.BoxGeometry(0.4, 0.06, 0.5), glow, 0, -0.12, 0.95);
    // wings
    this.wings = [];
    for (const s of [1, -1]) {
      const w = this.grp(body, 0.75 * s, 0.8, 0.6);
      const pts = [[0, 0, 0], [1.9 * s, 2.7, -0.3], [4.0 * s, 2.3, -0.7], [4.1 * s, 0.9, -0.9], [3.1 * s, -0.3, -1.0], [0.5 * s, -0.5, -0.9]];
      const V = p => new THREE.Vector3(...p);
      const geo = new THREE.BufferGeometry();
      const tri = [];
      for (let i = 1; i < pts.length - 1; i++) tri.push(...pts[0], ...pts[i], ...pts[i + 1]);
      tri.push(...pts[1], ...pts[2], ...pts[3]);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mem); m.castShadow = true; w.add(m);
      const bone = (a, b, r) => {
        const A = V(a), B = V(b), len = A.distanceTo(B);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), scaleD);
        c.position.copy(A).add(B).multiplyScalar(0.5);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
        c.castShadow = true; w.add(c);
      };
      bone(pts[0], pts[1], 0.13);
      for (let i = 2; i <= 4; i++) bone(pts[1], pts[i], 0.06);
      this.add(w, new THREE.ConeGeometry(0.07, 0.4, 5), horn, pts[1][0], pts[1][1] + 0.2, pts[1][2], 0, 0, -0.3 * s);
      this.wings.push({ w, s });
    }
    // tail
    let tp = this.grp(body, 0, 0.1, -1.7);
    this.tailSeg = [];
    for (let i = 0; i < 7; i++) {
      const seg = this.grp(tp, 0, 0, i === 0 ? 0 : -0.6); seg.rotation.x = 0.12;
      const r = 0.55 - i * 0.07;
      this.add(seg, new THREE.CylinderGeometry(Math.max(0.08, r - 0.07), r, 0.72, 8), scale, 0, 0, -0.3, Math.PI / 2);
      if (i % 2 === 0) this.add(seg, new THREE.ConeGeometry(0.09, 0.35, 5), horn, 0, r, -0.3, -0.5);
      this.tailSeg.push(seg); tp = seg;
    }
    this.add(tp, new THREE.ConeGeometry(0.25, 0.7, 4), horn, 0, 0, -0.9, -Math.PI / 2);
    this.groundGlow(0xff5a1a, 8);
    this.emitters.push({ obj: this.grp(head, 0, -0.1, 1.3), color: 0xff7a1a, rate: 9, kind: 'flame' });
    this.chest = this.grp(body, 0, 0.2, 1.8);
    this.tip = this.grp(head, 0, -0.1, 1.45);
    this.top = this.grp(body, 0, 3.2, 1.5);
    this.height = 5.2;
  }
  update(dt, fx) {
    this._updateCommon(dt, fx);
    const a = this.act, t = this.t, br = Math.sin(t * 1.4);
    const b = this.bodyG;
    b.position.y = 2.35 - a.crouch * 0.8 + br * 0.05 + a.rear * 0.4;
    b.position.z = a.lunge * 1.5;
    b.rotation.x = -a.rear * 0.4 + a.lunge * 0.12 + a.torsoX * 0.3;
    b.rotation.y = a.torsoY * 0.4;
    const nk = a.neck - a.rear * 0.3;
    this.neck.forEach((s, i) => { s.rotation.x = -0.3 + nk * 0.18 + Math.sin(t * 1.1 - i * 0.4) * 0.03; s.rotation.y = Math.sin(t * 0.6 - i * 0.3) * 0.05; });
    this.head.rotation.x = 1.0 + a.headX * 0.4 + a.lunge * 0.3;
    this.jawM.rotation.x = 0.06 + a.jaw * 0.65;
    const flap = 0.12 + a.spread * 0.6;
    for (const W of this.wings) {
      W.w.rotation.z = W.s * (Math.sin(t * (1.6 + a.spread * 3)) * flap - a.spread * 0.25);
      W.w.rotation.y = W.s * (0.15 + a.crouch * 0.2);
    }
    this.tailSeg.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.2 - i * 0.5) * 0.08 + a.tail * 0.35; });
    for (const L of this.legsG) L.leg.rotation.x = (L.front ? -a.rear * 0.7 : 0) - a.crouch * 0.3;
  }
}
