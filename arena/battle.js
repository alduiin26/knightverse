// KnightVerse Arena - battle engine: attack bars, skills, AI, cinematics
import * as THREE from 'three';
import { SKILLS, STATUS_INFO, RARITIES, derive } from './data.js';
import { tween, wait, ease, clock, rand, pick } from './core.js';
import { buildHero } from './hero.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SLOTS = {
  player: [[-4.4, 5.0], [0, 6.4], [4.4, 5.0]],
  enemy: [[-4.4, -5.0], [0, -6.4], [4.4, -5.0]],
};
const TURN_CAP = 150;

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const fwd = u => V(Math.sin(u.root.rotation.y), 0, Math.cos(u.root.rotation.y));

class Unit {
  constructor(nft, team, slot) {
    this.nft = nft; this.team = team; this.slot = slot;
    this.d = derive(nft);
    this.hp = this.d.maxHP;
    this.bar = rand(0, 25);
    this.status = {};
    this.fresh = new Set();
    this.skills = SKILLS[nft.cls];
    this.cd = this.skills.map(s => (s.ult ? 2 : 0));
    this.alive = true;
    this.dealt = 0; this.healed = 0;
    this.hero = buildHero(nft);
    this.hero.root.rotation.order = 'YXZ';
    const [x, z] = SLOTS[team][slot];
    this.home = V(x, 0, z);
    const look = team === 'player' ? V(0, 0, -4) : V(0, 0, 4);
    this.homeRot = Math.atan2(look.x - x, look.z - z);
    this.hero.root.position.copy(this.home);
    this.hero.root.rotation.y = this.homeRot;
    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.7, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1.3; this.hitbox.userData.unit = this;
    this.hero.root.add(this.hitbox);
  }
  get root() { return this.hero.root; }
  get pct() { return this.hp / this.d.maxHP; }
  chestPos() { const p = V(); this.hero.chest.getWorldPosition(p); return p; }
  tipPos() { const p = V(); this.hero.tip.getWorldPosition(p); return p; }
  topPos() { const p = V(); this.hero.top.getWorldPosition(p); return p; }
}

export class Battle {
  constructor({ world, fx, ui, audio }, playerNfts, enemyNfts, rival) {
    Object.assign(this, { world, fx, ui, audio, rival });
    this.units = [
      ...playerNfts.map((n, i) => new Unit(n, 'player', i)),
      ...enemyNfts.map((n, i) => new Unit(n, 'enemy', i)),
    ];
    this.auto = false; this.over = false; this.forfeited = false;
    this.turns = 0; this.crits = 0;
    this.markers = []; this.activeMarker = null; this.current = null;
  }

  foes(u) { return this.units.filter(x => x.alive && x.team !== u.team); }
  friends(u) { return this.units.filter(x => x.alive && x.team === u.team); }
  forfeit() { this.over = true; this.forfeited = true; }

  // ======================================================================= flow
  async run() {
    await this.intro();
    while (!this.over) {
      const u = await this.advance();
      if (this.over || !u) break;
      await this.takeTurn(u);
      this.checkEnd();
      if (this.turns >= TURN_CAP) this.over = true;
    }
    return this.outro();
  }

  async intro() {
    const d = this.world.director;
    d.cut(V(0, 24, 34), V(0, 0, -2), 46);
    d.shot(d.home.pos, d.home.look, d.home.fov, 1.4);
    for (const u of this.units) { u.root.visible = false; this.world.scene.add(u.root); }
    this.ui.startBattleHud(this, this.rival);
    const order = [...this.units.filter(u => u.team === 'enemy'), ...this.units.filter(u => u.team === 'player')];
    await wait(0.5);
    for (const u of order) { this.spawn(u); await wait(0.24); }
    await wait(0.8);
    this.audio.play('fight');
    await this.ui.centerText('FIGHT!', 'fight', 1000);
  }

  spawn(u) {
    const col = RARITIES[u.nft.rarity].hex;
    this.fx.beam(u.home, col, { radius: 1.1, height: 18, life: 0.9 });
    this.fx.ring(u.home, col, { r1: 3, life: 0.7 });
    this.fx.emit({ pos: u.home.clone().setY(0.2), count: 40, colors: [col, 0xffffff], speed: [1, 4], up: 3, life: [0.4, 1], size: [0.1, 0.3], ring: 0.8 });
    const s = u.nft.faction === 'orc' ? 1.06 : 1;
    u.root.visible = true; u.root.scale.setScalar(0.01);
    tween(0.45, k => u.root.scale.setScalar(Math.max(0.01, s * k)), ease.outBack);
    u.hud.classList.add('in');
    this.audio.play('cast');
  }

