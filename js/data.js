/* =========================================================================
 *  data.js  ——  静态数据层：地块类型、作物、物品、工具、NPC、商店
 * ========================================================================= */
'use strict';

const TILE = 32;

/* ---------- 地块类型 ---------- */
const T = {
  GRASS: 0,   // 草地（可开垦）
  PATH: 1,    // 泥土路（可开垦）
  WATER: 2,   // 水（不可行走，可钓鱼）
  SAND: 3,    // 沙地（可开垦）
  WOOD: 4,    // 木地板
  STONE: 5,   // 石地板
  MINE: 6,    // 矿洞地面
  WALL: 7,    // 墙 / 岩壁（不可行走）
  BRICK: 8,   // 砖地
  CARPET: 9   // 地毯
};
const SOLID_TILES = new Set([T.WATER, T.WALL]);
const TILLABLE = new Set([T.GRASS, T.PATH, T.SAND]);

/* ---------- 季节 ---------- */
const SEASON_FULL = ['春季', '夏季', '秋季', '冬季'];
const SEASON_SHORT = ['春', '夏', '秋', '冬'];
const WEEKDAY = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAYS_PER_SEASON = 28;

/* 草地配色（按季节） */
const GRASS_PALETTE = [
  { base: '#6faa4e', light: '#7dbb58', dark: '#5d9440', blade: '#57a040' }, // 春
  { base: '#5f9f3d', light: '#6fb149', dark: '#4f8a31', blade: '#4c9836' }, // 夏
  { base: '#9d8342', light: '#ad9250', dark: '#8a7135', blade: '#8f7a3c' }, // 秋
  { base: '#c9d6dc', light: '#dce6ea', dark: '#b3c3cc', blade: '#aebfc7' }  // 冬
];
const TREE_PALETTE = [
  { leaf: '#4f9c45', leaf2: '#3f8a38' },
  { leaf: '#3f8f38', leaf2: '#347a2e' },
  { leaf: '#c98b2c', leaf2: '#a86a1c' },
  { leaf: '#dfe9ee', leaf2: '#c6d5de' }
];

/* ---------- 作物 ----------
 * grow : 每个生长阶段所需的天数
 * regrow: 收获后重新成熟所需天数(0=一次性作物)
 * tag  : '花' 表示观赏花卉（图标用 bloom 花冠造型）
 */
