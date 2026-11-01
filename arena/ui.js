// KnightVerse Arena - HTML interface: screens, unit HUDs, skill bar, floating text
import * as THREE from 'three';
import { ROSTER, RARITIES, CLASSES, FACTIONS, SKILLS, STATUS_INFO, derive } from './data.js';
import { clock } from './core.js';

// ---------------------------------------------------------------------------
// icons (simple line icons, 24x24)
// ---------------------------------------------------------------------------
const PATHS = {
  sword: '<path d="M5 19 18 6V3h-3L2 16"/><path d="m4.5 13.5 6 6"/><path d="M3 21l3-3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9.5 4.5-1.5 8-4.5 8-9.5V6z"/><path d="M12 8v8M8 12h8"/>',
  quake: '<path d="M2 20h20"/><path d="m5 20 3-6 3 3 2-5 3 4 3-2 1 6"/><path d="M12 2v5M7 4l2 3M17 4l-2 3"/>',
  daggers: '<path d="M4 20 15 5l1.5 1.5L5 21z"/><path d="M20 20 9 5 7.5 6.5 19 21z"/>',
  drop: '<path d="M12 3c4 5 6.5 8.5 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11.5 8 8 12 3z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
  shadow: '<path d="M15 3a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15 3z"/><path d="m3 7 4 2M2 12h4"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 .5 2 1.5 3 3 3-1-3 0-6 0-8z"/>',
  wave: '<path d="M2 16c3-4 5 4 8 0s5 4 8 0 3-2 4-1"/><path d="M2 10c3-4 5 4 8 0s5 4 8 0 3-2 4-1"/>',
  meteor: '<circle cx="16" cy="8" r="4"/><path d="M3 21 12.5 11.5M4 15l6-6M9 21l6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  heart: '<path d="M12 20s-8-5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z"/><path d="M12 10v5M9.5 12.5h5"/>',
  wings: '<path d="M12 9C9 5 4 4 2 6c2 .5 3 2 4.5 2.5C4.5 9 3.5 11 4 13c2-.5 5-2 8-4z"/><path d="M12 9c3-4 8-5 10-3-2 .5-3 2-4.5 2.5 2 .5 3 2.5 2.5 4.5-2-.5-5-2-8-4z"/><ellipse cx="12" cy="4" rx="3" ry="1"/><path d="M12 9v12"/>',
  stun: '<path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
  burn: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 .5 2 1.5 3 3 3-1-3 0-6 0-8z"/>',
  poison: '<path d="M12 3c4 5 6.5 8.5 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11.5 8 8 12 3z"/>',
  defBreak: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9.5 4.5-1.5 8-4.5 8-9.5V6z"/><path d="m13 6-3 5 4 2-3 6"/>',
  atkUp: '<path d="M12 21V5M6 11l6-6 6 6"/>',
  warrior: '<path d="M5 19 18 6V3h-3L2 16"/><path d="m4.5 13.5 6 6"/>',
  rogue: '<path d="M4 20 15 5l1.5 1.5L5 21z"/><path d="M20 20 9 5 7.5 6.5 19 21z"/>',
  mage: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 .5 2 1.5 3 3 3-1-3 0-6 0-8z"/>',
  priest: '<path d="M12 3v18M6 9h12"/><circle cx="12" cy="9" r="2"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
}

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RLETTER = { common: 'C', rare: 'R', epic: 'E', legendary: 'L' };

export class UI {
  constructor({ world, audio }) {
    this.world = world;
    this.audio = audio;
    this.screens = ['lobby', 'select', 'vs', 'battle', 'result'];
    this.battle = null;
    this.pending = null;
    this.onPreview = null;
    this.floatStack = new Map();
    this._bindControls();
  }

  show(name) {
    for (const s of this.screens) $('#' + s).classList.toggle('active', s === name);
    document.body.dataset.screen = name;
  }

  click() { this.audio.play('click'); }

  // ===================================================================== LOBBY
  showLobby() {
    this.show('lobby');
    return new Promise(res => {
      const b = $('#enterBtn');
      b.onclick = () => { this.audio.unlock(); this.click(); res(); };
    });
  }