  async advance() {
    const alive = this.units.filter(u => u.alive);
    if (!alive.length) return null;
    let tMin = Infinity;
    for (const u of alive) tMin = Math.min(tMin, Math.max(0, (100 - u.bar) / u.d.speed));
    const start = alive.map(u => u.bar);
    const dur = Math.min(0.32, 0.06 + tMin * 0.6);
    await tween(dur, k => {
      alive.forEach((u, i) => { u.bar = start[i] + u.d.speed * tMin * k; this.ui.updateBar(u); });
    }, ease.linear);
    let best = null;
    for (const u of alive) if (!best || u.bar > best.bar + 1e-6 || (Math.abs(u.bar - best.bar) < 1e-6 && Math.random() < 0.5)) best = u;
    return best;
  }

  predictOrder(n = 6) {
    const sim = this.units.filter(u => u.alive).map(u => ({ u, bar: u.bar }));
    const out = [];
    let guard = 0;
    while (out.length < n && sim.length && guard++ < 50) {
      let tMin = Infinity;
      for (const s of sim) tMin = Math.min(tMin, (100 - s.bar) / s.u.d.speed);
      tMin = Math.max(0, tMin);
      for (const s of sim) s.bar += s.u.d.speed * tMin;
      const best = sim.reduce((a, b) => (b.bar > a.bar ? b : a));
      out.push(best.u); best.bar = 0;
    }
    return out;
  }

  async takeTurn(u) {
    this.turns++;
    this.current = u;
    u.bar = 0; this.ui.updateBar(u);
    this.ui.setActive(u);
    this.ui.updateTurnOrder([u, ...this.predictOrder(6)]);
    this.setActiveMarker(u);
    this.audio.play('turn');
    u.cd = u.cd.map(c => Math.max(0, c - 1));

    // damage over time
    for (const k of ['burn', 'poison']) {
      if (u.status[k] > 0 && u.alive) {
        const dmg = Math.round(u.d.maxHP * (k === 'burn' ? 0.06 : 0.07));
        this.fx.emit({ pos: u.chestPos(), count: 22, colors: k === 'burn' ? [0xff7a1a, 0xffd27a] : [0x7dff5a, 0x2a8a2a], speed: [0.5, 2], up: 1.5, life: [0.4, 0.8], size: [0.15, 0.35], spread: 0.4 });
        this.audio.play(k === 'burn' ? 'fire' : 'poison');
        u.hero.setFlash(k === 'burn' ? 0xff5a1a : 0x4aff4a, 0.8);
        tween(0.4, kk => u.hero.setFlash(k === 'burn' ? 0xff5a1a : 0x4aff4a, 0.8 * (1 - kk)));
        this.damage(u, dmg, { kind: 'dot' });
        await wait(0.5);
      }
    }
    if (!u.alive || this.checkEnd()) { this.clearActive(); return; }

    if (u.status.stun > 0) {
      this.ui.float(u, 'Stunned', 'debuff');
      this.fx.stunStars(u.topPos(), 1.0);
      this.audio.play('stun');
      await wait(0.9);
      this.tickStatus(u); this.ui.updateHud(u); this.clearActive();
      return;
    }

    let choice;
    if (u.team === 'player' && !this.auto) {
      this.world.director.goHome();
      choice = await this.ui.awaitAction(u);
      if (!choice || choice.forfeit || this.over) { this.clearActive(); return; }
    } else {
      await wait(0.35);
      if (this.over) { this.clearActive(); return; }
      choice = this.ai(u);
    }
    const skill = u.skills[choice.skill];
    u.cd[choice.skill] = skill.cd;
    this.clearActive();
    await this.execute(u, skill, choice.target);
    this.tickStatus(u);
    this.ui.updateHud(u);
    this.world.dimTarget = 0;
    this.world.director.goHome();
    await wait(0.3);
  }

  checkEnd() {
    if (this.over) return true;
    const p = this.units.some(u => u.team === 'player' && u.alive);
    const e = this.units.some(u => u.team === 'enemy' && u.alive);
    if (!p || !e) this.over = true;
    return this.over;
  }

