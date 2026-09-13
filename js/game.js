/* =========================================================================
 *  game.js  ——  主循环、玩家、交互、时间系统、UI
 * ========================================================================= */
'use strict';

const MIN_PER_SEC = 2.5;      // 1 现实秒 = 2.5 游戏分钟（约 8 分钟一整天）
const DAY_START = 360;        // 6:00
const DAY_END = 1560;         // 26:00（凌晨 2 点强制昏倒）

const ZOOM_MIN = 0.55;        // 视角最远（看得最广）
const ZOOM_MAX = 2.2;         // 视角最近（看得最清）
const ZOOM_STEP = 0.12;       // 滚轮每格步长
const MONSTER_CAP = 6;        // 夜晚农场怪物同屏上限
const MONSTER_FROM = 1140;    // 19:00 后开始出怪（游戏分钟）
const FARM_FENCE = { x0: 3, y0: 10, x1: 42, y1: 38 };  // 农场围栏范围（与 createFarmMap 一致，怪物只刷在外面）
const ANIMAL_CAP = 8;         // 白天小动物同屏上限
const ANIMAL_UNTIL = 1080;    // 18:00 后不再刷新，入夜逐渐消失

const Game = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  map: null, maps: {},
  player: {
    x: 0, y: 0, dir: 'down', frame: 0, moving: false, anim: 0,
    speed: 138, swing: 0, swingKind: null, swingDir: 'down'
  },
  time: DAY_START, day: 1, season: 0, year: 1, weather: 'sun',
  money: 500, energy: 120, maxEnergy: 120,
  inv: new Array(36).fill(null), sel: 0,
  canWater: 40, canMax: 40,
  mineLevel: 1,
  npcs: [],
  monsters: [],        // 夜晚农场怪物
  monsterTimer: 0,     // 生成计时
  nightWarned: false,  // 每晚只提示一次
  animals: [],         // 白天野外小动物
  animalTimer: 0,
  shipping: [],
  floaters: [],
  toasts: [],
  particles: [],
  cam: { x: 0, y: 0 },
  zoom: 1, zoomTarget: 1, zoomHintT: 0,
  keys: {}, mouse: { x: 0, y: 0, down: false },
  running: false, paused: true, muted: false,
  fishing: null,
  mining: null,      // 长按挖矿 { tx, ty, timer }
  particles: [],     // 挖矿碎石特效
  t: 0,
  lastTs: 0,
  lastMin: -1
};

/* =========================================================================
 *  DOM
 * ========================================================================= */
const $ = function (id) { return document.getElementById(id); };
const dom = {};

function cacheDom() {
  ['cv', 'chipDate', 'chipTime', 'chipWeather', 'chipMoney', 'energyFill', 'energyText',
    'hotbar', 'toast', 'invPanel', 'invGrid', 'shopPanel', 'shopBody', 'shopTitle',
    'dialogPanel', 'dialogText', 'dialogBtns', 'titleScreen', 'helpPanel',
    'craftPanel', 'craftBody',
    'fade', 'btnHelp', 'btnMute', 'fishingPanel'].forEach(function (k) { dom[k] = $(k); });
}

/* =========================================================================
 *  提示 / 飘字
 * ========================================================================= */
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = text;
  dom.toast.appendChild(el);
  Game.toasts.push({ el: el, t: 2.8 });
  while (Game.toasts.length > 4) {
    const old = Game.toasts.shift();
    if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
  }
}
function floater(x, y, text, color) {
  Game.floaters.push({ x: x, y: y, text: text, color: color || '#fff', t: 1.3 });
}
/* 挖矿碎石粒子特效 */
function spawnRockFx(tx, ty, big, metal) {
  const cx = tx * TILE + 16, cy = ty * TILE + 12;
  const n = big ? 14 : 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (big ? 45 : 28) + Math.random() * 60;
    const metalCol = { copper: '#c87137', iron: '#c9ccd4', gold: '#e8c33a', iridium: '#b388ff', coal: '#3d3d42', amethyst: '#b56cd6', ruby: '#e0455a' }[metal];
    Game.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      t: 0, life: 0.4 + Math.random() * 0.35,
      size: big ? 2.6 : 2,
      color: metalCol && Math.random() < 0.35 ? metalCol : (Math.random() < 0.3 ? '#7a7e85' : '#a8adb5')
    });
  }
}

/* =========================================================================
 *  音效（WebAudio 合成）
 * ========================================================================= */
let actx = null;
function sfx(type) {
  if (Game.muted) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const conf = {
      chop: [200, 0.14, 'square', 0.09, 90],
      till: [130, 0.12, 'sawtooth', 0.06, 70],
      water: [520, 0.22, 'sine', 0.05, 300],
      coin: [880, 0.10, 'square', 0.05, 1180],
      pick: [280, 0.12, 'square', 0.08, 120],
      break: [110, 0.28, 'sawtooth', 0.10, 40],
      plant: [340, 0.09, 'triangle', 0.05, 420],
      bite: [660, 0.12, 'sine', 0.06, 900],
      hit: [160, 0.12, 'square', 0.09, 55],
      error: [100, 0.13, 'square', 0.05, 60],
      sleep: [300, 0.5, 'sine', 0.05, 120],
      step: [70, 0.05, 'triangle', 0.02, 60]
    }[type];
    if (!conf) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = conf[2];
    o.frequency.setValueAtTime(conf[0], actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(conf[4], actx.currentTime + conf[1]);
    g.gain.setValueAtTime(conf[3], actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + conf[1]);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + conf[1] + 0.02);
  } catch (e) { /* 忽略音频错误 */ }
}

/* =========================================================================
 *  背包
 * ========================================================================= */
function addItem(id, n, quality) {
  n = n || 1;
  const it = ITEMS[id];
  if (!it) return 0;
  let left = n;
  // 先堆叠（同 id 且同品质才叠加）
  if (it.type !== 'tool') {
    for (let i = 0; i < Game.inv.length && left > 0; i++) {
      const s = Game.inv[i];
      if (s && s.id === id && (s.quality || 0) === (quality || 0) && s.count < 999) {
        const add = Math.min(999 - s.count, left);
        s.count += add; left -= add;
      }
    }
  }
  // 再找空位
  for (let i = 0; i < Game.inv.length && left > 0; i++) {
    if (!Game.inv[i]) {
      const add = (it.type === 'tool') ? 1 : left;
      Game.inv[i] = { id: id, count: add, quality: quality || 0 };
      left -= add;
    }
  }
  if (left > 0) toast('背包已满！');
  refreshInv();
  return n - left;
}
function removeItem(id, n, quality) {
  n = n || 1;
  let left = n;
  for (let i = 0; i < Game.inv.length && left > 0; i++) {
    const s = Game.inv[i];
    if (s && s.id === id && (quality == null || (s.quality || 0) === quality)) {
      const take = Math.min(s.count, left);
      s.count -= take; left -= take;
      if (s.count <= 0) Game.inv[i] = null;
    }
  }
  refreshInv();
  return n - left;
}
function countItem(id, quality) {
  let c = 0;
  for (let i = 0; i < Game.inv.length; i++) {
    const s = Game.inv[i];
    if (s && s.id === id && (quality == null || (s.quality || 0) === quality)) c += s.count;
  }
  return c;
}
/* 品质显示后缀 */
function qualitySuffix(s) {
  const q = s.quality || 0;
  return q > 0 ? ('·' + QUALITY[q].name) : '';
}
/* 品质星标（画在物品图标右上角） */
function drawQualityStar(ctx, q, x, y, r) {
  ctx.save();
  ctx.fillStyle = QUALITY[q] ? QUALITY[q].color : '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
function selectedItem() { return Game.inv[Game.sel]; }

/* =========================================================================
 *  UI：快捷栏 / 背包 / HUD
 * ========================================================================= */
function buildHotbar() {
  dom.hotbar.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.dataset.i = i;
    const c = makeCanvas(44, 44);
    d.appendChild(c);
    const num = document.createElement('span');
    num.className = 'num'; num.textContent = (i + 1) % 10;
    d.appendChild(num);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    d.appendChild(cnt);
    const nm = document.createElement('span');
    nm.className = 'nm';
    d.appendChild(nm);
    d.addEventListener('click', function () { selectSlot(i); });
    dom.hotbar.appendChild(d);
  }
}
function selectSlot(i) {
  Game.sel = i;
  refreshInv();
}
function refreshInv() {
  // 快捷栏
  for (let i = 0; i < 10; i++) {
    const d = dom.hotbar.children[i];
    if (!d) continue;
    d.classList.toggle('active', i === Game.sel);
    const c = d.querySelector('canvas');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 44, 44);
    const s = Game.inv[i];
    const nm = d.querySelector('.nm');
    if (s) {
      drawItemIcon(ctx, s.id, 6, 6, 32);
      if (s.quality > 0) drawQualityStar(ctx, s.quality, 37, 9, 5);
      const cnt = d.querySelector('.cnt');
      cnt.textContent = (ITEMS[s.id].type === 'tool' || s.count <= 1) ? '' : s.count;
      nm.textContent = ITEMS[s.id].name + qualitySuffix(s);
      nm.classList.remove('empty');
      d.title = ITEMS[s.id].name + (ITEMS[s.id].desc ? '：' + ITEMS[s.id].desc : '');
    } else {
      d.querySelector('.cnt').textContent = '';
      nm.textContent = '空';
      nm.classList.add('empty');
      d.title = '';
    }
  }
  // 背包面板
  if (!dom.invPanel.classList.contains('hidden')) renderInvPanel();
  if (!dom.shopPanel.classList.contains('hidden')) renderShop();
  updateHUD();
}
function renderInvPanel() {
  let html = '';
  for (let i = 0; i < 36; i++) {
    const s = Game.inv[i];
    const isHot = i < 10;
    html += '<div class="inv-slot' + (isHot ? ' hot' : '') + (i === Game.sel ? ' sel' : '') + '" data-i="' + i + '">' +
      '<canvas width="46" height="46" data-item="' + (s ? s.id : '') + '" data-quality="' + (s ? (s.quality || 0) : 0) + '"></canvas>' +
      (s && s.count > 1 && ITEMS[s.id].type !== 'tool' ? '<span class="cnt">' + s.count + '</span>' : '') +
      (isHot ? '<span class="tag">' + ((i + 1) % 10) + '</span>' : '') +
      '<span class="nm' + (s ? '' : ' empty') + '">' + (s ? ITEMS[s.id].name + qualitySuffix(s) : '空') + '</span>' +
      '</div>';
  }
  dom.invGrid.innerHTML = html;
  Array.prototype.forEach.call(dom.invGrid.querySelectorAll('canvas'), function (c) {
    const id = c.dataset.item;
    if (!id) return;
    const q = parseInt(c.dataset.quality || '0', 10);
    drawItemIcon(c.getContext('2d'), id, 7, 7, 32);
    if (q > 0) drawQualityStar(c.getContext('2d'), q, 38, 9, 5);
  });
  Array.prototype.forEach.call(dom.invGrid.querySelectorAll('.inv-slot'), function (el) {
    el.addEventListener('click', function () {
      const i = parseInt(el.dataset.i, 10);
      // 与当前选中格交换
      const tmp = Game.inv[i];
      Game.inv[i] = Game.inv[Game.sel];
      Game.inv[Game.sel] = tmp;
      refreshInv();
    });
    el.addEventListener('mouseenter', function () {
      const s = Game.inv[parseInt(el.dataset.i, 10)];
      el.title = s ? (ITEMS[s.id].name + (ITEMS[s.id].desc ? '：' + ITEMS[s.id].desc : '')) : '';
    });
  });
}

