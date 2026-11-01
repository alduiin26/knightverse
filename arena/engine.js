// KnightVerse Arena - battle rules engine
// Pure logic, no graphics. The game plays the events it produces, and the server
// replays the same battle from the seed + the player's moves to check the result.
// Every random roll uses a seeded generator, so the same seed + moves = the same battle.
import { ROSTER, SKILLS, STATUS_INFO, RIVAL_NAMES, derive } from './data.js';
import { BOSSES, BOSS_PHASES } from './bosses.js';

export const RULES = {
  dailyUses: 3,          // battles per hero per day
  pvpMin: 1, pvpMax: 3,  // heroes in a PvP battle
  bossTeam: 5,           // heroes in a boss raid
  pvpWin: 10, pvpLoss: 3, bossLoss: 3, // points per hero
  pvpTurnCap: 150, bossTurnCap: 240,
};

export function battlePoints(mode, bossId, win, heroes) {
  if (mode === 'boss') return heroes * (win ? BOSSES[bossId].winPoints : RULES.bossLoss);
  return heroes * (win ? RULES.pvpWin : RULES.pvpLoss);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BY_ID = Object.fromEntries(ROSTER.map(n => [n.id, n]));
export const nftById = id => BY_ID[id];

// opponent team of the same size and rarity, chosen from the seed
export function makeOpponent(teamIds, seed) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const used = new Set(teamIds);
  return teamIds.map(id => {
    const p = BY_ID[id];
    const pool = ROSTER.filter(n => n.rarity === p.rarity && !used.has(n.id));
    const n = pool[Math.floor(rng() * pool.length)];
    used.add(n.id);
    return n.id;
  });
}
export function rivalName(seed) {
  const rng = mulberry32((seed ^ 0x51ed270b) >>> 0);
  return `${RIVAL_NAMES[Math.floor(rng() * RIVAL_NAMES.length)]}_${10 + Math.floor(rng() * 89)}`;
}

// checks a team request; returns an error text or null
export function validateTeam(mode, team, boss) {
  if (!Array.isArray(team)) return 'bad_team';
  if (new Set(team).size !== team.length) return 'duplicate_hero';
  if (team.some(id => !BY_ID[id])) return 'unknown_hero';
  if (mode === 'pvp') { if (team.length < RULES.pvpMin || team.length > RULES.pvpMax) return 'team_size'; }
  else if (mode === 'boss') { if (team.length !== RULES.bossTeam) return 'team_size'; if (!BOSSES[boss]) return 'unknown_boss'; }
  else return 'bad_mode';
  return null;
}

const DOT = { burn: 0.06, poison: 0.07 };
const BOSS_DOT_SCALE = 0.3;

export class Engine {
  // mode: 'pvp' | 'boss'; team / enemy: arrays of NFT ids; boss: boss id; seed: uint32
  constructor({ mode, team, enemy = [], boss = null, seed }) {
    this.mode = mode;
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.aiRng = mulberry32((this.seed ^ 0x5bd1e995) >>> 0);
    this.units = [];
    team.forEach((id, i) => this.units.push(this._hero(BY_ID[id], 'player', i)));
    if (mode === 'boss') this.units.push(this._boss(BOSSES[boss]));
    else enemy.forEach((id, i) => this.units.push(this._hero(BY_ID[id], 'enemy', i)));
    this.byId = Object.fromEntries(this.units.map(u => [u.id, u]));
    for (const u of this.units) u.bar = this.rng() * 25;
    this.turns = 0; this.crits = 0;
    this.over = false; this.forfeited = false; this.current = null;
    this.cap = mode === 'boss' ? RULES.bossTurnCap : RULES.pvpTurnCap;
    this._beats = null;
  }

  _hero(nft, team, slot) {
    const d = derive(nft), skills = SKILLS[nft.cls];
    return {
      id: (team === 'player' ? 'p' : 'e') + slot, kind: 'hero', team, slot, nft, d, hp: d.maxHP, bar: 0,
      status: {}, fresh: new Set(), skills, cd: skills.map(s => (s.ult ? 2 : 0)), alive: true, dealt: 0, healed: 0,
    };
  }

