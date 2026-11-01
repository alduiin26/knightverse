// KnightVerse Arena - HTML interface: screens, unit HUDs, skill bar, floating text
import * as THREE from 'three';
import { ROSTER, RARITIES, CLASSES, FACTIONS, SKILLS, STATUS_INFO, derive } from './data.js';
import { BOSSES, BOSS_ORDER } from './bosses.js';
import { RULES } from './engine.js';
import { esc } from './api.js';
import { clock } from './core.js';
import { artOf, bossArt } from './assets.js';

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
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.4 3 5.5V20h10v-3.5c1.8-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 20v-2M14 20v-2"/>',
  boss: '<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.4 3 5.5V20h10v-3.5c1.8-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
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
    this.screens = ['lobby', 'bosses', 'select', 'vs', 'battle', 'result'];
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
  // account: 'me' data from the server, null (no account) or { offline: true }
  // onAccount(): opens the account window and returns the new account state
  showLobby(account, onAccount) {
    this.show('lobby');
    for (const e of document.querySelectorAll('[data-icon]')) e.innerHTML = icon(e.dataset.icon);
    const render = acc => {
      const box = $('#account');
      if (acc && acc.profile) {
        const p = acc.profile, r = acc.ranks || {};
        box.innerHTML = `<span class="acc-ico">${icon('user')}</span><span class="acc-main"><b>${esc(p.nickname)}</b><small>${p.game_points.toLocaleString()} points${r.game ? ` &middot; Rank #${r.game}` : ''} &middot; ${p.wins} wins</small></span><button class="acc-btn" id="accBtn">Account</button>`;
      } else if (acc && acc.offline) {
        box.innerHTML = `<span class="acc-ico">${icon('user')}</span><span class="acc-main"><b>Server unreachable</b><small>You can still play practice battles. Points are not saved.</small></span><button class="acc-btn" id="accBtn">Retry</button>`;
      } else {
        box.innerHTML = `<span class="acc-ico">${icon('user')}</span><span class="acc-main"><b>Playing as guest</b><small>Create a fighter name to earn points and join the rankings.</small></span><button class="acc-btn gold" id="accBtn">Create fighter</button>`;
      }
      $('#accBtn').onclick = async () => { this.audio.unlock(); this.click(); const a = await onAccount(acc); render(a); };
    };
    render(account);
    return new Promise(res => {
      for (const b of document.querySelectorAll('.mode-card')) {
        b.onclick = () => { this.audio.unlock(); this.click(); res(b.dataset.mode); };
      }
    });
  }

  // ===================================================================== BOSS SELECT
  showBossSelect() {
    this.show('bosses');
    const list = $('#bossList');
    const stars = n => '<span class="stars">' + Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('') + '</span>';
    const rating = { spider: [3, 3, 3], troll: [4, 3, 4], ultima: [4, 4, 4], dragon: [5, 4, 5] };
    list.innerHTML = BOSS_ORDER.map(id => {
      const b = BOSSES[id], [pw, hp, dm] = rating[id];
      return `<button class="bcard" data-id="${id}" style="--bc:#${b.color.toString(16).padStart(6, '0')}">
        <span class="bc-img"><img src="${bossArt(b.img)}" alt="${esc(b.name)}" draggable="false"></span>
        <span class="bc-body"><b>${esc(b.name)}</b><small>${esc(b.title)}</small>
        <span class="bc-rate"><span>Power</span>${stars(pw)}<span>Health</span>${stars(hp)}<span>Damage</span>${stars(dm)}</span>
        <span class="bc-desc">${esc(b.desc)}</span>
        <span class="bc-foot"><em>+${b.winPoints} pts per hero on win</em><span>Recommended: ${esc(b.recommend)}</span></span></span>
      </button>`;
    }).join('');
    return new Promise(res => {
      for (const c of list.querySelectorAll('.bcard')) c.onclick = () => { this.click(); res(c.dataset.id); };
      $('#bossBack').onclick = () => { this.click(); res(null); };
    });
  }

  // ===================================================================== SELECT
  // mode 'pvp' (1-3 heroes) or 'boss' (exactly 5). uses: { nftId: battlesToday } or null (practice)
  showSelect(mode, prevTeam = [], uses = null, boss = null) {
    this.show('select');
    const max = mode === 'boss' ? RULES.bossTeam : RULES.pvpMax;
    const min = mode === 'boss' ? RULES.bossTeam : RULES.pvpMin;
    const left = n => (uses ? Math.max(0, RULES.dailyUses - (uses[n.id] || 0)) : RULES.dailyUses);
    const team = prevTeam.filter(n => left(n) > 0).slice(0, max);
    let filterF = 'all', filterR = 'all';
    let focus = team[0] || ROSTER.find(n => n.rarity === 'legendary');
    const grid = $('#rosterGrid');
    $('#selMode').innerHTML = mode === 'boss'
      ? `Boss Raid vs <b>${esc(BOSSES[boss].name)}</b> &middot; pick 5 heroes`
      : 'PvP Arena &middot; pick 1 to 3 heroes';
    $('#fightBtn').textContent = mode === 'boss' ? 'Start Raid' : 'Find Opponent';

    // build the grid once per filter change; selection changes only toggle classes
    const cards = new Map();
    const renderGrid = () => {
      grid.innerHTML = ''; cards.clear();
      for (const n of ROSTER) {
        if (filterF !== 'all' && n.faction !== filterF) continue;
        if (filterR !== 'all' && n.rarity !== filterR) continue;
        const l = left(n);
        const c = el('button', `rcard r-${n.rarity} ${l === 0 ? 'spent' : ''}`);
        c.innerHTML = `<img src="${artOf(n)}" alt="${n.name}" loading="lazy" draggable="false"><span class="rc-cls">${icon(n.cls)}</span><span class="rc-rar">${RLETTER[n.rarity]}</span><span class="rc-uses" title="Battles left today">${l}/${RULES.dailyUses}</span>`;
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
      $('#detailImg').src = artOf(n);
      $('#detailName').textContent = n.name;
      $('#detailTags').innerHTML = `<span class="tag" style="--c:${r.color}">${r.label}</span><span class="tag">${FACTIONS[n.faction].label}</span><span class="tag">${CLASSES[n.cls].label}</span><span class="tag uses ${left(n) ? '' : 'none'}">${left(n)}/${RULES.dailyUses} battles left</span>`;
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
      const inTeam = team.includes(n);
      btn.textContent = inTeam ? 'Remove from team' : left(n) === 0 ? 'No battles left today' : team.length >= max ? 'Team is full' : 'Add to team';
      btn.disabled = !inTeam && (team.length >= max || left(n) === 0);
      btn.onclick = () => toggle(n);
      if (this.onPreview) this.onPreview(n);
    };

    const renderSlots = () => {
      const slots = $('#teamSlots'); slots.innerHTML = '';
      slots.classList.toggle('five', max === 5);
      for (let i = 0; i < max; i++) {
        const n = team[i];
        const s = el('button', 'slot' + (n ? ` filled r-${n.rarity}` : ''));
        s.innerHTML = n ? `<img src="${artOf(n)}" alt=""><span>${n.name}</span>` : `<span class="slot-empty">${i < min ? 'Slot ' + (i + 1) : 'Optional'}</span>`;
        if (n) s.onclick = () => toggle(n);
        slots.appendChild(s);
      }
      $('#fightBtn').disabled = team.length < min || team.length > max;
      $('#teamPower').textContent = team.length
        ? `Team power ${team.reduce((a, n) => a + Object.values(n.stats).reduce((x, y) => x + y, 0), 0)}`
        : (mode === 'boss' ? 'Pick 5 heroes' : 'Pick 1 to 3 heroes');
    };

    const toggle = n => {
      const i = team.indexOf(n);
      if (i >= 0) team.splice(i, 1);
      else if (left(n) === 0) { this.toast('This hero has no battles left today.'); return; }
      else if (team.length < max) team.push(n);
      else return;
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
      $('#fightBtn').onclick = () => { if (team.length >= min && team.length <= max) { this.click(); res(team.slice()); } };
      $('#selBack').onclick = () => { this.click(); res(null); };
    });
  }

  // ===================================================================== VS
  // shows "searching" until ready() resolves (the server picks the opponent), then the VS cards
  async showVS(player, enemy, rivalName, boss = null, ready = null) {
    this.show('vs');
    const vs = $('#vs');
    vs.classList.remove('go', 'searching', 'boss');
    vs.classList.add('searching');
    $('#vsSearchText').textContent = boss ? `Preparing the raid against ${boss.name}…` : 'Searching for an opponent…';
    const t0 = performance.now();
    if (ready) { const r = await ready(); if (r && r.cancel) return r; enemy = r.enemy; rivalName = r.rival; }
    vs.classList.toggle('boss', !!boss);
    $('#vsRival').textContent = rivalName;
    const fill = (id, list) => { $(id).innerHTML = list.map(n => `<div class="vcard r-${n.rarity}"><img src="${artOf(n)}" alt=""><span>${n.name}</span></div>`).join(''); };
    fill('#vsLeft', player);
    if (boss) $('#vsRight').innerHTML = `<div class="vboss" style="--bc:#${boss.color.toString(16).padStart(6, '0')}"><img src="${bossArt(boss.img)}" alt=""><span>${esc(boss.title)}</span></div>`;
    else fill('#vsRight', enemy);
    const waited = (performance.now() - t0) / 1000;
    if (waited < 1.3) await new Promise(r => setTimeout(r, (1.3 - waited) * 1000));
    vs.classList.remove('searching'); vs.classList.add('go');
    this.audio.play('fight');
    await new Promise(r => setTimeout(r, 2300));
    return null;
  }

  // ===================================================================== BATTLE HUD
  startBattleHud(battle, rivalName) {
    this.battle = battle;
    this.show('battle');
    $('#unitHuds').innerHTML = ''; $('#floats').innerHTML = '';
    $('#rivalName').textContent = rivalName;
    $('#skillbar').classList.remove('show');
    $('#battle').classList.toggle('raid', battle.mode === 'boss');
    this.bossAlert(null);
    $('#bossCard').className = '';
    this._syncControls();
    for (const u of battle.units) {
      if (u.kind === 'boss') this._createBossHud(u);
      else this._createHud(u);
    }
  }

  _createBossHud(u) {
    const b = u.boss;
    $('#bossBar').style.setProperty('--bc', '#' + b.color.toString(16).padStart(6, '0'));
    $('#bbName').textContent = b.name;
    $('#bbTitle').textContent = b.title;
    $('#bbPhase').innerHTML = '<i class="on"></i><i></i><i></i>';
    u.bossHud = { fill: $('#bossBar .fill'), lag: $('#bossBar .lag'), pct: $('#bbPct'), status: $('#bbStatus') };
    u.bossHud.fill.style.width = '100%'; u.bossHud.lag.style.width = '100%';
    this.updateHud(u);
  }

  bossIntro(b) {
    const c = $('#bossCard');
    c.style.setProperty('--bc', '#' + b.color.toString(16).padStart(6, '0'));
    c.innerHTML = `<small>Boss Raid</small><b>${esc(b.name)}</b><span>${esc(b.title)}</span>`;
    c.className = ''; void c.offsetWidth; c.className = 'show';
  }

  bossAlert(html) {
    const a = $('#bossAlert');
    if (!html) { a.className = ''; return; }
    a.innerHTML = html; a.className = 'show';
  }

  bossPhase(phase) {
    const pips = document.querySelectorAll('#bbPhase i');
    pips.forEach((p, i) => p.classList.toggle('on', i <= phase));
    this.centerText(`<span class="phase-t">Phase ${phase + 1}</span><small>The boss grows stronger!</small>`, 'phase', 1500);
  }

  toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.className = ''; }, ms);
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
    if (u.bossHud) {
      const H = u.bossHud, pct = Math.max(0, u.hp / u.d.maxHP) * 100;
      H.fill.style.width = pct + '%';
      H.pct.textContent = (pct > 0 && pct < 1 ? '<1' : Math.ceil(pct)) + '%';
      clearTimeout(u._lagT);
      u._lagT = setTimeout(() => { H.lag.style.width = pct + '%'; }, 380 / clock.speed);
      H.status.innerHTML = Object.entries(u.status).filter(([, v]) => v > 0).map(([k, v]) =>
        `<span class="sti ${STATUS_INFO[k].good ? 'good' : 'bad'}" title="${STATUS_INFO[k].label}: ${STATUS_INFO[k].desc}">${icon(k)}<b>${v}</b></span>`).join('');
      return;
    }
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
    to.innerHTML = list.map((u, i) => `<div class="to-item team-${u.team} ${i === 0 ? 'now' : ''}"><img src="${artOf(u.nft)}" alt=""></div>`).join('');
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
    $('#sbPortrait').src = artOf(u.nft);
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
  // res: battle result. Points are shown later with setResultPoints().
  // canRematch: false when a hero in the team has no battles left today
  showResult(res, canRematch = true) {
    this.show('result');
    const r = $('#result');
    // only swap win/lose; the 'screen' class must stay so the panel can be hidden again
    r.classList.toggle('win', res.win);
    r.classList.toggle('lose', !res.win);
    $('#resTitle').textContent = res.win ? 'VICTORY' : 'DEFEAT';
    $('#resVs').innerHTML = `<span class="${res.win ? 'w' : 'l'}">${res.win ? 'WIN' : 'LOSE'}</span><b>You</b><i>VS</i><b>${esc(res.rival)}</b><span class="${res.win ? 'l' : 'w'}">${res.win ? 'LOSE' : 'WIN'}</span>`;
    const mvp = res.mvp;
    $('#resMvp').innerHTML = mvp ? `<img src="${artOf(mvp.nft)}" alt=""><div><small>MVP</small><b>${mvp.nft.name}</b><span>${mvp.dealt.toLocaleString()} damage · ${mvp.healed.toLocaleString()} healing</span></div>` : '';
    $('#resStats').innerHTML = [
      ['Turns', res.turns], ['Damage dealt', res.dealt.toLocaleString()], ['Critical hits', res.crits], ['Heroes left', res.left],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    this.setResultPoints({ state: 'saving' });
    this.setRematch(canRematch);
    return new Promise(resolve => {
      $('#btnRematch').onclick = () => { this.click(); resolve('rematch'); };
      $('#btnTeam').onclick = () => { this.click(); resolve('team'); };
      $('#btnLobby').onclick = () => { this.click(); resolve('lobby'); };
    });
  }

  setRematch(ok) {
    const b = $('#btnRematch');
    b.disabled = !ok;
    b.title = ok ? '' : 'A hero in this team has no battles left today';
  }

  // info: { state: 'saving' | 'saved' | 'practice' | 'error', points, total, rank, message }
  setResultPoints(info) {
    const box = $('#resPoints');
    if (info.state === 'saving') box.innerHTML = '<div class="rp saving"><span class="mini-spin"></span> Saving your points…</div>';
    else if (info.state === 'saved') box.innerHTML = `<div class="rp saved"><b>+${info.points}</b><span>points</span><small>Total ${info.total.toLocaleString()}${info.rank ? ` &middot; Rank #${info.rank}` : ''}</small></div>`;
    else if (info.state === 'practice') box.innerHTML = `<div class="rp practice">${esc(info.message || 'Practice battle: no points saved.')}</div>`;
    else box.innerHTML = `<div class="rp error">${esc(info.message || 'Points could not be saved.')}</div>`;
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
