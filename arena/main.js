// KnightVerse Arena - entry point: game loop and screen flow
import * as THREE from 'three';
import { World } from './world.js';
import { FX } from './fx.js';
import { SoundSystem } from './audio.js';
import { UI, icon } from './ui.js';
import { Battle } from './battle.js';
import { buildHero, preloadModels, getModel, MODEL_SETTINGS } from './hero.js';
import { ROSTER } from './data.js';
import { BOSSES } from './bosses.js';
import { RULES, makeOpponent, rivalName } from './engine.js';
import { api, loadMe, openAccount, errText, getToken } from './api.js';
import { clock, updateTweens, shuffle } from './core.js';

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const FIXED_DT = params.has('fixeddt') ? 1 / 30 : 0; // testing: advance a fixed step per frame

let world;
try {
  world = new World(document.getElementById('stage'));
} catch (e) {
  document.getElementById('loading').innerHTML = '<div class="load-inner"><p>Your browser could not start 3D graphics (WebGL).<br>Please try a recent version of Chrome, Edge, Safari or Firefox.</p><a href="index.html" class="back">Back to site</a></div>';
  throw e;
}
const fx = new FX(world);
const audio = new SoundSystem();
const ui = new UI({ world, audio });
let battle = null;

document.getElementById('btnSettings').innerHTML = icon('gear');
document.getElementById('musicBtn').innerHTML = icon('music');

// ---------------------------------------------------------------- showcase heroes (lobby + team select)
const showcase = { heroes: [], preview: null };
function clearShowcase() {
  for (const h of showcase.heroes) world.scene.remove(h.root);
  showcase.heroes = []; showcase.preview = null;
}
function placeShowcase(nft, x, rotY) {
  const h = buildHero(nft);
  h.root.position.set(x, 0, 0); h.root.rotation.y = rotY;
  if (nft.faction === 'orc') h.root.scale.setScalar(1.06);
  world.scene.add(h.root); showcase.heroes.push(h);
  return h;
}
function lobbyShowcase() {
  clearShowcase();
  world.setTheme('arena'); world.setLayout('pvp');
  const find = (f, c, r) => ROSTER.find(n => n.faction === f && n.cls === c && n.rarity === r);
  placeShowcase(find('human', 'warrior', 'legendary'), -2.1, Math.PI / 2);
  placeShowcase(find('orc', 'warrior', 'legendary'), 2.1, -Math.PI / 2);
  world.director.orbit();
}
let lastPreviewId = null;
ui.onPreview = nft => {
  if (lastPreviewId === nft.id && showcase.preview) return;
  lastPreviewId = nft.id;
  clearShowcase();
  const h = placeShowcase(nft, 0, 0.5);
  showcase.preview = h;
  fx.ring(new THREE.Vector3(0, 0, 0), h.theme, { r1: 2.6, life: 0.6 });
  fx.emit({ pos: new THREE.Vector3(0, 0.2, 0), count: 30, colors: [h.theme, 0xffffff], speed: [0.5, 2], up: 2.5, life: [0.4, 0.9], size: [0.08, 0.2], ring: 0.7 });
  world.director.shot(new THREE.Vector3(0, 2.3, 7.4), new THREE.Vector3(0, 1.25, 0), 34, 3);
};

// ---------------------------------------------------------------- input on the 3D canvas
const canvas = world.renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  if (!battle || !ui.pending) return;
  const u = battle.pickUnit(e.clientX, e.clientY);
  if (u) ui._targetClick(u);
});
canvas.addEventListener('pointermove', e => {
  if (!battle || !ui.pending) return;
  const u = battle.pickUnit(e.clientX, e.clientY);
  ui.hoverUnit(u);
  canvas.style.cursor = u ? 'pointer' : '';
});