  async outro() {
    this.clearTargets(); this.clearActive();
    this.world.dimTarget = 0; this.ui.hideUlt();
    const pAlive = this.units.filter(u => u.team === 'player' && u.alive);
    const eAlive = this.units.filter(u => u.team === 'enemy' && u.alive);
    let win;
    if (this.forfeited) win = false;
    else if (!eAlive.length) win = true;
    else if (!pAlive.length) win = false;
    else { const sum = a => a.reduce((s, u) => s + u.pct, 0); win = sum(pAlive) >= sum(eAlive); }
    await wait(0.7);
    const winners = win ? pAlive : eAlive;
    if (winners.length) {
      const c = winners.reduce((a, u) => a.add(u.home), V()).multiplyScalar(1 / winners.length);
      const d = this.world.director;
      d.shot(c.clone().add(V(0, 3.4, 9.5)), c.clone().add(V(0, 1.3, 0)), 38, 2);
      for (const u of winners) {
        const r0 = u.root.rotation.y;
        tween(0.4, k => { u.root.rotation.y = lerpAngle(r0, 0, k); });
        u.hero.pose({ armRX: -2.8, armRZ: -0.3, armLX: -0.6, torsoX: -0.2, headX: -0.25 }, 0.45, ease.outBack);
        this.fx.emit({ pos: u.home.clone().setY(0.2), count: 50, colors: [RARITIES[u.nft.rarity].hex, 0xffffff], speed: [0.3, 1.5], up: 4, life: [0.6, 1.4], size: [0.1, 0.3], ring: 1 });
      }
    }
    this.audio.play(win ? 'win' : 'lose');
    await this.ui.centerText(win ? 'VICTORY' : 'DEFEAT', win ? 'win' : 'lose', 1800);
    const players = this.units.filter(u => u.team === 'player');
    const mvp = players.reduce((a, b) => ((b.dealt + b.healed) > (a.dealt + a.healed) ? b : a));
    return {
      win, rival: this.rival, turns: this.turns, crits: this.crits, left: pAlive.length, mvp,
      dealt: players.reduce((s, u) => s + u.dealt, 0),
    };
  }

  dispose() {
    this.clearTargets(); this.clearActive();
    for (const u of this.units) {
      this.world.scene.remove(u.root);
      u.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    }
  }

  update(dt) {
    for (const u of this.units) u.hero.update(dt, this.fx);
    for (const m of this.markers) m.rotation.z += dt * 1.2;
    if (this.activeMarker) this.activeMarker.rotation.z -= dt * 0.8;
  }

  // ======================================================================= AI
  pickTarget(u, foes) {
    if (!foes.length) return null;
    if (Math.random() < 0.6) return foes.reduce((a, b) => (b.pct < a.pct ? b : a));
    return pick(foes);
  }

  ai(u) {
    const foes = this.foes(u), allies = this.friends(u);
    const ready = i => u.cd[i] === 0;
    if (u.nft.cls === 'priest') {
      const hurt = allies.filter(a => a.pct < 0.6);
      const critical = allies.some(a => a.pct < 0.35);
      if (ready(2) && (hurt.length >= 2 || critical)) return { skill: 2 };
      if (ready(1) && hurt.length) return { skill: 1, target: hurt.reduce((a, b) => (b.pct < a.pct ? b : a)) };
      if (ready(2) && Math.random() < 0.4) return { skill: 2 };
      return { skill: 0, target: this.pickTarget(u, foes) };
    }
    if (ready(2)) return { skill: 2, target: this.pickTarget(u, foes) };
    if (ready(1)) return { skill: 1, target: this.pickTarget(u, foes) };
    return { skill: 0, target: this.pickTarget(u, foes) };
  }

  // ======================================================================= combat math
  roll(att, def, mult, opts = {}) {
    let v = (40 + att.d.power * 3.2) * mult * rand(0.92, 1.08);
    if (att.status.atkUp) v *= 1.25;
    if (def.status.defBreak) v *= 1.25;
    v *= 1 - def.d.dr;
    const crit = Math.random() < att.d.critChance + (opts.critBonus || 0);
    const glance = !crit && Math.random() < def.d.evade;
    if (crit) v *= att.d.critDmg;
    if (glance) v *= 0.6;
    return { dmg: Math.max(1, Math.round(v)), crit, glance };
  }

  strike(att, def, mult, opts = {}) {
    if (!def || !def.alive) return null;
    const r = this.roll(att, def, mult, opts);
    if (r.crit && att.team === 'player') this.crits++;
    att.dealt += Math.min(r.dmg, def.hp);
    this.damage(def, r.dmg, { crit: r.crit, glance: r.glance, from: att, color: opts.color ?? att.hero.theme });
    return r;
  }

  damage(def, amount, info = {}) {
    if (!def.alive) return;
    def.hp = Math.max(0, def.hp - amount);
    if (info.kind === 'dot') this.ui.float(def, `-${amount.toLocaleString()}`, 'dot');
    else if (info.crit) this.ui.float(def, `<em>Critical</em>${amount.toLocaleString()}`, 'crit', true);
    else if (info.glance) this.ui.float(def, `<em>Glancing Hit</em>${amount.toLocaleString()}`, 'glance');
    else this.ui.float(def, amount.toLocaleString(), 'dmg');
    if (info.kind !== 'dot') {
      this.fx.impact(def.chestPos(), info.color ?? 0xffffff, info.crit ? 1.5 : 1);
      this.audio.play(info.crit ? 'crit' : 'hit');
      this.world.director.shake(info.crit ? 0.4 : 0.14);
      this.hitReact(def, info.from);
    }
    this.ui.updateHud(def);
    if (def.hp <= 0) this.kill(def);
  }