const CROPS = {
  parsnip:    { name: '防风草',   sell: 35,  seed: 20,  season: 0, grow: [1, 1, 1, 1], color: '#f2e6a8', shape: 'root',   regrow: 0 },
  potato:     { name: '土豆',     sell: 80,  seed: 50,  season: 0, grow: [1, 1, 2, 2], color: '#d3ae63', shape: 'tuber',  regrow: 0 },
  cauliflower:{ name: '花椰菜',   sell: 175, seed: 80,  season: 0, grow: [2, 2, 3, 4], color: '#f3f4e6', shape: 'flower', regrow: 0 },
  bean:       { name: '青豆',     sell: 40,  seed: 60,  season: 0, grow: [1, 2, 3, 4], color: '#7cc24a', shape: 'bean',   regrow: 3 },
  strawberry: { name: '草莓',     sell: 120, seed: 100, season: 0, grow: [2, 2, 2, 3], color: '#e5462f', shape: 'berry',  regrow: 4 },
  kale:       { name: '甘蓝菜',   sell: 110, seed: 70,  season: 0, grow: [2, 2, 2, 2], color: '#6faa4e', shape: 'flower', regrow: 0 },
  garlic:     { name: '大蒜',     sell: 60,  seed: 40,  season: 0, grow: [1, 1, 2, 2], color: '#f0ece0', shape: 'root',   regrow: 0 },
  asparagus:  { name: '芦笋',     sell: 55,  seed: 30,  season: 0, grow: [1, 1, 2, 2], color: '#8fc46b', shape: 'bean',   regrow: 2 },
  tulip:      { name: '郁金香',   sell: 60,  seed: 30,  season: 0, grow: [1, 2, 2, 2], color: '#f06292', shape: 'bloom',  regrow: 0, tag: '花' },
  bluejazz:   { name: '蓝爵',     sell: 90,  seed: 50,  season: 0, grow: [1, 2, 2, 2], color: '#5c7cfa', shape: 'bloom',  regrow: 0, tag: '花' },

  melon:      { name: '甜瓜',     sell: 250, seed: 80,  season: 1, grow: [2, 3, 3, 4], color: '#79c244', shape: 'melon',  regrow: 0 },
  blueberry:  { name: '蓝莓',     sell: 50,  seed: 80,  season: 1, grow: [2, 3, 3, 3], color: '#4a63c9', shape: 'berry',  regrow: 4 },
  tomato:     { name: '番茄',     sell: 60,  seed: 50,  season: 1, grow: [2, 2, 3, 4], color: '#e04a2c', shape: 'fruit',  regrow: 4 },
  pepper:     { name: '辣椒',     sell: 40,  seed: 40,  season: 1, grow: [2, 2, 2, 2], color: '#d62f24', shape: 'pepper', regrow: 3 },
  wheat:      { name: '小麦',     sell: 25,  seed: 10,  season: 1, grow: [1, 1, 1, 1], color: '#e3c25c', shape: 'grain',  regrow: 0 },
  hops:       { name: '啤酒花',   sell: 25,  seed: 60,  season: 1, grow: [2, 3, 3, 3], color: '#a3d95e', shape: 'berry',  regrow: 1 },
  sunflower:  { name: '向日葵',   sell: 80,  seed: 40,  season: 1, grow: [2, 2, 3, 3], color: '#f5c518', shape: 'bloom',  regrow: 0, tag: '花' },
  redcabbage: { name: '红叶卷心菜', sell: 260, seed: 150, season: 1, grow: [2, 2, 3, 4], color: '#b03a6b', shape: 'flower', regrow: 0 },
  poppy:      { name: '罂粟花',   sell: 140, seed: 80,  season: 1, grow: [2, 2, 3, 3], color: '#e8452f', shape: 'bloom',  regrow: 0, tag: '花' },
  spangle:    { name: '夏季亮片', sell: 110, seed: 60,  season: 1, grow: [2, 2, 2, 3], color: '#f7a8d8', shape: 'bloom',  regrow: 0, tag: '花' },

  pumpkin:    { name: '南瓜',     sell: 320, seed: 100, season: 2, grow: [3, 3, 3, 4], color: '#e8852b', shape: 'melon',  regrow: 0 },
  corn:       { name: '玉米',     sell: 50,  seed: 150, season: 2, grow: [2, 3, 4, 5], color: '#f4c73c', shape: 'grain',  regrow: 4 },
  eggplant:   { name: '茄子',     sell: 60,  seed: 20,  season: 2, grow: [2, 2, 3, 3], color: '#7d4fae', shape: 'fruit',  regrow: 5 },
  bokchoy:    { name: '小白菜',   sell: 80,  seed: 50,  season: 2, grow: [1, 1, 2, 2], color: '#a3d95e', shape: 'flower', regrow: 0 },
  cranberry:  { name: '蔓越莓',   sell: 75,  seed: 240, season: 2, grow: [2, 2, 2, 3], color: '#c32b3c', shape: 'berry',  regrow: 5 },
  artichoke:  { name: '洋蓟',     sell: 110, seed: 60,  season: 2, grow: [2, 2, 3, 3], color: '#7fa85a', shape: 'flower', regrow: 0 },
  yam:        { name: '山药',     sell: 160, seed: 60,  season: 2, grow: [2, 2, 2, 3], color: '#d9a05b', shape: 'tuber',  regrow: 0 },
  beet:       { name: '甜菜',     sell: 100, seed: 20,  season: 2, grow: [1, 2, 2, 2], color: '#9b2d5c', shape: 'root',   regrow: 0 },
  fairyrose:  { name: '仙女玫瑰', sell: 290, seed: 180, season: 2, grow: [2, 3, 3, 4], color: '#d6336c', shape: 'bloom',  regrow: 0, tag: '花' },
  cosmos:     { name: '波斯菊',   sell: 150, seed: 90,  season: 2, grow: [2, 2, 3, 3], color: '#e86fa8', shape: 'bloom',  regrow: 0, tag: '花' },

  winterroot: { name: '冬根',     sell: 70,  seed: 40,  season: 3, grow: [2, 2, 3, 3], color: '#e8e2d0', shape: 'root',   regrow: 0 },
  snowflower: { name: '雪绒花',   sell: 95,  seed: 55,  season: 3, grow: [2, 3, 3, 3], color: '#bfe3f0', shape: 'bloom',  regrow: 0, tag: '花' },
  frostbell:  { name: '霜铃花',   sell: 120, seed: 70,  season: 3, grow: [2, 3, 3, 3], color: '#9db9f5', shape: 'bloom',  regrow: 0, tag: '花' },
  icecrystal: { name: '冰晶花',   sell: 175, seed: 100, season: 3, grow: [2, 3, 3, 4], color: '#7ee8e0', shape: 'bloom',  regrow: 0, tag: '花' }
};

