// KnightVerse Arena - game data
// Stats are taken from the printed NFT cards (STR / HP / DEX / MP / INT).

export const RARITIES = {
  common:    { label: 'Common',    color: '#c9ced6', hex: 0xc9ced6, tier: 1 },
  rare:      { label: 'Rare',      color: '#4aa3ff', hex: 0x4aa3ff, tier: 2 },
  epic:      { label: 'Epic',      color: '#b35cff', hex: 0xb35cff, tier: 3 },
  legendary: { label: 'Legendary', color: '#ffc93c', hex: 0xffc93c, tier: 4 },
};

export const CLASSES = {
  warrior: { label: 'Warrior', main: 'STR', range: 'melee'  },
  rogue:   { label: 'Rogue',   main: 'DEX', range: 'melee'  },
  mage:    { label: 'Mage',    main: 'MP',  range: 'ranged' },
  priest:  { label: 'Priest',  main: 'INT', range: 'ranged' },
};

export const FACTIONS = {
  human: { label: 'Human' },
  orc:   { label: 'Orc' },
};

// faction, class, rarity, image, STR, HP, DEX, MP, INT
const RAW = [
  ['human', 'mage',    'common',    'common.jpg',      3,  36,   6,  53,  44],
  ['human', 'priest',  'common',    'commonp.jpg',    49,  78,  22,  26,  81],
  ['human', 'rogue',   'common',    'commonr.jpg',    20,  58,  74,  33,  17],
  ['human', 'warrior', 'common',    'commonw.jpg',    93,  72,  41,  10,   3],
  ['human', 'mage',    'rare',      'rare.jpg',        9,  48,  12,  75,  62],
  ['human', 'priest',  'rare',      'rarep.jpg',      61,  96,  33,  30,  98],
  ['human', 'rogue',   'rare',      'rarer.jpg',      32,  73,  99,  46,  37],
  ['human', 'warrior', 'rare',      'rarew.jpg',     107,  93,  51,  14,   4],
  ['human', 'mage',    'epic',      'epic.jpg',       14,  68,  17, 110,  95],
  ['human', 'priest',  'epic',      'epicp.jpg',      68, 114,  38,  36, 114],
  ['human', 'rogue',   'epic',      'epicr.jpg',      38,  82, 111,  52,  43],
  ['human', 'warrior', 'epic',      'epicw.jpg',     123, 102,  57,  18,   5],
  ['human', 'mage',    'legendary', 'legendary.jpg',  18,  92,  21, 130, 115],
  ['human', 'priest',  'legendary', 'legendaryp.jpg', 73, 122,  44,  43, 128],
  ['human', 'rogue',   'legendary', 'legendaryr.jpg', 47,  94, 128,  64,  57],
  ['human', 'warrior', 'legendary', 'legendaryw.jpg',140, 112,  68,  21,   7],
  ['orc',   'warrior', 'common',    'warc.jpg',       93,  75,  42,  11,   5],
  ['orc',   'mage',    'common',    'magc.jpg',        5,  35,   5,  55,  45],
  ['orc',   'priest',  'common',    'pric.jpg',       47,  77,  21,  24,  85],
  ['orc',   'rogue',   'common',    'rogc.jpg',       24,  57,  78,  35,  21],
  ['orc',   'warrior', 'rare',      'warr.jpg',      103,  91,  49,  17,   8],
  ['orc',   'mage',    'rare',      'magr.jpg',       10,  47,  14,  75,  65],
  ['orc',   'priest',  'rare',      'prir.jpg',       59,  98,  31,  29, 100],
  ['orc',   'rogue',   'rare',      'rogr.jpg',       31,  76,  97,  41,  32],
  ['orc',   'warrior', 'epic',      'ware.jpg',      127,  98,  58,  21,   9],
  ['orc',   'mage',    'epic',      'mage.jpg',       14,  72,  20, 113,  98],
  ['orc',   'priest',  'epic',      'prie.jpg',       67, 112,  35,  36, 111],
  ['orc',   'rogue',   'epic',      'roge.jpg',       40,  85, 112,  53,  39],
  ['orc',   'warrior', 'legendary', 'warl.jpg',      138, 115,  65,  28,  12],
  ['orc',   'mage',    'legendary', 'magl.jpg',       21,  90,  23, 132, 114],
  ['orc',   'priest',  'legendary', 'pril.jpg',       71, 125,  43,  42, 121],
  ['orc',   'rogue',   'legendary', 'rogl.jpg',       48,  96, 126,  63,  59],
];

export const ROSTER = RAW.map(([faction, cls, rarity, img, STR, HP, DEX, MP, INT], i) => ({
  id: 'kv' + String(i + 1).padStart(3, '0'),
  faction, cls, rarity, img,
  name: `${FACTIONS[faction].label} ${CLASSES[cls].label}`,
  stats: { STR, HP, DEX, MP, INT },
}));

