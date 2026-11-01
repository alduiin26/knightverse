// KnightVerse Arena - entry point: game loop and screen flow
import * as THREE from 'three';
import { World } from './world.js';
import { FX } from './fx.js';
import { SoundSystem } from './audio.js';
import { UI, icon } from './ui.js';
import { Battle } from './battle.js';
import { buildHero, preloadModels } from './hero.js';
import { ROSTER, RIVAL_NAMES } from './data.js';
import { clock, updateTweens, pick, rand, shuffle } from './core.js';

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

// ---------------------------------------------------------------- flow
function makeOpponent(team) {
  const used = new Set(team.map(n => n.id));
  return team.map(p => {
    const pool = ROSTER.filter(n => n.rarity === p.rarity && !used.has(n.id));
    const n = pick(pool); used.add(n.id); return n;
  });
}

async function run() {
  await preloadModels();
  lobbyShowcase();
  document.getElementById('loading').classList.add('done');
  let team = [];
  if (TEST) {
    team = shuffle(ROSTER).slice(0, 3);
    clock.speed = Number(params.get('speed') || 3);
  } else {
    await ui.showLobby();
  }
  let mode = TEST ? 'rematch' : 'team';
  for (;;) {
    if (mode === 'team') team = await ui.showSelect(team);
    clearShowcase();
    const enemy = makeOpponent(team);
    const rival = `${pick(RIVAL_NAMES)}_${Math.floor(rand(10, 99))}`;
    world.director.orbit();
    if (!TEST) await ui.showVS(team, enemy, rival);
    battle = new Battle({ world, fx, ui, audio }, team, enemy, rival);
    if (TEST) battle.auto = true;
    window.__arena.battle = battle;
    const res = await battle.run();
    window.__arena.result = res;
    const choice = await ui.showResult(res);
    battle.dispose(); battle = null; ui.battle = null;
    clock.paused = false; clock.slowMo = 1;
    mode = choice === 'rematch' ? 'rematch' : 'team';
  }
}

window.__arena = { world, fx, ui, clock, ROSTER, battle: null, result: null };
run().catch(e => console.error(e));