  hitReact(def, from) {
    const h = def.hero;
    const dir = from ? def.home.clone().sub(from.root.position).setY(0).normalize() : V(0, 0, def.team === 'player' ? 1 : -1);
    h.trigger('hit');
    h.pose({ torsoX: -0.35, headX: -0.3 }, 0.06).then(() => { if (def.alive) h.pose({ torsoX: 0, headX: 0 }, 0.3); });
    tween(0.35, k => {
      if (!def.alive) return;
      def.root.position.copy(def.home).addScaledVector(dir, Math.sin(k * Math.PI) * 0.35);
      h.setFlash(0xffffff, 0.75 * (1 - k) * (1 - k));
    });
  }

  kill(u) {
    if (!u.alive) return;
    u.alive = false; u.hero.dead = true;
    this.audio.play('death');
    this.ui.updateHud(u);
    u.hero.trigger('death');
    u.hero.setFlash(0x000000, 0);
    this.ui.float(u, 'Defeated', 'debuff');
    tween(0.65, k => { u.root.rotation.x = -ease.in(k) * 1.45; u.root.position.y = Math.sin(k * Math.PI) * 0.2; }, ease.linear)
      .then(() => {
        this.fx.emit({ pos: u.home.clone().setY(0.4), count: 40, colors: [0x8a7a6a, 0xc8b8a8, RARITIES[u.nft.rarity].hex], speed: [0.4, 1.8], up: 1, life: [0.6, 1.2], size: [0.3, 0.6], grow: 1, drag: 2, spread: 0.6 });
        return tween(0.7, k => { u.hero.setOpacity(1 - k); u.root.position.y = -k * 0.4; });
      })
      .then(() => { u.root.visible = false; });
  }

  tryStatus(att, def, key, chance, turns) {
    if (!def || !def.alive || Math.random() > chance) return false;
    const info = STATUS_INFO[key];
    if (!info.good && Math.random() < def.d.resist) { this.ui.float(def, 'Resisted', 'resist'); return false; }
    def.status[key] = Math.max(def.status[key] || 0, turns);
    if (def === this.current) def.fresh.add(key);
    this.ui.float(def, info.label, info.good ? 'buff' : 'debuff');
    this.ui.updateHud(def);
    return true;
  }

  tickStatus(u) {
    for (const k of Object.keys(u.status)) {
      if (u.fresh.has(k)) continue;
      u.status[k]--;
      if (u.status[k] <= 0) delete u.status[k];
    }
    u.fresh.clear();
  }

  cleanse(u) {
    let any = false;
    for (const k of Object.keys(u.status)) if (!STATUS_INFO[k].good) { delete u.status[k]; any = true; }
    if (any) this.ui.float(u, 'Cleansed', 'buff');
    this.ui.updateHud(u);
  }

  heal(src, t, mult) {
    if (!t.alive) return;
    const amount = Math.round((60 + src.d.power * 3) * mult * rand(0.95, 1.05));
    const real = Math.min(amount, t.d.maxHP - t.hp);
    t.hp += real; src.healed += real;
    this.ui.float(t, `+${amount.toLocaleString()}`, 'heal');
    this.ui.updateHud(t);
  }

  // ======================================================================= markers / picking
  setActiveMarker(u) {
    this.clearActive();
    const m = this.fx.marker(0xffa040, { size: 2.7, variant: 0, opacity: 0.95 });
    m.position.set(u.home.x, 0.05, u.home.z);
    this.activeMarker = m;
  }
  clearActive() { this.fx.removeMarker(this.activeMarker); this.activeMarker = null; }

  showTargets(list, friendly) {
    this.clearTargets();
    for (const t of list) {
      const m = this.fx.marker(friendly ? 0x6dff8a : 0xff4a4a, { size: 2.5, target: true, opacity: 0.7 });
      m.position.set(t.home.x, 0.07, t.home.z); m.userData.unit = t;
      this.markers.push(m);
      t.hud && t.hud.classList.add('targetable');
    }
  }
  clearTargets() {
    for (const m of this.markers) this.fx.removeMarker(m);
    this.markers = [];
    for (const u of this.units) u.hud && u.hud.classList.remove('targetable', 'hover');
  }
  hoverTarget(t) {
    for (const m of this.markers) {
      const on = m.userData.unit === t;
      m.material.opacity = on ? 1 : 0.6;
      m.scale.setScalar(on ? 3.0 : 2.5);
    }
  }
  pickUnit(x, y) {
    const hits = this.world.raycast(x, y, this.units.filter(u => u.alive).map(u => u.hitbox));
    return hits.length ? hits[0].object.userData.unit : null;
  }

  // ======================================================================= movement + camera helpers
  focusCam(a, b, zoom = 0.72, smooth = 3.2) {
    const d = this.world.director;
    const mid = a.home.clone().add((b || a).home).multiplyScalar(0.5);
    const off = d.home.pos.clone().sub(d.home.look).multiplyScalar(zoom);
    off.x += a.home.x * 0.35;
    d.shot(mid.clone().add(off), mid.clone().add(V(0, 0.9, 0)), 40, smooth);
  }