function clockText() {
  const h24 = Math.floor(Game.time / 60) % 24;
  const mm = Math.floor(Game.time % 60);
  const ap = h24 < 12 ? '上午' : '下午';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return ap + ' ' + h12 + ':' + (mm < 10 ? '0' : '') + mm;
}
function weatherText() {
  if (Game.weather === 'rain') return '🌧 雨天';
  if (Game.weather === 'snow') return '❄ 雪天';
  return '☀ 晴天';
}
function updateHUD() {
  dom.chipDate.textContent = SEASON_SHORT[Game.season] + ' ' + Game.day + '日 ' + WEEKDAY[(Game.day - 1) % 7] + ' · 第' + Game.year + '年';
  dom.chipTime.textContent = clockText();
  dom.chipWeather.textContent = weatherText();
  dom.chipMoney.textContent = '🪙 ' + Game.money;
  const pct = Math.max(0, Math.min(1, Game.energy / Game.maxEnergy));
  dom.energyFill.style.width = (pct * 100) + '%';
  dom.energyFill.style.background = pct > 0.4 ? 'linear-gradient(#ffe07a,#f0a83a)' : 'linear-gradient(#ff9a7a,#e0523a)';
  dom.energyText.textContent = Math.ceil(Game.energy) + '/' + Game.maxEnergy;
  const sel = selectedItem();
  dom.hotbar.title = sel ? ITEMS[sel.id].name : '';
}

/* =========================================================================
 *  面板控制
 * ========================================================================= */
function closeAllPanels() {
  dom.invPanel.classList.add('hidden');
  dom.shopPanel.classList.add('hidden');
  dom.helpPanel.classList.add('hidden');
  dom.dialogPanel.classList.add('hidden');
  dom.craftPanel.classList.add('hidden');
  if (Game.running) Game.paused = false;
  else Game.paused = true;
}
function anyPanelOpen() {
  return !dom.invPanel.classList.contains('hidden') ||
    !dom.shopPanel.classList.contains('hidden') ||
    !dom.helpPanel.classList.contains('hidden') ||
    !dom.dialogPanel.classList.contains('hidden') ||
    !dom.craftPanel.classList.contains('hidden') ||
    !dom.titleScreen.classList.contains('hidden');
}
function toggleInventory() {
  if (dom.invPanel.classList.contains('hidden')) {
    closeAllPanels();
    renderInvPanel();
    dom.invPanel.classList.remove('hidden');
    Game.paused = true;
  } else closeAllPanels();
}
function showDialog(text, buttons) {
  dom.dialogText.innerHTML = text;
  dom.dialogBtns.innerHTML = '';
  (buttons || [{ label: '关闭', fn: closeAllPanels }]).forEach(function (b) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = b.label;
    btn.addEventListener('click', function () { sfx('plant'); b.fn(); });
    dom.dialogBtns.appendChild(btn);
  });
  dom.dialogPanel.classList.remove('hidden');
  Game.paused = true;
}

/* =========================================================================
 *  商店 / 出货
 * ========================================================================= */
let shopMode = 'shop';
function openShop(mode) {
  closeAllPanels();
  shopMode = mode;
  dom.shopTitle.textContent = mode === 'bin' ? '📦 出货箱（次日结算）' : '🏪 皮埃尔杂货铺';
  renderShop();
  dom.shopPanel.classList.remove('hidden');
  Game.paused = true;
}
function shopStock() {
  const list = [];
  Object.keys(CROPS).forEach(function (id) {
    if (CROPS[id].season === Game.season) list.push({ id: 'seed_' + id });
  });
  SHOP_EXTRA.forEach(function (s) { list.push({ id: s.id }); });
  return list;
}
function renderShop() {
  let html = '<div class="shop-cols">';
  if (shopMode === 'shop') {
    html += '<div class="shop-col"><h4>购买</h4><div class="shop-list">';
    shopStock().forEach(function (s) {
      const it = ITEMS[s.id];
      const price = it.buy != null ? it.buy : (CROPS[it.crop] ? CROPS[it.crop].seed : 0);
      html += '<div class="shop-row">' +
        '<canvas width="34" height="34" data-item="' + s.id + '"></canvas>' +
        '<span class="nm">' + it.name + '</span>' +
        '<span class="pr">🪙' + price + '</span>' +
        '<button class="mini" data-buy="' + s.id + '" data-n="1">买1</button>' +
        '<button class="mini" data-buy="' + s.id + '" data-n="5">买5</button>' +
        '</div>';
    });
    html += '</div></div>';
  }
  html += '<div class="shop-col"><h4>出售</h4><div class="shop-list">';
  let has = false;
  for (let i = 0; i < Game.inv.length; i++) {
    const s = Game.inv[i];
    if (!s) continue;
    const it = ITEMS[s.id];
    if (it.type === 'tool' || it.sell == null) continue;
    const q = s.quality || 0;
    const mult = QUALITY[q] ? QUALITY[q].mult : 1;
    has = true;
    html += '<div class="shop-row">' +
      '<canvas width="34" height="34" data-item="' + s.id + '"></canvas>' +
      '<span class="nm">' + it.name + qualitySuffix(s) + ' ×' + s.count + '</span>' +
      '<span class="pr">🪙' + Math.round(it.sell * s.count * mult) + '</span>' +
      '<button class="mini" data-sell="' + s.id + ':' + q + '">卖出</button>' +
      '</div>';
  }
  if (!has) html += '<div class="empty">没有可出售的物品</div>';
  html += '</div>';
  html += '<button class="btn wide" id="sellAll">全部出售</button>';
  html += '</div></div>';
  html += '<div class="shop-foot">持有：🪙 <b>' + Game.money + '</b>' +
    (shopMode === 'bin' ? '　·　出货箱待结算：🪙 <b>' + shippingTotal() + '</b>' : '') + '</div>';
  dom.shopBody.innerHTML = html;

  Array.prototype.forEach.call(dom.shopBody.querySelectorAll('canvas'), function (c) {
    drawItemIcon(c.getContext('2d'), c.dataset.item, 4, 4, 26);
  });
  Array.prototype.forEach.call(dom.shopBody.querySelectorAll('[data-buy]'), function (b) {
    b.addEventListener('click', function () { buyItem(b.dataset.buy, parseInt(b.dataset.n, 10)); });
  });
  Array.prototype.forEach.call(dom.shopBody.querySelectorAll('[data-sell]'), function (b) {
    b.addEventListener('click', function () {
      const p = b.dataset.sell.split(':');
      sellItem(p[0], 999, parseInt(p[1], 10));
    });
  });
  const sa = $('sellAll');
  if (sa) sa.addEventListener('click', sellAll);
}
function buyItem(id, n) {
  const it = ITEMS[id];
  const price = it.buy != null ? it.buy : (CROPS[it.crop] ? CROPS[it.crop].seed : 0);
  const cost = price * n;
  if (Game.money < cost) { toast('金币不足'); sfx('error'); return; }
  const got = addItem(id, n);
  if (got <= 0) return;
  Game.money -= price * got;
  sfx('coin');
  toast('购买 ' + it.name + ' ×' + got);
  refreshInv();
}
function sellItem(id, n, quality) {
  const it = ITEMS[id];
  const q = quality || 0;
  const cnt = Math.min(countItem(id, q), n);
  if (cnt <= 0) return;
  const value = Math.round(it.sell * cnt * QUALITY[q].mult);
  removeItem(id, cnt, q);
  const label = it.name + ((q > 0) ? '·' + QUALITY[q].name : '');
  if (shopMode === 'bin') {
    Game.shipping.push({ id: id, count: cnt, value: value, name: label, quality: q });
    toast('已放入出货箱：' + label + ' ×' + cnt);
  } else {
    Game.money += value;
    toast('卖出 ' + label + ' ×' + cnt + '，+🪙' + value);
  }
  sfx('coin');
  refreshInv();
}
function sellAll() {
  let sold = 0, value = 0;
  for (let i = 0; i < Game.inv.length; i++) {
    const s = Game.inv[i];
    if (!s) continue;
    const it = ITEMS[s.id];
    if (it.type === 'tool' || it.sell == null) continue;
    const q = s.quality || 0;
    const v = Math.round(it.sell * s.count * QUALITY[q].mult);
    value += v;
    sold += s.count;
    if (shopMode === 'bin') Game.shipping.push({ id: s.id, count: s.count, value: v, name: it.name + qualitySuffix(s), quality: q });
    Game.inv[i] = null;
  }
  if (!sold) { toast('没有可出售的物品'); return; }
  if (shopMode !== 'bin') Game.money += value;
  sfx('coin');
  toast(shopMode === 'bin' ? ('已放入出货箱：🪙' + value) : ('全部卖出，+🪙' + value));
  refreshInv();
}
function shippingTotal() {
  return Game.shipping.reduce(function (a, b) { return a + b.value; }, 0);
}

/* =========================================================================
 *  地图切换
 * ========================================================================= */
function enterMap(id, spawn, level) {
  let key = id;
  if (id === 'mine') {
    key = 'mine_' + level;
    Game.maps[key] = createMineMap(level);   // 每次进入矿井都重新生成随机布局
  } else if (!Game.maps[key]) {
    if (id === 'house') Game.maps[key] = createHouseMap();
    else if (id === 'farm') Game.maps[key] = createFarmMap();
    else { toast('这里进不去（未知地图：' + id + '）'); return; }  // 兜底：绝不能再造一张新农场
  }
  Game.map = Game.maps[key];
  if (!Game.map.cache || Game.map.cacheSeason !== Game.season) buildGroundCache(Game.map, Game.season);
  const sp = spawn || Game.map.spawn;
  Game.player.x = sp.x; Game.player.y = sp.y;
  Game.cam.x = Game.player.x - Game.W / 2;
  Game.cam.y = Game.player.y - Game.H / 2;
  clampCam();
}

/* =========================================================================
 *  输入
 * ========================================================================= */