  // ===================================================================== SELECT
  showSelect(prevTeam = []) {
    this.show('select');
    const team = prevTeam.slice();
    let filterF = 'all', filterR = 'all';
    let focus = team[0] || ROSTER.find(n => n.rarity === 'legendary');
    const grid = $('#rosterGrid');

    // build the grid once per filter change; selection changes only toggle classes
    const cards = new Map();
    const renderGrid = () => {
      grid.innerHTML = ''; cards.clear();
      for (const n of ROSTER) {
        if (filterF !== 'all' && n.faction !== filterF) continue;
        if (filterR !== 'all' && n.rarity !== filterR) continue;
        const c = el('button', `rcard r-${n.rarity}`);
        c.innerHTML = `<img src="${n.img}" alt="${n.name}" loading="lazy" draggable="false"><span class="rc-cls">${icon(n.cls)}</span><span class="rc-rar">${RLETTER[n.rarity]}</span>`;
        c.onclick = () => { if (focus === n) return; focus = n; this.audio.play('select'); refreshGrid(); renderDetail(); };
        c.ondblclick = () => toggle(n);
        grid.appendChild(c); cards.set(n, c);
      }
      refreshGrid();
    };
    const refreshGrid = () => {
      for (const [n, c] of cards) { c.classList.toggle('picked', team.includes(n)); c.classList.toggle('focus', focus === n); }
    };

    const renderDetail = () => {
      const n = focus, d = derive(n), r = RARITIES[n.rarity];
      $('#detailImg').src = n.img;
      $('#detailName').textContent = n.name;
      $('#detailTags').innerHTML = `<span class="tag" style="--c:${r.color}">${r.label}</span><span class="tag">${FACTIONS[n.faction].label}</span><span class="tag">${CLASSES[n.cls].label}</span>`;
      const main = CLASSES[n.cls].main;
      $('#detailStats').innerHTML = ['STR', 'HP', 'DEX', 'MP', 'INT'].map(k =>
        `<div class="st ${k === main ? 'main' : ''}"><span class="st-k">${k}</span><span class="st-bar"><i style="width:${Math.min(100, n.stats[k] / 1.45)}%"></i></span><span class="st-v">${n.stats[k]}</span></div>`).join('');
      $('#detailDerived').innerHTML = [
        ['Max HP', d.maxHP], ['Power', `${d.power} <small>${main}</small>`], ['Speed', Math.round(d.speed)],
        ['Crit', `${Math.round(d.critChance * 100)}%`], ['Armor', `${Math.round(d.dr * 100)}%`], ['Resist', `${Math.round(d.resist * 100)}%`],
      ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
      $('#detailSkills').innerHTML = SKILLS[n.cls].map(s =>
        `<div class="dsk ${s.ult ? 'ult' : ''}"><div class="dsk-i">${icon(s.icon)}</div><div><b>${s.name}</b>${s.cd ? `<em>${s.ult ? 'Ultimate · ' : ''}Cooldown ${s.cd}</em>` : '<em>Basic</em>'}<p>${s.desc}</p></div></div>`).join('');
      const btn = $('#pickBtn');
      btn.textContent = team.includes(n) ? 'Remove from team' : team.length >= 3 ? 'Team is full' : 'Add to team';
      btn.disabled = !team.includes(n) && team.length >= 3;
      btn.onclick = () => toggle(n);
      if (this.onPreview) this.onPreview(n);
    };

    const renderSlots = () => {
      const slots = $('#teamSlots'); slots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const n = team[i];
        const s = el('button', 'slot' + (n ? ` filled r-${n.rarity}` : ''));
        s.innerHTML = n ? `<img src="${n.img}" alt=""><span>${n.name}</span>` : `<span class="slot-empty">Slot ${i + 1}</span>`;
        if (n) s.onclick = () => toggle(n);
        slots.appendChild(s);
      }
      $('#fightBtn').disabled = team.length !== 3;
      $('#teamPower').textContent = team.length ? `Team power ${team.reduce((a, n) => a + Object.values(n.stats).reduce((x, y) => x + y, 0), 0)}` : 'Pick 3 heroes';
    };

    const toggle = n => {
      const i = team.indexOf(n);
      if (i >= 0) team.splice(i, 1); else if (team.length < 3) team.push(n); else return;
      focus = n;
      this.audio.play('select');
      refreshGrid(); renderDetail(); renderSlots();
    };

    const chips = (id, set) => {
      for (const b of document.querySelectorAll(`#${id} button`)) {
        b.onclick = () => { this.click(); set(b.dataset.v); for (const x of document.querySelectorAll(`#${id} button`)) x.classList.toggle('on', x === b); renderGrid(); };
      }
    };
    chips('filterFaction', v => (filterF = v));
    chips('filterRarity', v => (filterR = v));

    renderGrid(); renderDetail(); renderSlots();
    return new Promise(res => {
      $('#fightBtn').onclick = () => { if (team.length === 3) { this.click(); res(team.slice()); } };
    });
  }