  async moveTo(u, dest, dur, jump = 0.6, face = true) {
    const from = u.root.position.clone();
    const rot0 = u.root.rotation.y;
    const rot1 = Math.atan2(dest.x - from.x, dest.z - from.z);
    this.audio.play('whoosh');
    u.hero.pose({ crouch: 0.3, torsoX: 0.3 }, dur * 0.3);
    await tween(dur, k => {
      u.root.position.lerpVectors(from, dest, k);
      u.root.position.y = Math.sin(k * Math.PI) * jump;
      if (face) u.root.rotation.y = lerpAngle(rot0, rot1, Math.min(1, k * 3));
    }, ease.inOut);
    u.hero.pose({ crouch: 0, torsoX: 0 }, 0.15);
  }

  frontOf(att, def, dist = 1.75) {
    const dir = att.home.clone().sub(def.home).setY(0).normalize();
    return def.home.clone().addScaledVector(dir, dist);
  }

  async approach(att, def) {
    this.focusCam(att, def);
    await this.moveTo(att, this.frontOf(att, def), 0.38, 0.7);
    att.root.rotation.y = Math.atan2(def.home.x - att.root.position.x, def.home.z - att.root.position.z);
  }

  async goBack(u) {
    await this.moveTo(u, u.home, 0.34, 0.6, false);
    const r0 = u.root.rotation.y;
    await tween(0.15, k => { u.root.rotation.y = lerpAngle(r0, u.homeRot, k); });
    u.root.rotation.y = u.homeRot;
  }

  async castPose(u, big = false) {
    u.hero.trigger('cast');
    this.fx.circle(u.root.position, u.hero.theme, { size: big ? 4.2 : 3, life: 1.0, spin: 2 });
    this.audio.play('cast');
    await u.hero.pose({ armRX: -1.6, elbowR: 0.1, armLX: -1.2, armLZ: 0.5, torsoX: -0.12 }, 0.28, ease.out);
    this.fx.emit({ pos: u.tipPos(), count: 26, colors: [u.hero.theme, 0xffffff], speed: [1, 3], life: [0.3, 0.6], size: [0.1, 0.25] });
  }

  healFx(t, color) {
    this.fx.beam(t.home, 0x9dffb0, { radius: 0.9, height: 9, life: 0.9, intensity: 1.2 });
    this.fx.circle(t.home, color, { size: 2.8, life: 1.0, spin: 1.5, variant: 1 });
    this.fx.emit({ pos: t.home.clone().setY(0.3), count: 40, colors: [0x9dffb0, color, 0xffffff], speed: [0.1, 0.6], up: 3, life: [0.6, 1.2], size: [0.1, 0.25], ring: 0.7, drag: 0.6 });
  }

  async ultIntro(u, skill) {
    const d = this.world.director;
    this.world.dimTarget = 1;
    const f = fwd(u), side = V(f.z, 0, -f.x), p = u.root.position.clone();
    d.shot(p.clone().addScaledVector(f, 4.8).addScaledVector(side, 1.9).add(V(0, 2.0, 0)), p.clone().add(V(0, 1.5, 0)), 34, 5);
    this.ui.ultBanner(skill, u);
    this.audio.play('ult');
    this.fx.circle(p, u.hero.theme, { size: 4.6, life: 1.6, spin: 1.5, variant: 1 });
    this.fx.emit({ pos: p.clone().setY(0.2), count: 70, colors: [u.hero.theme, 0xffffff], speed: [0.2, 1], up: 4, life: [0.6, 1.2], size: [0.1, 0.25], ring: 1.2, drag: 0.8 });
    this.fx.light(p.clone().add(V(0, 2, 0)), u.hero.theme, 50, 1.2);
    u.hero.trigger('cast');
    await u.hero.pose({ armRX: -2.3, armLX: -2.1, armLZ: 0.6, armRZ: -0.6, torsoX: -0.25, headX: -0.3 }, 0.4, ease.out);
    await wait(0.7);
    this.ui.hideUlt();
    this.world.dimTarget = 0.45;
    // hard cut back to the wide angle (a smooth move from a close-up would sweep along the floor)
    d.cut(d.home.pos, d.home.look, d.home.fov);
    await u.hero.rest(0.18);
  }

  // ======================================================================= skills
  async execute(u, skill, target) {
    if (!target || !target.alive) {
      target = skill.target === 'ally' ? this.friends(u).reduce((a, b) => (b.pct < a.pct ? b : a))
        : skill.target === 'all-allies' ? u : this.pickTarget(u, this.foes(u));
    }
    if (!target) return;
    this.ui.skillBanner(u, skill);
    await this['sk_' + skill.id](u, skill, target);
    if (skill.ult) this.world.dimTarget = 0;
  }

