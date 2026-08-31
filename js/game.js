/* =========================================================================
 *  game.js  ——  主循环、玩家、交互、时间系统、UI
 * ========================================================================= */
'use strict';

const MIN_PER_SEC = 2.5;      // 1 现实秒 = 2.5 游戏分钟（约 8 分钟一整天）
const DAY_START = 360;        // 6:00
const DAY_END = 1560;         // 26:00（凌晨 2 点强制昏倒）

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
  shipping: [],
  floaters: [],
  toasts: [],
  particles: [],
  cam: { x: 0, y: 0 },
  keys: {}, mouse: { x: 0, y: 0, down: false },
  running: false, paused: true, muted: false,
  fishing: null,
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
      plant: [340, 0.09, 'triangle', 0.05, 420],
      bite: [660, 0.12, 'sine', 0.06, 900],
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
function addItem(id, n) {
  n = n || 1;
  const it = ITEMS[id];
  if (!it) return 0;
  let left = n;
  // 先堆叠
  if (it.type !== 'tool') {
    for (let i = 0; i < Game.inv.length && left > 0; i++) {
      const s = Game.inv[i];
      if (s && s.id === id && s.count < 999) {
        const add = Math.min(999 - s.count, left);
        s.count += add; left -= add;
      }
    }
  }
  // 再找空位
  for (let i = 0; i < Game.inv.length && left > 0; i++) {
    if (!Game.inv[i]) {
      const add = (it.type === 'tool') ? 1 : left;
      Game.inv[i] = { id: id, count: add };
      left -= add;
    }
  }
  if (left > 0) toast('背包已满！');
  refreshInv();
  return n - left;
}
function removeItem(id, n) {
  n = n || 1;
  let left = n;
  for (let i = 0; i < Game.inv.length && left > 0; i++) {
    const s = Game.inv[i];
    if (s && s.id === id) {
      const take = Math.min(s.count, left);
      s.count -= take; left -= take;
      if (s.count <= 0) Game.inv[i] = null;
    }
  }
  refreshInv();
  return n - left;
}
function countItem(id) {
  let c = 0;
  for (let i = 0; i < Game.inv.length; i++) if (Game.inv[i] && Game.inv[i].id === id) c += Game.inv[i].count;
  return c;
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
      const cnt = d.querySelector('.cnt');
      cnt.textContent = (ITEMS[s.id].type === 'tool' || s.count <= 1) ? '' : s.count;
      nm.textContent = ITEMS[s.id].name;
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
      '<canvas width="46" height="46" data-item="' + (s ? s.id : '') + '"></canvas>' +
      (s && s.count > 1 && ITEMS[s.id].type !== 'tool' ? '<span class="cnt">' + s.count + '</span>' : '') +
      (isHot ? '<span class="tag">' + ((i + 1) % 10) + '</span>' : '') +
      '<span class="nm' + (s ? '' : ' empty') + '">' + (s ? ITEMS[s.id].name : '空') + '</span>' +
      '</div>';
  }
  dom.invGrid.innerHTML = html;
  Array.prototype.forEach.call(dom.invGrid.querySelectorAll('canvas'), function (c) {
    const id = c.dataset.item;
    if (!id) return;
    drawItemIcon(c.getContext('2d'), id, 7, 7, 32);
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
  if (Game.running) Game.paused = false;
  else Game.paused = true;
}
function anyPanelOpen() {
  return !dom.invPanel.classList.contains('hidden') ||
    !dom.shopPanel.classList.contains('hidden') ||
    !dom.helpPanel.classList.contains('hidden') ||
    !dom.dialogPanel.classList.contains('hidden') ||
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
    has = true;
    html += '<div class="shop-row">' +
      '<canvas width="34" height="34" data-item="' + s.id + '"></canvas>' +
      '<span class="nm">' + it.name + ' ×' + s.count + '</span>' +
      '<span class="pr">🪙' + (it.sell * s.count) + '</span>' +
      '<button class="mini" data-sell="' + s.id + '">卖出</button>' +
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
    b.addEventListener('click', function () { sellItem(b.dataset.sell, 999); });
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
function sellItem(id, n) {
  const it = ITEMS[id];
  const cnt = Math.min(countItem(id), n);
  if (cnt <= 0) return;
  const value = it.sell * cnt;
  removeItem(id, cnt);
  if (shopMode === 'bin') {
    Game.shipping.push({ id: id, count: cnt, value: value, name: it.name });
    toast('已放入出货箱：' + it.name + ' ×' + cnt);
  } else {
    Game.money += value;
    toast('卖出 ' + it.name + ' ×' + cnt + '，+🪙' + value);
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
    value += it.sell * s.count;
    sold += s.count;
    if (shopMode === 'bin') Game.shipping.push({ id: s.id, count: s.count, value: it.sell * s.count, name: it.name });
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
  if (id === 'mine') key = 'mine_' + level;
  if (!Game.maps[key]) {
    if (id === 'mine') Game.maps[key] = createMineMap(level);
    else if (id === 'house') Game.maps[key] = createHouseMap();
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
      if (Game.fishing) fishingClick();
      else useAtFacing();
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
    const wx = Game.mouse.x + Game.cam.x, wy = Game.mouse.y + Game.cam.y;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    useAt(tx, ty);
  });
  window.addEventListener('mouseup', function () { Game.mouse.down = false; });
  dom.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

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
  const o = getObj(m, tx, ty);
  const sel = selectedItem();

  // 优先：可交互物件（wall = 建筑墙体，点建筑任意位置都能进屋/开商店）
  if (o && ['door', 'wall', 'bin', 'bin2', 'bed', 'bed2', 'stairs', 'leave', 'sign'].indexOf(o.type) >= 0) {
    interact(o, tx, ty); return;
  }
  if (tileDist(tx, ty) > TILE * 2.1) { toast('太远了，走近一点'); return; }

  // 空手 / 手持非工具
  if (!sel) { handAction(tx, ty, o); return; }
  const it = ITEMS[sel.id];
  if (it.type === 'tool') { useTool(sel.id, tx, ty, o); return; }
  if (it.type === 'seed') { plantSeed(tx, ty, sel.id); return; }
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
    toast('对着树使用斧头'); return;
  }
  if (kind === 'pickaxe') {
    if (o && o.type === 'rock') {
      if (!spend(COST.pick)) return;
      swing('pickaxe'); sfx('pick');
      o.shake = 0.25;
      o.hp = (o.hp || 2) - 1;
      if (o.hp <= 0) {
        setObj(m, tx, ty, null);
        const drops = ['stone'];
        if (o.metal === 'copper') drops.push('copper_ore');
        if (o.metal === 'iron') drops.push('iron_ore');
        if (o.metal === 'gold') drops.push('gold_ore');
        if (o.metal === 'coal') drops.push('coal', 'coal');
        if (Math.random() < 0.25) drops.push('coal');
        giveLoot(tx, ty, drops);
      } else giveLoot(tx, ty, ['stone']);
      return;
    }
    if (soil && !soil.crop) { delete m.soil[key(tx, ty)]; swing('pickaxe'); toast('清理了耕地'); return; }
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
  const pool = FISH;
  const idx = Math.min(pool.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * pool.length));
  Game.fishing = {
    phase: 'wait', t: 0, wait: 1.2 + Math.random() * 3.2,
    fish: pool[idx], p: 0.5, v: 0, fishP: 0.5, fishV: 0,
    target: 0.5, timer: 0, progress: 0.28, tx: tx, ty: ty
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
    if (f.t > 1.0) { toast('鱼跑了……'); endFishing(false); }
  } else if (f.phase === 'game') {
    const hold = Game.mouse.down || !!Game.keys[' '];
    // 浮标
    const barH = 0.16;
    f.v += (hold ? -2.6 : 2.1) * dt;
    f.v *= 0.94;
    f.p += f.v * dt;
    if (f.p < 0) { f.p = 0; f.v = 0; }
    if (f.p > 1 - barH) { f.p = 1 - barH; f.v = 0; }
    // 鱼
    f.timer -= dt;
    if (f.timer <= 0) {
      f.timer = 0.4 + Math.random() * 0.9;
      f.target = Math.random();
    }
    const sp = 0.6 + f.fish.speed * 0.42;
    f.fishP += Math.sign(f.target - f.fishP) * Math.min(Math.abs(f.target - f.fishP), sp * dt);
    f.fishP = Math.max(0, Math.min(1, f.fishP));
    // 判定
    const bc = f.p + barH / 2, fc = f.fishP;
    const overlap = Math.abs(bc - fc) < barH * 0.62;
    f.progress += (overlap ? 0.36 : -0.30) * dt;
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
    addItem(f.fish.id, 1);
    sfx('coin');
    floater(Game.player.x, Game.player.y - 40, '钓到 ' + f.fish.name + '！', '#ffe07a');
    toast('钓到 ' + f.fish.name + '（可卖 🪙' + f.fish.sell + '）');
  } else {
    sfx('error');
    toast('鱼儿溜走了……');
  }
  refreshInv();
}
function drawFishingUI() {
  const f = Game.fishing;
  if (!f || f.phase !== 'game') return;
  const ctx = Game.ctx;
  const x = Game.W - 96, y = 120, w = 34, h = 300;
  ctx.save();
  ctx.fillStyle = 'rgba(20,26,40,0.82)';
  ctx.fillRect(x - 8, y - 30, w + 16, h + 60);
  ctx.strokeStyle = '#e8d9a0'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 8.5, y - 30.5, w + 17, h + 61);
  // 轨道
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  // 鱼
  const fh = 44;
  const fy = y + f.fishP * (h - fh);
  ctx.fillStyle = f.fish.color;
  ctx.beginPath(); ctx.ellipse(x + w / 2, fy + fh / 2, w * 0.42, fh / 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.arc(x + w * 0.36, fy + fh / 2, 2.4, 0, 7); ctx.fill();
  // 浮标条
  const barH = 0.16 * h;
  const by = y + f.p * h;
  ctx.fillStyle = f.progress > 0.6 ? '#8fe08a' : '#ffd97a';
  ctx.fillRect(x + 3, by, w - 6, barH);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(x + 3.5, by + 0.5, w - 7, barH - 1);
  // 进度
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 4, y - 22, w + 8, 12);
  ctx.fillStyle = '#6fd0f0';
  ctx.fillRect(x - 2, y - 20, (w + 4) * Math.max(0, f.progress), 8);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('按住空格', x + w / 2, y + h + 20);
  ctx.restore();
}