function bindInput() {
  window.addEventListener('keydown', function (e) {
    const k = e.key.toLowerCase();
    Game.keys[k] = true;
    if ([' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();

    if (!Game.running) {
      if (k === 'enter') startGame(false);
      return;
    }
    if (k === 'escape') {
      if (Game.fishing) endFishing(false);
      closeAllPanels();
      return;
    }
    if (anyPanelOpen() && k !== 'tab' && k !== 'i' && k !== 'e') return;

    if (k >= '1' && k <= '9') selectSlot(parseInt(k, 10) - 1);
    if (k === '0') selectSlot(9);
    if (k === 'tab' || k === 'i') { toggleInventory(); return; }
    if (k === 'e') { doInteract(); return; }
    if (k === 'f') { eatSelected(); return; }
    if (k === 'h') { toggleHelp(); return; }
    if (k === ' ') {
      if (e.repeat) return;   // 长按空格不重复触发动作
      if (Game.fishing) {
        if (Game.fishing.phase !== 'wait') fishingClick();   // 等待阶段空格仅待命，不取消钓鱼
      } else useAtFacing();
    }
  });
  window.addEventListener('keyup', function (e) { Game.keys[e.key.toLowerCase()] = false; });

  dom.cv.addEventListener('mousemove', function (e) {
    const r = dom.cv.getBoundingClientRect();
    Game.mouse.x = e.clientX - r.left;
    Game.mouse.y = e.clientY - r.top;
  });
  dom.cv.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (!Game.running || Game.paused) return;
    const r = dom.cv.getBoundingClientRect();
    Game.mouse.x = e.clientX - r.left;
    Game.mouse.y = e.clientY - r.top;
    Game.mouse.down = true;
    if (Game.fishing) { fishingClick(); return; }
    const w = screenToWorld(Game.mouse.x, Game.mouse.y);
    const tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    useAt(tx, ty);
    // 记录按住目标：长按挖矿（镐子敲石头时持续生效）
    Game.mining = { tx: tx, ty: ty, timer: 0.34 };
  });
  window.addEventListener('mouseup', function () { Game.mouse.down = false; Game.mining = null; });
  dom.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // 滚轮缩放视角：以鼠标位置为锚点，向上滚放大、向下滚缩小
  dom.cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (!Game.running) return;
    const r = dom.cv.getBoundingClientRect();
    const f = e.deltaY < 0 ? (1 + ZOOM_STEP) : 1 / (1 + ZOOM_STEP);
    setZoom(Game.zoomTarget * f, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  dom.btnHelp.addEventListener('click', toggleHelp);
  dom.btnMute.addEventListener('click', function () {
    Game.muted = !Game.muted;
    dom.btnMute.textContent = Game.muted ? '🔇' : '🔊';
  });
  dom.helpPanel.addEventListener('click', function (e) {
    if (e.target === dom.helpPanel) closeAllPanels();
  });
  $('btnNew').addEventListener('click', function () { startGame(false); });
  $('btnContinue').addEventListener('click', function () { startGame(true); });
  $('btnHelpTitle').addEventListener('click', toggleHelp);
}
function toggleHelp() {
  if (dom.helpPanel.classList.contains('hidden')) {
    closeAllPanels();
    dom.helpPanel.classList.remove('hidden');
    Game.paused = true;
  } else closeAllPanels();
}

/* =========================================================================
 *  玩家动作
 * ========================================================================= */
function facingTile() {
  const p = Game.player;
  const d = { down: [0, 16], up: [0, -22], left: [-16, -6], right: [16, -6] }[p.dir];
  return { x: Math.floor((p.x + d[0]) / TILE), y: Math.floor((p.y + d[1]) / TILE) };
}
function tileDist(tx, ty) {
  const p = Game.player;
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  return Math.hypot(cx - p.x, cy - (p.y - 8));
}
function useAtFacing() {
  if (Game.fishing) { fishingClick(); return; }
  const t = facingTile();
  useAt(t.x, t.y);
}
function useAt(tx, ty) {
  const m = Game.map;
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
  // 野外小动物优先：点到即狩猎
  const an = animalAt(tx, ty);
  if (an) { huntAnimal(an); return; }
  // 夜晚怪物优先：点到怪物即攻击
  const mo = monsterAt(tx, ty);
  if (mo) { attackMonster(mo); return; }
  const o = getObj(m, tx, ty);
  const sel = selectedItem();

  // 优先：可交互物件（wall = 建筑墙体，点建筑任意位置都能进屋/开商店）
  if (o && ['door', 'wall', 'bin', 'bin2', 'bed', 'bed2', 'stairs', 'leave', 'sign', 'workbench', 'campfire'].indexOf(o.type) >= 0) {
    interact(o, tx, ty); return;
  }
  if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }

  // 空手 / 手持非工具
  if (!sel) { handAction(tx, ty, o); return; }
  const it = ITEMS[sel.id];
  if (it.type === 'tool') { useTool(sel.id, tx, ty, o); return; }
  if (it.type === 'seed') { plantSeed(tx, ty, sel.id); return; }
  // 火把：放置或收回
  if (sel.id === 'torch') {
    if (o && o.type === 'torch') {
      setObj(m, tx, ty, null);
      addItem('torch', 1);
      toast('收回了火把');
      return;
    }
    if (o) { toast('这里放不下'); return; }
    const tile = tileAt(m, tx, ty);
    if (SOLID_TILES.has(tile)) { toast('这里放不下'); return; }
    if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }
    if (!removeItem('torch', 1)) return;
    setObj(m, tx, ty, { type: 'torch', solid: false });
    toast('放置了火把');
    return;
  }
  // 可放置物品：工作台 / 栅栏 / 石墙 / 火堆（与火把同款放置逻辑）
  if (sel && ['workbench', 'fence', 'stonewall', 'campfire'].indexOf(sel.id) >= 0) {
    if (o) { toast('这里放不下'); return; }
    const ptile = tileAt(m, tx, ty);
    if (SOLID_TILES.has(ptile)) { toast('这里放不下'); return; }
    if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }
    if (!removeItem(sel.id, 1)) return;
    setObj(m, tx, ty, { type: sel.id, solid: true });
    sfx('till');
    toast('放置了' + ITEMS[sel.id].name);
    return;
  }
  handAction(tx, ty, o);
}

function spend(n) {
  if (Game.energy < n) { toast('体力不足，去睡觉吧'); sfx('error'); return false; }
  Game.energy -= n;
  return true;
}
function swing(kind) {
  Game.player.swing = 0.34;
  Game.player.swingKind = kind;
  Game.player.swingDir = Game.player.dir;
}

function useTool(id, tx, ty, o) {
  const m = Game.map;
  const kind = ITEMS[id].kind;
  const soil = m.soil[key(tx, ty)];
  const tile = tileAt(m, tx, ty);

  if (kind === 'rod') {
    if (tile === T.WATER) { startFishing(tx, ty); return; }
    toast('要站在水边才能钓鱼'); return;
  }
  if (kind === 'can') {
    if (tile === T.WATER) { Game.canWater = Game.canMax; toast('洒水壶已装满'); sfx('water'); return; }
    if (soil) {
      if (soil.wet) { toast('这里已经浇过水了'); return; }
      if (Game.canWater <= 0) { toast('洒水壶空了，去水边补水'); sfx('error'); return; }
      if (!spend(COST.water)) return;
      Game.canWater--;
      soil.wet = true;
      sfx('water'); swing('can');
      floater(tx * TILE + 16, ty * TILE, '💧', '#8fd0ff');
      return;
    }
    toast('先用地锄开垦土地'); return;
  }
  if (kind === 'hoe') {
    if (o && o.type === 'weeds') { setObj(m, tx, ty, null); swing('hoe'); sfx('till'); return; }
    if (soil) {
      if (soil.crop) { delete m.soil[key(tx, ty)]; toast('铲除了作物'); swing('hoe'); return; }
      delete m.soil[key(tx, ty)]; toast('恢复了草地'); swing('hoe'); return;
    }
    if (!TILLABLE.has(tile)) { toast('这里开垦不了'); return; }
    if (o) { toast('先把地上的东西清掉'); return; }
    if (!spend(COST.hoe)) return;
    m.soil[key(tx, ty)] = { wet: false, crop: null };
    swing('hoe'); sfx('till');
    return;
  }
  if (kind === 'axe') {
    if (o && (o.type === 'tree' || o.type === 'branch')) {
      if (!spend(COST.axe)) return;
      swing('axe'); sfx('chop');
      o.shake = 0.25;
      o.hp = (o.hp || 3) - 1;
      if (o.type === 'branch') {
        setObj(m, tx, ty, null);
        giveLoot(tx, ty, ['wood']);
        return;
      }
      if (o.kind === 'stump' || o.hp <= 0) {
        setObj(m, tx, ty, null);
        giveLoot(tx, ty, ['wood', 'wood', 'sap']);
        // 留下树桩
        if (o.kind !== 'stump' && Math.random() < 0.7) setObj(m, tx, ty, { type: 'tree', kind: 'stump', solid: true, hp: 1, shake: 0 });
        return;
      }
      giveLoot(tx, ty, ['sap']);
      return;
    }
    if (o && o.type === 'fence') {
      if (!spend(COST.axe)) return;
      swing('axe'); sfx('chop');
      spawnRockFx(tx, ty, false);
      setObj(m, tx, ty, null);
      addItem('fence', 1);
      toast('拆除了栅栏，回收 1 个');
      return;
    }
    if (o && (o.type === 'campfire' || o.type === 'workbench')) {
      if (!spend(COST.axe)) return;
      swing('axe'); sfx('chop');
      spawnRockFx(tx, ty, false);
      setObj(m, tx, ty, null);
      addItem(o.type, 1);
      toast('拆除了' + ITEMS[o.type].name + '，回收 1 个');
      return;
    }
    toast('对着树使用斧头'); return;
  }
  if (kind === 'pickaxe') {
    if (o && o.type === 'rock') {
      if (!spend(COST.pick)) return;
      swing('pickaxe'); sfx('pick');
      spawnRockFx(tx, ty, false, o.metal);
      o.shake = 0.25;
      o.hp = (o.hp || 2) - 1;
      if (o.hp <= 0) {
        setObj(m, tx, ty, null);
        spawnRockFx(tx, ty, true, o.metal);
        sfx('break');
        const drops = ['stone'];
        if (o.metal === 'copper') drops.push('copper_ore');
        if (o.metal === 'iron') drops.push('iron_ore');
        if (o.metal === 'gold') drops.push('gold_ore');
        if (o.metal === 'iridium') drops.push('iridium_ore');
        if (o.metal === 'coal') drops.push('coal', 'coal');
        if (o.metal === 'amethyst') drops.push('amethyst', Math.random() < 0.35 ? 'amethyst' : null);
        if (o.metal === 'ruby') drops.push('ruby', Math.random() < 0.35 ? 'ruby' : null);
        // 额外掉落：普通石头可能掉煤/矿/稀有宝石；矿脉石可能额外掉宝石
        if (o.metal === null) {
          if (Math.random() < 0.16) drops.push(Math.random() < 0.5 ? 'coal' : 'copper_ore');
          if (Math.random() < 0.04) drops.push(Math.random() < 0.5 ? 'amethyst' : 'ruby');
          if (Math.random() < 0.03) drops.push('torch');
        } else if (o.metal === 'copper' || o.metal === 'iron' || o.metal === 'gold' || o.metal === 'iridium') {
          if (Math.random() < 0.08) drops.push(Math.random() < 0.5 ? 'amethyst' : 'ruby');
          if (Math.random() < 0.05) drops.push('torch');
        }
        if (Math.random() < 0.25) drops.push('coal');
        giveLoot(tx, ty, drops);
      } else giveLoot(tx, ty, ['stone']);
      return;
    }
    if (soil && !soil.crop) { delete m.soil[key(tx, ty)]; swing('pickaxe'); toast('清理了耕地'); return; }
    if (o && o.type === 'stonewall') {
      if (!spend(COST.pick)) return;
      swing('pickaxe'); sfx('pick');
      spawnRockFx(tx, ty, false);
      setObj(m, tx, ty, null);
      addItem('stonewall', 1);
      toast('拆除了石墙，回收 1 个');
      return;
    }
    toast('对着石头使用镐子'); return;
  }
  if (kind === 'scythe') {
    if (o && o.type === 'weeds') {
      if (!spend(COST.scythe)) return;
      swing('scythe'); sfx('chop');
      setObj(m, tx, ty, null);
      giveLoot(tx, ty, ['fiber', Math.random() < 0.5 ? 'fiber' : null]);
      return;
    }
    toast('对着杂草使用镰刀'); return;
  }
}