  // ---- warrior
  async sk_cleave(u, s, t) {
    await this.approach(u, t);
    u.hero.trigger('attack');
    await u.hero.pose({ armRX: -2.7, armRZ: -0.2, elbowR: -0.2, torsoY: 0.5, torsoX: -0.15 }, 0.16, ease.out);
    this.audio.play('swing');
    this.fx.slash(u.root.position.clone().add(V(0, 1.3, 0)).addScaledVector(fwd(u), 0.6), u.root.rotation.y, u.hero.theme, { radius: 1.6, tilt: 0.5 });
    await u.hero.pose({ armRX: -0.2, elbowR: -0.1, torsoY: -0.6, torsoX: 0.25 }, 0.11, ease.in);
    this.strike(u, t, s.mult);
    await wait(0.25);
    u.hero.rest(0.25);
    await this.goBack(u);
  }

  async sk_bash(u, s, t) {
    await this.approach(u, t);
    await u.hero.pose({ armLX: -0.2, armLZ: 0.6, elbowL: -1.4, torsoY: -0.6, crouch: 0.2 }, 0.14);
    this.audio.play('swing');
    const p0 = u.root.position.clone(), f = fwd(u);
    u.hero.pose({ armLX: -1.5, armLZ: 0, elbowL: -0.3, torsoY: 0.5, crouch: 0 }, 0.1, ease.in);
    await tween(0.1, k => u.root.position.copy(p0).addScaledVector(f, k * 0.55));
    this.fx.glow(t.chestPos(), 0xffe9a0, { scale: 4, life: 0.35 });
    this.fx.ring(t.home, 0xffe9a0, { r1: 3.2, life: 0.45 });
    this.strike(u, t, s.mult, { color: 0xffe9a0 });
    this.world.director.shake(0.35);
    if (this.tryStatus(u, t, 'stun', s.stun, 1)) { this.fx.stunStars(t.topPos(), 1.2); this.audio.play('stun'); }
    await wait(0.3);
    await tween(0.12, k => u.root.position.copy(p0).addScaledVector(f, (1 - k) * 0.55));
    u.hero.rest(0.25);
    await this.goBack(u);
  }

  async sk_quake(u, s, t) {
    await this.ultIntro(u, s);
    const foes = this.foes(u);
    if (!foes.length) return;
    const center = foes.reduce((a, f) => a.add(f.home), V()).multiplyScalar(1 / foes.length);
    const land = center.clone().add(u.home.clone().sub(center).setY(0).normalize().multiplyScalar(2.4));
    const d = this.world.director;
    const off = d.home.pos.clone().sub(d.home.look).multiplyScalar(0.9);
    d.shot(land.clone().add(off), land.clone().add(V(0, 1.2, 0)), 42, 3);
    const from = u.root.position.clone();
    const rot0 = u.root.rotation.y, rot1 = Math.atan2(center.x - from.x, center.z - from.z);
    await u.hero.pose({ armRX: -2.9, armLX: -2.6, crouch: 0.45 }, 0.15);
    this.audio.play('whoosh');
    u.hero.pose({ crouch: 0 }, 0.1);
    await tween(0.55, k => {
      u.root.position.lerpVectors(from, land, k);
      u.root.position.y = Math.sin(k * Math.PI) * 5.5 * (1 - k * 0.25);
      u.root.rotation.y = lerpAngle(rot0, rot1, Math.min(1, k * 2));
    }, ease.inOut);
    u.root.position.y = 0;
    u.hero.pose({ armRX: -0.1, armLX: -0.3, torsoX: 0.5, crouch: 0.5 }, 0.08, ease.in);
    this.audio.play('boom');
    d.shake(1.1);
    this.fx.explosion(land.clone().setY(0.3), u.hero.theme, 1.6);
    this.fx.ring(land, u.hero.theme, { r0: 0.5, r1: 12, life: 0.85, width: 0.12 });
    this.fx.ring(land, 0xffffff, { r0: 0.5, r1: 8, life: 0.6, width: 0.06 });
    this.fx.circle(land, u.hero.theme, { size: 7.5, life: 1.3, spin: 0.5 });
    this.fx.emit({ pos: land.clone().setY(0.2), count: 90, colors: [0x8a7a66, 0x5a4a3a, u.hero.theme], speed: [3, 9], up: 5, life: [0.6, 1.2], size: [0.2, 0.5], gravity: 14, drag: 0.8, ring: 1 });
    for (const f of foes) {
      await wait(0.06);
      this.strike(u, f, s.mult);
      this.tryStatus(u, f, 'defBreak', s.defBreak, 2);
    }
    await wait(0.55);
    u.hero.rest(0.3);
    this.world.dimTarget = 0;
    await this.goBack(u);
  }