// ---------------------------------------------------------------- game loop
let last = performance.now();
function frame(now) {
  const realDt = FIXED_DT || Math.min(0.05, (now - last) / 1000); last = now;
  const gdt = realDt * clock.scale;
  updateTweens(gdt);
  fx.update(gdt);
  if (battle) battle.update(gdt);
  for (const h of showcase.heroes) h.update(realDt, fx);
  if (showcase.preview) showcase.preview.root.rotation.y += realDt * 0.35;
  world.update(realDt, gdt);
  ui.update();
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- player account
const state = { me: null }; // 'me' data from the server, null = guest, { offline } = server unreachable
const online = () => !!(state.me && state.me.profile);
const usesLeft = (team) => team.every(n => RULES.dailyUses - ((state.me && state.me.uses && state.me.uses[n.id]) || 0) > 0);

async function accountAction(current) {
  if (current && current.offline) { state.me = await loadMe(); return state.me; }
  const r = await openAccount({ startWith: online() ? 'code' : 'create' });
  state.me = getToken() ? await loadMe() : null;
  void r;
  return state.me;
}

// ask the server to start a battle (it picks the opponent and the random seed)
async function startOnline(mode, team, boss) {
  try {
    const r = await api('battle_start', { mode, team: team.map(n => n.id), boss });
    return { ok: true, setup: { mode, team: r.team, enemy: r.enemy, boss: r.boss, seed: r.seed, rival: r.rival }, battleId: r.battle_id };
  } catch (e) {
    return { ok: false, error: e };
  }
}
function practiceSetup(mode, team, boss) {
  const seed = (Math.random() * 2 ** 31) >>> 0;
  const ids = team.map(n => n.id);
  return { mode, team: ids, enemy: mode === 'pvp' ? makeOpponent(ids, seed) : [], boss, seed, rival: mode === 'pvp' ? rivalName(seed) : BOSSES[boss].name };
}

// ---------------------------------------------------------------- flow
async function run() {
  await preloadModels();
  world.applyEnvModels({ rock: getModel('env-rock'), tower: getModel('env-tower'), settings: MODEL_SETTINGS });
  lobbyShowcase();
  state.me = await loadMe();
  document.getElementById('loading').classList.add('done');

  if (TEST) return runTest();

  for (;;) {
    // ---- lobby
    lobbyShowcase();
    const mode = await ui.showLobby(state.me, accountAction);
    let boss = null;
    if (mode === 'boss') {
      boss = await ui.showBossSelect();
      if (!boss) continue;
    }
    // ---- team select + battles
    let team = [];
    let next = 'team';
    while (next !== 'lobby') {
      if (next === 'team') {
        if (state.me && state.me.profile) state.me = (await loadMe()) || state.me;
        team = await ui.showSelect(mode, team, online() ? state.me.uses : null, boss);
        if (!team) { next = 'lobby'; break; }
      }
      next = await playBattle(mode, team, boss);
    }
  }
}

// one battle from VS screen to result; returns 'rematch' | 'team' | 'lobby'
async function playBattle(mode, team, boss) {
  clearShowcase();
  const bossDef = boss ? BOSSES[boss] : null;
  world.setLayout(mode);
  world.setTheme(bossDef ? bossDef.theme : 'arena');
  world.director.orbit();

  let setup = null, battleId = null, practiceNote = null;
  const prepare = async () => {
    if (online()) {
      const r = await startOnline(mode, team, boss);
      if (r.ok) { setup = r.setup; battleId = r.battleId; }
      else if (r.error.code === 'no_uses' || r.error.code === 'team_size') {
        ui.toast(errText(r.error), 3500);
        return { cancel: true };
      } else {
        practiceNote = `Practice battle: ${errText(r.error)} No points saved.`;
        setup = practiceSetup(mode, team, boss);
      }
    } else {
      practiceNote = state.me && state.me.offline
        ? 'Practice battle: the server could not be reached, so no points were saved.'
        : 'Practice battle: create a fighter name in the lobby to earn points.';
      setup = practiceSetup(mode, team, boss);
    }
    return { enemy: setup.enemy.map(id => ROSTER.find(n => n.id === id)), rival: setup.rival };
  };
  const vs = await ui.showVS(team, [], '', bossDef, prepare);
  if (vs && vs.cancel) {
    state.me = (await loadMe()) || state.me;
    return 'team';
  }

  battle = new Battle({ world, fx, ui, audio }, setup);
  window.__arena.battle = battle;
  const res = await battle.run();
  window.__arena.result = res;

  const canRematchNow = () => !online() || usesLeft(team);
  const choiceP = ui.showResult(res, battleId ? false : canRematchNow());
  if (battleId) {
    try {
      const f = await api('battle_finish', { battle_id: battleId, log: res.log, forfeit: res.forfeit });
      state.me.profile.game_points = f.game_points;
      state.me.profile.wins = f.wins; state.me.profile.battles = f.battles;
      state.me.ranks = { ...(state.me.ranks || {}), game: f.rank };
      state.me.uses = f.uses;
      ui.setResultPoints({ state: 'saved', points: f.points, total: f.game_points, rank: f.rank });
    } catch (e) {
      ui.setResultPoints({ state: 'error', message: errText(e) });
      state.me = (await loadMe()) || state.me;
    }
    ui.setRematch(canRematchNow());
  } else {
    ui.setResultPoints({ state: 'practice', message: practiceNote });
  }
  window.__arena.saved = true;
  const choice = await choiceP;
  battle.dispose(); battle = null; ui.battle = null;
  clock.paused = false; clock.slowMo = 1;
  return choice;
}

// automated test run (?test): random teams, auto battle, loops forever
async function runTest() {
  clock.speed = Number(params.get('speed') || 3);
  const mode = params.get('mode') === 'boss' ? 'boss' : 'pvp';
  const boss = mode === 'boss' ? (params.get('boss') || 'spider') : null;
  for (;;) {
    const pool = params.get('rarity') ? ROSTER.filter(n => n.rarity === params.get('rarity')) : ROSTER;
    const team = shuffle(pool).slice(0, mode === 'boss' ? 5 : Number(params.get('n') || 3));
    clearShowcase();
    world.setLayout(mode);
    world.setTheme(boss ? BOSSES[boss].theme : 'arena');
    const setup = practiceSetup(mode, team, boss);
    battle = new Battle({ world, fx, ui, audio }, setup);
    battle.auto = true;
    window.__arena.battle = battle;
    const res = await battle.run();
    window.__arena.result = res;
    window.__arena.rounds = (window.__arena.rounds || 0) + 1;
    const p = ui.showResult(res, true);
    ui.setResultPoints({ state: 'practice', message: 'Test run' });
    await Promise.race([p, new Promise(r => setTimeout(r, 1500))]);
    battle.dispose(); battle = null; ui.battle = null;
  }
}

window.__arena = { world, fx, ui, clock, ROSTER, battle: null, result: null, state };
run().catch(e => console.error(e));