function cropTotalDays(def) {
  return def.grow.reduce(function (a, b) { return a + b; }, 0);
}
function cropStage(def, days) {
  let acc = 0;
  for (let i = 0; i < def.grow.length; i++) {
    acc += def.grow[i];
    if (days < acc) return i;
  }
  return def.grow.length - 1;
}
function cropMature(def, days) {
  return days >= cropTotalDays(def);
}

/* ---------- 物品表 ---------- */
const ITEMS = {
  /* 工具 */
  hoe:     { name: '锄头',   type: 'tool', kind: 'hoe',     desc: '开垦土地，把草地变成农田' },
  can:     { name: '洒水壶', type: 'tool', kind: 'can',     desc: '给农田浇水，在水边点击可补水' },
  axe:     { name: '斧头',   type: 'tool', kind: 'axe',     desc: '砍伐树木，获得木材与树液' },
  pickaxe: { name: '镐子',   type: 'tool', kind: 'pickaxe', desc: '敲碎石头，挖掘矿石' },
  scythe:  { name: '镰刀',   type: 'tool', kind: 'scythe',  desc: '割掉杂草，获得纤维' },
  rod:     { name: '钓鱼竿', type: 'tool', kind: 'rod',     desc: '站在水边抛竿钓鱼' },

  /* 材料 */
  wood:       { name: '木材',   type: 'mat', sell: 2,  shape: 'wood' },
  stone:      { name: '石头',   type: 'mat', sell: 2,  shape: 'stone' },
  fiber:      { name: '纤维',   type: 'mat', sell: 1,  shape: 'fiber' },
  sap:        { name: '树液',   type: 'mat', sell: 2,  shape: 'sap' },
  coal:       { name: '煤炭',   type: 'mat', sell: 15, shape: 'coal' },
  copper_ore: { name: '铜矿石', type: 'mat', sell: 5,  shape: 'ore', tint: '#c87137' },
  iron_ore:   { name: '铁矿石', type: 'mat', sell: 10, shape: 'ore', tint: '#b8b8c0' },
  gold_ore:   { name: '金矿石', type: 'mat', sell: 25, shape: 'ore', tint: '#e8c33a' },
  iridium_ore:{ name: '铱矿石', type: 'mat', sell: 50, shape: 'ore', tint: '#b388ff' },

  /* 宝石（矿井稀有掉落） */
  amethyst:   { name: '紫水晶', type: 'mat', sell: 40, shape: 'gem', color: '#b56cd6' },
  ruby:       { name: '红宝石', type: 'mat', sell: 70, shape: 'gem', color: '#e0455a' },
  torch:      { name: '火把',   type: 'mat', sell: 8,  buy: 25, shape: 'torch', desc: '手持照明，或放置在地上照亮矿井' }
};