function handAction(tx, ty, o) {
  const m = Game.map;
  if (o && o.type === 'forage') {
    setObj(m, tx, ty, null);
    giveLoot(tx, ty, [o.item]);
    return;
  }
  const soil = m.soil[key(tx, ty)];
  if (soil && soil.crop) {
    const def = CROPS[soil.crop.id];
    if (cropMature(def, soil.crop.days)) {
      harvest(tx, ty, soil, def);
      return;
    }
    const left = cropTotalDays(def) - soil.crop.days;
    toast(def.name + '还需 ' + left + ' 天成熟');
    return;
  }
  if (o && o.type === 'weeds') { setObj(m, tx, ty, null); giveLoot(tx, ty, ['fiber']); return; }
}

function harvest(tx, ty, soil, def) {
  const n = (def.regrow > 0 && Math.random() < 0.25) ? 2 : 1;
  addItem(soil.crop.id, n);
  floater(tx * TILE + 16, ty * TILE - 6, '+' + n + ' ' + def.name, '#ffe07a');
  sfx('coin');
  if (def.regrow > 0) {
    soil.crop.days = cropTotalDays(def) - def.regrow;
  } else {
    soil.crop = null;
  }
  swing(null);
}

function plantSeed(tx, ty, seedId) {
  const m = Game.map;
  const soil = m.soil[key(tx, ty)];
  if (!soil) { toast('先用锄头开垦土地'); sfx('error'); return; }
  if (soil.crop) { toast('这里已经种了东西'); return; }
  const cropId = ITEMS[seedId].crop;
  const def = CROPS[cropId];
  if (def.season !== Game.season) { toast(def.name + '不是当季作物'); sfx('error'); return; }
  removeItem(seedId, 1);
  soil.crop = { id: cropId, days: 0 };
  sfx('plant'); swing(null);
  floater(tx * TILE + 16, ty * TILE, '🌱', '#9fe07a');
}

function giveLoot(tx, ty, ids) {
  ids.forEach(function (id, i) {
    if (!id) return;
    if (id === null) return;
    addItem(id, 1);
    const it = ITEMS[id];
    floater(tx * TILE + 16 + (i - 1) * 10, ty * TILE - 6 - i * 6, '+' + it.name, '#cfe8ff');
  });
}

/* ---------- 交互（门 / 床 / 出货箱 / 楼梯 / NPC） ---------- */
function doInteract() {
  const t = facingTile();
  const o = getObj(Game.map, t.x, t.y);
  if (o && ['door', 'bin', 'bin2', 'bed', 'bed2', 'stairs', 'leave'].indexOf(o.type) >= 0) {
    interact(o, t.x, t.y); return;
  }
  // NPC
  for (let i = 0; i < Game.npcs.length; i++) {
    const n = Game.npcs[i];
    if (n.mapId !== Game.map.id) continue;
    if (Math.hypot(n.x - Game.player.x, n.y - Game.player.y) < 46) {
      const line = n.lines[Math.floor(Math.random() * n.lines.length)];
      showDialog('<b>' + n.name + '</b>：' + line, [{ label: '再见', fn: closeAllPanels }]);
      return;
    }
  }
  // 门 / 床 / 出货箱 / 楼梯：在 2 格半径内找最近的可交互物件（不用精确站到门格上）
  const TYPES = ['door', 'wall', 'bin', 'bin2', 'bed', 'bed2', 'stairs', 'leave'];
  const px = Math.floor(Game.player.x / TILE), py = Math.floor(Game.player.y / TILE);
  let best = null, bestD = 99;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = px + dx, ty = py + dy;
      const ob = getObj(Game.map, tx, ty);
      if (!ob || TYPES.indexOf(ob.type) < 0) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestD) { bestD = d; best = { o: ob, x: tx, y: ty }; }
    }
  }
  if (best) { interact(best.o, best.x, best.y); return; }
  useAtFacing();
}

function interact(o, tx, ty) {
  if (o.type === 'door') {
    const act = o.action || {};
    // 商店门不是传送门，而是直接开面板（兼容 action 与 to 两种写法）
    if (o.to === 'shop' || act.to === 'shop') { openShop('shop'); return; }
    const to = o.to || act.to;
    if (to === 'mine') {
      Game.mineLevel = 1;
      enterMap('mine', null, 1);
      toast('进入矿洞 第 1 层');
    } else if (to === 'house') {
      enterMap('house', o.spawn || act.spawn);
    } else if (to === 'farm') {
      enterMap('farm', o.spawn || act.spawn);
    } else {
      toast('这扇门打不开');
    }
    return;
  }
  // 点建筑墙体也能进入（门只有一格，不容易精准点中）
  if (o.type === 'wall' && o.b) {
    if (tileDist(tx, ty) > TILE * 3.2) { toast('太远了，走近一点'); return; }
    if (o.b.type === 'shop') { openShop('shop'); return; }
    if (o.b.type === 'house') { enterMap('house', { x: 7 * TILE + 16, y: 6 * TILE + 20 }); return; }
    if (o.b.type === 'cave') {
      Game.mineLevel = 1; enterMap('mine', null, 1); toast('进入矿洞 第 1 层'); return;
    }
    return;
  }
  if (o.type === 'bin' || o.type === 'bin2') { openShop('bin'); return; }
  if (o.type === 'workbench') { openCraft(); return; }
  if (o.type === 'campfire') { openRoast(); return; }
  if (o.type === 'bed' || o.type === 'bed2') {
    showDialog('要睡觉吗？睡觉会推进到第二天。', [
      { label: '睡觉 💤', fn: function () { closeAllPanels(); sleep(); } },
      { label: '再逛逛', fn: closeAllPanels }
    ]);
    return;
  }
  if (o.type === 'stairs') {
    Game.mineLevel++;
    enterMap('mine', null, Game.mineLevel);
    toast('下到矿洞第 ' + Game.mineLevel + ' 层');
    sfx('sleep');
    return;
  }
  if (o.type === 'leave') {
    enterMap('farm', o.spawn);
    toast('回到地面');
    return;
  }
}

/* ---------- 工作台制作 / 火堆烤肉（共用面板） ---------- */
let craftList = RECIPES;              // 当前面板展示的配方集
let craftTitle = '🛠️ 工作台';
function countItem(id) {
  let n = 0;
  for (let i = 0; i < Game.inv.length; i++) {
    const s = Game.inv[i];
    if (s && s.id === id) n += s.count;
  }
  return n;
}
function canCraft(r) {
  return r.cost.every(function (c) { return countItem(c[0]) >= c[1]; });
}
function showCraftPanel() {
  closeAllPanels();
  renderCraftPanel();
  dom.craftPanel.classList.remove('hidden');
  Game.paused = true;
}
function openCraft() { craftList = RECIPES; craftTitle = '🛠️ 工作台'; showCraftPanel(); }
function openRoast() { craftList = ROASTS; craftTitle = '🔥 火堆 · 烤肉'; showCraftPanel(); }
function doCraft(i) {
  const r = craftList[i];
  if (!r) return;
  if (!canCraft(r)) { toast('材料不足'); sfx('error'); return; }
  r.cost.forEach(function (c) { removeItem(c[0], c[1]); });
  addItem(r.out, r.n);
  sfx('coin');
  toast('制作了 ' + ITEMS[r.out].name + ' ×' + r.n);
  renderCraftPanel();
}
function renderCraftPanel() {
  const titleEl = $('craftTitle');
  if (titleEl) titleEl.textContent = craftTitle;
  let html = '<div class="shop-cols"><div class="shop-col"><h4>配方</h4><div class="shop-list">';
  craftList.forEach(function (r, i) {
    const ok = canCraft(r);
    const mats = r.cost.map(function (c) {
      return ITEMS[c[0]].name + '×' + c[1] + '<small>（有' + countItem(c[0]) + '）</small>';
    }).join(' + ');
    html += '<div class="shop-row">' +
      '<canvas width="34" height="34" data-item="' + r.out + '"></canvas>' +
      '<span class="nm">' + ITEMS[r.out].name + ' ×' + r.n + '</span>' +
      '<span class="pr">' + mats + '</span>' +
      '<button class="mini" data-craft="' + i + '"' + (ok ? '' : ' disabled') + '>制作</button>' +
      '</div>';
  });
  html += '</div></div></div>';
  html += '<div class="shop-foot">材料够用时「制作」按钮才会亮起</div>';
  dom.craftBody.innerHTML = html;
  Array.prototype.forEach.call(dom.craftBody.querySelectorAll('canvas'), function (c) {
    drawItemIcon(c.getContext('2d'), c.dataset.item, 4, 4, 26);
  });
  Array.prototype.forEach.call(dom.craftBody.querySelectorAll('[data-craft]'), function (b) {
    b.addEventListener('click', function () { doCraft(parseInt(b.dataset.craft, 10)); });
  });
}

/* ---------- 吃 ---------- */
function eatSelected() {
  const s = selectedItem();
  if (!s) { toast('手上没有东西'); return; }
  const it = ITEMS[s.id];
  if (!it.energy) { toast(it.name + '不能吃'); sfx('error'); return; }
  if (Game.energy >= Game.maxEnergy) { toast('体力是满的'); return; }
  removeItem(s.id, 1);
  Game.energy = Math.min(Game.maxEnergy, Game.energy + it.energy);
  sfx('bite');
  floater(Game.player.x, Game.player.y - 30, '+' + it.energy + ' 体力', '#8fe08a');
  refreshInv();
}

/* =========================================================================
 *  钓鱼小游戏
 * ========================================================================= */
