// KnightVerse Arena - battle presentation: plays the rules engine's events with
// 3D movement, skill effects, camera work and HUD updates.
import * as THREE from 'three';
import { RARITIES } from './data.js';
import { BOSSES } from './bosses.js';
import { Engine } from './engine.js';
import { tween, wait, ease, rand } from './core.js';
import { buildHero } from './hero.js';
import { buildBoss } from './bossmodels.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SLOTS = {
  1: [[0, 6.2]],
  2: [[-2.6, 5.7], [2.6, 5.7]],
  3: [[-4.4, 5.0], [0, 6.4], [4.4, 5.0]],
  5: [[-6.2, 4.3], [-3.1, 5.6], [0, 6.3], [3.1, 5.6], [6.2, 4.3]],
};
const BOSS_HOME = [0, -5.6];

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const fwd = u => V(Math.sin(u.root.rotation.y), 0, Math.cos(u.root.rotation.y));

// view of one fighter: 3D model + the values shown on screen
class Unit {
  constructor(e, count, squeeze = 1) {
    this.e = e; this.id = e.id; this.team = e.team; this.kind = e.kind;
    if (e.kind === 'boss') {
      const b = e.boss;
      this.boss = b;
      this.nft = { id: 'boss-' + b.id, name: b.name, img: b.img, rarity: 'legendary', cls: 'boss', faction: 'boss' };
      this.hero = buildBoss(b);
    } else {
      this.nft = e.nft;
      this.hero = buildHero(e.nft);
    }
    this.hp = e.hp; this.status = {}; this.alive = true; this.bar = e.bar;
    this.hero.root.rotation.order = 'YXZ';
    const [x, z] = e.kind === 'boss' ? BOSS_HOME : (e.team === 'player' ? SLOTS[count][e.slot] : SLOTS[count][e.slot].map((v, i) => (i ? -v : v)));
    this.home = V(x * squeeze, 0, z);
    const look = e.team === 'player' ? V(0, 0, -4) : V(0, 0, 4);
    this.homeRot = Math.atan2(look.x - x, look.z - z);
    this.hero.root.position.copy(this.home);
    this.hero.root.rotation.y = this.homeRot;
    const R = e.kind === 'boss' ? this.hero.radius * 0.75 : 0.9, H = e.kind === 'boss' ? this.hero.height : 2.7;
    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = H / 2; this.hitbox.userData.unit = this;
    this.hero.root.add(this.hitbox);
  }
  get d() { return this.e.d; }
  get skills() { return this.e.skills; }
  get cd() { return this.e.cd; }
  get root() { return this.hero.root; }
  get pct() { return this.hp / this.d.maxHP; }
  get radius() { return this.kind === 'boss' ? this.hero.radius : 1.75; }
  chestPos() { const p = V(); this.hero.chest.getWorldPosition(p); return p; }
  tipPos() { const p = V(); this.hero.tip.getWorldPosition(p); return p; }
  topPos() { const p = V(); this.hero.top.getWorldPosition(p); return p; }
}

export class Battle {
  // setup: { mode, team, enemy, boss, seed, rival }
  constructor({ world, fx, ui, audio }, setup) {
    Object.assign(this, { world, fx, ui, audio });
    this.mode = setup.mode;
    this.rival = setup.mode === 'boss' ? BOSSES[setup.boss].name : setup.rival;
    this.bossDef = setup.mode === 'boss' ? BOSSES[setup.boss] : null;
    this.engine = new Engine(setup);
    const pc = setup.team.length, ec = setup.mode === 'boss' ? 1 : setup.enemy.length;
    this.units = this.engine.units.map(e => new Unit(e, e.team === 'player' ? pc : ec, this.mode === 'boss' && world.portrait ? 0.68 : 1));
    this.byId = Object.fromEntries(this.units.map(u => [u.id, u]));
    this.log = [];
    this.auto = false; this.over = false; this.forfeited = false;
    this.markers = []; this.activeMarker = null; this.current = null;
    this.danger = []; this.beats = [];
  }

  get turns() { return this.engine.turns; }
  foes(u) { return this.units.filter(x => x.alive && x.team !== u.team); }
  friends(u) { return this.units.filter(x => x.alive && x.team === u.team); }
  forfeit() { this.over = true; this.forfeited = true; this.engine.forfeit(); }
  get boss() { return this.units.find(u => u.kind === 'boss') || null; }

  // ======================================================================= flow
  async run() {
    await this.intro();
    const E = this.engine;
    while (!this.over && !E.over) {
      const a = E.advance();
      if (!a) break;
      await this.animateBars(a.tMin);
      if (this.over) break;
      await this.takeTurn(this.byId[a.actor.id]);
    }
    return this.outro();
  }

  async intro() {
    const d = this.world.director;
    d.cut(V(0, 24, 34), V(0, 0, -2), 46);
    d.shot(d.home.pos, d.home.look, d.home.fov, 1.4);
    for (const u of this.units) { u.root.visible = false; this.world.scene.add(u.root); }
    this.ui.startBattleHud(this, this.rival);
    const players = this.units.filter(u => u.team === 'player'), enemies = this.units.filter(u => u.team === 'enemy');
    await wait(0.5);
    if (this.mode === 'boss') {
      for (const u of players) { this.spawn(u); await wait(0.2); }
      await wait(0.4);
      await this.spawnBoss(this.boss);
    } else {
      for (const u of [...enemies, ...players]) { this.spawn(u); await wait(0.24); }
      await wait(0.8);
    }
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
    u.hud && u.hud.classList.add('in');
    this.audio.play('cast');
  }