/* 采集物（按季节分组；w = 刷新权重，越大越常见；form = 外形种类） */
const FORAGE = {
  // 春
  0: [
    { id: 'wildroot',   name: '野山葵',   sell: 8,  energy: 12, color: '#8fc46b', form: 'root',     w: 22 },
    { id: 'dandelion',  name: '蒲公英',   sell: 15, energy: 10, color: '#f2d24b', form: 'flower',   w: 20 },
    { id: 'daffodil',   name: '黄水仙',   sell: 12, energy: 8,  color: '#f6e07a', form: 'flower',   w: 18 },
    { id: 'leek',       name: '大葱',     sell: 20, energy: 16, color: '#9ec46a', form: 'leaf',     w: 14 },
    { id: 'fiddlehead', name: '蕨菜',     sell: 25, energy: 18, color: '#7fbf5a', form: 'fern',     w: 12 },
    { id: 'wildtulip',  name: '野郁金香', sell: 22, energy: 12, color: '#e05a7a', form: 'flower',   w: 12 },
    { id: 'bambooshoot',name: '春笋',     sell: 32, energy: 20, color: '#b8d878', form: 'root',     w: 9  },
    { id: 'wildrose',   name: '野玫瑰',   sell: 18, energy: 10, color: '#e87a9a', form: 'flower',   w: 11 },
    { id: 'morel',      name: '羊肚菌',   sell: 45, energy: 26, color: '#8a6a45', form: 'mushroom', w: 7  }
  ],
  // 夏
  1: [
    { id: 'pea',        name: '香豌豆',   sell: 12, energy: 15, color: '#d79bd6', form: 'flower',   w: 20 },
    { id: 'spiceberry', name: '香料莓',   sell: 25, energy: 18, color: '#d9556a', form: 'berry',    w: 20 },
    { id: 'grape',      name: '野葡萄',   sell: 30, energy: 22, color: '#7a5fa8', form: 'berry',    w: 15 },
    { id: 'cactusfruit',name: '仙人掌果', sell: 28, energy: 20, color: '#e0657a', form: 'berry',    w: 10 },
    { id: 'redmushroom',name: '红蘑菇',   sell: 35, energy: 22, color: '#d0503c', form: 'mushroom', w: 12 },
    { id: 'mint',       name: '薄荷',     sell: 15, energy: 14, color: '#6ac08a', form: 'leaf',     w: 14 },
    { id: 'sunflower',  name: '野向日葵', sell: 22, energy: 12, color: '#f0c030', form: 'flower',   w: 10 },
    { id: 'goldenberry',name: '金莓',     sell: 55, energy: 26, color: '#e8b830', form: 'berry',    w: 6  },
    { id: 'fiddlehead', name: '蕨菜',     sell: 25, energy: 18, color: '#7fbf5a', form: 'fern',     w: 10 }
  ],
  // 秋
  2: [
    { id: 'mushroom',   name: '蘑菇',     sell: 40, energy: 25, color: '#c98a63', form: 'mushroom', w: 20 },
    { id: 'chanterelle',name: '鸡油菌',   sell: 60, energy: 30, color: '#e0a03c', form: 'mushroom', w: 12 },
    { id: 'blackberry', name: '黑莓',     sell: 25, energy: 20, color: '#4a3a6a', form: 'berry',    w: 20 },
    { id: 'hazelnut',   name: '榛子',     sell: 35, energy: 24, color: '#9a6b3c', form: 'nut',      w: 15 },
    { id: 'wildplum',   name: '野李子',   sell: 30, energy: 22, color: '#a04a7a', form: 'berry',    w: 14 },
    { id: 'purplemush', name: '紫蘑菇',   sell: 90, energy: 36, color: '#9a5fc0', form: 'mushroom', w: 5  },
    { id: 'mapleleaf',  name: '红枫叶',   sell: 15, energy: 8,  color: '#d06030', form: 'leaf',     w: 14 },
    { id: 'chestnut',   name: '野栗子',   sell: 28, energy: 20, color: '#8a5a30', form: 'nut',      w: 12 },
    { id: 'porcini',    name: '牛肝菌',   sell: 70, energy: 32, color: '#a0714a', form: 'mushroom', w: 7  }
  ],
  // 冬
  3: [
    { id: 'crystal',    name: '水晶果',   sell: 30, energy: 20, color: '#8fd6e8', form: 'crystal',  w: 20 },
    { id: 'winterroot', name: '冬根',     sell: 70, energy: 32, color: '#c8a882', form: 'root',     w: 18 },
    { id: 'crocus',     name: '番红花',   sell: 60, energy: 18, color: '#c07ad0', form: 'flower',   w: 16 },
    { id: 'holly',      name: '冬青果',   sell: 40, energy: 14, color: '#d03040', form: 'berry',    w: 14 },
    { id: 'snowyam',    name: '雪山药',   sell: 100, energy: 40, color: '#e8e2d0', form: 'root',    w: 8  },
    { id: 'pinecone',   name: '松果',     sell: 12, energy: 10, color: '#6a4a2a', form: 'nut',      w: 15 },
    { id: 'iceflower',  name: '冰晶花',   sell: 70, energy: 20, color: '#a0e8f0', form: 'flower',   w: 8  },
    { id: 'snowlotus',  name: '雪莲',     sell: 120, energy: 30, color: '#e8f0f8', form: 'flower',  w: 4  }
  ]
};
Object.keys(FORAGE).forEach(function (k) {
  FORAGE[k].forEach(function (f) {
    ITEMS[f.id] = {
      name: f.name, type: 'forage', sell: f.sell, energy: f.energy,
      color: f.color, shape: 'forage', form: f.form,
      desc: '野外采集，可食用回复体力'
    };
  });
});