function startFishing(tx, ty) {
  if (Game.fishing) return;
  if (!spend(COST.fish)) return;
  // 按季节取鱼池
  const poolIds = FISH_BY_SEASON[Game.season] || FISH.map(function (f) { return f.id; });
  const pool = poolIds.map(function (id) { return FISH_MAP[id]; }).filter(Boolean);
  const idx = Math.min(pool.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * pool.length));
  Game.fishing = {
    phase: 'wait', t: 0, wait: 1.2 + Math.random() * 3.2,
    fish: pool[idx], p: 0.5, v: 0, fishP: 0.5, fishV: 0,
    target: 0.5, timer: 0, progress: 0.28, tx: tx, ty: ty,
    perfect: true, dart: false, dashTimer: 0
  };
  swing('rod');
  toast('抛竿了……等鱼上钩');
  dom.fishingPanel.classList.remove('hidden');
}
function fishingClick() {
  const f = Game.fishing;
  if (!f) return;
  if (f.phase === 'wait') { f.phase = 'game'; toast('收早了！'); endFishing(false); return; }
  if (f.phase === 'bite') {
    f.phase = 'game';
    f.fishP = f.p;    // 鱼的初始位置与浮标一致
    f.target = f.p;   // 开局鱼不立即跑开
    f.timer = 0.45;   // 给玩家反应缓冲
    sfx('bite');
    toast('上钩了！按住鼠标/空格让浮标跟着鱼');
  } else if (f.phase === 'game') {
    f.hold = true;
  }
}
function updateFishing(dt) {
  const f = Game.fishing;
  if (!f) return;
  f.t += dt;
  if (f.phase === 'wait') {
    if (f.t > f.wait) { f.phase = 'bite'; f.t = 0; sfx('bite'); floater(Game.player.x, Game.player.y - 40, '！', '#ffd34a'); }
  } else if (f.phase === 'bite') {
    if (f.t > 5.0) { toast('鱼跑了……'); endFishing(false); }
    else if (Game.keys[' '] || Game.mouse.down) {
      f.phase = 'game';
      f.fishP = f.p;    // 鱼的初始位置与浮标一致
      f.target = f.p;   // 开局鱼不立即跑开
      f.timer = 0.45;   // 给玩家反应缓冲
      sfx('bite'); toast('上钩了！按住鼠标/空格让浮标跟着鱼');
    }
  } else if (f.phase === 'game') {
    const hold = Game.mouse.down || !!Game.keys[' '];
    // 浮标（帧率无关阻尼 + 更快响应，追上鱼）
    const barH = 0.18;
    f.v += (hold ? -5.4 : 4.3) * dt;
    f.v *= Math.pow(0.955, dt * 60);
    f.p += f.v * dt;
    if (f.p < 0) { f.p = 0; f.v = 0; }
    if (f.p > 1 - barH) { f.p = 1 - barH; f.v = 0; }
    // 鱼（按 behavior 决定移动模式：mixed 随机 / smooth 平滑 / dart 猛冲 / wild 狂野）
    const beh = f.fish.behavior || 'mixed';
    const fspd = f.fish.speed || 1;
    f.timer -= dt;
    if (f.timer <= 0) {
      if (beh === 'dart') {
        f.timer = 0.7 + Math.random() * 1.4; f.target = Math.random(); f.dart = true;
      } else if (beh === 'wild') {
        f.timer = 0.18 + Math.random() * 0.45; f.target = Math.random();
      } else if (beh === 'smooth') {
        f.timer = 0.6 + Math.random() * 1.1; f.target = Math.random();
      } else {
        f.timer = 0.35 + Math.random() * 0.9; f.target = Math.random();
      }
    }
    let mvSpd;
    if (beh === 'dart') mvSpd = f.dart ? 1.5 * fspd : 0.06;
    else if (beh === 'wild') mvSpd = 1.15 * fspd;
    else if (beh === 'smooth') mvSpd = 0.55 * fspd;
    else mvSpd = 0.45 + fspd * 0.30;
    f.fishP += Math.sign(f.target - f.fishP) * Math.min(Math.abs(f.target - f.fishP), mvSpd * dt);
    f.fishP = Math.max(0, Math.min(1, f.fishP));
    if (beh === 'dart' && Math.abs(f.target - f.fishP) < 0.02) f.dart = false;
    // 判定
    const bc = f.p + barH / 2, fc = f.fishP;
    const overlap = Math.abs(bc - fc) < barH * 0.62;
    if (!overlap) f.perfect = false;
    const gain = Math.max(0.22, 0.52 - fspd * 0.12);
    f.progress += (overlap ? gain : -0.28) * dt;
    if (f.progress >= 1) endFishing(true);
    else if (f.progress <= 0) endFishing(false);
  }
}
function endFishing(ok) {
  const f = Game.fishing;
  if (!f) return;
  Game.fishing = null;
  dom.fishingPanel.classList.add('hidden');
  if (ok) {
    // 完美判定 → 铱金高品质鱼；普通成功 → 随机普通/银/金
    const quality = f.perfect ? 3 : rollFishQuality();
    const qName = QUALITY[quality].name;
    const label = (quality > 0) ? (qName + '·' + f.fish.name) : f.fish.name;
    const sellVal = Math.round(f.fish.sell * QUALITY[quality].mult);
    addItem(f.fish.id, 1, quality);
    sfx('coin');
    if (f.perfect) {
      floater(Game.player.x, Game.player.y - 40, '完美！' + label, '#7af0a0');
      toast('完美钓鱼！获得 高品质 ' + label + '（可卖 🪙' + sellVal + '）');
    } else {
      floater(Game.player.x, Game.player.y - 40, '钓到 ' + label + '！', '#ffe07a');
      toast('钓到 ' + label + '（可卖 🪙' + sellVal + '）');
    }
  } else {
    sfx('error');
    toast('鱼儿溜走了……');
  }
  refreshInv();
}
/* 非完美钓获的随机品质：普通 50% / 银 35% / 金 15% */
function rollFishQuality() {
  const r = Math.random();
  if (r < 0.5) return 0;
  if (r < 0.85) return 1;
  return 2;
}
function drawFishingUI() {
  const f = Game.fishing;
  if (!f || f.phase !== 'game') return;
  const ctx = Game.ctx;
  const x = Game.W - 96, y = 120, w = 34, h = 300;
  ctx.save();
  ctx.fillStyle = 'rgba(20,26,40,0.82)';
  ctx.fillRect(x - 8, y - 30, w + 40, h + 60);
  ctx.strokeStyle = '#e8d9a0'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 8.5, y - 30.5, w + 41, h + 61);
  // 轨道
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  // 鱼（横向鱼形：宽 > 高，游动朝向右侧）
  const fh = 30;
  const fy = y + f.fishP * (h - fh);
  ctx.fillStyle = f.fish.color;
  ctx.beginPath(); ctx.ellipse(x + w / 2, fy + fh / 2, w * 0.58, fh / 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.arc(x + w * 0.62, fy + fh / 2, 2.2, 0, 7); ctx.fill();
  // 浮标条
  const barH = 0.18 * h;
  const by = y + f.p * h;
  ctx.fillStyle = f.progress > 0.6 ? '#8fe08a' : '#ffd97a';
  ctx.fillRect(x + 3, by, w - 6, barH);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(x + 3.5, by + 0.5, w - 7, barH - 1);
  // 进度（右侧竖条，原版布局：从下往上满）
  const px = x + w + 10, pw = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px, y, pw, h);
  const ph = Math.max(0, f.progress) * h;
  ctx.fillStyle = f.perfect ? '#7af0a0' : '#6fd0f0';
  ctx.fillRect(px, y + (h - ph), pw, ph);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(px + 0.5, y + 0.5, pw - 1, h - 1);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(f.perfect ? '完美中·按住' : '按住空格', x + w / 2, y + h + 20);
  ctx.restore();
}

/* =========================================================================
 *  时间与天数
 * ========================================================================= */
function nightAlpha() {
  const t = Game.time;
  if (t < 1020) return 0;                        // 17:00 前
  if (t < 1140) return (t - 1020) / 120 * 0.50;  // 17:00-19:00 渐暗
  if (t < 1440) return 0.50 + (t - 1140) / 300 * 0.18;
  return 0.68;                                   // 深夜更暗，衬托火把光
}
function rollWeather() {
  const r = Math.random();
  if (Game.season === 3) return r < 0.55 ? 'snow' : 'sun';
  if (Game.season === 0) return r < 0.24 ? 'rain' : 'sun';
  if (Game.season === 1) return r < 0.16 ? 'rain' : 'sun';
  return r < 0.18 ? 'rain' : 'sun';
}
function sleep() {
  fadeTo(function () {
    const pay = shippingTotal();
    Game.money += pay;
    const report = Game.shipping.length
      ? Game.shipping.map(function (s) { return s.name + ' ×' + s.count + ' = 🪙' + s.value; }).join('<br>')
      : '（没有出货）';
    Game.shipping = [];
    nextDay();
    showDialog('<b>第 ' + (Game.day - 1) + ' 天结束</b><br>' + report +
      '<br><b>出货收入：🪙' + pay + '</b><br><br>今日天气：' + weatherText(),
      [{ label: '开始新的一天', fn: closeAllPanels }]);
  });
}
function passOut(reason) {
  fadeTo(function () {
    nextDay();
    Game.energy = Math.round(Game.maxEnergy * 0.5);
    showDialog('<b>' + (reason || '你在野外累倒了……') + '</b><br>被好心人送回了家，体力只恢复了一半。<br><br>今日天气：' + weatherText(),
      [{ label: '起床', fn: closeAllPanels }]);
  });
}
function nextDay() {
  const prevSeason = Game.season;
  Game.day++;
  if (Game.day > DAYS_PER_SEASON) { Game.day = 1; Game.season++; }
  if (Game.season > 3) { Game.season = 0; Game.year++; }
  Game.time = DAY_START;
  Game.energy = Game.maxEnergy;
  Game.weather = rollWeather();
  Game.monsters.length = 0;   // 天亮怪物消失
  Game.monsterTimer = 0;
  Game.nightWarned = false;
  Game.animals.length = 0;    // 小动物每日重新刷新
  Game.animalTimer = 0;
  const m = Game.maps.farm;
  if (m) {
    // 作物生长
    Object.keys(m.soil).forEach(function (k) {
      const s = m.soil[k];
      if (!s.crop) { if (Game.weather === 'rain') s.wet = true; return; }
      if (s.wet || Game.weather === 'rain') s.crop.days++;
      s.wet = (Game.weather === 'rain');
    });
    clearForage(m);
    spawnForage(m, Game.season, 10 + Math.floor(Math.random() * 6));
  }
  if (prevSeason !== Game.season) {
    if (m) clearDeadCrops(m, Game.season);
    Object.keys(Game.maps).forEach(function (k) {
      if (!Game.maps[k].cache) return;
      buildGroundCache(Game.maps[k], Game.season);
    });
    toast('季节更替：' + SEASON_FULL[Game.season]);
  }
  // 回到农舍门口
  if (Game.map && Game.map.id !== 'farm') enterMap('farm', null);
  else { Game.player.x = Game.maps.farm ? Game.maps.farm.spawn.x : Game.player.x; Game.player.y = Game.maps.farm ? Game.maps.farm.spawn.y : Game.player.y; }
  saveGame();
  updateHUD();
}

let fading = false;
function fadeTo(fn) {
  if (fading) return;
  fading = true;
  sfx('sleep');
  dom.fade.classList.remove('hidden');
  dom.fade.style.opacity = '1';
  setTimeout(function () {
    fn();
    setTimeout(function () {
      dom.fade.style.opacity = '0';
      setTimeout(function () { dom.fade.classList.add('hidden'); fading = false; }, 420);
    }, 260);
  }, 430);
}

/* =========================================================================
 *  存档
 * ========================================================================= */