  async spawnBoss(b) {
    const d = this.world.director, col = b.hero.theme;
    d.shot(V(0, 4.5, 6), V(0, 3, -5.6), 46, 2.2);
    this.world.dimTarget = 0.6;
    await wait(0.5);
    this.audio.play('boom');
    d.shake(0.8);
    this.fx.beam(b.home, col, { radius: 3.2, height: 30, life: 1.4, intensity: 2 });
    this.fx.ring(b.home, col, { r1: 10, life: 1.0, width: 0.2 });
    this.fx.explosion(b.home.clone().setY(1), col, 1.6);
    this.fx.light(b.home.clone().add(V(0, 3, 0)), col, 80, 1.4);
    const s0 = b.hero.sizeScale || 1;
    b.root.visible = true; b.root.scale.setScalar(0.01);
    await tween(0.7, k => b.root.scale.setScalar(Math.max(0.01, k * s0)), ease.outBack);
    b.hero.trigger('attack');
    this.audio.play('ult');
    b.hero.pose({ rear: 1, jaw: 1, spread: 1, headX: -0.4, armRX: -2.2, armLX: -2.0 }, 0.35, ease.out);
    d.shake(0.6);
    this.ui.bossIntro(this.bossDef);
    await wait(1.4);
    await b.hero.rest(0.4);
    this.world.dimTarget = 0;
    d.goHome(1.6);
    await wait(0.6);
  }

  async animateBars(tMin) {
    const alive = this.units.filter(u => u.alive);
    const start = alive.map(u => u.bar), end = alive.map(u => u.e.bar);
    const dur = Math.min(0.32, 0.06 + tMin * 0.6);
    await tween(dur, k => {
      alive.forEach((u, i) => { u.bar = start[i] + (end[i] - start[i]) * k; this.ui.updateBar(u); });
    }, ease.linear);
  }

  predictOrder(n = 6) { return this.engine.predictOrder(n).map(e => this.byId[e.id]); }

  async takeTurn(u) {
    const E = this.engine;
    this.current = u;
    const st = E.startTurn(u.e);
    u.bar = 0; this.ui.updateBar(u);
    this.ui.setActive(u);
    this.ui.updateTurnOrder([u, ...this.predictOrder(6)]);
    this.setActiveMarker(u);
    this.audio.play('turn');
    for (const b of st.beats) { this.applyBeat(b); await wait(0.5); }
    if (!st.canAct || E.over || this.over) { this.syncAll(); this.clearActive(); return; }

    let choice;
    if (u.team === 'player' && !this.auto) {
      this.world.director.goHome();
      const c = await this.ui.awaitAction(u);
      if (!c || c.forfeit || this.over) { this.clearActive(); return; }
      choice = { skill: c.skill, target: c.target ? c.target.id : null };
    } else {
      await wait(0.35);
      if (this.over) { this.clearActive(); return; }
      choice = u.team === 'player' ? E.ai(u.e, Math.random) : E.ai(u.e);
    }
    if (u.team === 'player') this.log.push({ u: u.id, s: choice.skill, t: choice.target || null });
    const res = E.act(u.e, choice.skill, choice.target);
    this.clearActive();
    await this.perform(u, res);
    this.syncAll();
    this.world.dimTarget = 0;
    this.world.director.goHome();
    await wait(0.3);
  }

  // player auto-play / auto button (target returned as a unit for the UI)
  ai(u) {
    const c = this.engine.ai(u.e, Math.random);
    return { skill: c.skill, target: c.target ? this.byId[c.target] : null };
  }

  async outro() {
    this.clearTargets(); this.clearActive(); this.clearDanger();
    this.world.dimTarget = 0; this.ui.hideUlt();
    const r = this.engine.result();
    const win = r.win;
    const pAlive = this.units.filter(u => u.team === 'player' && u.alive);
    const eAlive = this.units.filter(u => u.team === 'enemy' && u.alive);
    await wait(0.7);
    const winners = win ? pAlive : eAlive;
    if (winners.length) {
      const c = winners.reduce((a, u) => a.add(u.home), V()).multiplyScalar(1 / winners.length);
      const d = this.world.director;
      if (winners[0].kind === 'boss') {
        d.shot(V(0, 4.5, 7), V(0, 3, -5.6), 44, 2);
        winners[0].hero.pose({ rear: 1, jaw: 1, spread: 1, headX: -0.4, armRX: -2.4, armLX: -2.2 }, 0.45, ease.out);
      } else {
        d.shot(c.clone().add(V(0, 3.4, 9.5 + (winners.length > 3 ? 3 : 0))), c.clone().add(V(0, 1.3, 0)), 38, 2);
        for (const u of winners) {
          const r0 = u.root.rotation.y;
          tween(0.4, k => { u.root.rotation.y = lerpAngle(r0, 0, k); });
          u.hero.pose({ armRX: -2.8, armRZ: -0.3, armLX: -0.6, torsoX: -0.2, headX: -0.25 }, 0.45, ease.outBack);
          this.fx.emit({ pos: u.home.clone().setY(0.2), count: 50, colors: [RARITIES[u.nft.rarity].hex, 0xffffff], speed: [0.3, 1.5], up: 4, life: [0.6, 1.4], size: [0.1, 0.3], ring: 1 });
        }
      }
    }
    this.audio.play(win ? 'win' : 'lose');
    await this.ui.centerText(win ? 'VICTORY' : 'DEFEAT', win ? 'win' : 'lose', 1800);
    const mvp = this.byId[r.mvp];
    return {
      win, mode: this.mode, boss: this.bossDef ? this.bossDef.id : null, rival: this.rival,
      turns: r.turns, crits: r.crits, left: r.left, dealt: r.dealt,
      mvp: mvp ? { nft: mvp.nft, dealt: mvp.e.dealt, healed: mvp.e.healed } : null,
      heroes: this.units.filter(u => u.team === 'player').length,
      log: this.log.slice(), forfeit: this.forfeited,
    };
  }

  dispose() {
    this.clearTargets(); this.clearActive(); this.clearDanger();
    for (const u of this.units) {
      this.world.scene.remove(u.root);
      u.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    }
  }