// ---------------------------------------------------------------------------
// Combat formulas
//  - Main stat (Warrior STR, Rogue DEX, Mage MP, Priest INT) sets damage/heal power
//  - HP sets max health
//  - MP fills the attack bar faster (turn speed)
//  - STR gives damage reduction, DEX gives crit chance + glancing (evasion),
//    INT gives resistance against debuffs
// ---------------------------------------------------------------------------
export function derive(nft) {
  const s = nft.stats;
  const main = s[CLASSES[nft.cls].main];
  return {
    maxHP: Math.round(600 + s.HP * 14),
    power: main,
    speed: 100 + s.MP * 0.3,
    critChance: 0.05 + s.DEX * 0.0018,
    critDmg: nft.cls === 'rogue' ? 1.7 : 1.5,
    dr: Math.min(0.18, s.STR * 0.0009),
    evade: Math.min(0.15, s.DEX * 0.001),
    resist: Math.min(0.2, s.INT * 0.0012),
  };
}

export const STATUS_INFO = {
  stun:     { label: 'Stun',        good: false, desc: 'Skips the next turn.' },
  burn:     { label: 'Burn',        good: false, desc: 'Takes 6% max HP damage each turn.' },
  poison:   { label: 'Poison',      good: false, desc: 'Takes 7% max HP damage each turn.' },
  defBreak: { label: 'Armor Break', good: false, desc: 'Takes 25% more damage.' },
  atkUp:    { label: 'Attack Up',   good: true,  desc: 'Deals 25% more damage.' },
};

// target: 'enemy' | 'ally' | 'all-enemies' | 'all-allies'
export const SKILLS = {
  warrior: [
    { id: 'cleave', name: 'Cleave', icon: 'sword', cd: 0, target: 'enemy', mult: 1.0,
      desc: 'A heavy two-handed swing. Damage scales with STR.' },
    { id: 'bash', name: 'Shield Bash', icon: 'shield', cd: 3, target: 'enemy', mult: 1.15, stun: 0.55,
      desc: 'Slams the target with the shield. 55% chance to Stun for 1 turn.' },
    { id: 'quake', name: 'Titan Quake', icon: 'quake', cd: 5, ult: true, target: 'all-enemies', mult: 0.85, defBreak: 0.7,
      desc: 'Leaps high and smashes the arena. Hits all enemies, 70% chance to Break Armor for 2 turns.' },
  ],
  rogue: [
    { id: 'fang', name: 'Twin Fang', icon: 'daggers', cd: 0, target: 'enemy', mult: 0.6, hits: 2,
      desc: 'Two quick strikes. Damage scales with DEX.' },
    { id: 'venom', name: 'Venom Edge', icon: 'drop', cd: 3, target: 'enemy', mult: 1.0, poison: 0.8, selfBar: 30,
      desc: 'A poisoned cut. 80% chance to Poison for 2 turns and fills own attack bar by 30%.' },
    { id: 'shadow', name: 'Shadow Dance', icon: 'shadow', cd: 5, ult: true, target: 'all-enemies', mult: 0.5, hits: 5, critBonus: 0.15,
      desc: 'Vanishes and strikes 5 times at random enemies with +15% crit chance.' },
  ],
  mage: [
    { id: 'bolt', name: 'Fire Bolt', icon: 'flame', cd: 0, target: 'enemy', mult: 1.15, burn: 0.25,
      desc: 'Hurls a bolt of fire. Damage scales with MP. 25% chance to Burn.' },
    { id: 'wave', name: 'Flame Wave', icon: 'wave', cd: 3, target: 'all-enemies', mult: 0.8, burn: 0.4,
      desc: 'A wave of fire hits all enemies. 40% chance to Burn for 2 turns.' },
    { id: 'meteor', name: 'Meteor Storm', icon: 'meteor', cd: 5, ult: true, target: 'all-enemies', mult: 1.4, burn: 0.6,
      desc: 'Calls meteors from the sky on all enemies. 60% chance to Burn for 2 turns.' },
  ],
  priest: [
    { id: 'smite', name: 'Holy Smite', icon: 'sun', cd: 0, target: 'enemy', mult: 1.1,
      desc: 'A pillar of holy light strikes the target. Damage scales with INT.' },
    { id: 'mend', name: 'Mending Light', icon: 'heart', cd: 3, target: 'ally', heal: 1.6, cleanse: true,
      desc: 'Heals one ally based on INT and removes their debuffs.' },
    { id: 'grace', name: 'Divine Grace', icon: 'wings', cd: 5, ult: true, target: 'all-allies', heal: 1.0, atkUp: 2, cleanse: true,
      desc: 'Heals all allies, removes debuffs and grants Attack Up for 2 turns.' },
  ],
};

export const RIVAL_NAMES = ['IronFang', 'GrimTusk', 'SilverOath', 'AshenBlade', 'VoidWarden', 'StormMaw',
  'DuskReaver', 'BoneCrusher', 'EmberQueen', 'NightHowl', 'GoldenAegis', 'RuneBreaker'];