const SAVE_KEY = 'stardew_web_save_v1';
function saveGame() {
  try {
    const m = Game.maps.farm;
    const soil = [];
    if (m) {
      Object.keys(m.soil).forEach(function (k) {
        const s = m.soil[k];
        const p = k.split(',');
        soil.push([+p[0], +p[1], s.wet ? 1 : 0, s.crop ? s.crop.id : '', s.crop ? s.crop.days : 0]);
      });
    }
    const data = {
      day: Game.day, season: Game.season, year: Game.year, money: Game.money,
      energy: Game.energy, inv: Game.inv, time: Game.time, weather: Game.weather,
      mineLevel: Game.mineLevel, canWater: Game.canWater, soil: soil,
      shipping: Game.shipping
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 存储不可用则忽略 */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    Game.day = d.day; Game.season = d.season; Game.year = d.year;
    Game.money = d.money; Game.energy = d.energy;
    Game.inv = d.inv || new Array(36).fill(null);
    Game.time = d.time != null ? d.time : DAY_START;
    Game.weather = d.weather || 'sun';
    Game.mineLevel = d.mineLevel || 1;
    Game.canWater = d.canWater != null ? d.canWater : 40;
    Game.shipping = d.shipping || [];
    const m = Game.maps.farm;
    if (m && d.soil) {
      d.soil.forEach(function (a) {
        m.soil[a[0] + ',' + a[1]] = { wet: !!a[2], crop: a[3] ? { id: a[3], days: a[4] } : null };
      });
    }
    return true;
  } catch (e) { return false; }
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

/* =========================================================================
 *  新游戏
 * ========================================================================= */
function newGame() {
  Game.maps = {};
  Game.time = DAY_START;
  Game.day = 1; Game.season = 0; Game.year = 1;
  Game.money = 500; Game.energy = Game.maxEnergy;
  Game.inv = new Array(36).fill(null);
  Game.canWater = Game.canMax;
  Game.mineLevel = 1;
  Game.shipping = [];
  Game.sel = 0;
  const farm = createFarmMap();
  Game.maps.farm = farm;
  Game.map = farm;
  buildGroundCache(farm, Game.season);
  spawnForage(farm, Game.season, 12);
  Game.weather = 'sun';
  // 初始物品
  ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'rod'].forEach(function (t, i) {
    Game.inv[i] = { id: t, count: 1 };
  });
  addItem('seed_parsnip', 15);
  Game.player.x = farm.spawn.x; Game.player.y = farm.spawn.y;
  // NPC
  Game.npcs = NPCS.map(function (n) {
    return {
      name: n.name, color: n.color, shirt: n.shirt, hair: n.hair, lines: n.lines,
      x: n.x * TILE + 16, y: n.y * TILE + 16, home: { x: n.x * TILE + 16, y: n.y * TILE + 16 },
      dir: 'down', frame: 0, anim: 0, wait: Math.random() * 3, mapId: 'farm',
      vx: 0, vy: 0
    };
  });
}

/* =========================================================================
 *  更新
 * ========================================================================= */
function update(dt) {
  Game.t += dt;
  // toast 计时
  for (let i = Game.toasts.length - 1; i >= 0; i--) {
    Game.toasts[i].t -= dt;
    if (Game.toasts[i].t <= 0) {
      const el = Game.toasts[i].el;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      Game.toasts.splice(i, 1);
    }
  }
  for (let i = Game.floaters.length - 1; i >= 0; i--) {
    Game.floaters[i].t -= dt;
    Game.floaters[i].y -= dt * 22;
    if (Game.floaters[i].t <= 0) Game.floaters.splice(i, 1);
  }
  // 物件摇晃
  const objs = Game.map ? Game.map.objs : {};
  Object.keys(objs).forEach(function (k) {
    if (objs[k].shake > 0) objs[k].shake = Math.max(0, objs[k].shake - dt);
  });

  if (!Game.running || Game.paused) return;

  updateZoom(dt);

  // 时间
  Game.time += dt * MIN_PER_SEC;
  if (Game.time >= DAY_END) { passOut(); return; }
  const cur = Math.floor(Game.time / 10);
  if (cur !== Game.lastMin) { Game.lastMin = cur; updateHUD(); }

  // 玩家移动
  const p = Game.player;
  let dx = 0, dy = 0;
  if (Game.keys['a'] || Game.keys['arrowleft']) dx -= 1;
  if (Game.keys['d'] || Game.keys['arrowright']) dx += 1;
  if (Game.keys['w'] || Game.keys['arrowup']) dy -= 1;
  if (Game.keys['s'] || Game.keys['arrowdown']) dy += 1;
  p.moving = !!(dx || dy);
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    if (Math.abs(dy) > Math.abs(dx)) p.dir = dy > 0 ? 'down' : 'up';
    else p.dir = dx > 0 ? 'right' : 'left';
    const nx = p.x + dx * p.speed * dt, ny = p.y + dy * p.speed * dt;
    if (!collides(nx, p.y)) p.x = nx;
    if (!collides(p.x, ny)) p.y = ny;
    p.anim += dt * 8.5;
    p.frame = Math.floor(p.anim) % 4;
  } else p.frame = 0;
  if (p.swing > 0) p.swing -= dt;

  // 长按挖矿：按住鼠标且目标是可挖石头时持续敲击
  if (Game.mouse.down && Game.mining) {
    const msel = selectedItem();
    const mit = msel && ITEMS[msel.id];
    const mrock = getObj(Game.map, Game.mining.tx, Game.mining.ty);
    if (mit && mit.kind === 'pickaxe' && mrock && mrock.type === 'rock' &&
        tileDist(Game.mining.tx, Game.mining.ty) <= TILE * 2.1 && Game.energy >= COST.pick) {
      Game.mining.timer -= dt;
      if (Game.mining.timer <= 0) {
        Game.mining.timer = 0.34;
        useTool('pickaxe', Game.mining.tx, Game.mining.ty, mrock);
      }
    } else Game.mining = null;
  } else if (!Game.mouse.down) Game.mining = null;

  // 碎石粒子更新
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const pt = Game.particles[i];
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 220 * dt;
    if (pt.t >= pt.life) Game.particles.splice(i, 1);
  }

  updateNPCs(dt);
  updateMonsters(dt);
  updateAnimals(dt);
  updateFishing(dt);

  clampCam();
}
function collides(x, y) {
  const m = Game.map, hw = 7;
  const pts = [[x - hw, y], [x + hw, y], [x - hw, y - 6], [x + hw, y - 6]];
  for (let i = 0; i < pts.length; i++) {
    if (isSolid(m, Math.floor(pts[i][0] / TILE), Math.floor(pts[i][1] / TILE))) return true;
  }
  return false;
}
/* 可视区域的世界尺寸（随缩放变化） */
function viewW() { return Game.W / Game.zoom; }
function viewH() { return Game.H / Game.zoom; }

function clampCam() {
  const m = Game.map;
  if (!m) return;
  const vw = viewW(), vh = viewH();
  let cx = Game.player.x - vw / 2;
  let cy = Game.player.y - vh / 2 - 20 / Game.zoom;
  const mw = m.w * TILE, mh = m.h * TILE;
  cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(cx, mw - vw));
  cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(cy, mh - vh));
  Game.cam.x = cx; Game.cam.y = cy;
}

/* 屏幕坐标 -> 世界坐标（考虑缩放） */
function screenToWorld(sx, sy) {
  return { x: sx / Game.zoom + Game.cam.x, y: sy / Game.zoom + Game.cam.y };
}

/* 缩放：向目标值平滑过渡，并保持鼠标下方的世界点不动 */
function setZoom(z, anchorX, anchorY) {
  Game.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  if (typeof anchorX !== 'number') { anchorX = Game.mouse.x; anchorY = Game.mouse.y; }
  Game.zoomAnchor = { x: anchorX, y: anchorY };
  Game.zoomHintT = 1.4;
}
/* 缩放提示：滚轮缩放时在屏幕上方短暂显示当前倍率 */
function drawZoomHint(ctx) {
  if (Game.zoomHintT <= 0) return;
  const a = Math.min(1, Game.zoomHintT / 0.5);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  const text = '🔍 视角 ' + Math.round(Game.zoom * 100) + '%';
  const x = Game.W / 2, y = 44;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function updateZoom(dt) {
  if (Game.zoomHintT > 0) Game.zoomHintT = Math.max(0, Game.zoomHintT - dt);
  const diff = Game.zoomTarget - Game.zoom;
  if (Math.abs(diff) < 0.0015) { if (Game.zoom !== Game.zoomTarget) { Game.zoom = Game.zoomTarget; clampCam(); } return; }
  const a = Game.zoomAnchor || { x: Game.W / 2, y: Game.H / 2 };
  // 缩放前鼠标指向的世界点
  const wx = a.x / Game.zoom + Game.cam.x, wy = a.y / Game.zoom + Game.cam.y;
  Game.zoom += diff * Math.min(1, dt * 16);
  // 缩放后把同一个世界点拉回鼠标下
  Game.cam.x = wx - a.x / Game.zoom;
  Game.cam.y = wy - a.y / Game.zoom;
  clampCam();
}
/* =========================================================================
 *  夜晚怪物：19:00 后刷新在农场围栏外，黎明(睡醒)消失
 *  AI：8 格内追击玩家，接触扣体力并弹开；点击怪物即攻击
 * ========================================================================= */
function monsterNight() { return Game.time >= MONSTER_FROM; }
function monsterAt(tx, ty) {
  for (let i = 0; i < Game.monsters.length; i++) {
    const mo = Game.monsters[i];
    if (mo.x >= tx * TILE && mo.x < (tx + 1) * TILE && mo.y >= ty * TILE && mo.y < (ty + 1) * TILE) return mo;
  }
  return null;
}
function spawnMonster() {
  const m = Game.map;
  if (!m) return;
  const pool = Object.keys(MONSTERS).filter(function (k) { return Game.time >= MONSTERS[k].after; });
  const kind = pool[Math.floor(Math.random() * pool.length)];
  for (let tries = 0; tries < 40; tries++) {
    const tx = 1 + Math.floor(Math.random() * (m.w - 2));
    const ty = 1 + Math.floor(Math.random() * (m.h - 2));
    // 只刷在围栏外
    if (tx >= FARM_FENCE.x0 && tx <= FARM_FENCE.x1 && ty >= FARM_FENCE.y0 && ty <= FARM_FENCE.y1) continue;
    if (isSolid(m, tx, ty)) continue;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (Math.hypot(cx - Game.player.x, cy - Game.player.y) < TILE * 6) continue;  // 不在玩家脸上刷
    Game.monsters.push({
      kind: kind, def: MONSTERS[kind], x: cx, y: cy,
      hp: MONSTERS[kind].hp, vx: 0, vy: 0, dir: 'down',
      anim: Math.random() * 4, frame: 0, wait: Math.random() * 2,
      hitCd: 0, hurtT: 0, wob: Math.random() * 6
    });
    return;
  }
}
function updateMonsters(dt) {
  if (!Game.map || Game.map.id !== 'farm' || !monsterNight()) return;
  if (!Game.nightWarned) {
    Game.nightWarned = true;
    toast('🌙 夜深了，围栏外传来奇怪的动静……');
  }
  // 定时生成（每天夜晚上限 MONSTER_CAP 只；1.5~3.5 秒一只）
  if (Game.monsters.length < MONSTER_CAP) {
    Game.monsterTimer -= dt;
    if (Game.monsterTimer <= 0) {
      Game.monsterTimer = 1.5 + Math.random() * 2;
      spawnMonster();
    }
  }
  const p = Game.player;
  for (let i = 0; i < Game.monsters.length; i++) {
    const mo = Game.monsters[i];
    if (mo.hurtT > 0) mo.hurtT -= dt;
    if (mo.hitCd > 0) mo.hitCd -= dt;
    const d = Math.hypot(p.x - mo.x, p.y - mo.y) || 1;
    if (d < TILE * 8) {           // 追击
      mo.vx = (p.x - mo.x) / d * mo.def.speed;
      mo.vy = (p.y - mo.y) / d * mo.def.speed;
    } else {                      // 游荡
      mo.wait -= dt;
      if (mo.wait <= 0) {
        mo.wait = 1.5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        mo.vx = Math.cos(a) * mo.def.speed * 0.5;
        mo.vy = Math.sin(a) * mo.def.speed * 0.5;
      }
    }
    const nx = mo.x + mo.vx * dt, ny = mo.y + mo.vy * dt;
    if (!npcCollide(nx, mo.y)) mo.x = nx; else mo.vx *= -1;
    if (!npcCollide(mo.x, ny)) mo.y = ny; else mo.vy *= -1;
    if (Math.abs(mo.vx) > Math.abs(mo.vy)) mo.dir = mo.vx > 0 ? 'right' : 'left';
    else if (mo.vy) mo.dir = mo.vy > 0 ? 'down' : 'up';
    mo.anim += dt * (mo.def.fly ? 12 : 6);
    mo.frame = Math.floor(mo.anim) % 4;
    // 接触伤害 + 反弹
    if (mo.hitCd <= 0 && d < TILE * 0.9) {
      mo.hitCd = 1.2;
      hurtPlayer(mo.def.dmg, mo.def.name);
      mo.vx = (mo.x - p.x) / d * 130;
      mo.vy = (mo.y - p.y) / d * 130;
    }
  }
}
function hurtPlayer(dmg, src) {
  Game.energy = Math.max(0, Game.energy - dmg);
  updateHUD();
  floater(Game.player.x, Game.player.y - 30, '-' + dmg + ' 💥', '#ff7a6a');
  sfx('hit');
  if (Game.energy <= 0 && !fading) passOut('被 ' + src + ' 打晕了……');
}
function attackMonster(mo) {
  const tx = Math.floor(mo.x / TILE), ty = Math.floor(mo.y / TILE);
  if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }
  const sel = selectedItem();
  const dmg = (sel && ITEMS[sel.id] && ITEMS[sel.id].type === 'tool') ? 2 : 1;   // 工具伤害 2，空手 1
  swing('axe');
  sfx('hit');
  mo.hp -= dmg;
  mo.hurtT = 0.22;
  const d = Math.hypot(mo.x - Game.player.x, mo.y - Game.player.y) || 1;
  mo.vx = (mo.x - Game.player.x) / d * 170;
  mo.vy = (mo.y - Game.player.y) / d * 170;
  floater(mo.x, mo.y - 20, '-' + dmg, '#ffd34a');
  if (mo.hp <= 0) {
    spawnRockFx(tx, ty, false);
    addItem(mo.def.loot, 1 + (Math.random() < 0.35 ? 1 : 0));
    toast(mo.def.name + ' 被击败了！掉落 ' + ITEMS[mo.def.loot].name);
    const i = Game.monsters.indexOf(mo);
    if (i >= 0) Game.monsters.splice(i, 1);
  }
}