  // ===================================================================== VS
  async showVS(player, enemy, rivalName) {
    this.show('vs');
    const vs = $('#vs');
    vs.classList.remove('go', 'searching');
    vs.classList.add('searching');
    $('#vsRival').textContent = rivalName;
    const fill = (id, list) => { $(id).innerHTML = list.map(n => `<div class="vcard r-${n.rarity}"><img src="${n.img}" alt=""><span>${n.name}</span></div>`).join(''); };
    fill('#vsLeft', player); fill('#vsRight', enemy);
    await new Promise(r => setTimeout(r, 1300));
    vs.classList.remove('searching'); vs.classList.add('go');
    this.audio.play('fight');
    await new Promise(r => setTimeout(r, 2300));
  }

  // ===================================================================== BATTLE HUD
  startBattleHud(battle, rivalName) {
    this.battle = battle;
    this.show('battle');
    $('#unitHuds').innerHTML = ''; $('#floats').innerHTML = '';
    $('#rivalName').textContent = rivalName;
    $('#skillbar').classList.remove('show');
    this._syncControls();
    for (const u of battle.units) this._createHud(u);
  }

  _createHud(u) {
    const r = RARITIES[u.nft.rarity];
    const h = el('div', `uhud team-${u.team}`);
    h.innerHTML = `
      <div class="uh-status"></div>
      <div class="uh-row">
        <div class="uh-badge" style="--c:${r.color}">${icon(u.nft.cls)}</div>
        <div class="uh-bars">
          <div class="uh-hp"><i class="lag"></i><i class="fill"></i></div>
          <div class="uh-atb"><i></i></div>
        </div>
      </div>`;
    h.onclick = () => this._targetClick(u);
    $('#unitHuds').appendChild(h);
    u.hud = h;
    u.hudHP = h.querySelector('.fill'); u.hudLag = h.querySelector('.lag');
    u.hudATB = h.querySelector('.uh-atb i'); u.hudStatus = h.querySelector('.uh-status');
    this.updateHud(u);
  }

  updateHud(u) {
    if (!u.hud) return;
    const pct = Math.max(0, u.hp / u.d.maxHP) * 100;
    u.hudHP.style.width = pct + '%';
    u.hudHP.classList.toggle('low', pct < 30);
    clearTimeout(u._lagT);
    u._lagT = setTimeout(() => { if (u.hudLag) u.hudLag.style.width = pct + '%'; }, 380 / clock.speed);
    this.updateBar(u);
    u.hudStatus.innerHTML = Object.entries(u.status).filter(([, v]) => v > 0).map(([k, v]) =>
      `<span class="sti ${STATUS_INFO[k].good ? 'good' : 'bad'}" title="${STATUS_INFO[k].label}: ${STATUS_INFO[k].desc}">${icon(k)}<b>${v}</b></span>`).join('');
    u.hud.classList.toggle('dead', !u.alive);
  }

  updateBar(u) { if (u.hudATB) u.hudATB.style.width = Math.min(100, u.bar) + '%'; }

  setActive(u) {
    for (const x of this.battle.units) x.hud && x.hud.classList.toggle('active', x === u);
  }

  updateTurnOrder(list) {
    const to = $('#turnOrder');
    to.innerHTML = list.map((u, i) => `<div class="to-item team-${u.team} ${i === 0 ? 'now' : ''}"><img src="${u.nft.img}" alt=""></div>`).join('');
  }

  // floating combat text
  float(u, text, kind = 'dmg', big = false) {
    const p = new THREE.Vector3();
    u.hero.chest.getWorldPosition(p);
    p.y += 0.6;
    const s = this.world.project(p);
    const now = performance.now();
    const st = this.floatStack.get(u) || { n: 0, t: 0 };
    if (now - st.t > 450) st.n = 0;
    st.n++; st.t = now; this.floatStack.set(u, st);
    const e = el('div', `flt ${kind} ${big ? 'big' : ''}`, text);
    e.style.left = s.x + (Math.random() - 0.5) * 34 + 'px';
    e.style.top = s.y - (st.n - 1) * 26 + 'px';
    e.style.animationDuration = 1.25 / Math.max(1, clock.speed * 0.8) + 's';
    $('#floats').appendChild(e);
    setTimeout(() => e.remove(), 1400);
  }