  update(dt) {
    for (const u of this.units) u.hero.update(dt, this.fx);
    for (const m of this.markers) m.rotation.z += dt * 1.2;
    for (const m of this.danger) { m.rotation.z -= dt * 2; m.material.opacity = 0.55 + Math.sin(performance.now() / 120) * 0.3; }
    if (this.activeMarker) this.activeMarker.rotation.z -= dt * 0.8;
  }

  // ======================================================================= applying engine events
  nextBeat() { const b = this.beats.shift(); if (b) this.applyBeat(b); return b; }
  beatFor(id) {
    const i = this.beats.findIndex(b => b.some(e => e.tgt === id && (e.t === 'hit' || e.t === 'heal')));
    if (i < 0) return null;
    const [b] = this.beats.splice(i, 1);
    this.applyBeat(b);
    return b;
  }
  beatTarget(b) { const e = b && b.find(x => x.t === 'hit' || x.t === 'heal'); return e ? this.byId[e.tgt] : null; }
  peekTarget() { return this.beatTarget(this.beats[0]); }
  flush() { while (this.beats.length) this.nextBeat(); }

  applyBeat(b, opts = {}) { for (const e of b) this.applyEvent(e, opts); }

  applyEvent(e, opts = {}) {
    const t = this.byId[e.tgt];
    const src = e.src ? this.byId[e.src] : null;
    if (e.s && t) { t.hp = e.s.hp; t.status = e.s.status; }
    switch (e.t) {
      case 'hit': {
        const amount = e.dmg.toLocaleString();
        if (e.crit) this.ui.float(t, `<em>Critical</em>${amount}`, 'crit', true);
        else if (e.glance) this.ui.float(t, `<em>Glancing Hit</em>${amount}`, 'glance');
        else this.ui.float(t, amount, 'dmg');
        if (!opts.noFx) this.fx.impact(t.chestPos(), opts.color ?? (src ? src.hero.theme : 0xffffff), e.crit ? 1.5 : 1);
        this.audio.play(e.crit ? 'crit' : 'hit');
        this.world.director.shake(e.crit ? 0.4 : 0.14);
        this.hitReact(t, src);
        break;
      }
      case 'dot': {
        const burn = e.kind === 'burn';
        this.ui.float(t, `-${e.dmg.toLocaleString()}`, 'dot');
        this.fx.emit({ pos: t.chestPos(), count: 22, colors: burn ? [0xff7a1a, 0xffd27a] : [0x7dff5a, 0x2a8a2a], speed: [0.5, 2], up: 1.5, life: [0.4, 0.8], size: [0.15, 0.35], spread: 0.4 });
        this.audio.play(burn ? 'fire' : 'poison');
        const c = burn ? 0xff5a1a : 0x4aff4a;
        t.hero.setFlash(c, 0.8);
        tween(0.4, kk => t.hero.setFlash(c, 0.8 * (1 - kk)));
        break;
      }
      case 'status': {
        const info = { stun: 'Stun', burn: 'Burn', poison: 'Poison', defBreak: 'Armor Break', atkUp: 'Attack Up' }[e.key];
        if (e.ok) {
          this.ui.float(t, info, e.key === 'atkUp' ? 'buff' : 'debuff');
          if (e.key === 'stun') { this.fx.stunStars(t.topPos(), 1.2); this.audio.play('stun'); }
        } else if (e.immune) this.ui.float(t, 'Immune', 'resist');
        else if (e.resisted) this.ui.float(t, 'Resisted', 'resist');
        break;
      }
      case 'heal': this.ui.float(t, `+${e.amount.toLocaleString()}`, 'heal'); break;
      case 'cleanse': if (e.any) this.ui.float(t, 'Cleansed', 'buff'); break;
      case 'bar': t.bar = e.bar; this.ui.updateBar(t); this.ui.float(t, `ATK Bar +${e.delta}%`, 'buff'); break;
      case 'stunned':
        this.ui.float(t, 'Stunned', 'debuff');
        this.fx.stunStars(t.topPos(), 1.0);
        this.audio.play('stun');
        break;
      case 'interrupt':
        this.clearDanger();
        this.ui.float(t, '<em>Interrupted!</em>', 'crit', true);
        this.ui.bossAlert(null);
        this.fx.ring(t.home, 0xffffff, { r1: 8, life: 0.7 });
        this.audio.play('crit');
        break;
      case 'phase': this.phaseFx(t, e.phase); break;
      default: break;
    }
    if (t) {
      this.ui.updateHud(t);
      if (e.s && !e.s.alive && t.alive) this.kill(t);
    }
  }

  // make the screen match the engine (end of every move)
  syncAll() {
    for (const u of this.units) {
      u.hp = u.e.hp; u.status = { ...u.e.status }; u.bar = u.e.bar;
      if (!u.e.alive && u.alive) this.kill(u);
      this.ui.updateHud(u);
    }
  }