/* =========================================================================
 *  野外小动物：白天在农场随机游荡，玩家靠近会逃跑
 *  点击即狩猎（1 击），掉落对应肉，食用恢复体力；18:00 后逐渐消失
 * ========================================================================= */
function animalAt(tx, ty) {
  for (let i = 0; i < Game.animals.length; i++) {
    const an = Game.animals[i];
    if (an.x >= tx * TILE && an.x < (tx + 1) * TILE && an.y >= ty * TILE && an.y < (ty + 1) * TILE) return an;
  }
  return null;
}
function spawnAnimal() {
  const m = Game.map;
  if (!m) return;
  const pool = Object.keys(ANIMALS);
  const kind = pool[Math.floor(Math.random() * pool.length)];
  for (let tries = 0; tries < 40; tries++) {
    const tx = 1 + Math.floor(Math.random() * (m.w - 2));
    const ty = 1 + Math.floor(Math.random() * (m.h - 2));
    if (isSolid(m, tx, ty)) continue;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (Math.hypot(cx - Game.player.x, cy - Game.player.y) < TILE * 4) continue;
    Game.animals.push({
      kind: kind, def: ANIMALS[kind], x: cx, y: cy,
      vx: 0, vy: 0, dir: 'down', anim: Math.random() * 4, frame: 0,
      wait: Math.random() * 2, wob: Math.random() * 6, fleeing: false
    });
    return;
  }
}
function updateAnimals(dt) {
  if (!Game.map || Game.map.id !== 'farm') return;
  const day = Game.time < ANIMAL_UNTIL;
  Game.animalTimer -= dt;
  // 入夜逐渐消失，白天按节奏补充
  if (!day && Game.animals.length && Game.animalTimer <= 0) {
    Game.animals.shift();
    Game.animalTimer = 2;
  }
  if (day && Game.animals.length < ANIMAL_CAP && Game.animalTimer <= 0) {
    Game.animalTimer = 2.5 + Math.random() * 3;
    spawnAnimal();
  }
  const p = Game.player;
  for (let i = 0; i < Game.animals.length; i++) {
    const an = Game.animals[i];
    const d = Math.hypot(p.x - an.x, p.y - an.y) || 1;
    if (d < an.def.flee * TILE) {
      // 逃跑：背向玩家全速
      an.fleeing = true;
      an.vx = (an.x - p.x) / d * an.def.speed;
      an.vy = (an.y - p.y) / d * an.def.speed;
    } else {
      an.fleeing = false;
      an.wait -= dt;
      if (an.wait <= 0) {
        an.wait = 1.5 + Math.random() * 3.5;
        if (Math.random() < 0.4) { an.vx = 0; an.vy = 0; }
        else {
          const a = Math.random() * Math.PI * 2;
          an.vx = Math.cos(a) * an.def.speed * 0.25;
          an.vy = Math.sin(a) * an.def.speed * 0.25;
        }
      }
    }
    const nx = an.x + an.vx * dt, ny = an.y + an.vy * dt;
    if (!npcCollide(nx, an.y)) an.x = nx;
    else if (an.fleeing) { const a = Math.random() * Math.PI * 2; an.vx = Math.cos(a) * an.def.speed; }
    else an.vx *= -1;
    if (!npcCollide(an.x, ny)) an.y = ny;
    else if (an.fleeing) { const a = Math.random() * Math.PI * 2; an.vy = Math.sin(a) * an.def.speed; }
    else an.vy *= -1;
    if (Math.abs(an.vx) > Math.abs(an.vy)) an.dir = an.vx > 0 ? 'right' : 'left';
    else if (an.vy) an.dir = an.vy > 0 ? 'down' : 'up';
    an.anim += dt * (an.fleeing ? 14 : 6);
    an.frame = Math.floor(an.anim) % 4;
  }
}
function huntAnimal(an) {
  const tx = Math.floor(an.x / TILE), ty = Math.floor(an.y / TILE);
  if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }
  swing('axe');
  sfx('hit');
  spawnRockFx(tx, ty, false);
  addItem(an.def.loot, 1 + (Math.random() < 0.25 ? 1 : 0));
  toast(an.def.name + ' 被捕获了！掉落 ' + ITEMS[an.def.loot].name);
  const i = Game.animals.indexOf(an);
  if (i >= 0) Game.animals.splice(i, 1);
}

function updateNPCs(dt) {
  Game.npcs.forEach(function (n) {
    if (n.mapId !== (Game.map ? Game.map.id : '')) return;
    n.wait -= dt;
    if (n.wait <= 0) {
      n.wait = 1.5 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      n.vx = Math.cos(a) * 34;
      n.vy = Math.sin(a) * 34;
      if (Math.random() < 0.35) { n.vx = 0; n.vy = 0; }
      if (Math.abs(n.vx) > Math.abs(n.vy)) n.dir = n.vx > 0 ? 'right' : 'left';
      else if (n.vy) n.dir = n.vy > 0 ? 'down' : 'up';
    }
    if (n.vx || n.vy) {
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
      if (Math.hypot(nx - n.home.x, ny - n.home.y) > 150) { n.vx *= -1; n.vy *= -1; }
      else {
        if (!npcCollide(nx, n.y)) { n.x = nx; n.y = ny; }
        else { n.vx = -n.vx; n.vy = -n.vy; }
      }
      n.anim += dt * 6;
      n.frame = Math.floor(n.anim) % 4;
    } else n.frame = 0;
  });
}
function npcCollide(x, y) {
  const m = Game.map, hw = 7;
  const pts = [[x - hw, y], [x + hw, y], [x - hw, y - 6], [x + hw, y - 6]];
  for (let i = 0; i < pts.length; i++) {
    if (isSolid(m, Math.floor(pts[i][0] / TILE), Math.floor(pts[i][1] / TILE))) return true;
  }
  return false;
}

/* =========================================================================
 *  渲染
 * ========================================================================= */
