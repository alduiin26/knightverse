// KnightVerse Arena - raid bosses (5 heroes vs 1 boss)
// Pure data: shared by the game and the server-side result check.
//
// stats: maxHP, power (damage scale, same formula as heroes), speed (attack bar),
//        critChance, critDmg, dr (damage reduction), evade (glancing chance), resist (debuff resistance)
// skills:
//   target 'enemy'        one hero          | 'all-enemies' every hero | 'random' hits random heroes | 'self'
//   mult                  damage multiplier | hits: number of hits
//   stun/poison/burn/defBreak: chance to apply (stun 1 turn, others 2 turns)
//   charge: true          telegraphed attack: the boss spends one turn gathering power and unleashes it on
//                         its next turn. Stunning the boss while it charges cancels the attack.
//   minPhase              skill unlocks when the boss reaches that phase (phases at 66% and 33% HP)
//   anim                  which animation the game plays (lunge, slam, breath, spit, nova, roar, beam, sweep)
// winPoints: points per hero when the raid is won (a loss always gives 3 per hero)

export const BOSS_PHASES = [0.66, 0.33];

export const BOSSES = {
  spider: {
    id: 'spider', name: 'Venom Broodmother', title: 'Giant Spider', theme: 'swamp',
    img: 'boss-spider.png', model: 'boss-spider', color: 0x7dff4a, scale: 1.3,
    difficulty: 2, winPoints: 12, recommend: 'Rare or better',
    desc: 'A giant spider from the poison caves. Average health and average damage, but her venom piles up fast.',
    stats: { maxHP: 17000, power: 104, speed: 128, critChance: 0.1, critDmg: 1.5, dr: 0.1, evade: 0.06, resist: 0.3 },
    skills: [
      { id: 'bite', name: 'Venom Bite', icon: 'drop', cd: 0, target: 'enemy', mult: 1.35, poison: 0.55, anim: 'lunge' },
      { id: 'web', name: 'Web Burst', icon: 'wave', cd: 3, target: 'all-enemies', mult: 0.55, stun: 0.22, anim: 'spit' },
      { id: 'swarm', name: 'Brood Swarm', icon: 'daggers', cd: 3, target: 'random', hits: 5, mult: 0.5, poison: 0.35, anim: 'sweep', minPhase: 1 },
      { id: 'nova', name: 'Venom Nova', icon: 'meteor', cd: 5, target: 'all-enemies', mult: 1.25, poison: 0.8, charge: true, anim: 'nova' },
    ],
  },
  troll: {
    id: 'troll', name: 'Troll King', title: 'Lord of the Broken Hills', theme: 'stone',
    img: 'boss-orc.png', model: 'boss-troll', color: 0xffb347, scale: 1.05,
    difficulty: 3, winPoints: 15, recommend: 'Epic or better',
    desc: 'A crowned brute with a spiked club. Hits hard, cracks armor and shrugs off small wounds.',
    stats: { maxHP: 23500, power: 120, speed: 122, critChance: 0.12, critDmg: 1.6, dr: 0.18, evade: 0.02, resist: 0.35 },
    skills: [
      { id: 'smash', name: 'Club Smash', icon: 'quake', cd: 0, target: 'enemy', mult: 1.45, stun: 0.25, anim: 'lunge' },
      { id: 'slam', name: 'Ground Slam', icon: 'quake', cd: 3, target: 'all-enemies', mult: 0.7, defBreak: 0.6, anim: 'slam' },
      { id: 'roar', name: 'War Roar', icon: 'atkUp', cd: 4, target: 'self', atkUp: 2, cleanse: true, healPct: 0.05, anim: 'roar', minPhase: 1 },
      { id: 'quake', name: 'Earthshatter', icon: 'quake', cd: 5, target: 'all-enemies', mult: 1.5, stun: 0.35, charge: true, anim: 'slam' },
    ],
  },
  ultima: {
    id: 'ultima', name: 'Mor Ultima', title: 'The Violet Colossus', theme: 'void',
    img: 'boss-void.png', model: 'boss-ultima', color: 0xc05cff, scale: 1.0,
    difficulty: 4, winPoints: 20, recommend: 'Strong Epic or Legendary',
    desc: 'A colossus of black stone and violet fire. High health, high damage and it gets stronger as it breaks.',
    stats: { maxHP: 19000, power: 112, speed: 134, critChance: 0.12, critDmg: 1.6, dr: 0.2, evade: 0.04, resist: 0.42 },
    skills: [
      { id: 'claw', name: 'Void Claw', icon: 'daggers', cd: 0, target: 'enemy', mult: 1.4, defBreak: 0.4, anim: 'lunge' },
      { id: 'pulse', name: 'Shadow Pulse', icon: 'shadow', cd: 3, target: 'all-enemies', mult: 0.75, burn: 0.45, anim: 'nova' },
      { id: 'rain', name: 'Violet Rain', icon: 'meteor', cd: 3, target: 'random', hits: 6, mult: 0.55, defBreak: 0.3, anim: 'beam', minPhase: 1 },
      { id: 'oblivion', name: 'Oblivion Beam', icon: 'sun', cd: 5, target: 'all-enemies', mult: 1.6, burn: 0.6, charge: true, anim: 'beam' },
    ],
  },
  dragon: {
    id: 'dragon', name: 'Ancient Dragon', title: 'Flame of the Deep Caverns', theme: 'lava',
    img: 'boss-dragon.png', model: 'boss-dragon', color: 0xff5a1a, scale: 1.2,
    difficulty: 5, winPoints: 30, recommend: '5 Legendary heroes',
    desc: 'The oldest dragon of the caverns. Very high power, high health and devastating fire. Only a full Legendary team stands a chance.',
    stats: { maxHP: 15000, power: 106, speed: 148, critChance: 0.15, critDmg: 1.6, dr: 0.24, evade: 0.05, resist: 0.5 },
    skills: [
      { id: 'rend', name: 'Rending Claws', icon: 'daggers', cd: 0, target: 'enemy', mult: 1.5, defBreak: 0.4, anim: 'lunge' },
      { id: 'breath', name: 'Fire Breath', icon: 'flame', cd: 3, target: 'all-enemies', mult: 0.85, burn: 0.55, anim: 'breath' },
      { id: 'tail', name: 'Tail Sweep', icon: 'wave', cd: 3, target: 'all-enemies', mult: 0.7, stun: 0.3, anim: 'sweep', minPhase: 1 },
      { id: 'inferno', name: 'Inferno', icon: 'meteor', cd: 5, target: 'all-enemies', mult: 1.7, burn: 0.8, charge: true, anim: 'breath' },
    ],
  },
};

export const BOSS_ORDER = ['spider', 'troll', 'ultima', 'dragon'];