  skillBanner(u, skill) {
    const p = new THREE.Vector3(); u.hero.top.getWorldPosition(p); p.y += 0.6;
    const s = this.world.project(p);
    const e = el('div', 'skb', `${icon(skill.icon)}<span>${skill.name}</span>`);
    e.style.left = s.x + 'px'; e.style.top = s.y - 40 + 'px';
    e.style.setProperty('--c', '#' + u.hero.theme.toString(16).padStart(6, '0'));
    $('#floats').appendChild(e);
    setTimeout(() => e.remove(), 1500);
  }

  ultBanner(skill, unit) {
    const b = $('#ultBanner');
    b.style.setProperty('--c', '#' + unit.hero.theme.toString(16).padStart(6, '0'));
    b.innerHTML = `<div class="ub-line"></div><div class="ub-name">${skill.name}</div><div class="ub-sub">${unit.nft.name} · ${RARITIES[unit.nft.rarity].label}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    $('#vignette').classList.add('on');
  }
  hideUlt() { $('#ultBanner').classList.remove('show'); $('#vignette').classList.remove('on'); }

  centerText(text, cls = '', ms = 1200) {
    const c = $('#centerText');
    c.className = cls; c.innerHTML = text;
    void c.offsetWidth; c.classList.add('show');
    return new Promise(r => setTimeout(() => { c.classList.remove('show'); r(); }, ms));
  }

  // ===================================================================== PLAYER INPUT
  awaitAction(u) {
    return new Promise(resolve => {
      const ready = u.skills.findIndex((s, i) => u.cd[i] === 0);
      this.pending = { unit: u, resolve, skill: ready < 0 ? 0 : ready };
      this._renderSkillbar();
      this._selectSkill(this.pending.skill, true);
    });
  }

  _renderSkillbar() {
    const p = this.pending; if (!p) return;
    const u = p.unit, sb = $('#skillbar');
    $('#sbPortrait').src = u.nft.img;
    $('#sbName').innerHTML = `${u.nft.name} <small style="color:${RARITIES[u.nft.rarity].color}">${RARITIES[u.nft.rarity].label}</small>`;
    const wrap = $('#sbSkills'); wrap.innerHTML = '';
    u.skills.forEach((s, i) => {
      const b = el('button', `skill ${s.ult ? 'ult' : ''} ${u.cd[i] > 0 ? 'cd' : ''} ${p.skill === i ? 'sel' : ''}`);
      b.innerHTML = `<span class="sk-ico">${icon(s.icon)}</span>${u.cd[i] > 0 ? `<span class="sk-cd">${u.cd[i]}</span>` : ''}<span class="sk-n">${s.name}</span>`;
      b.onclick = () => this._selectSkill(i);
      b.onmouseenter = () => this._tip(s, b);
      b.onmouseleave = () => this._tip(null);
      wrap.appendChild(b);
    });
    sb.classList.add('show');
  }

  _tip(s, anchor) {
    const t = $('#skillTip');
    if (!s) { t.classList.remove('show'); return; }
    t.innerHTML = `<b>${s.name}</b>${s.cd ? ` <em>${s.ult ? 'Ultimate · ' : ''}CD ${s.cd}</em>` : ' <em>Basic</em>'}<p>${s.desc}</p>`;
    const r = anchor.getBoundingClientRect();
    t.style.left = r.left + r.width / 2 + 'px'; t.style.top = r.top - 10 + 'px';
    t.classList.add('show');
  }

  _selectSkill(i, silent) {
    const p = this.pending; if (!p) return;
    const u = p.unit, s = u.skills[i];
    if (u.cd[i] > 0) { if (!silent) this.audio.play('click'); return; }
    p.skill = i;
    if (!silent) this.audio.play('select');
    this._renderSkillbar();
    const b = this.battle;
    if (s.target === 'all-enemies' || s.target === 'all-allies') {
      b.showTargets(s.target === 'all-enemies' ? b.foes(u) : b.friends(u), s.target === 'all-allies');
      $('#sbHint').textContent = 'Tap any highlighted unit to cast';
    } else {
      b.showTargets(s.target === 'enemy' ? b.foes(u) : b.friends(u), s.target === 'ally');
      $('#sbHint').textContent = s.target === 'ally' ? 'Choose an ally' : 'Choose a target';
    }
  }

  _targetClick(target) {
    const p = this.pending; if (!p || !target || !target.alive) return;
    const u = p.unit, s = u.skills[p.skill];
    const valid = (s.target === 'enemy' || s.target === 'all-enemies') ? target.team !== u.team : target.team === u.team;
    if (!valid) return;
    this._resolve({ skill: p.skill, target });
  }

  hoverUnit(target) {
    const p = this.pending;
    for (const x of this.battle ? this.battle.units : []) x.hud && x.hud.classList.toggle('hover', x === target && !!p);
    if (this.battle) this.battle.hoverTarget(p ? target : null);
  }

  _resolve(choice) {
    const p = this.pending; if (!p) return;
    this.pending = null;
    $('#skillbar').classList.remove('show');
    this._tip(null);
    this.battle.clearTargets();
    p.resolve(choice);
  }

  // auto / forfeit can end the wait
  autoResolve() {
    const p = this.pending; if (!p) return;
    this._resolve(this.battle.ai(p.unit));
  }

  // ===================================================================== CONTROLS
  _bindControls() {
    $('#btnPause').onclick = () => { this.click(); clock.paused = !clock.paused; this._syncControls(); };
    $('#btnSpeed').onclick = () => { this.click(); clock.speed = clock.speed >= 3 ? 1 : clock.speed + 1; this._syncControls(); };
    $('#btnAuto').onclick = () => {
      this.click(); if (!this.battle) return;
      this.battle.auto = !this.battle.auto; this._syncControls();
      if (this.battle.auto) this.autoResolve();
    };
    $('#btnSettings').onclick = () => { this.click(); $('#settings').classList.toggle('show'); };
    $('#setMusic').onchange = e => this.audio.setMusic(e.target.checked);
    $('#setSfx').onchange = e => this.audio.setSfx(e.target.checked);
    $('#setShadows').onchange = e => this.world.setShadows(e.target.checked);
    $('#btnForfeit').onclick = () => {
      $('#settings').classList.remove('show');
      if (this.battle && !this.battle.over) {
        this.battle.forfeit();
        if (this.pending) this._resolve({ forfeit: true });
      }
    };
    $('#closeSettings').onclick = () => $('#settings').classList.remove('show');
    $('#musicBtn').onclick = () => { this.audio.unlock(); const on = !this.audio.musicOn; this.audio.setMusic(on); $('#setMusic').checked = on; this._syncControls(); };
  }

  _syncControls() {
    $('#btnPause').innerHTML = clock.paused ? icon('play') : icon('pause');
    $('#btnPause').classList.toggle('on', clock.paused);
    $('#btnSpeed').innerHTML = `x${clock.speed}`;
    $('#btnAuto').classList.toggle('on', !!(this.battle && this.battle.auto));
    $('#musicBtn').classList.toggle('off', !this.audio.musicOn);
    document.body.classList.toggle('paused', clock.paused);
  }

  // ===================================================================== RESULT
  showResult(res) {
    this.show('result');
    const r = $('#result');
    r.className = 'active ' + (res.win ? 'win' : 'lose');
    $('#resTitle').textContent = res.win ? 'VICTORY' : 'DEFEAT';
    $('#resVs').innerHTML = `<span class="${res.win ? 'w' : 'l'}">${res.win ? 'WIN' : 'LOSE'}</span><b>You</b><i>VS</i><b>${res.rival}</b><span class="${res.win ? 'l' : 'w'}">${res.win ? 'LOSE' : 'WIN'}</span>`;
    const mvp = res.mvp;
    $('#resMvp').innerHTML = mvp ? `<img src="${mvp.nft.img}" alt=""><div><small>MVP</small><b>${mvp.nft.name}</b><span>${mvp.dealt.toLocaleString()} damage · ${mvp.healed.toLocaleString()} healing</span></div>` : '';
    $('#resStats').innerHTML = [
      ['Turns', res.turns], ['Damage dealt', res.dealt.toLocaleString()], ['Critical hits', res.crits], ['Heroes left', res.left],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    return new Promise(resolve => {
      $('#btnRematch').onclick = () => { this.click(); resolve('rematch'); };
      $('#btnTeam').onclick = () => { this.click(); resolve('team'); };
    });
  }

  // per-frame: keep HUDs above heroes
  update() {
    const b = this.battle;
    if (!b || document.body.dataset.screen !== 'battle') return;
    const p = new THREE.Vector3();
    for (const u of b.units) {
      if (!u.hud) continue;
      u.hero.top.getWorldPosition(p);
      p.y += 0.25;
      const s = this.world.project(p);
      u.hud.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
  }
}