  hitReact(def, from) {
    const h = def.hero;
    if (!def.alive) return;
    const dir = from ? def.home.clone().sub(from.root.position).setY(0).normalize() : V(0, 0, def.team === 'player' ? 1 : -1);
    const push = def.kind === 'boss' ? 0.15 : 0.35;
    h.trigger('hit');
    h.pose({ torsoX: -0.35, headX: -0.3 }, 0.06).then(() => { if (def.alive) h.pose({ torsoX: 0, headX: 0 }, 0.3); });
    tween(0.35, k => {
      if (!def.alive) return;
      if (!def.moving) def.root.position.copy(def.home).addScaledVector(dir, Math.sin(k * Math.PI) * push);
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
    if (u.kind === 'boss') {
      this.clearDanger(); this.ui.bossAlert(null);
      const col = u.hero.theme;
      this.world.director.shake(1.2);
      u.hero.pose({ crouch: 1, rear: -0.4, jaw: 1, spread: 0, headX: 0.5 }, 1.0, ease.inOut);
      for (let i = 0; i < 5; i++) setTimeout(() => this.fx.explosion(u.home.clone().add(V(rand(-2, 2), rand(1, 4), rand(-1.5, 1.5))), col, 1.2), i * 220);
      this.audio.play('boom');
      tween(1.0, () => {}).then(() => tween(1.2, k => { u.hero.setOpacity(1 - k); u.root.position.y = -k * 1.2; })).then(() => { u.root.visible = false; });
      return;
    }
    tween(0.65, k => { u.root.rotation.x = -ease.in(k) * 1.45; u.root.position.y = Math.sin(k * Math.PI) * 0.2; }, ease.linear)
      .then(() => {
        this.fx.emit({ pos: u.home.clone().setY(0.4), count: 40, colors: [0x8a7a6a, 0xc8b8a8, RARITIES[u.nft.rarity].hex], speed: [0.4, 1.8], up: 1, life: [0.6, 1.2], size: [0.3, 0.6], grow: 1, drag: 2, spread: 0.6 });
        return tween(0.7, k => { u.hero.setOpacity(1 - k); u.root.position.y = -k * 0.4; });
      })
      .then(() => { u.root.visible = false; });
  }

  phaseFx(b, phase) {
    const col = b.hero.theme;
    this.audio.play('ult');
    this.world.director.shake(0.7);
    this.fx.ring(b.home, col, { r1: 14, life: 1.0, width: 0.2 });
    this.fx.ring(b.home, 0xffffff, { r1: 9, life: 0.7, width: 0.08 });
    this.fx.light(b.home.clone().add(V(0, 3, 0)), col, 70, 1.0);
    this.fx.emit({ pos: b.home.clone().setY(0.3), count: 90, colors: [col, 0xffffff], speed: [1, 5], up: 5, life: [0.6, 1.3], size: [0.2, 0.5], ring: 2 });
    b.hero.pose({ rear: 0.8, jaw: 1, spread: 1, headX: -0.4 }, 0.3, ease.out).then(() => wait(0.5)).then(() => b.hero.rest(0.4));
    this.ui.bossPhase(phase);
  }

  // ======================================================================= markers / picking
  setActiveMarker(u) {
    this.clearActive();
    const m = this.fx.marker(0xffa040, { size: u.kind === 'boss' ? u.radius * 1.9 : 2.7, variant: 0, opacity: 0.95 });
    m.position.set(u.home.x, 0.05, u.home.z);
    this.activeMarker = m;
  }
  clearActive() { this.fx.removeMarker(this.activeMarker); this.activeMarker = null; }

  showTargets(list, friendly) {
    this.clearTargets();
    for (const t of list) {
      const m = this.fx.marker(friendly ? 0x6dff8a : 0xff4a4a, { size: t.kind === 'boss' ? t.radius * 1.8 : 2.5, target: true, opacity: 0.7 });
      m.position.set(t.home.x, 0.07, t.home.z); m.userData.unit = t; m.userData.size = t.kind === 'boss' ? t.radius * 1.8 : 2.5;
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
      const on = m.userData.unit === t, s = m.userData.size || 2.5;
      m.material.opacity = on ? 1 : 0.6;
      m.scale.setScalar(on ? s * 1.2 : s);
    }
  }
  pickUnit(x, y) {
    const hits = this.world.raycast(x, y, this.units.filter(u => u.alive).map(u => u.hitbox));
    return hits.length ? hits[0].object.userData.unit : null;
  }

  showDanger() {
    this.clearDanger();
    for (const t of this.units.filter(u => u.team === 'player' && u.alive)) {
      const m = this.fx.marker(0xff2a1a, { size: 2.9, target: true, opacity: 0.85 });
      m.position.set(t.home.x, 0.08, t.home.z);
      this.danger.push(m);
    }
  }
  clearDanger() { for (const m of this.danger) this.fx.removeMarker(m); this.danger = []; }

  // ======================================================================= movement + camera helpers
  focusCam(a, b, zoom = 0.72, smooth = 3.2) {
    const d = this.world.director;
    const mid = a.home.clone().add((b || a).home).multiplyScalar(0.5);
    const off = d.home.pos.clone().sub(d.home.look).multiplyScalar(zoom * (this.mode === 'boss' ? 1.15 : 1));
    off.x += a.home.x * 0.35;
    d.shot(mid.clone().add(off), mid.clone().add(V(0, this.mode === 'boss' ? 1.6 : 0.9, 0)), 40, smooth);
  }

  async moveTo(u, dest, dur, jump = 0.6, face = true) {
    const from = u.root.position.clone();
    const rot0 = u.root.rotation.y;
    const rot1 = Math.atan2(dest.x - from.x, dest.z - from.z);
    this.audio.play('whoosh');
    u.moving = true;
    u.hero.pose({ crouch: 0.3, torsoX: 0.3 }, dur * 0.3);
    await tween(dur, k => {
      u.root.position.lerpVectors(from, dest, k);
      u.root.position.y = Math.sin(k * Math.PI) * jump;
      if (face) u.root.rotation.y = lerpAngle(rot0, rot1, Math.min(1, k * 3));
    }, ease.inOut);
    u.hero.pose({ crouch: 0, torsoX: 0 }, 0.15);
    u.moving = false;
  }

  frontOf(att, def, extra = 0) {
    const dir = att.home.clone().sub(def.home).setY(0).normalize();
    return def.home.clone().addScaledVector(dir, def.radius + (att.kind === 'boss' ? att.radius - 1.2 : 0) + extra);
  }

  async approach(att, def) {
    this.focusCam(att, def);
    await this.moveTo(att, this.frontOf(att, def), att.kind === 'boss' ? 0.5 : 0.38, att.kind === 'boss' ? 1.2 : 0.7);
    att.root.rotation.y = Math.atan2(def.home.x - att.root.position.x, def.home.z - att.root.position.z);
  }

  async goBack(u) {
    await this.moveTo(u, u.home, u.kind === 'boss' ? 0.45 : 0.34, 0.6, false);
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
    const big = u.kind === 'boss';
    d.shot(p.clone().addScaledVector(f, big ? 10 : 4.8).addScaledVector(side, big ? 3 : 1.9).add(V(0, big ? 3.5 : 2.0, 0)), p.clone().add(V(0, big ? 3 : 1.5, 0)), big ? 44 : 34, 5);
    this.ui.ultBanner(skill, u);
    this.audio.play('ult');
    this.fx.circle(p, u.hero.theme, { size: big ? 9 : 4.6, life: 1.6, spin: 1.5, variant: 1 });
    this.fx.emit({ pos: p.clone().setY(0.2), count: 70, colors: [u.hero.theme, 0xffffff], speed: [0.2, 1], up: 4, life: [0.6, 1.2], size: [0.1, 0.25], ring: big ? 3 : 1.2, drag: 0.8 });
    this.fx.light(p.clone().add(V(0, 2, 0)), u.hero.theme, 50, 1.2);
    u.hero.trigger('cast');
    if (big) await u.hero.pose({ rear: 1, jaw: 1, spread: 1, headX: -0.4, armRX: -2.4, armLX: -2.2 }, 0.4, ease.out);
    else await u.hero.pose({ armRX: -2.3, armLX: -2.1, armLZ: 0.6, armRZ: -0.6, torsoX: -0.25, headX: -0.3 }, 0.4, ease.out);
    await wait(0.7);
    this.ui.hideUlt();
    this.world.dimTarget = 0.45;
    // hard cut back to the wide angle (a smooth move from a close-up would sweep along the floor)
    d.cut(d.home.pos, d.home.look, d.home.fov);
    await u.hero.rest(0.18);
  }

  // ======================================================================= perform a move
  async perform(u, res) {
    const skill = u.skills[res.skill];
    const target = res.target ? this.byId[res.target] : null;
    this.beats = res.beats.map(b => b.slice());
    if (u.kind === 'boss') await this.bossPerform(u, skill, res);
    else {
      this.ui.skillBanner(u, skill);
      await this['sk_' + skill.id](u, skill, target);
    }
    this.flush();
    if (skill.ult || skill.charge) this.world.dimTarget = 0;
  }

  // ---- warrior
  async sk_cleave(u, s, t) {
    await this.approach(u, t);
    u.hero.trigger('attack');
    await u.hero.pose({ armRX: -2.7, armRZ: -0.2, elbowR: -0.2, torsoY: 0.5, torsoX: -0.15 }, 0.16, ease.out);
    this.audio.play('swing');
    this.fx.slash(u.root.position.clone().add(V(0, 1.3, 0)).addScaledVector(fwd(u), 0.6), u.root.rotation.y, u.hero.theme, { radius: 1.6, tilt: 0.5 });
    await u.hero.pose({ armRX: -0.2, elbowR: -0.1, torsoY: -0.6, torsoX: 0.25 }, 0.11, ease.in);
    this.nextBeat();
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
    this.nextBeat();
    this.world.director.shake(0.35);
    await wait(0.3);
    await tween(0.12, k => u.root.position.copy(p0).addScaledVector(f, (1 - k) * 0.55));
    u.hero.rest(0.25);
    await this.goBack(u);
  }

  async sk_quake(u, s) {
    await this.ultIntro(u, s);
    const foes = this.foes(u);
    if (!foes.length) return;
    const center = foes.reduce((a, f) => a.add(f.home), V()).multiplyScalar(1 / foes.length);
    const reach = foes.length === 1 ? foes[0].radius + 0.6 : 2.4;
    const land = center.clone().add(u.home.clone().sub(center).setY(0).normalize().multiplyScalar(reach));
    const d = this.world.director;
    const off = d.home.pos.clone().sub(d.home.look).multiplyScalar(0.9);
    d.shot(land.clone().add(off), land.clone().add(V(0, 1.2, 0)), 42, 3);
    const from = u.root.position.clone();
    const rot0 = u.root.rotation.y, rot1 = Math.atan2(center.x - from.x, center.z - from.z);
    await u.hero.pose({ armRX: -2.9, armLX: -2.6, crouch: 0.45 }, 0.15);
    this.audio.play('whoosh');
    u.hero.pose({ crouch: 0 }, 0.1);
    u.moving = true;
    await tween(0.55, k => {
      u.root.position.lerpVectors(from, land, k);
      u.root.position.y = Math.sin(k * Math.PI) * 5.5 * (1 - k * 0.25);
      u.root.rotation.y = lerpAngle(rot0, rot1, Math.min(1, k * 2));
    }, ease.inOut);
    u.moving = false;
    u.root.position.y = 0;
    u.hero.pose({ armRX: -0.1, armLX: -0.3, torsoX: 0.5, crouch: 0.5 }, 0.08, ease.in);
    this.audio.play('boom');
    d.shake(1.1);
    this.fx.explosion(land.clone().setY(0.3), u.hero.theme, 1.6);
    this.fx.ring(land, u.hero.theme, { r0: 0.5, r1: 12, life: 0.85, width: 0.12 });
    this.fx.ring(land, 0xffffff, { r0: 0.5, r1: 8, life: 0.6, width: 0.06 });
    this.fx.circle(land, u.hero.theme, { size: 7.5, life: 1.3, spin: 0.5 });
    this.fx.emit({ pos: land.clone().setY(0.2), count: 90, colors: [0x8a7a66, 0x5a4a3a, u.hero.theme], speed: [3, 9], up: 5, life: [0.6, 1.2], size: [0.2, 0.5], gravity: 14, drag: 0.8, ring: 1 });
    while (this.beats.length) { await wait(0.06); this.nextBeat(); }
    await wait(0.55);
    u.hero.rest(0.3);
    this.world.dimTarget = 0;
    await this.goBack(u);
  }

  // ---- rogue
  async sk_fang(u, s, t) {
    await this.approach(u, t);
    u.hero.trigger('attack');
    let i = 0;
    while (this.beats.length) {
      const right = i++ % 2 === 0;
      await u.hero.pose(right ? { armRX: -1.9, armRZ: -0.9, elbowR: -0.2, torsoY: 0.4 } : { armLX: -1.9, armLZ: 0.9, elbowL: -0.2, torsoY: -0.4 }, 0.08, ease.out);
      this.audio.play('swing');
      this.fx.slash(u.root.position.clone().add(V(0, 1.2, 0)).addScaledVector(fwd(u), 0.7), u.root.rotation.y, u.hero.theme, { radius: 1.1, tilt: right ? 0.9 : -0.9, flip: !right, life: 0.22 });
      await u.hero.pose(right ? { armRX: -0.6, armRZ: 0.3, torsoY: -0.3 } : { armLX: -0.6, armLZ: -0.3, torsoY: 0.3 }, 0.07, ease.in);
      this.nextBeat();
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
    this.fx.emit({ pos: t.chestPos(), count: 45, colors: [0x7dff5a, 0x2ecc40, 0xd6ff9a], speed: [1, 4], life: [0.4, 0.9], size: [0.15, 0.35], gravity: 3 });
    this.audio.play('poison');
    this.nextBeat();
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
    let i = 0;
    while (this.beats.length) {
      const t2 = this.peekTarget(); if (!t2) { this.nextBeat(); continue; }
      const a = rand(0, Math.PI * 2), r = t2.radius - 0.25;
      const pos = t2.home.clone().add(V(Math.sin(a) * r, 0, Math.cos(a) * r));
      u.root.position.copy(pos);
      u.root.rotation.y = Math.atan2(t2.home.x - pos.x, t2.home.z - pos.z);
      u.root.visible = true; smoke(pos); this.audio.play('shadow');
      u.hero.pose({ armRX: -2.0, armLX: -2.0, armRZ: -0.8, armLZ: 0.8 }, 0.04);
      await wait(0.05);
      u.hero.pose({ armRX: -0.5, armLX: -0.5, armRZ: 0.2, armLZ: -0.2 }, 0.08, ease.in);
      this.fx.slash(pos.clone().add(V(0, 1.2, 0)).addScaledVector(fwd(u), 0.6), u.root.rotation.y, u.hero.theme, { radius: 1.3, tilt: rand(-1, 1), flip: i++ % 2 === 1, life: 0.25 });
      this.audio.play('swing');
      this.nextBeat();
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
    this.nextBeat();
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
      this.fx.emit({ pos: f.home.clone().setY(0.3), count: 60, colors: [u.hero.theme, 0xffd27a, 0xff3b1f], speed: [0.5, 2.5], up: 5, life: [0.4, 0.9], size: [0.3, 0.6], ring: f.kind === 'boss' ? 2 : 0.6, grow: 0.6 });
      this.fx.glow(f.chestPos(), u.hero.theme, { scale: 4, life: 0.4 });
      this.fx.light(f.chestPos(), u.hero.theme, 35, 0.4);
      this.beatFor(f.id);
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
    const list = this.beats.splice(0);
    const tasks = list.map((b, i) => (async () => {
      const f = this.beatTarget(b);
      await wait(i * 0.22);
      this.audio.play('whoosh');
      const spot = f ? f.home.clone().add(f.kind === 'boss' ? V(rand(-1.5, 1.5), 0, rand(-1, 1.5)) : V()).setY(0.4) : center.clone();
      await this.fx.meteor(spot, u.hero.theme);
      this.audio.play('boom'); d.shake(0.7);
      this.applyBeat(b);
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
    const big = t.kind === 'boss';
    this.fx.circle(t.home, u.hero.theme, { size: big ? 6 : 3, life: 0.9, spin: -2, variant: 1 });
    await wait(0.22);
    this.fx.beam(t.home, u.hero.theme, { radius: big ? 2.2 : 1.0, height: 24, life: 0.7, intensity: 2 });
    this.fx.glow(t.chestPos(), 0xffffff, { scale: 4, life: 0.4 });
    if (u.nft.faction === 'orc') this.fx.emit({ pos: t.chestPos(), count: 40, colors: [u.hero.theme, 0xffffff], speed: [4, 9], life: [0.1, 0.3], size: [0.08, 0.18], drag: 4 });
    this.nextBeat();
    await wait(0.35);
    await u.hero.rest(0.25);
  }

  async sk_mend(u, s, t) {
    this.focusCam(u, t, 0.8);
    await this.castPose(u);
    this.audio.play('heal');
    this.healFx(t, u.hero.theme);
    this.nextBeat();
    await wait(0.45);
    await u.hero.rest(0.25);
  }

  async sk_grace(u, s) {
    await this.ultIntro(u, s);
    this.world.director.goHome(3);
    const allies = this.friends(u);
    const c = allies.reduce((a, f) => a.add(f.home), V()).multiplyScalar(1 / allies.length);
    this.fx.circle(c, u.hero.theme, { size: allies.length > 3 ? 18 : 13, life: 1.7, spin: 0.6, variant: 1 });
    this.fx.ring(c, u.hero.theme, { r0: 1, r1: 10, life: 1.0 });
    this.audio.play('holy');
    await wait(0.3);
    while (this.beats.length) {
      const a = this.peekTarget();
      if (a) this.healFx(a, u.hero.theme);
      this.nextBeat();
      await wait(0.1);
    }
    this.audio.play('heal');
    await wait(0.55);
    u.hero.rest(0.3);
    this.world.dimTarget = 0;
  }

  // ======================================================================= boss moves
  async bossPerform(b, skill, res) {
    const first = this.beats[0] && this.beats[0][0];
    if (first && first.t === 'charge') {
      this.beats.shift();
      await this.bossCharge(b, skill);
      return;
    }
    const charged = !!skill.charge;
    if (charged) {
      this.clearDanger();
      this.ui.bossAlert(null);
      await this.ultIntro(b, skill);
    } else {
      this.ui.skillBanner(b, skill);
    }
    const anim = skill.anim || 'lunge';
    if (skill.target === 'self') await this.bossRoar(b, skill);
    else if (skill.target === 'enemy') await this.bossLunge(b, skill);
    else if (anim === 'slam') await this.bossSlam(b, skill, charged);
    else if (anim === 'breath') await this.bossBreath(b, skill, charged);
    else if (anim === 'nova') await this.bossNova(b, skill, charged);
    else await this.bossVolley(b, skill, anim, charged);
    await b.hero.rest(0.3);
  }

  async bossCharge(b, skill) {
    const d = this.world.director, col = b.hero.theme;
    d.shot(V(b.home.x + 4, 5, b.home.z + 13), b.home.clone().add(V(0, 2.6, 0)), 44, 3);
    this.ui.skillBanner(b, skill);
    this.audio.play('ult');
    b.hero.trigger('cast');
    b.hero.pose({ rear: 0.6, crouch: 0.25, spread: 1, jaw: 0.6, armRX: -2.0, armLX: -2.0, headX: -0.3 }, 0.4, ease.out);
    this.fx.circle(b.home, col, { size: 10, life: 2.0, spin: 1.2, variant: 1 });
    this.fx.light(b.chestPos(), col, 60, 1.6);
    for (let i = 0; i < 4; i++) setTimeout(() => this.fx.emit({ pos: b.home.clone().setY(0.3), count: 40, colors: [col, 0xffffff], speed: [0.1, 0.6], up: 6, life: [0.6, 1.3], size: [0.15, 0.35], ring: 3, drag: 0.5 }), i * 180);
    this.showDanger();
    this.ui.bossAlert(`${b.boss.name} is charging <b>${skill.name}</b>! Stun it to interrupt.`);
    await wait(1.3);
    await b.hero.rest(0.4);
  }

  async bossRoar(b) {
    const col = b.hero.theme;
    this.world.director.shot(V(b.home.x + 3, 5, b.home.z + 12), b.home.clone().add(V(0, 2.8, 0)), 44, 3);
    b.hero.trigger('cast');
    this.audio.play('ult');
    await b.hero.pose({ rear: 0.9, jaw: 1, spread: 1, headX: -0.5, armRX: -2.6, armLX: -2.4 }, 0.35, ease.out);
    this.world.director.shake(0.6);
    this.fx.ring(b.home, col, { r1: 12, life: 0.9, width: 0.2 });
    this.fx.light(b.chestPos(), col, 60, 0.8);
    this.fx.emit({ pos: b.home.clone().setY(0.3), count: 80, colors: [col, 0xffffff], speed: [1, 4], up: 4, life: [0.5, 1.1], size: [0.2, 0.45], ring: 2.5 });
    this.flush();
    await wait(0.7);
  }

  async bossLunge(b, skill) {
    const t = this.peekTarget();
    if (!t) return;
    await this.approach(b, t);
    b.hero.trigger('attack');
    while (this.beats.length) {
      await b.hero.pose({ rear: 0.5, jaw: 1, armRX: -2.6, armLX: -1.4, torsoY: 0.4, headX: -0.3 }, 0.22, ease.out);
      this.audio.play('swing');
      await b.hero.pose({ rear: -0.2, lunge: 1, slam: 1, jaw: 0.3, armRX: -0.3, armLX: -0.6, torsoY: -0.4, headX: 0.3 }, 0.12, ease.in);
      this.fx.slash(t.chestPos().add(V(0, 0.3, 0)), b.root.rotation.y, b.hero.theme, { radius: 2.0, tilt: rand(-0.6, 0.6), life: 0.3 });
      this.fx.explosion(t.chestPos(), b.hero.theme, 0.7);
      this.world.director.shake(0.5);
      this.nextBeat();
      await wait(0.25);
      b.hero.pose({ lunge: 0, slam: 0 }, 0.2);
    }
    await wait(0.2);
    b.hero.rest(0.25);
    await this.goBack(b);
  }

  async bossSlam(b, skill, charged) {
    const d = this.world.director, col = b.hero.theme;
    if (!charged) d.shot(V(0, 9, 17), V(0, 1.5, -1), 46, 3);
    await b.hero.pose({ rear: 1, crouch: 0, armRX: -2.9, armLX: -2.7, jaw: 1, spread: 1 }, 0.3, ease.out);
    this.audio.play('whoosh');
    await b.hero.pose({ rear: -0.3, crouch: 0.6, slam: 1, armRX: -0.2, armLX: -0.2, lunge: 0.6 }, 0.12, ease.in);
    this.audio.play('boom');
    d.shake(charged ? 1.4 : 0.9);
    const front = b.home.clone().add(V(0, 0, b.radius));
    this.fx.explosion(front.clone().setY(0.4), col, charged ? 2 : 1.3);
    this.fx.ring(front, col, { r0: 0.5, r1: 18, life: 1.0, width: 0.18 });
    this.fx.ring(front, 0xffffff, { r0: 0.5, r1: 12, life: 0.7, width: 0.08 });
    const order = this.beats.splice(0).map(bt => ({ bt, t: this.beatTarget(bt) })).sort((a, c) => (a.t && c.t ? a.t.home.distanceTo(front) - c.t.home.distanceTo(front) : 0));
    for (const { bt, t } of order) {
      await wait(0.09);
      if (t) this.fx.emit({ pos: t.home.clone().setY(0.2), count: 40, colors: [0x8a7a66, 0x5a4a3a, col], speed: [2, 6], up: 5, life: [0.5, 1.0], size: [0.2, 0.45], gravity: 12, ring: 0.8 });
      this.applyBeat(bt);
    }
    await wait(0.5);
  }

  async bossBreath(b, skill, charged) {
    const d = this.world.director, col = b.hero.theme;
    if (!charged) d.shot(V(-8, 8, 14), V(0, 1.8, -0.5), 46, 3);
    b.hero.trigger('attack');
    await b.hero.pose({ rear: 0.5, jaw: 1, neck: 0.6, headX: -0.2, spread: 0.6 }, 0.3, ease.out);
    this.audio.play('fire');
    const order = this.beats.splice(0).map(bt => ({ bt, t: this.beatTarget(bt) })).sort((a, c) => (a.t && c.t ? a.t.home.x - c.t.home.x : 0));
    for (const { bt, t } of order) {
      if (!t) { this.applyBeat(bt); continue; }
      const from = b.tipPos(), to = t.chestPos();
      b.hero.pose({ torsoY: Math.atan2(t.home.x - b.home.x, t.home.z - b.home.z) * 0.8, rear: 0.2, neck: -0.2, headX: 0.3 }, 0.15);
      for (let k = 0; k < 5; k++) {
        const p = from.clone().lerp(to, (k + 1) / 5);
        this.fx.emit({ pos: p, count: charged ? 26 : 16, colors: [col, 0xffd27a, 0xff3b1f], speed: [0.5, 2], life: [0.25, 0.55], size: [0.4, 0.9], spread: 0.3 + k * 0.1, grow: 1, drag: 1 });
      }
      this.fx.light(to, col, 40, 0.4);
      await wait(0.12);
      this.fx.explosion(to, col, charged ? 1.0 : 0.6);
      this.applyBeat(bt, { color: col });
      await wait(0.08);
    }
    await wait(0.4);
  }

  async bossNova(b, skill, charged) {
    const d = this.world.director, col = b.hero.theme;
    if (!charged) d.shot(V(0, 10, 17), V(0, 1.5, -1), 46, 3);
    b.hero.trigger('cast');
    await b.hero.pose({ crouch: 0.4, jaw: 0.5, armRX: -1.2, armLX: -1.2, armRZ: -0.9, armLZ: 0.9, spread: 0.3 }, 0.3);
    this.fx.glow(b.chestPos(), col, { scale: 8, life: 0.6 });
    this.fx.light(b.chestPos(), col, 70, 0.7);
    await wait(0.25);
    await b.hero.pose({ crouch: 0, rear: 0.6, jaw: 1, spread: 1, armRX: -2.4, armLX: -2.4, armRZ: -0.3, armLZ: 0.3 }, 0.12, ease.out);
    this.audio.play('boom');
    d.shake(charged ? 1.2 : 0.7);
    this.fx.ring(b.home, col, { r0: 1, r1: 20, life: 1.0, width: 0.22 });
    this.fx.ring(b.home, 0xffffff, { r0: 1, r1: 14, life: 0.8, width: 0.08 });
    this.fx.emit({ pos: b.chestPos(), count: 120, colors: [col, 0xffffff], speed: [4, 12], life: [0.4, 0.9], size: [0.2, 0.5], drag: 1.2 });
    const order = this.beats.splice(0).map(bt => ({ bt, t: this.beatTarget(bt) })).sort((a, c) => (a.t && c.t ? a.t.home.distanceTo(b.home) - c.t.home.distanceTo(b.home) : 0));
    await wait(0.25);
    for (const { bt, t } of order) {
      if (t) this.fx.glow(t.chestPos(), col, { scale: 4, life: 0.4 });
      this.applyBeat(bt, { color: col });
      await wait(0.08);
    }
    await wait(0.45);
  }

  // projectiles / beams / sweeping hits, one per beat
  async bossVolley(b, skill, anim, charged) {
    const d = this.world.director, col = b.hero.theme;
    if (!charged) d.shot(V(0, 10, 17), V(0, 1.5, -1), 46, 3);
    b.hero.trigger(anim === 'beam' ? 'cast' : 'attack');
    await b.hero.pose({ rear: 0.4, jaw: 1, armRX: -2.2, armLX: -1.8, spread: 0.8, tail: 1 }, 0.25, ease.out);
    while (this.beats.length) {
      const bt = this.beats.shift(), t = this.beatTarget(bt);
      if (!t) { this.applyBeat(bt); continue; }
      if (anim === 'beam') {
        this.fx.circle(t.home, col, { size: 3, life: 0.6, spin: -2, variant: 1 });
        await wait(0.12);
        this.fx.beam(t.home, col, { radius: 1.0, height: 26, life: 0.6, intensity: 2.2 });
        this.fx.explosion(t.chestPos(), col, 0.6);
        this.audio.play('holy');
      } else if (anim === 'sweep') {
        b.hero.pose({ tail: b.hero.act.tail > 0 ? -1 : 1, torsoY: (t.home.x - b.home.x) * 0.04 }, 0.12);
        this.fx.projectile(b.tipPos(), t.chestPos(), col, { duration: 0.22, arc: 0.6, size: 0.9 });
        await wait(0.2);
        this.fx.slash(t.chestPos(), Math.PI, col, { radius: 1.3, tilt: rand(-1, 1), life: 0.25 });
        this.audio.play('swing');
      } else {
        this.audio.play('poison');
        await this.fx.projectile(b.tipPos(), t.chestPos(), col, { duration: 0.32, arc: 1.6, size: 1.2 });
        this.fx.explosion(t.chestPos(), col, 0.5);
      }
      this.applyBeat(bt, { color: col });
      await wait(0.1);
    }
    await wait(0.35);
  }
}