/* 鱼（四季鱼种：seasons 标注可钓季节 0春/1夏/2秋/3冬） */
const FISH = [
  { id: 'carp',     name: '鲤鱼',   sell: 30,  energy: 20, color: '#c08a4a', speed: 1.0, size: 1.0, behavior: 'mixed',  seasons: [0, 1, 2, 3] },
  { id: 'sunfish',  name: '太阳鱼', sell: 55,  energy: 24, color: '#e0a44a', speed: 1.2, size: 1.0, behavior: 'smooth',  seasons: [0, 1] },
  { id: 'herring',  name: '鲱鱼',   sell: 45,  energy: 22, color: '#9fb4d0', speed: 1.5, size: 1.0, behavior: 'dart',    seasons: [0] },
  { id: 'catfish',  name: '鲶鱼',   sell: 45,  energy: 24, color: '#7a6a52', speed: 1.2, size: 1.1, behavior: 'smooth',  seasons: [0, 2] },
  { id: 'salmon',   name: '鲑鱼',   sell: 75,  energy: 32, color: '#d08a72', speed: 2.0, size: 1.3, behavior: 'wild',    seasons: [0, 2] },
  { id: 'bass',     name: '鲈鱼',   sell: 60,  energy: 28, color: '#6f8f5a', speed: 1.5, size: 1.1, behavior: 'dart',    seasons: [1, 2] },
  { id: 'pike',     name: '狗鱼',   sell: 90,  energy: 34, color: '#5f7f6a', speed: 1.8, size: 1.2, behavior: 'wild',    seasons: [1, 3] },
  { id: 'tuna',     name: '金枪鱼', sell: 110, energy: 40, color: '#4a6a8a', speed: 2.2, size: 1.3, behavior: 'wild',    seasons: [1, 3] },
  { id: 'sturgeon', name: '鲟鱼',   sell: 120, energy: 44, color: '#8a93a6', speed: 1.6, size: 1.4, behavior: 'smooth',  seasons: [1, 3] },
  { id: 'eel',      name: '鳗鱼',   sell: 80,  energy: 30, color: '#5a6a5a', speed: 1.4, size: 1.0, behavior: 'dart',    seasons: [2] },
  { id: 'walleye',  name: '梭鲈',   sell: 95,  energy: 34, color: '#c8c064', speed: 1.6, size: 1.1, behavior: 'mixed',  seasons: [2] },
  { id: 'squid',    name: '鱿鱼',   sell: 105, energy: 38, color: '#a06a9a', speed: 1.9, size: 1.1, behavior: 'dart',    seasons: [3] },
  { id: 'icefish',  name: '冰鱼',   sell: 65,  energy: 26, color: '#bfe3f0', speed: 1.3, size: 1.0, behavior: 'smooth',  seasons: [3] }
];
const FISH_MAP = {};
FISH.forEach(function (f) { FISH_MAP[f.id] = f; });
const FISH_BY_SEASON = [0, 1, 2, 3].map(function (se) {
  return FISH.filter(function (f) { return f.seasons.indexOf(se) >= 0; }).map(function (f) { return f.id; });
});
FISH.forEach(function (f) {
  ITEMS[f.id] = {
    name: f.name, type: 'fish', sell: f.sell, energy: f.energy,
    color: f.color, shape: 'fish',
    desc: f.seasons.map(function (s) { return SEASON_SHORT[s]; }).join('·') + '可钓，可出售或食用'
  };
});