  _boss(b) {
    const d = { ...b.stats };
    return {
      id: 'b0', kind: 'boss', team: 'enemy', slot: 0, boss: b, d, hp: d.maxHP, bar: 0,
      status: {}, fresh: new Set(), skills: b.skills, cd: b.skills.map(s => (s.charge ? 3 : s.cd > 0 ? 1 : 0)),
      alive: true, dealt: 0, healed: 0, phase: 0, pmul: 1, charging: null, stunImmune: 0,
    };
  }

  alive() { return this.units.filter(u => u.alive); }
  foes(u) { return this.units.filter(x => x.alive && x.team !== u.team); }
  friends(u) { return this.units.filter(x => x.alive && x.team === u.team); }
  pct(u) { return u.hp / u.d.maxHP; }
  forfeit() { this.over = true; this.forfeited = true; }

  // fill the attack bars until someone reaches 100; returns the unit that acts
  advance() {
    const alive = this.alive();
    if (!alive.length || this.over) return null;
    let tMin = Infinity;
    for (const u of alive) tMin = Math.min(tMin, Math.max(0, (100 - u.bar) / u.d.speed));
    for (const u of alive) u.bar += u.d.speed * tMin;
    let best = null;
    for (const u of alive) if (!best || u.bar > best.bar + 1e-6 || (Math.abs(u.bar - best.bar) < 1e-6 && this.rng() < 0.5)) best = u;
    return { actor: best, tMin };
  }

  // who acts next (display only, no random rolls)
  predictOrder(n = 6) {
    const sim = this.alive().map(u => ({ u, bar: u.bar }));
    const out = [];
    let guard = 0;
    while (out.length < n && sim.length && guard++ < 60) {
      let tMin = Infinity;
      for (const s of sim) tMin = Math.min(tMin, (100 - s.bar) / s.u.d.speed);
      tMin = Math.max(0, tMin);
      for (const s of sim) s.bar += s.u.d.speed * tMin;
      const best = sim.reduce((a, b) => (b.bar > a.bar ? b : a));
      out.push(best.u); best.bar = 0;
    }
    return out;
  }

  // start of a turn: cooldowns, damage over time, stun. Returns { beats, canAct }
  startTurn(u) {
    this.turns++;
    this.current = u;
    u.bar = 0;
    u.cd = u.cd.map(c => Math.max(0, c - 1));
    const beats = this._beats = [];
    if (u.kind === 'boss' && u.stunImmune > 0) u.stunImmune--;
    for (const k of ['burn', 'poison']) {
      if (u.status[k] > 0 && u.alive) {
        this._beat();
        const dmg = Math.max(1, Math.round(u.d.maxHP * DOT[k] * (u.kind === 'boss' ? BOSS_DOT_SCALE : 1)));
        this._damage(u, dmg, null, { t: 'dot', kind: k });
      }
    }
    if (!u.alive || this._checkEnd()) { this._post(); return { beats, canAct: false }; }
    if (u.status.stun > 0) {
      this._beat();
      this._ev({ t: 'stunned', tgt: u.id });
      if (u.charging != null) {
        const si = u.charging;
        u.charging = null; u.cd[si] = 2;
        this._ev({ t: 'interrupt', tgt: u.id, skill: si });
      }
      if (u.kind === 'boss') u.stunImmune = 2;
      this._tick(u);
      this._ev({ t: 'sync', tgt: u.id, s: this._st(u) });
      this._post();
      return { beats, canAct: false };
    }
    return { beats, canAct: true };
  }

  // perform a move. skill = index, target = unit id (optional for area skills)
  act(u, skill, target) {
    let si = Number.isInteger(skill) && u.skills[skill] && u.cd[skill] === 0 ? skill : 0;
    if (u.kind === 'boss' && u.charging != null) si = u.charging;
    const s = u.skills[si];
    if (u.kind === 'boss' && s.minPhase && u.phase < s.minPhase) si = 0;
    const sk = u.skills[si];
    let t = target ? this.byId[target] : null;
    const wantAlly = sk.target === 'ally';
    const wantFoe = sk.target === 'enemy';
    if (wantAlly && (!t || !t.alive || t.team !== u.team)) t = this._lowest(this.friends(u));
    if (wantFoe && (!t || !t.alive || t.team === u.team)) t = this._lowest(this.foes(u));
    if (!wantAlly && !wantFoe) t = null;
    const beats = this._beats = [];
    if (u.kind === 'boss') this._bossMove(u, si, t);
    else {
      u.cd[si] = sk.cd;
      this['_h_' + sk.id](u, sk, t);
    }
    this._tick(u);
    this._post();
    return { skill: si, target: t ? t.id : null, beats, charging: u.charging != null };
  }