/* =========================================================================
 *  时间与天数
 * ========================================================================= */
function nightAlpha() {
  const t = Game.time;
  if (t < 1020) return 0;                       // 17:00 前
  if (t < 1140) return (t - 1020) / 120 * 0.42; // 17:00-19:00
  if (t < 1440) return 0.42 + (t - 1140) / 300 * 0.14;
  return 0.56;
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
function passOut() {
  fadeTo(function () {
    nextDay();
    Game.energy = Math.round(Game.maxEnergy * 0.5);
    showDialog('<b>你在野外累倒了……</b><br>被好心人送回了家，体力只恢复了一半。<br><br>今日天气：' + weatherText(),
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

  updateNPCs(dt);
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
function clampCam() {
  const m = Game.map;
  if (!m) return;
  let cx = Game.player.x - Game.W / 2;
  let cy = Game.player.y - Game.H / 2 - 20;
  const mw = m.w * TILE, mh = m.h * TILE;
  cx = mw <= Game.W ? (mw - Game.W) / 2 : Math.max(0, Math.min(cx, mw - Game.W));
  cy = mh <= Game.H ? (mh - Game.H) / 2 : Math.max(0, Math.min(cy, mh - Game.H));
  Game.cam.x = cx; Game.cam.y = cy;
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
  ctx.clearRect(0, 0, Game.W, Game.H);
  ctx.save();
  ctx.translate(-Math.round(Game.cam.x), -Math.round(Game.cam.y));

  const x0 = Math.max(0, Math.floor(Game.cam.x / TILE));
  const y0 = Math.max(0, Math.floor(Game.cam.y / TILE));
  const x1 = Math.min(m.w - 1, Math.ceil((Game.cam.x + Game.W) / TILE));
  const y1 = Math.min(m.h - 1, Math.ceil((Game.cam.y + Game.H) / TILE));

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

  ctx.restore();

  // 光照/夜晚
  drawLighting(ctx);
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
  }
}

function drawCursor(ctx) {
  if (!Game.running || Game.paused) return;
  const wx = Game.mouse.x + Game.cam.x, wy = Game.mouse.y + Game.cam.y;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (tx < 0 || ty < 0 || tx >= Game.map.w || ty >= Game.map.h) return;
  const near = tileDist(tx, ty) <= TILE * 2.1;
  ctx.save();
  ctx.strokeStyle = near ? 'rgba(255,240,180,0.95)' : 'rgba(255,120,120,0.6)';
  ctx.lineWidth = 2;
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
  // 玩家周围的暖光
  ctx.globalCompositeOperation = 'lighter';
  const px = Game.player.x - Game.cam.x, py = Game.player.y - Game.cam.y - 16;
  const r = Game.map.type === 'mine' ? 150 : 130;
  const g = ctx.createRadialGradient(px, py, 8, px, py, r);
  g.addColorStop(0, 'rgba(255,225,160,' + (0.30 + dark * 0.25) + ')');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
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