/* 鱼获品质（普通/银/金/铱，售价倍率 ×1/×1.25/×1.5/×2） */
const QUALITY = [
  { name: '普通', mult: 1,    color: '#ffffff' },
  { name: '银',   mult: 1.25, color: '#cfd8e3' },
  { name: '金',   mult: 1.5,  color: '#f5c518' },
  { name: '铱',   mult: 2,    color: '#b388ff' }
];

/* 作物本体 + 种子 */
Object.keys(CROPS).forEach(function (id) {
  const c = CROPS[id];
  const tag = c.tag === '花' ? '花卉' : '作物';
  ITEMS[id] = {
    name: c.name, type: 'crop', sell: c.sell, color: c.color,
    shape: c.shape, desc: SEASON_FULL[c.season] + tag
  };
  ITEMS['seed_' + id] = {
    name: c.name + '种子', type: 'seed', crop: id,
    sell: Math.max(1, Math.round(c.seed * 0.4)), buy: c.seed,
    color: c.color, shape: 'seed', desc: '播种到开垦好的农田里'
  };
});

/* ---------- 商店额外商品 ---------- */
const SHOP_EXTRA = [
  { id: 'wood',  buy: 10 },
  { id: 'stone', buy: 20 },
  { id: 'coal',  buy: 100 },
  { id: 'sap',   buy: 5 },
  { id: 'torch', buy: 25 },
  { id: 'workbench', buy: 250 }
];

/* ---------- 制作配方（demo：需靠近工作台操作） ---------- */
const RECIPES = [
  { out: 'torch',     n: 1, cost: [ ['wood', 1], ['sap', 2] ] },
  { out: 'fence',     n: 4, cost: [ ['wood', 2] ] },
  { out: 'stonewall', n: 2, cost: [ ['stone', 2] ] },
  { out: 'jam',       n: 1, cost: [ ['blackberry', 3] ] },
  { out: 'campfire',  n: 1, cost: [ ['torch', 3] ] }
];
/* ---------- 火堆烤肉（靠近火堆操作，熟食回体力更多、卖价更高） ---------- */
const ROASTS = [
  { out: 'cooked_rabbit',   n: 1, cost: [ ['rabbit_meat', 1] ] },
  { out: 'cooked_pheasant', n: 1, cost: [ ['pheasant_meat', 1] ] },
  { out: 'cooked_frog_leg', n: 1, cost: [ ['frog_leg', 1] ] }
];
ITEMS.campfire        = { name: '火堆',     type: 'mat', sell: 60, shape: 'campfire', color: '#e07030', desc: '放置后点击可烤肉，夜里发光' };
ITEMS.cooked_rabbit   = { name: '烤兔肉',   type: 'mat', sell: 95, energy: 70, shape: 'meat', color: '#b05f3a', desc: '火堆烤制，食用恢复 70 体力' };
ITEMS.cooked_pheasant = { name: '烤野鸡肉', type: 'mat', sell: 75, energy: 55, shape: 'meat', color: '#a86838', desc: '外焦里嫩，食用恢复 55 体力' };
ITEMS.cooked_frog_leg = { name: '烤蛙腿',   type: 'mat', sell: 65, energy: 45, shape: 'meat', color: '#9ca84a', desc: '嘎嘣脆，食用恢复 45 体力' };
ITEMS.workbench = { name: '工作台', type: 'mat', sell: 100, buy: 250, shape: 'workbench', color: '#8a6238', desc: '放置后点击可制作物品' };
ITEMS.fence     = { name: '栅栏',   type: 'mat', sell: 2,   shape: 'fence',     color: '#8a6238', desc: '围出你的地盘，可放置' };
ITEMS.stonewall = { name: '石墙',   type: 'mat', sell: 6,   shape: 'stone',     color: '#9aa0a6', desc: '比栅栏结实的围墙，可放置' };
ITEMS.jam       = { name: '黑莓果酱', type: 'mat', sell: 80, energy: 45, shape: 'drop', color: '#5a3a7a', desc: '手工熬制，食用恢复 45 体力' };