  _post() {
    this._checkEnd();
    if (this.turns >= this.cap) this.over = true;
  }

  _checkEnd() {
    if (this.over) return true;
    const p = this.units.some(u => u.team === 'player' && u.alive);
    const e = this.units.some(u => u.team === 'enemy' && u.alive);
    if (!p || !e) this.over = true;
    return this.over;
  }

  result() {
    const players = this.units.filter(u => u.team === 'player');
    const pA = players.filter(u => u.alive), eA = this.units.filter(u => u.team === 'enemy' && u.alive);
    let win;
    if (this.forfeited) win = false;
    else if (!eA.length) win = true;
    else if (!pA.length) win = false;
    else if (this.mode === 'boss') win = false; // ran out of turns
    else { const sum = a => a.reduce((s, u) => s + this.pct(u), 0); win = sum(pA) >= sum(eA); }
    const mvp = players.reduce((a, b) => ((b.dealt + b.healed) > (a.dealt + a.healed) ? b : a));
    return {
      win, turns: this.turns, crits: this.crits, left: pA.length, mvp: mvp.id,
      dealt: players.reduce((s, u) => s + u.dealt, 0),
      bossHp: this.mode === 'boss' ? this.units.find(u => u.kind === 'boss').hp : null,
    };
  }

  // ------------------------------------------------------------------ AI
  _lowest(list) { return list.length ? list.reduce((a, b) => (this.pct(b) < this.pct(a) ? b : a)) : null; }
  _pickTarget(foes, rng) {
    if (!foes.length) return null;
    if (rng() < 0.6) return this._lowest(foes);
    return foes[Math.floor(rng() * foes.length)];
  }

  // returns { skill, target(id) }. rng: the engine's AI generator for enemies, any generator for player auto-play
  ai(u, rng = this.aiRng) {
    if (u.kind === 'boss') return this._bossAI(u, rng);
    const foes = this.foes(u), allies = this.friends(u);
    const ready = i => u.cd[i] === 0;
    const id = x => (x ? x.id : null);
    if (u.nft.cls === 'priest') {
      const hurt = allies.filter(a => this.pct(a) < 0.6);
      const critical = allies.some(a => this.pct(a) < 0.35);
      if (ready(2) && (hurt.length >= 2 || critical)) return { skill: 2, target: null };
      if (ready(1) && hurt.length) return { skill: 1, target: id(this._lowest(hurt)) };
      if (ready(2) && rng() < 0.4) return { skill: 2, target: null };
      return { skill: 0, target: id(this._pickTarget(foes, rng)) };
    }
    if (ready(2)) return { skill: 2, target: id(this._pickTarget(foes, rng)) };
    if (ready(1)) return { skill: 1, target: id(this._pickTarget(foes, rng)) };
    return { skill: 0, target: id(this._pickTarget(foes, rng)) };
  }

  _bossAI(u, rng) {
    const foes = this.foes(u);
    const tgt = () => { const t = this._pickTarget(foes, rng); return t ? t.id : null; };
    if (u.charging != null) return { skill: u.charging, target: null };
    for (let i = u.skills.length - 1; i > 0; i--) {
      const s = u.skills[i];
      if (u.cd[i] > 0 || (s.minPhase && u.phase < s.minPhase)) continue;
      if (s.target === 'self' && !(Object.keys(u.status).some(k => !STATUS_INFO[k].good) || this.pct(u) < 0.6)) continue;
      if (s.charge || rng() < 0.8) return { skill: i, target: s.target === 'enemy' ? tgt() : null };
    }
    return { skill: 0, target: tgt() };
  }

  // ------------------------------------------------------------------ events
  _beat() { this._beats.push([]); }
  _ev(e) { if (!this._beats.length) this._beat(); this._beats[this._beats.length - 1].push(e); }
  _st(u) { return { hp: u.hp, status: { ...u.status }, alive: u.alive }; }