function render() {
  const ctx = Game.ctx, m = Game.map;
  if (!m) return;
  ctx.setTransform(Game.dpr, 0, 0, Game.dpr, 0, 0);
  ctx.clearRect(0, 0, Game.W, Game.H);
  ctx.save();
  // 缩放：先把世界坐标按 zoom 放大，再平移相机
  ctx.scale(Game.zoom, Game.zoom);
  ctx.translate(-Math.round(Game.cam.x), -Math.round(Game.cam.y));

  const x0 = Math.max(0, Math.floor(Game.cam.x / TILE));
  const y0 = Math.max(0, Math.floor(Game.cam.y / TILE));
  const x1 = Math.min(m.w - 1, Math.ceil((Game.cam.x + viewW()) / TILE));
  const y1 = Math.min(m.h - 1, Math.ceil((Game.cam.y + viewH()) / TILE));

  // 地面缓存
  if (m.cache) ctx.drawImage(m.cache, 0, 0);

  // 水面动画
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (m.ground[y * m.w + x] === T.WATER) drawWaterAnim(ctx, x * TILE, y * TILE, Game.t);
    }
  }

  // 耕地 + 作物（地面层）
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const s = m.soil[key(x, y)];
      if (!s) continue;
      drawTilled(ctx, x * TILE, y * TILE, s.wet, x, y);
      if (s.crop) {
        const def = CROPS[s.crop.id];
        const st = cropStage(def, s.crop.days);
        drawCropPlant(ctx, x * TILE, y * TILE, s.crop.id, st, s.crop.days, cropMature(def, s.crop.days), Game.lastTs);
      }
    }
  }

  // 需要 Y 排序的实体
  const draws = [];
  for (let y = y0 - 2; y <= y1 + 2; y++) {
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      const o = m.objs[key(x, y)];
      if (!o) continue;
      if (o.type === 'wall') continue;
      if (o.type === 'bin2' || o.type === 'bed2') continue;
      if (o.type === 'weeds' || o.type === 'forage' || o.type === 'branch') {
        draws.push({ y: (y + 1) * TILE - 2, fn: function () { drawGroundObj(ctx, o, x, y); } });
      } else {
        draws.push({ y: (y + 1) * TILE, fn: function () { drawGroundObj(ctx, o, x, y); } });
      }
    }
  }
  m.buildings.forEach(function (b) {
    if (b.x > x1 + 8 || b.x + b.w < x0 - 8 || b.y > y1 + 8 || b.y + b.h < y0 - 8) return;
    draws.push({ y: (b.y + b.h) * TILE, fn: function () { drawBuilding(ctx, b, Game.season); } });
  });
  Game.npcs.forEach(function (n) {
    if (n.mapId !== m.id) return;
    draws.push({
      y: n.y, fn: function () {
        drawChar(ctx, n.x, n.y, n.dir, n.frame, { shirt: n.shirt, hair: n.hair, skin: '#f2c99a', pants: '#3a4a6a' }, 2);
        ctx.save();
        ctx.font = '11px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const w = ctx.measureText(n.name).width + 10;
        ctx.fillRect(n.x - w / 2, n.y - 46, w, 15);
        ctx.fillStyle = '#fff';
        ctx.fillText(n.name, n.x, n.y - 35);
        ctx.restore();
      }
    });
  });
  // 夜晚怪物（只在农场地图出现）
  Game.monsters.forEach(function (mo) {
    if (m.id !== 'farm') return;
    draws.push({ y: mo.y, fn: function () { drawMonster(ctx, mo); } });
  });
  // 野外小动物（只在农场地图出现）
  Game.animals.forEach(function (an) {
    if (m.id !== 'farm') return;
    draws.push({ y: an.y, fn: function () { drawAnimal(ctx, an); } });
  });
  const p = Game.player;
  draws.push({
    y: p.y, fn: function () {
      drawChar(ctx, p.x, p.y, p.dir, p.moving ? p.frame : 0,
        { shirt: '#4a7fc1', hair: '#5a3a22', skin: '#f2c99a', pants: '#3a4a6a', hat: '#e0c07a' }, 2);
      if (p.swing > 0 && p.swingKind) {
        drawSwing(ctx, p.x, p.y, p.swingDir, p.swingKind, 1 - p.swing / 0.34);
      }
      // 钓鱼线
      if (Game.fishing) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 18);
        ctx.lineTo((Game.fishing.tx + 0.5) * TILE, (Game.fishing.ty + 0.5) * TILE);
        ctx.stroke();
        const bobY = (Game.fishing.ty + 0.5) * TILE + (Game.fishing.phase === 'bite' ? Math.sin(Game.t * 30) * 4 : 0);
        ctx.fillStyle = Game.fishing.phase === 'bite' ? '#ffd34a' : '#e05a4a';
        ctx.beginPath(); ctx.arc((Game.fishing.tx + 0.5) * TILE, bobY, 4, 0, 7); ctx.fill();
      }
    }
  });
  draws.sort(function (a, b) { return a.y - b.y; });
  draws.forEach(function (d) { d.fn(); });

  // 准星高亮
  drawCursor(ctx);

  // 飘字
  Game.floaters.forEach(function (f) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.t);
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });

  // 碎石粒子（世界坐标）
  Game.particles.forEach(function (pt) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 7); ctx.fill();
    ctx.restore();
  });

  ctx.restore();

  // 光照/夜晚
  drawLighting(ctx);
  // 缩放倍率提示
  drawZoomHint(ctx);
  // 天气
  if (Game.map.type === 'outdoor') {
    if (Game.weather === 'rain') drawRain(ctx, Game.W, Game.H, Game.t, false);
    else if (Game.weather === 'snow') drawRain(ctx, Game.W, Game.H, Game.t, true);
  }
  // 钓鱼 UI
  drawFishingUI();
  // 上钩提示
  if (Game.fishing && Game.fishing.phase === 'bite') {
    ctx.save();
    ctx.font = 'bold 22px "PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe07a';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
    const txt = '！点击 / 空格收竿！';
    ctx.strokeText(txt, Game.W / 2, 120);
    ctx.fillText(txt, Game.W / 2, 120);
    ctx.restore();
  }
}

function drawGroundObj(ctx, o, x, y) {
  const px = x * TILE, py = y * TILE;
  switch (o.type) {
    case 'tree': drawTree(ctx, px, py, o, Game.season); break;
    case 'rock': drawRock(ctx, px, py, o); break;
    case 'weeds': drawWeeds(ctx, px, py, o, Game.season); break;
    case 'branch': drawBranch(ctx, px, py); break;
    case 'forage': drawForage(ctx, px, py, o.item); break;
    case 'fence': drawFence(ctx, px, py, o); break;
    case 'bin': drawBin(ctx, px, py); break;
    case 'bed': drawBed(ctx, px, py); break;
    case 'stairs': drawStairs(ctx, px, py, false); break;
    case 'leave': drawStairs(ctx, px, py, true); break;
    case 'table':
      ctx.fillStyle = '#8a5c33'; ctx.fillRect(px + 2, py + 8, 28, 18);
      ctx.fillStyle = '#a2763f'; ctx.fillRect(px + 2, py + 8, 28, 4);
      break;
    case 'plant':
      ctx.fillStyle = '#8a5c33'; ctx.fillRect(px + 8, py + 18, 16, 12);
      ctx.fillStyle = '#4f9c34';
      ctx.beginPath(); ctx.arc(px + 16, py + 12, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#6cbb45';
      ctx.beginPath(); ctx.arc(px + 13, py + 9, 5, 0, 7); ctx.fill();
      break;
    case 'door':
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffe07a';
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      ctx.restore();
      break;
    case 'torch': drawTorch(ctx, px, py, Game.t); break;
    case 'campfire': drawCampfire(ctx, px, py); break;
    case 'workbench':
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + 2, py + 24, 28, 5);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(px + 3, py + 6, 26, 18);
      ctx.fillStyle = '#96693c'; ctx.fillRect(px + 3, py + 6, 26, 4);
      ctx.fillStyle = '#5a3c20'; ctx.fillRect(px + 4, py + 22, 4, 5); ctx.fillRect(px + 24, py + 22, 4, 5);
      ctx.fillStyle = '#8a6238'; ctx.fillRect(px + 9, py + 10, 2, 7);
      ctx.fillStyle = '#c9ccd4'; ctx.fillRect(px + 7, py + 9, 6, 3);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(px + 18, py + 12, 5, 5);
      break;
    case 'stonewall':
      ctx.fillStyle = '#8a9096'; ctx.fillRect(px + 1, py + 1, 30, 30);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(px + 1, py + 1, 30, 26);
      ctx.fillStyle = '#a8aeb4'; ctx.fillRect(px + 1, py + 1, 30, 4);
      ctx.fillStyle = '#7a8086'; ctx.fillRect(px + 1, py + 13, 30, 2); ctx.fillRect(px + 14, py + 1, 2, 26);
      ctx.fillStyle = '#b4bac0'; ctx.fillRect(px + 4, py + 4, 8, 7); ctx.fillRect(px + 18, py + 16, 9, 8);
      break;
  }
}

function drawCursor(ctx) {
  if (!Game.running || Game.paused) return;
  const wp = screenToWorld(Game.mouse.x, Game.mouse.y);
  const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
  if (tx < 0 || ty < 0 || tx >= Game.map.w || ty >= Game.map.h) return;
  const near = tileDist(tx, ty) <= TILE * 2.1;
  ctx.save();
  ctx.strokeStyle = near ? 'rgba(255,240,180,0.95)' : 'rgba(255,120,120,0.6)';
  ctx.lineWidth = 2 / Game.zoom;   // 缩放时保持屏幕上的线宽一致
  ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
  ctx.restore();
}

function drawLighting(ctx) {
  let dark = 0;
  if (Game.map.type === 'outdoor') {
    dark = nightAlpha();
    if (Game.weather === 'rain') dark = Math.min(0.62, dark + 0.16);
  } else if (Game.map.type === 'mine') dark = 0.62;
  else dark = 0.05;
  if (dark <= 0.01) return;
  ctx.save();
  ctx.fillStyle = 'rgba(18,26,64,' + dark + ')';
  ctx.fillRect(0, 0, Game.W, Game.H);
  ctx.globalCompositeOperation = 'lighter';
  // 火把/火堆照明：每个光源一圈暖光（带轻微闪烁），任何地图/时段都生效
  const objs = Game.map.objs || {};
  for (const k in objs) {
    const o = objs[k];
    if (o.type !== 'torch' && o.type !== 'campfire') continue;
    const wx = o.x + TILE / 2, wy = o.y + TILE / 2 - 10;
    const sx = (wx - Game.cam.x) * Game.zoom, sy = (wy - Game.cam.y) * Game.zoom;
    // 视锥裁剪：视野外不画
    if (sx < -300 || sy < -300 || sx > Game.W + 300 || sy > Game.H + 300) continue;
    const isBig = o.type === 'campfire';
    const r = ((isBig ? 230 : 170) + Math.sin(Game.t * 8 + o.x * 0.7) * 8) * Game.zoom;
    const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, r);
    g.addColorStop(0, 'rgba(255,200,110,' + (isBig ? 0.85 : 0.75) + ')');
    g.addColorStop(0.55, 'rgba(255,170,70,' + (isBig ? 0.35 : 0.28) + ')');
    g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* =========================================================================
 *  主循环
 * ========================================================================= */
function loop(ts) {
  const dt = Math.min(0.05, (ts - Game.lastTs) / 1000 || 0);
  Game.lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function resize() {
  Game.dpr = Math.min(2, window.devicePixelRatio || 1);
  Game.W = window.innerWidth;
  Game.H = window.innerHeight;
  dom.cv.width = Math.floor(Game.W * Game.dpr);
  dom.cv.height = Math.floor(Game.H * Game.dpr);
  dom.cv.style.width = Game.W + 'px';
  dom.cv.style.height = Game.H + 'px';
  Game.ctx = dom.cv.getContext('2d');
  Game.ctx.setTransform(Game.dpr, 0, 0, Game.dpr, 0, 0);
  Game.ctx.imageSmoothingEnabled = false;
  clampCam();
}

/* =========================================================================
 *  启动
 * ========================================================================= */
function startGame(cont) {
  const ok = cont ? loadGame() : false;
  if (!ok) {
    newGame();
    if (cont) toast('没有找到存档，已开始新游戏');
  } else {
    // 存档存在但地图需要重建
    if (!Game.maps.farm) newGame();
    Game.npcs = NPCS.map(function (n) {
      return {
        name: n.name, color: n.color, shirt: n.shirt, hair: n.hair, lines: n.lines,
        x: n.x * TILE + 16, y: n.y * TILE + 16, home: { x: n.x * TILE + 16, y: n.y * TILE + 16 },
        dir: 'down', frame: 0, anim: 0, wait: Math.random() * 3, mapId: 'farm', vx: 0, vy: 0
      };
    });
    buildGroundCache(Game.maps.farm, Game.season);
    spawnForage(Game.maps.farm, Game.season, 10);
    enterMap('farm', null);
  }
  dom.titleScreen.classList.add('hidden');
  Game.running = true;
  Game.paused = false;
  Game.lastTs = performance.now();
  refreshInv();
  toast('欢迎回到星露谷！按 H 查看操作说明');
}

function init() {
  cacheDom();
  buildHotbar();
  bindInput();
  resize();
  window.addEventListener('resize', resize);
  // 标题界面背景：先建一张农场地图
  newGame();
  Game.running = false;
  Game.paused = true;
  refreshInv();
  if (!hasSave()) $('btnContinue').disabled = true;
  requestAnimationFrame(loop);
}

window.addEventListener('error', function (e) {
  try { toast('脚本错误：' + e.message); } catch (x) { }
});
window.addEventListener('load', init);