/* ---------- 体力消耗 ---------- */
const COST = { hoe: 2, water: 2, axe: 3, pick: 3, scythe: 1, fish: 5, harvest: 0 };

/* ---------- NPC ---------- */
const NPCS = [
  {
    name: '刘易斯', color: '#3f6ea8', shirt: '#3f6ea8', hair: '#d8d8d8',
    x: 22, y: 49, home: { x: 22, y: 49 },
    lines: ['早上好，年轻人！农场还顺利吗？', '镇上很久没来新农夫了。', '别忘了每天照看你的作物。', '第 15 天会有集市，记得来逛逛。']
  },
  {
    name: '莉亚', color: '#6f9c4a', shirt: '#6f9c4a', hair: '#8a4f2a',
    x: 27, y: 49, home: { x: 27, y: 49 },
    lines: ['我在林子里散步的时候，总想画点什么。', '你的农场看起来很有生命力。', '木头是很棒的材料，对吧？', '下次带点你种的东西给我看看。']
  },
  {
    name: '谢恩', color: '#8a5a3a', shirt: '#5a5f7a', hair: '#4a3524',
    x: 32, y: 49, home: { x: 32, y: 49 },
    lines: ['……别盯着我看。', '农场生活？能睡着就行。', '乔迪超市的披萨还不错。', '……下雨天我只想待着。']
  }
];

/* =========================================================================
 *  夜晚怪物（19:00 后刷新在农场围栏外，黎明消失）
 *  hp 血量 / speed 追击速度 / dmg 接触伤害(扣体力) / loot 掉落 / after 出没时刻(游戏分钟)
 * ========================================================================= */
const MONSTERS = {
  slime: { name: '史莱姆', hp: 3, speed: 44, dmg: 6, color: '#6fcf9a', dark: '#3f9e6d', loot: 'slimegel',  after: 1140 },
  bat:   { name: '蝙蝠',   hp: 2, speed: 78, dmg: 4, color: '#8a7ab0', dark: '#5a4a80', loot: 'batwing',  after: 1140, fly: true },
  ghost: { name: '幽灵',   hp: 4, speed: 38, dmg: 9, color: '#bfe6f2', dark: '#8fc4d8', loot: 'ectoplasm', after: 1320, fly: true }
};
ITEMS.slimegel  = { name: '粘液',     type: 'mat', sell: 12, color: '#6fcf9a', shape: 'drop', desc: '史莱姆的残留物，皮埃尔会收购' };
ITEMS.batwing   = { name: '蝙蝠翅膀', type: 'mat', sell: 22, color: '#8a7ab0', shape: 'drop', desc: '夜间击败蝙蝠的掉落物' };
ITEMS.ectoplasm = { name: '灵质',     type: 'mat', sell: 45, color: '#bfe6f2', shape: 'drop', desc: '幽灵残留的神秘物质，值点钱' };

/* =========================================================================
 *  野外小动物（白天在农场游荡，靠近会逃跑；击杀掉肉，食用恢复体力）
 *  speed 逃跑速度 / flee 触发逃跑的玩家距离(格) / loot 掉落
 * ========================================================================= */
const ANIMALS = {
  rabbit:   { name: '兔子', speed: 118, flee: 4.5, loot: 'rabbit_meat',   body: '#ece6da', dark: '#bcb2a2' },
  pheasant: { name: '野鸡', speed: 96,  flee: 5,   loot: 'pheasant_meat', body: '#b07a4e', dark: '#7a4f30' },
  frog:     { name: '青蛙', speed: 82,  flee: 3.5, loot: 'frog_leg',     body: '#6cbb45', dark: '#4f9c34' }
};
ITEMS.rabbit_meat   = { name: '兔肉',   type: 'mat', sell: 45, energy: 40, shape: 'meat', color: '#d88a7a', desc: '新鲜的兔肉，食用恢复 40 体力' };
ITEMS.pheasant_meat = { name: '野鸡肉', type: 'mat', sell: 35, energy: 30, shape: 'meat', color: '#c07858', desc: '野味十足，食用恢复 30 体力' };
ITEMS.frog_leg      = { name: '蛙腿',   type: 'mat', sell: 30, energy: 25, shape: 'meat', color: '#8fc46b', desc: '烤一烤更香，食用恢复 25 体力' };