  _roll(att, def, mult, opts = {}) {
    const r = this.rng;
    let v = (40 + att.d.power * 3.2) * mult * (0.92 + r() * 0.16);
    if (att.pmul) v *= att.pmul;
    if (att.status.atkUp) v *= 1.25;
    if (def.status.defBreak) v *= 1.25;
    v *= 1 - def.d.dr;
    const crit = r() < att.d.critChance + (opts.critBonus || 0);
    const glance = !crit && r() < def.d.evade;
    if (crit) v *= att.d.critDmg;
    if (glance) v *= 0.6;
    return { dmg: Math.max(1, Math.round(v)), crit, glance };
  }

  _strike(att, def, mult, opts = {}) {
    if (!def || !def.alive) return null;
    const r = this._roll(att, def, mult, opts);
    if (r.crit && att.team === 'player') this.crits++;
    att.dealt += Math.min(r.dmg, def.hp);
    this._damage(def, r.dmg, att, { t: 'hit', crit: r.crit, glance: r.glance });
    return r;
  }

  _damage(def, amount, src, info) {
    if (!def.alive) return;
    def.hp = Math.max(0, def.hp - amount);
    if (def.hp <= 0) { def.alive = false; def.charging = null; }
    this._ev({ ...info, src: src ? src.id : null, tgt: def.id, dmg: amount, kill: !def.alive, s: this._st(def) });
    if (def.kind === 'boss' && def.alive) this._phaseCheck(def);
  }

  _phaseCheck(b) {
    while (b.phase < BOSS_PHASES.length && this.pct(b) < BOSS_PHASES[b.phase]) {
      b.phase++;
      b.pmul *= 1.12;
      b.d = { ...b.d, speed: b.d.speed * 1.08 };
      for (const k of Object.keys(b.status)) if (!STATUS_INFO[k].good) delete b.status[k];
      this._ev({ t: 'phase', tgt: b.id, phase: b.phase, s: this._st(b) });
    }
  }

  _status(att, def, key, chance, turns) {
    if (!def || !def.alive || !chance) return false;
    if (this.rng() > chance) return false;
    const info = STATUS_INFO[key];
    if (key === 'stun' && def.kind === 'boss' && def.stunImmune > 0) {
      this._ev({ t: 'status', src: att.id, tgt: def.id, key, ok: false, immune: true, s: this._st(def) });
      return false;
    }
    if (!info.good && this.rng() < def.d.resist) {
      this._ev({ t: 'status', src: att.id, tgt: def.id, key, ok: false, resisted: true, s: this._st(def) });
      return false;
    }
    def.status[key] = Math.max(def.status[key] || 0, turns);
    if (def === this.current) def.fresh.add(key);
    this._ev({ t: 'status', src: att.id, tgt: def.id, key, ok: true, turns, s: this._st(def) });
    return true;
  }

  _tick(u) {
    for (const k of Object.keys(u.status)) {
      if (u.fresh.has(k)) continue;
      u.status[k]--;
      if (u.status[k] <= 0) delete u.status[k];
    }
    u.fresh.clear();
  }

  _cleanse(u) {
    let any = false;
    for (const k of Object.keys(u.status)) if (!STATUS_INFO[k].good) { delete u.status[k]; any = true; }
    this._ev({ t: 'cleanse', tgt: u.id, any, s: this._st(u) });
  }

  _heal(src, t, mult) {
    if (!t.alive) return;
    const amount = Math.round((60 + src.d.power * 3) * mult * (0.95 + this.rng() * 0.1));
    const real = Math.min(amount, t.d.maxHP - t.hp);
    t.hp += real; src.healed += real;
    this._ev({ t: 'heal', src: src.id, tgt: t.id, amount, s: this._st(t) });
  }

