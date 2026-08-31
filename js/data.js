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
  gold_ore:   { name: '金矿石', type: 'mat', sell: 25, shape: 'ore', tint: '#e8c33a' }
};

/* 采集物（按季节） */
const FORAGE = {
  0: { id: 'wildroot', name: '野山葵', sell: 8,  energy: 12, color: '#8fc46b' },
  1: { id: 'pea',      name: '香豌豆', sell: 12, energy: 15, color: '#d79bd6' },
  2: { id: 'mushroom', name: '蘑菇',   sell: 40, energy: 25, color: '#c98a63' },
  3: { id: 'crystal',  name: '水晶果', sell: 30, energy: 20, color: '#8fd6e8' }
};
Object.keys(FORAGE).forEach(function (k) {
  const f = FORAGE[k];
  ITEMS[f.id] = {
    name: f.name, type: 'forage', sell: f.sell, energy: f.energy,
    color: f.color, shape: 'forage', desc: '野外采集，可食用回复体力'
  };
});

/* 鱼 */
const FISH = [
  { id: 'carp',   name: '鲤鱼',   sell: 30, energy: 20, color: '#c08a4a', speed: 1.0, size: 1.0 },
  { id: 'catfish',name: '鲶鱼',   sell: 45, energy: 24, color: '#7a6a52', speed: 1.3, size: 1.2 },
  { id: 'bass',   name: '鲈鱼',   sell: 60, energy: 28, color: '#6f8f5a', speed: 1.6, size: 1.1 },
  { id: 'salmon', name: '鲑鱼',   sell: 75, energy: 32, color: '#d08a72', speed: 2.0, size: 1.3 }
];
FISH.forEach(function (f) {
  ITEMS[f.id] = {
    name: f.name, type: 'fish', sell: f.sell, energy: f.energy,
    color: f.color, shape: 'fish', desc: '钓上来的鱼，可出售或食用'
  };
});

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
  { id: 'sap',   buy: 5 }
];

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