  // ---- rogue
  async sk_fang(u, s, t) {
    await this.approach(u, t);
    u.hero.trigger('attack');
    for (let i = 0; i < s.hits; i++) {
      const right = i % 2 === 0;
      await u.hero.pose(right ? { armRX: -1.9, armRZ: -0.9, elbowR: -0.2, torsoY: 0.4 } : { armLX: -1.9, armLZ: 0.9, elbowL: -0.2, torsoY: -0.4 }, 0.08, ease.out);
      this.audio.play('swing');
      this.fx.slash(u.root.position.clone().add(V(0, 1.2, 0)).addScaledVector(fwd(u), 0.7), u.root.rotation.y, u.hero.theme, { radius: 1.1, tilt: right ? 0.9 : -0.9, flip: !right, life: 0.22 });
      await u.hero.pose(right ? { armRX: -0.6, armRZ: 0.3, torsoY: -0.3 } : { armLX: -0.6, armLZ: -0.3, torsoY: 0.3 }, 0.07, ease.in);
      this.strike(u, t, s.mult);
      if (!t.alive) break;
      await wait(0.08);
    }
    u.hero.rest(0.2);
    await wait(0.15);
    await this.goBack(u);
  }

  async sk_venom(u, s, t) {
    await this.approach(u, t);
    u.hero.trigger('attack');
    await u.hero.pose({ armRX: -0.4, elbowR: -1.8, torsoY: 0.5, crouch: 0.3 }, 0.12);
    this.audio.play('swing');
    await u.hero.pose({ armRX: -1.6, elbowR: 0, torsoY: -0.3, crouch: 0.1 }, 0.08, ease.in);
    this.strike(u, t, s.mult);
    this.fx.emit({ pos: t.chestPos(), count: 45, colors: [0x7dff5a, 0x2ecc40, 0xd6ff9a], speed: [1, 4], life: [0.4, 0.9], size: [0.15, 0.35], gravity: 3 });
    this.audio.play('poison');
    this.tryStatus(u, t, 'poison', s.poison, 2);
    u.bar = Math.min(100, u.bar + s.selfBar);
    this.ui.updateBar(u);
    this.ui.float(u, 'ATK Bar +30%', 'buff');
    await wait(0.2);
    u.hero.rest(0.2);
    await this.goBack(u);
  }

  async sk_shadow(u, s) {
    await this.ultIntro(u, s);
    this.world.director.goHome(3);
    const smoke = p => this.fx.emit({ pos: p.clone().add(V(0, 1, 0)), count: 40, colors: [0x2a1f35, 0x4a3a5a, u.hero.theme], speed: [0.5, 2.5], life: [0.4, 0.9], size: [0.5, 1.0], spread: 0.5, grow: 1.2, drag: 2 });
    smoke(u.root.position); this.audio.play('shadow');
    u.root.visible = false;
    await wait(0.2);
    for (let i = 0; i < s.hits; i++) {
      const foes = this.foes(u); if (!foes.length) break;
      const t2 = pick(foes);
      const a = rand(0, Math.PI * 2);
      const pos = t2.home.clone().add(V(Math.sin(a) * 1.5, 0, Math.cos(a) * 1.5));
      u.root.position.copy(pos);
      u.root.rotation.y = Math.atan2(t2.home.x - pos.x, t2.home.z - pos.z);
      u.root.visible = true; smoke(pos); this.audio.play('shadow');
      u.hero.pose({ armRX: -2.0, armLX: -2.0, armRZ: -0.8, armLZ: 0.8 }, 0.04);
      await wait(0.05);
      u.hero.pose({ armRX: -0.5, armLX: -0.5, armRZ: 0.2, armLZ: -0.2 }, 0.08, ease.in);
      this.fx.slash(pos.clone().add(V(0, 1.2, 0)).addScaledVector(fwd(u), 0.6), u.root.rotation.y, u.hero.theme, { radius: 1.3, tilt: rand(-1, 1), flip: i % 2 === 1, life: 0.25 });
      this.audio.play('swing');
      this.strike(u, t2, s.mult, { critBonus: s.critBonus });
      await wait(0.17);
      u.root.visible = false; smoke(pos);
      await wait(0.06);
    }
    u.root.position.copy(u.home); u.root.rotation.y = u.homeRot;
    u.root.visible = true; smoke(u.home);
    u.hero.rest(0.2);
    this.world.dimTarget = 0;
    await wait(0.3);
  }

  // ---- mage
  async sk_bolt(u, s, t) {
    this.focusCam(u, t, 0.8);
    await this.castPose(u);
    const from = u.tipPos(), to = t.chestPos();
    this.audio.play('fire');
    await this.fx.projectile(from, to, u.hero.theme, { duration: 0.42, arc: 1.4, size: 1.4 });
    this.fx.explosion(to, u.hero.theme, 0.6);
    this.strike(u, t, s.mult);
    this.tryStatus(u, t, 'burn', s.burn, 2);
    await wait(0.3);
    await u.hero.rest(0.25);
  }