  // ------------------------------------------------------------------ hero skills
  _h_cleave(u, s, t) { this._beat(); this._strike(u, t, s.mult); }
  _h_bash(u, s, t) { this._beat(); this._strike(u, t, s.mult); this._status(u, t, 'stun', s.stun, 1); }
  _h_quake(u, s) {
    for (const f of this.foes(u)) { this._beat(); this._strike(u, f, s.mult); this._status(u, f, 'defBreak', s.defBreak, 2); }
  }
  _h_fang(u, s, t) {
    for (let i = 0; i < s.hits; i++) { this._beat(); this._strike(u, t, s.mult); if (!t.alive) break; }
  }
  _h_venom(u, s, t) {
    this._beat();
    this._strike(u, t, s.mult);
    this._status(u, t, 'poison', s.poison, 2);
    u.bar = Math.min(100, u.bar + s.selfBar);
    this._ev({ t: 'bar', tgt: u.id, delta: s.selfBar, bar: u.bar });
  }
  _h_shadow(u, s) {
    for (let i = 0; i < s.hits; i++) {
      const foes = this.foes(u); if (!foes.length) break;
      const t = foes[Math.floor(this.rng() * foes.length)];
      this._beat();
      this._strike(u, t, s.mult, { critBonus: s.critBonus });
    }
  }
  _h_bolt(u, s, t) { this._beat(); this._strike(u, t, s.mult); this._status(u, t, 'burn', s.burn, 2); }
  _h_wave(u, s) {
    for (const f of this.foes(u)) { this._beat(); this._strike(u, f, s.mult); this._status(u, f, 'burn', s.burn, 2); }
  }
  _h_meteor(u, s) {
    for (const f of this.foes(u)) { this._beat(); this._strike(u, f, s.mult); this._status(u, f, 'burn', s.burn, 2); }
  }
  _h_smite(u, s, t) { this._beat(); this._strike(u, t, s.mult); }
  _h_mend(u, s, t) { this._beat(); this._heal(u, t, s.heal); this._cleanse(t); }
  _h_grace(u, s) {
    for (const a of this.friends(u)) {
      this._beat(); this._heal(u, a, s.heal); this._cleanse(a); this._status(u, a, 'atkUp', 1, s.atkUp);
    }
  }

  // ------------------------------------------------------------------ boss moves
  _bossMove(u, si, t) {
    const s = u.skills[si];
    if (s.charge && u.charging == null) {
      // first turn of a telegraphed attack: only gather power
      u.charging = si;
      this._beat();
      this._ev({ t: 'charge', tgt: u.id, skill: si });
      return;
    }
    if (s.charge) u.charging = null;
    u.cd[si] = s.cd;
    const effects = f => {
      if (s.stun) this._status(u, f, 'stun', s.stun, 1);
      if (s.poison) this._status(u, f, 'poison', s.poison, 2);
      if (s.burn) this._status(u, f, 'burn', s.burn, 2);
      if (s.defBreak) this._status(u, f, 'defBreak', s.defBreak, 2);
    };
    if (s.target === 'self') {
      this._beat();
      if (s.cleanse) this._cleanse(u);
      if (s.healPct) {
        const real = Math.min(Math.round(u.d.maxHP * s.healPct), u.d.maxHP - u.hp);
        u.hp += real;
        this._ev({ t: 'heal', src: u.id, tgt: u.id, amount: real, s: this._st(u) });
      }
      if (s.atkUp) this._status(u, u, 'atkUp', 1, s.atkUp);
      return;
    }
    if (s.target === 'enemy') {
      for (let i = 0; i < (s.hits || 1); i++) { this._beat(); this._strike(u, t, s.mult); effects(t); if (!t.alive) break; }
      return;
    }
    if (s.target === 'random') {
      for (let i = 0; i < (s.hits || 1); i++) {
        const foes = this.foes(u); if (!foes.length) break;
        const f = foes[Math.floor(this.rng() * foes.length)];
        this._beat(); this._strike(u, f, s.mult); effects(f);
      }
      return;
    }
    for (const f of this.foes(u)) { this._beat(); this._strike(u, f, s.mult); effects(f); }
  }
}

// Server check: replays a whole battle from the seed and the player's moves.
// log: [{ u: unitId, s: skillIndex, t: targetId|null }, ...] in the order the player made them.
export function replayBattle({ mode, team, enemy, boss, seed, log, forfeit }) {
  const E = new Engine({ mode, team, enemy, boss, seed });
  let li = 0;
  let guard = 0;
  while (!E.over && guard++ < 2000) {
    const a = E.advance();
    if (!a) break;
    const u = a.actor;
    const st = E.startTurn(u);
    if (E.over || !st.canAct) continue;
    let choice;
    if (u.team === 'player') {
      if (li >= log.length) {
        if (forfeit) { E.forfeit(); break; }
        return { error: 'log_short' };
      }
      const c = log[li++];
      if (!c || c.u !== u.id) return { error: 'log_mismatch' };
      choice = { skill: c.s, target: c.t || null };
    } else {
      choice = E.ai(u, E.aiRng);
    }
    E.act(u, choice.skill, choice.target);
  }
  if (forfeit) E.forfeit();
  if (li < log.length) return { error: 'log_long' };
  return E.result();
}