  async sk_wave(u, s) {
    this.world.director.goHome(3);
    await this.castPose(u, true);
    this.audio.play('fire');
    const foes = this.foes(u).sort((a, b) => a.home.distanceTo(u.home) - b.home.distanceTo(u.home));
    this.fx.ring(u.root.position, u.hero.theme, { r0: 0.5, r1: 15, life: 0.9, width: 0.15 });
    this.fx.ring(u.root.position, 0xffd27a, { r0: 0.3, r1: 13, life: 0.8, width: 0.06 });
    await wait(0.3);
    for (const f of foes) {
      this.fx.emit({ pos: f.home.clone().setY(0.3), count: 60, colors: [u.hero.theme, 0xffd27a, 0xff3b1f], speed: [0.5, 2.5], up: 5, life: [0.4, 0.9], size: [0.3, 0.6], ring: 0.6, grow: 0.6 });
      this.fx.glow(f.chestPos(), u.hero.theme, { scale: 4, life: 0.4 });
      this.fx.light(f.chestPos(), u.hero.theme, 35, 0.4);
      this.strike(u, f, s.mult);
      this.tryStatus(u, f, 'burn', s.burn, 2);
      await wait(0.13);
    }
    await wait(0.35);
    await u.hero.rest(0.25);
  }

  async sk_meteor(u, s) {
    await this.ultIntro(u, s);
    const foes = this.foes(u);
    if (!foes.length) return;
    const center = foes.reduce((a, f) => a.add(f.home), V()).multiplyScalar(1 / foes.length);
    const d = this.world.director;
    const off = d.home.pos.clone().sub(d.home.look).multiplyScalar(1.05);
    if (u.team === 'enemy') off.z = -off.z;
    d.shot(center.clone().add(off), center.clone().add(V(0, 0.8, 0)), 42, 2.5);
    u.hero.pose({ armRX: -2.9, elbowR: 0, armLX: -2.6, armLZ: 0.4 }, 0.25);
    await wait(0.15);
    this.fx.beam(u.tipPos(), u.hero.theme, { radius: 0.5, height: 40, life: 0.8, y: u.tipPos().y });
    await wait(0.35);
    const tasks = foes.map((f, i) => (async () => {
      await wait(i * 0.22);
      this.audio.play('whoosh');
      await this.fx.meteor(f.home.clone().setY(0.4), u.hero.theme);
      this.audio.play('boom'); d.shake(0.7);
      this.strike(u, f, s.mult);
      this.tryStatus(u, f, 'burn', s.burn, 2);
    })());
    for (let i = 0; i < 3; i++) {
      tasks.push((async () => {
        await wait(0.1 + i * 0.27);
        const p = center.clone().add(V(rand(-6, 6), 0.3, rand(-3, 3)));
        await this.fx.meteor(p, u.hero.theme);
        d.shake(0.3);
      })());
    }
    await Promise.all(tasks);
    await wait(0.55);
    u.hero.rest(0.3);
    this.world.dimTarget = 0;
  }

  // ---- priest
  async sk_smite(u, s, t) {
    this.focusCam(u, t, 0.8);
    await this.castPose(u);
    this.audio.play('holy');
    this.fx.circle(t.home, u.hero.theme, { size: 3, life: 0.9, spin: -2, variant: 1 });
    await wait(0.22);
    this.fx.beam(t.home, u.hero.theme, { radius: 1.0, height: 24, life: 0.7, intensity: 2 });
    this.fx.glow(t.chestPos(), 0xffffff, { scale: 4, life: 0.4 });
    if (u.nft.faction === 'orc') this.fx.emit({ pos: t.chestPos(), count: 40, colors: [u.hero.theme, 0xffffff], speed: [4, 9], life: [0.1, 0.3], size: [0.08, 0.18], drag: 4 });
    this.strike(u, t, s.mult);
    await wait(0.35);
    await u.hero.rest(0.25);
  }

  async sk_mend(u, s, t) {
    this.focusCam(u, t, 0.8);
    await this.castPose(u);
    this.audio.play('heal');
    this.healFx(t, u.hero.theme);
    this.heal(u, t, s.heal);
    this.cleanse(t);
    await wait(0.45);
    await u.hero.rest(0.25);
  }

  async sk_grace(u, s) {
    await this.ultIntro(u, s);
    this.world.director.goHome(3);
    const allies = this.friends(u);
    const c = allies.reduce((a, f) => a.add(f.home), V()).multiplyScalar(1 / allies.length);
    this.fx.circle(c, u.hero.theme, { size: 13, life: 1.7, spin: 0.6, variant: 1 });
    this.fx.ring(c, u.hero.theme, { r0: 1, r1: 10, life: 1.0 });
    this.audio.play('holy');
    await wait(0.3);
    for (const a of allies) {
      this.healFx(a, u.hero.theme);
      this.heal(u, a, s.heal);
      this.cleanse(a);
      this.tryStatus(u, a, 'atkUp', 1, s.atkUp);
      await wait(0.1);
    }
    this.audio.play('heal');
    await wait(0.55);
    u.hero.rest(0.3);
    this.world.dimTarget = 0;
  }
}
