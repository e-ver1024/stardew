/* =========================================================================
 *  game.js  ——  主循环、玩家、交互、UI、系统层
 * ========================================================================= */
'use strict';

const TITLE = 'Vladilena·Milizé 的星露谷物语';
const SAVE_KEY = 'star_dew_save_v1';
const DAYS_PER_SEASON_ = DAYS_PER_SEASON;

/* ===================== 状态 ===================== */
let canvas, ctx, ui = {};
let state = 'title';
let G = null;
let lastFrame = 0;
let cam = { x: 0, y: 0 };
let keys = {};
let mouse = { x: 0, y: 0, down: false, gx: 0, gy: 0 };
let lastDayShown = -1, lastWeatherShown = -1, lastHourShown = -1;
let swingAnim = null;
let fishing = null;
let shake = 0;
let prefersReducedMotion = false;

/* ===================== 初始化 ===================== */
function init() {
  canvas = document.getElementById('cv');
  ctx = canvas.getContext('2d');
  ui.titleScreen = document.getElementById('titleScreen');
  ui.btnNew = document.getElementById('btnNew');
  ui.btnContinue = document.getElementById('btnContinue');
  ui.btnHelpTitle = document.getElementById('btnHelpTitle');
  ui.chipDate = document.getElementById('chipDate');
  ui.chipTime = document.getElementById('chipTime');
  ui.chipWeather = document.getElementById('chipWeather');
  ui.chipMoney = document.getElementById('chipMoney');
  ui.energyFill = document.getElementById('energyFill');
  ui.energyText = document.getElementById('energyText');
  ui.hotbar = document.getElementById('hotbar');
  ui.invPanel = document.getElementById('invPanel');
  ui.invGrid = document.getElementById('invGrid');
  ui.shopPanel = document.getElementById('shopPanel');
  ui.shopTitle = document.getElementById('shopTitle');
  ui.shopBody = document.getElementById('shopBody');
  ui.helpPanel = document.getElementById('helpPanel');
  ui.dialogPanel = document.getElementById('dialogPanel');
  ui.dialogText = document.getElementById('dialogText');
  ui.dialogBtns = document.getElementById('dialogBtns');
  ui.toast = document.getElementById('toast');
  ui.fishingPanel = document.getElementById('fishingPanel');
  ui.fade = document.getElementById('fade');
  ui.btnMute = document.getElementById('btnMute');
  ui.btnHelp = document.getElementById('btnHelp');
  ui.tipbar = document.getElementById('tipbar');
  ui.tipbar.style.display = 'none';

  resize();
  window.addEventListener('resize', resize);
  setupInput();
  setupTitle();
  ui.btnMute.addEventListener('click', function () { audio.muted = !audio.muted; ui.btnMute.textContent = audio.muted ? '🔇' : '🔊'; });
  ui.btnHelp.addEventListener('click', function () { ui.helpPanel.classList.remove('hidden'); });
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) prefersReducedMotion = true;
  if (!localStorage.getItem(SAVE_KEY)) ui.btnContinue.style.display = 'none';
  requestAnimationFrame(loop);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/* ===================== 输入 ===================== */
function setupInput() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', function (e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (state !== 'play' || isPanelOpen()) return;
    mouse.down = true;
    const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
    const gx = Math.floor(wx / TILE), gy = Math.floor(wy / TILE);
    if (useToolOn(gx, gy, true)) { updateSwing(); }
  });
  window.addEventListener('mouseup', function () { mouse.down = false; });
}

function onKeyDown(e) {
  if (e.repeat) return;
  keys[e.key.toLowerCase()] = true;
  if (state === 'title') return;
  if (e.key === 'Tab' || e.key.toLowerCase() === 'i') {
    e.preventDefault();
    if (ui.invPanel.classList.contains('hidden')) { openInventory(); return false; }
    closeAllPanels(); return false;
  }
  if (e.key === 'Escape') { closeAllPanels(); return; }
  if (isPanelOpen()) return;
  const n = parseInt(e.key, 10);
  if (!isNaN(n)) {
    let idx = (n + 9) % 10; // 1 -> 0, ..., 9 -> 8, 0 -> 9
    selectSlot(idx);
    return;
  }
  switch (e.key.toLowerCase()) {
    case ' ': case 'spacebar':
      e.preventDefault();
      useToolFront(); break;
    case 'e': interact(); break;
    case 'f': eatHand(); break;
    case 'h': ui.helpPanel.classList.remove('hidden'); break;
  }
}
function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

function isPanelOpen() {
  return !(ui.invPanel.classList.contains('hidden') &&
    ui.shopPanel.classList.contains('hidden') &&
    ui.helpPanel.classList.contains('hidden') &&
    ui.dialogPanel.classList.contains('hidden'));
}
function closeAllPanels() {
  ui.invPanel.classList.add('hidden');
  ui.shopPanel.classList.add('hidden');
  ui.helpPanel.classList.add('hidden');
  ui.dialogPanel.classList.add('hidden');
  renderShop();
}
window.closeAllPanels = closeAllPanels;

/* ===================== 标题屏 ===================== */
function setupTitle() {
  ui.btnNew.addEventListener('click', function () {
    newGame();
    ui.titleScreen.classList.add('hidden');
    ui.tipbar.style.display = '';
    startMusic();
  });
  ui.btnContinue.addEventListener('click', function () {
    if (loadGame()) {
      ui.titleScreen.classList.add('hidden');
      ui.tipbar.style.display = '';
      startMusic();
    }
  });
  ui.btnHelpTitle.addEventListener('click', function () { ui.helpPanel.classList.remove('hidden'); });
}

/* ===================== 新游戏 ===================== */
function newGame() {
  G = {
    money: 500, day: 1, season: 0,
    time: 600, weather: 'sunny',
    maps: {}, current: 'farm',
    player: { x: 33 * TILE + 16, y: 22 * TILE + 20, dir: 'down', frame: 0, t: 0,
      hp: 100, energy: 120, maxEnergy: 120, facing: 'down',
      inv: [null, null, null, null, null, null, null, null, null, null, null, null,
        { id: 'hoe', count: 1 }, { id: 'can', count: 1 }, { id: 'axe', count: 1 },
        { id: 'pickaxe', count: 1 }, { id: 'scythe', count: 1 }, { id: 'rod', count: 1 },
        { id: 'parsnip', count: 15 }, null, null, null, null, null, null, null, null, null, null, null
      ],
      hot: 12, canWater: 0, invSel: -1,
      body: { skin: '#f2c99a', hair: '#5a3a1e', shirt: '#4a7fc1', pants: '#3a4a6a', hat: '#c9a648' }
    },
    npcs: [], level: 0, salePending: [],
    seenFlowerKind: false
  };
  // 初始化地图
  G.maps.farm = createFarmMap();
  buildGroundCache(G.maps.farm, 0);
  G.maps.house = createHouseMap();
  buildGroundCache(G.maps.house, 0);
  G.maps.shop = createShopMap();
  buildGroundCache(G.maps.shop, 0);
  spawnForage(G.maps.farm, 0, 22);
  // NPC
  G.npcs = NPCS.map(function (n) {
    return {
      name: n.name, x: n.x, y: n.y, home: n.home,
      skin: n.skin || '#f2c99a', hair: n.hair, shirt: n.shirt, body: { skin: n.skin || '#f2c99a', hair: n.hair, shirt: n.shirt, pants: '#3a4a6a' },
      lines: n.lines, idx: Math.floor(Math.random() * n.lines.length), talkCD: 0
    };
  });
  // 把 NPC 挂到当前地图的物件里方便碰撞与渲染
  placeNpcsOnMap();
  G.player.x = G.maps.farm.spawn.x;
  G.player.y = G.maps.farm.spawn.y;
  state = 'play';
  lastDayShown = -1;
  showToast('🌱 第 1 天，春季。好好经营你的农场吧！');
  saveGame();
}

function placeNpcsOnMap() {
  const m = G.maps.farm;
  G.npcs.forEach(function (n) {
    setObj(m, n.x, n.y, { type: 'npc', solid: true, npc: n });
  });
}

/* ===================== 商店内景 ===================== */
function createShopMap() {
  const W = 14, H = 10;
  const m = makeMap('shop', W, H, T.BRICK, 'shop');
  for (let x = 0; x < W; x++) { setTile(m, x, 0, T.WALL); setTile(m, x, H - 1, T.WALL); }
  for (let y = 0; y < H; y++) { setTile(m, 0, y, T.WALL); setTile(m, W - 1, y, T.WALL); }
  // 货架装饰
  for (let x = 2; x < W - 2; x++) setObj(m, x, 2, { type: 'shelf', solid: true });
  // 收银台（交互开商店）
  setObj(m, 7, 5, { type: 'counter', solid: true, action: 'shop' });
  setObj(m, 7, H - 1, { type: 'door', solid: false, to: 'farm', spawn: { x: 47 * TILE + 16, y: 21 * TILE + 24 }, label: '出门' });
  m.spawn = { x: 7 * TILE + 16, y: 7 * TILE + 20 };
  return m;
}

/* ===================== 主循环 ===================== */
function loop(t) {
  const dt = Math.min(50, t - lastFrame);
  lastFrame = t;
  if (state === 'play') {
    update(dt);
    render();
  }
  requestAnimationFrame(loop);
}

function update(dt) {
  const p = G.player;
  // 移动
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx || dy) {
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
    else p.dir = dy > 0 ? 'down' : 'up';
    const len = Math.hypot(dx, dy);
    const spd = 2.0;
    const nx = p.x + dx / len * spd;
    const ny = p.y + dy / len * spd;
    tryMove(nx, ny);
    p.t += dt;
    p.frame = Math.floor(p.t / 140) % 4;
  } else {
    p.frame = 0; p.t = 0;
  }
  // 相机
  cam.x = p.x - canvas.width / 2;
  cam.y = p.y - canvas.height / 2;
  const m = G.maps[G.current];
  cam.x = Math.max(0, Math.min(m.w * TILE - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(m.h * TILE - canvas.height, cam.y));
  if (m.w * TILE < canvas.width) cam.x = (m.w * TILE - canvas.width) / 2;
  if (m.h * TILE < canvas.height) cam.y = (m.h * TILE - canvas.height) / 2;
  // 时间推进
  G.time += dt / 16.67 * 0.4;
  if (G.time >= 260) { G.time = 260; collapseAndSleep(); }
  // 出货结算
  if (G.salePending.length && G.time >= 600 && G.time < 620) {
    let total = 0;
    G.salePending.forEach(function (s) { total += s.value; });
    G.money += total;
    showToast('🪙 昨日出货结算：+' + total + ' 金币');
    G.salePending = [];
    updateHUD();
  }
  // 树摇恢复
  const objs = m.objs;
  for (const k in objs) {
    const o = objs[k];
    if (o.shake > 0) o.shake = Math.max(0, o.shake - dt / 220);
  }
  // 钓鱼
  if (fishing) updateFishing(dt);
  // 挥动恢复
  if (swingAnim) {
    swingAnim.t += dt;
    if (swingAnim.t >= swingAnim.dur) swingAnim = null;
  }
  // HUD刷新
  if (Math.floor(G.time / 10) !== lastHourShown) updateHUD();
  updateHotbar();
}

function tryMove(nx, ny) {
  const p = G.player;
  const m = G.maps[G.current];
  const r = 10; // 碰撞半径
  const cx = Math.floor((nx) / TILE);
  const cy = Math.floor((ny + r) / TILE);
  if (!isSolid(m, cx, cy) && !isSolid(m, Math.floor((nx - r) / TILE), cy) && !isSolid(m, Math.floor((nx + r) / TILE), cy)) {
    p.x = nx;
  }
  if (!isSolid(m, Math.floor(p.x / TILE), Math.floor((ny + r) / TILE)) && !isSolid(m, Math.floor((p.x - r) / TILE), Math.floor((ny + r) / TILE)) && !isSolid(m, Math.floor((p.x + r) / TILE), Math.floor((ny + r) / TILE))) {
    p.y = ny;
  }
}

/* ===================== 渲染 ===================== */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const m = G.maps[G.current];
  // 地面缓存
  if (!m.cache || m.cacheSeason !== G.season) buildGroundCache(m, G.season);
  ctx.drawImage(m.cache, -cam.x, -cam.y);
  // 耕地
  for (const k in m.soil) {
    const s = m.soil[k];
    const parts = k.split(',');
    const tx = +parts[0], ty = +parts[1];
    const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > canvas.width || py > canvas.height) continue;
    drawTilled(ctx, px, py, s.wet, tx, ty);
    if (s.crop) {
      const def = CROPS[s.crop.id];
      const stage = cropStage(def, s.crop.days);
      const mature = cropMature(def, s.crop.days);
      drawCropPlant(ctx, px, py, s.crop.id, stage, s.crop.days, mature, performance.now());
    }
  }
  // 物件
  for (const k in m.objs) {
    const o = m.objs[k];
    const parts = k.split(',');
    const tx = +parts[0], ty = +parts[1];
    const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
    if (px < -TILE * 2 || py < -TILE * 2 || px > canvas.width || py > canvas.height) continue;
    switch (o.type) {
      case 'tree': drawTree(ctx, px, py, o, G.season); break;
      case 'rock': drawRock(ctx, px, py, o); break;
      case 'weeds': drawWeeds(ctx, px, py, o, G.season); break;
      case 'branch': drawBranch(ctx, px, py); break;
      case 'forage': drawForage(ctx, px, py, o.item); break;
      case 'fence': drawFence(ctx, px, py); break;
      case 'bin': case 'bin2': drawBin(ctx, px, py); break;
      case 'bed': case 'bed2': drawBed(ctx, px, py); break;
      case 'stairs': drawStairs(ctx, px, py, true); break;
      case 'leave': drawStairs(ctx, px, py, false); break;
      case 'shelf': ctx.fillStyle = '#6a4a2a'; ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8); ctx.fillStyle = '#8a6238'; ctx.fillRect(px + 2, py + 8, TILE - 4, 4); break;
      case 'counter': ctx.fillStyle = '#5a3a1e'; ctx.fillRect(px, py + 8, TILE, TILE - 8); ctx.fillStyle = '#8a5c33'; ctx.fillRect(px + 2, py + 10, TILE - 4, TILE - 12); break;
      case 'plant': ctx.fillStyle = '#6a4a2a'; ctx.fillRect(px + 10, py + 18, 12, 12); ctx.fillStyle = '#4f9c34'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 9, 0, 7); ctx.fill(); break;
      case 'table': ctx.fillStyle = '#8a5c33'; ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 16); ctx.fillRect(px + 4, py + 8, TILE - 8, 4); break;
      case 'npc': drawChar(ctx, px + TILE / 2, py + TILE, o.npc.dir || 'down', o.npc.frame || 0, o.npc.body, 2); break;
    }
  }
  // 建筑
  m.buildings.forEach(function (b) {
    const px = b.x * TILE - cam.x, py = b.y * TILE - cam.y;
    if (px + b.w * TILE < 0 || py + b.h * TILE < 0 || px > canvas.width || py > canvas.height) return;
    drawBuilding(ctx, b, G.season);
  });
  // NPC 移动逻辑（简单游走）
  if (G.current === 'farm') updateNpcs();
  G.npcs.forEach(function (n) {
    const px = n.x * TILE - cam.x, py = n.y * TILE - cam.y;
    if (px < -TILE || py < -TILE || px > canvas.width || py > canvas.height) return;
    drawChar(ctx, px + TILE / 2, py + TILE, n.dir || 'down', n.frame || 0, n.body, 2);
  });
  // 玩家
  const p = G.player;
  drawChar(ctx, p.x - cam.x, p.y - cam.y, p.dir, p.frame, p.body, 2);
  if (swingAnim) {
    const prog = swingAnim.t / swingAnim.dur;
    drawSwing(ctx, p.x - cam.x, p.y - cam.y, p.dir, swingAnim.kind, prog);
  }
  // 水波纹
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.ground[y * m.w + x] === T.WATER) {
      const px = x * TILE - cam.x, py = y * TILE - cam.y;
      if (px < -TILE || py < -TILE || px > canvas.width || py > canvas.height) continue;
      drawWaterAnim(ctx, px, py, performance.now() / 1000);
    }
  }
  // 天气
  if (G.weather === 'rain') drawRain(ctx, canvas.width, canvas.height, performance.now() / 1000, false);
  else if (G.weather === 'snow') drawRain(ctx, canvas.width, canvas.height, performance.now() / 1000, true);
  // 昼夜光照
  drawLighting();
  // 钓鱼小游戏浮标
  if (fishing) drawFishingOverlay();
}

function drawLighting() {
  const h = G.time / 10;
  let alpha = 0, col = '20,30,50';
  if (h < 6 || h >= 20) { alpha = 0.55; }
  else if (h < 8) { alpha = 0.35 - (h - 6) * 0.15; }
  else if (h >= 18) { alpha = (h - 18) * 0.10; }
  if (G.weather === 'rain') alpha = Math.min(0.6, alpha + 0.12);
  if (alpha > 0.01) {
    ctx.fillStyle = 'rgba(' + col + ',' + alpha + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function updateNpcs() {
  G.npcs.forEach(function (n) {
    if (n.talkCD > 0) n.talkCD -= 1;
    if (Math.random() < 0.005) {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const d = dirs[Math.floor(Math.random() * 4)];
      const nx = n.x + d[0], ny = n.y + d[1];
      const m = G.maps.farm;
      if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && !isSolid(m, nx, ny) && !getObj(m, nx, ny)) {
        setObj(m, n.x, n.y, null);
        n.x = nx; n.y = ny;
        n.dir = d[1] > 0 ? 'down' : (d[1] < 0 ? 'up' : (d[0] > 0 ? 'right' : 'left'));
        n.frame = (n.frame || 0) + 1;
        setObj(m, n.x, n.y, { type: 'npc', solid: true, npc: n });
      }
    }
  });
}

/* ===================== HUD ===================== */
function updateHUD() {
  const d = G.day;
  const wd = WEEKDAY[(d - 1) % 7];
  ui.chipDate.textContent = SEASON_SHORT[G.season] + ' ' + (((d - 1) % DAYS_PER_SEASON_) + 1) + '日 ' + wd;
  const h = Math.floor(G.time / 10);
  const mi = Math.floor((G.time % 10) * 6);
  ui.chipTime.textContent = (h < 12 ? '上午 ' : '下午 ') + ((h + 11) % 12 + 1) + ':' + (mi < 10 ? '0' + mi : mi);
  ui.chipWeather.textContent = G.weather === 'sunny' ? '☀ 晴天' : G.weather === 'rain' ? '🌧 雨天' : '❄ 雪天';
  ui.chipMoney.textContent = '🪙 ' + G.money;
  const p = G.player;
  ui.energyFill.style.width = Math.max(0, p.energy / p.maxEnergy * 100) + '%';
  ui.energyText.textContent = Math.max(0, Math.floor(p.energy)) + '/' + p.maxEnergy;
  lastHourShown = Math.floor(G.time / 10);
  lastDayShown = G.day;
  lastWeatherShown = G.weather;
}

function updateHotbar() {
  const p = G.player;
  if (ui.hotbar.children.length !== 10) {
    ui.hotbar.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.dataset.idx = i;
      const num = document.createElement('div'); num.className = 'num'; num.textContent = (i + 1) % 10;
      s.appendChild(num);
      const cv = document.createElement('canvas'); cv.width = 44; cv.height = 44;
      s.appendChild(cv);
      const cnt = document.createElement('div'); cnt.className = 'cnt'; s.appendChild(cnt);
      const nm = document.createElement('div'); nm.className = 'nm'; s.appendChild(nm);
      s.addEventListener('click', function () { selectSlot(i); });
      ui.hotbar.appendChild(s);
    }
  }
  for (let i = 0; i < 10; i++) {
    const slot = ui.hotbar.children[i];
    const item = p.inv[i + 12];
    slot.classList.toggle('active', i === (p.hot - 12));
    const cv = slot.querySelector('canvas');
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 44, 44);
    slot.querySelector('.cnt').textContent = '';
    slot.querySelector('.nm').textContent = '';
    slot.querySelector('.nm').classList.add('empty');
    if (item) {
      drawItemIcon(c, item.id, 4, 4, 36);
      slot.querySelector('.nm').classList.remove('empty');
      slot.querySelector('.nm').textContent = ITEMS[item.id].name;
      if (item.count > 1) slot.querySelector('.cnt').textContent = item.count;
    }
  }
}

function selectSlot(i) {
  G.player.hot = i + 12;
  updateHotbar();
  audio.beep(440, 0.04);
}

/* ===================== 背包 ===================== */
function openInventory() {
  renderInv();
  ui.invPanel.classList.remove('hidden');
}
function renderInv() {
  const p = G.player;
  ui.invGrid.innerHTML = '';
  for (let i = 0; i < 30; i++) {
    const item = p.inv[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (i >= 12 && i < 22) slot.classList.add('hot');
    if (i === p.invSel) slot.classList.add('sel');
    const cv = document.createElement('canvas'); cv.width = 46; cv.height = 46;
    const c = cv.getContext('2d');
    if (item) drawItemIcon(c, item.id, 3, 3, 40);
    slot.appendChild(cv);
    if (item && item.count > 1) {
      const cnt = document.createElement('div'); cnt.className = 'cnt'; cnt.textContent = item.count; slot.appendChild(cnt);
    }
    const nm = document.createElement('div'); nm.className = 'nm' + (item ? '' : ' empty');
    nm.textContent = item ? ITEMS[item.id].name : '空';
    slot.appendChild(nm);
    slot.addEventListener('click', function () { onInvClick(i); });
    ui.invGrid.appendChild(slot);
  }
}
function onInvClick(i) {
  const p = G.player;
  if (p.invSel === -1) {
    p.invSel = i;
  } else if (p.invSel === i) {
    p.invSel = -1;
  } else {
    const tmp = p.inv[p.invSel];
    p.inv[p.invSel] = p.inv[i];
    p.inv[i] = tmp;
    p.invSel = -1;
  }
  renderInv();
  updateHotbar();
}

/* ===================== 商店 ===================== */
function renderShop() {
  if (ui.shopPanel.classList.contains('hidden')) return;
  const seedHtml = Object.keys(CROPS).filter(function (id) { return CROPS[id].season === G.season; }).map(function (id) {
    const c = CROPS[id];
    return '<div class="shop-row" data-id="seed_' + id + '">' +
      '<canvas width="34" height="34"></canvas>' +
      '<div class="nm">' + c.name + '种子</div>' +
      '<div class="pr">🪙 ' + c.seed + '</div>' +
      '<button class="mini">买</button></div>';
  }).join('');
  const matHtml = SHOP_EXTRA.map(function (s) {
    const it = ITEMS[s.id];
    return '<div class="shop-row" data-id="' + s.id + '">' +
      '<canvas width="34" height="34"></canvas>' +
      '<div class="nm">' + it.name + '</div>' +
      '<div class="pr">🪙 ' + s.buy + '</div>' +
      '<button class="mini">买</button></div>';
  }).join('');
  ui.shopBody.innerHTML = '<div class="shop-cols"><div class="shop-col"><h4>种子</h4><div class="shop-list">' + seedHtml + '</div></div>' +
    '<div class="shop-col"><h4>材料</h4><div class="shop-list">' + matHtml + '</div></div>' +
    '<div class="shop-col"><h4>出售物品</h4><div class="shop-list" id="sellList"></div></div></div>';
  ui.shopTitle.textContent = '🏪 皮埃尔杂货铺';
  // 画图标
  ui.shopBody.querySelectorAll('.shop-row').forEach(function (row) {
    const id = row.dataset.id;
    const cv = row.querySelector('canvas');
    drawItemIcon(cv.getContext('2d'), id, 0, 0, 34);
    row.querySelector('button').addEventListener('click', function () { buyItem(id); });
  });
  renderSellList();
}
function renderSellList() {
  const list = document.getElementById('sellList');
  if (!list) return;
  const p = G.player;
  const sellable = [];
  p.inv.forEach(function (item, i) {
    if (item && ITEMS[item.id] && ITEMS[item.id].sell) sellable.push({ item: item, idx: i });
  });
  if (!sellable.length) { list.innerHTML = '<div class="empty">背包里没有可出售的物品</div>'; return; }
  list.innerHTML = sellable.map(function (s) {
    const it = ITEMS[s.item.id];
    return '<div class="shop-row" data-idx="' + s.idx + '">' +
      '<canvas width="34" height="34"></canvas>' +
      '<div class="nm">' + it.name + (s.item.count > 1 ? ' x' + s.item.count : '') + '</div>' +
      '<div class="pr">🪙 ' + it.sell + '</div>' +
      '<button class="mini">卖</button></div>';
  }).join('');
  list.querySelectorAll('.shop-row').forEach(function (row) {
    const idx = +row.dataset.idx;
    const item = p.inv[idx];
    if (item) drawItemIcon(row.querySelector('canvas').getContext('2d'), item.id, 0, 0, 34);
    row.querySelector('button').addEventListener('click', function () { sellItem(idx); });
  });
}
function buyItem(id) {
  const it = ITEMS[id];
  const buy = id.indexOf('seed_') === 0 ? CROPS[id.slice(5)].seed :
    (SHOP_EXTRA.find(function (s) { return s.id === id; }) || {}).buy;
  if (G.money < buy) { showToast('💰 金币不足！'); return; }
  G.money -= buy;
  addItem(id, 1);
  showToast('✅ 购入 ' + it.name + '（-🪙' + buy + '）');
  renderShop();
  updateHUD();
}
function sellItem(idx) {
  const item = G.player.inv[idx];
  if (!item) return;
  const it = ITEMS[item.id];
  if (!it || !it.sell) return;
  G.money += it.sell;
  showToast('🪙 +' + it.sell + ' ' + it.name);
  item.count -= 1;
  if (item.count <= 0) G.player.inv[idx] = null;
  renderShop();
  updateHUD();
}

/* ===================== 工具使用 ===================== */
function useToolOn(gx, gy, fromClick) {
  const m = G.maps[G.current];
  const p = G.player;
  if (gx < 0 || gy < 0 || gx >= m.w || gy >= m.h) return false;
  const dx = gx - Math.floor(p.x / TILE);
  const dy = gy - Math.floor((p.y + 10) / TILE);
  const dist = Math.hypot(dx, dy);
  if (dist > 1.7) { if (fromClick) showToast('太远了，走近一点'); return false; }
  const item = p.inv[p.hot];
  if (!item) {
    // 空手：收获 / 拾取
    return handAction(gx, gy);
  }
  const it = ITEMS[item.id];
  if (it.type === 'tool') return useTool(gx, gy, it.kind);
  if (it.type === 'seed') return plantSeed(gx, gy, it.crop);
  if (it.type === 'fish') return tryEat(item.id);
  return false;
}

function useToolFront() {
  const p = G.player;
  let dx = 0, dy = 0;
  if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1;
  else if (p.dir === 'left') dx = -1; else dx = 1;
  const gx = Math.floor(p.x / TILE) + dx;
  const gy = Math.floor((p.y + 10) / TILE) + dy;
  if (useToolOn(gx, gy, false)) updateSwing();
  else if (G.player.inv[G.player.hot] && ITEMS[G.player.inv[G.player.hot].id].kind === 'rod') {
    startFishing(gx, gy);
  }
}

function useTool(gx, gy, kind) {
  const m = G.maps[G.current];
  const p = G.player;
  const tile = tileAt(m, gx, gy);
  const o = getObj(m, gx, gy);
  const k = key(gx, gy);
  if (kind === 'hoe') {
    if (!TILLABLE.has(tile)) { if (!o) return false; }
    if (o) return false;
    if (p.energy < COST.hoe) { showToast('⚡ 体力不足'); return false; }
    p.energy -= COST.hoe;
    m.soil[k] = { wet: false, crop: null };
    audio.beep(220, 0.08);
    return true;
  }
  if (kind === 'can') {
    if (tile === T.WATER) {
      p.canWater = 40;
      showToast('💦 水壶已装满');
      audio.beep(330, 0.08);
      return true;
    }
    if (m.soil[k]) {
      if (p.canWater <= 0) { showToast('水壶空了，去水边装水'); return false; }
      p.energy -= COST.water;
      p.canWater -= 1;
      m.soil[k].wet = true;
      audio.beep(550, 0.06);
      return true;
    }
    return false;
  }
  if (kind === 'axe') {
    if (o && o.type === 'tree') {
      if (p.energy < COST.axe) { showToast('⚡ 体力不足'); return false; }
      p.energy -= COST.axe;
      o.hp -= 1;
      o.shake = 1;
      audio.beep(180, 0.1);
      if (o.hp <= 0) {
        addItem('wood', 5 + Math.floor(Math.random() * 4));
        if (Math.random() < 0.3) addItem('sap', 2);
        setObj(m, gx, gy, { type: 'tree', kind: 'stump', solid: true, hp: 1, shake: 0 });
        showToast('🪵 砍倒了树！+木材');
      }
      return true;
    }
    if (o && o.type === 'stump') {
      p.energy -= 2;
      addItem('wood', 1);
      setObj(m, gx, gy, null);
      return true;
    }
    if (o && o.type === 'branch') {
      addItem('wood', 1);
      setObj(m, gx, gy, null);
      return true;
    }
    return false;
  }
  if (kind === 'pickaxe') {
    if (o && o.type === 'rock') {
      if (p.energy < COST.pick) { showToast('⚡ 体力不足'); return false; }
      p.energy -= COST.pick;
      o.hp -= 1;
      o.shake = 1;
      audio.beep(200, 0.1);
      if (o.hp <= 0) {
        if (o.metal === 'coal') addItem('coal', 1);
        else if (o.metal === 'copper') addItem('copper_ore', 1);
        else if (o.metal === 'iron') addItem('iron_ore', 1);
        else if (o.metal === 'gold') addItem('gold_ore', 1);
        else addItem('stone', 1);
        setObj(m, gx, gy, null);
        showToast('⛏ 挖到了矿石');
      }
      return true;
    }
    return false;
  }
  if (kind === 'scythe') {
    if (o && o.type === 'weeds') {
      p.energy -= COST.scythe;
      addItem('fiber', 1);
      setObj(m, gx, gy, null);
      audio.beep(440, 0.06);
      return true;
    }
    return false;
  }
  if (kind === 'rod') {
    if (tile === T.WATER) { startFishing(gx, gy); return true; }
    return false;
  }
  return false;
}

function plantSeed(gx, gy, cropId) {
  const m = G.maps[G.current];
  const k = key(gx, gy);
  const s = m.soil[k];
  if (!s) { showToast('先开垦土地'); return false; }
  if (s.crop) { showToast('这里已经种了'); return false; }
  const def = CROPS[cropId];
  if (def.season !== G.season) { showToast('该作物不能在本季种植'); return false; }
  s.crop = { id: cropId, days: 0 };
  const p = G.player;
  const item = p.inv[p.hot];
  item.count -= 1;
  if (item.count <= 0) p.inv[p.hot] = null;
  showToast('🌱 种下了 ' + def.name);
  audio.beep(660, 0.06);
  return true;
}

function handAction(gx, gy) {
  const m = G.maps[G.current];
  const o = getObj(m, gx, gy);
  const k = key(gx, gy);
  if (o && o.type === 'forage') {
    addItem(o.item, 1);
    setObj(m, gx, gy, null);
    showToast('🍃 采集到 ' + ITEMS[o.item].name);
    audio.beep(660, 0.06);
    return true;
  }
  const s = m.soil[k];
  if (s && s.crop) {
    const def = CROPS[s.crop.id];
    if (cropMature(def, s.crop.days)) {
      addItem(s.crop.id, 1);
      if (def.regrow > 0) {
        s.crop.days = cropTotalDays(def) - def.regrow;
      } else {
        s.crop = null;
      }
      showToast('🌾 收获了 ' + def.name + '！');
      audio.beep(770, 0.1);
      return true;
    } else {
      showToast('还没成熟（' + s.crop.days + '/' + cropTotalDays(def) + ' 天）');
      return false;
    }
  }
  return false;
}

function updateSwing() {
  const item = G.player.inv[G.player.hot];
  if (item && ITEMS[item.id].type === 'tool') {
    swingAnim = { kind: ITEMS[item.id].kind, t: 0, dur: 280 };
  }
}

/* ===================== 钓鱼 ===================== */
function startFishing(gx, gy) {
  if (G.player.energy < COST.fish) { showToast('⚡ 体力不足'); return; }
  G.player.energy -= COST.fish;
  fishing = {
    gx: gx, gy: gy, t: 0, phase: 'wait',
    biteAt: 1 + Math.random() * 3,
    fish: FISH[Math.floor(Math.random() * FISH.length)],
    barH: 1.0, barY: 0.5, fishY: 0.5, fishV: 0, dir: 1
  };
  ui.fishingPanel.classList.remove('hidden');
  showToast('🎣 抛竿了，等鱼上钩...');
  audio.beep(330, 0.08);
}

function updateFishing(dt) {
  fishing.t += dt / 1000;
  if (fishing.phase === 'wait') {
    if (fishing.t >= fishing.biteAt) {
      fishing.phase = 'bite';
      fishing.t = 0;
      fishing.biteDur = 1.2;
      showToast('❗ 鱼上钩了！按住空格/鼠标！');
      audio.beep(880, 0.15);
    }
  } else if (fishing.phase === 'bite') {
    if (fishing.t >= fishing.biteDur) {
      fishing = null;
      ui.fishingPanel.classList.add('hidden');
      showToast('💨 鱼跑了...');
      return;
    }
  } else if (fishing.phase === 'reel') {
    // 鱼上下游动
    fishing.fishV += (Math.random() - 0.5) * 0.04 * fishing.fish.speed;
    fishing.fishV = Math.max(-0.04, Math.min(0.04, fishing.fishV));
    fishing.fishY += fishing.fishV;
    if (fishing.fishY < 0.05) { fishing.fishY = 0.05; fishing.fishV = Math.abs(fishing.fishV); }
    if (fishing.fishY > 0.95) { fishing.fishY = 0.95; fishing.fishV = -Math.abs(fishing.fishV); }
    // 浮标跟随鱼
    const held = keys[' '] || mouse.down;
    const target = held ? fishing.fishY : 0.5;
    fishing.barY += (target - fishing.barY) * 0.12;
    // 进度
    if (Math.abs(fishing.barY - fishing.fishY) < 0.15) {
      fishing.barH += dt / 1000 * 0.4;
    } else {
      fishing.barH -= dt / 1000 * 0.3;
    }
    fishing.barH = Math.max(0, Math.min(1, fishing.barH));
    if (fishing.barH >= 1) {
      const f = fishing.fish;
      addItem(f.id, 1);
      showToast('🐟 钓到了 ' + f.name + '！');
      audio.beep(990, 0.2);
      fishing = null;
      ui.fishingPanel.classList.add('hidden');
    } else if (fishing.barH <= 0) {
      fishing = null;
      ui.fishingPanel.classList.add('hidden');
      showToast('💨 鱼跑了...');
    }
  }
}

function drawFishingOverlay() {
  if (fishing.phase !== 'reel') return;
  const W = 200, H = 240;
  const x = canvas.width - W - 20, y = canvas.height / 2 - H / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(x, y, W, H);
  ctx.strokeStyle = '#7fb9d8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);
  // 鱼图标
  drawItemIcon(ctx, fishing.fish.id, x + W / 2 - 16, y + 10, 32);
  // 进度条（竖向）
  const bx = x + W / 2 - 12, by = y + 60, bw = 24, bh = H - 80;
  ctx.fillStyle = '#1a2a38';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#5fb9d8';
  ctx.fillRect(bx, by + bh * (1 - fishing.barH), bw, bh * fishing.barH);
  // 鱼
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh * fishing.fishY, 5, 0, 7); ctx.fill();
  // 浮标（黄色条）
  ctx.fillStyle = 'rgba(255,215,94,0.4)';
  ctx.fillRect(bx - 6, by + bh * fishing.barY - 10, bw + 12, 20);
  ctx.fillStyle = '#ffd75e';
  ctx.fillRect(bx - 6, by + bh * fishing.barY - 2, bw + 12, 4);
  ctx.restore();
}

// 钓鱼上钩时按空格进入收线阶段
document.addEventListener('keydown', function (e) {
  if (!fishing || fishing.phase !== 'bite') return;
  if (e.key === ' ' || e.key.toLowerCase() === 'spacebar') {
    e.preventDefault();
    fishing.phase = 'reel';
    fishing.t = 0;
  }
}, true);

/* ===================== 交互 ===================== */
function interact() {
  const p = G.player;
  let dx = 0, dy = 0;
  if (p.dir === 'up') dy = -1; else if (p.dir === 'down') dy = 1;
  else if (p.dir === 'left') dx = -1; else dx = 1;
  const gx = Math.floor(p.x / TILE) + dx;
  const gy = Math.floor((p.y + 10) / TILE) + dy;
  const m = G.maps[G.current];
  const o = getObj(m, gx, gy);
  if (!o) {
    // 也检查脚下的门
    const o2 = getObj(m, Math.floor(p.x / TILE), Math.floor((p.y + 10) / TILE));
    if (o2 && o2.type === 'door') return useDoor(o2);
    return;
  }
  if (o.type === 'door') return useDoor(o);
  if (o.type === 'bed') return sleep();
  if (o.type === 'bin' || o.type === 'bin2') return openBin();
  if (o.type === 'counter') { openShop(); return; }
  if (o.type === 'npc') return talkNpc(o.npc);
  if (o.type === 'stairs') return goMineNext();
  if (o.type === 'leave') return useDoor(o);
}

function useDoor(o) {
  if (o.to === 'farm') {
    G.current = 'farm';
    if (o.spawn) { G.player.x = o.spawn.x; G.player.y = o.spawn.y; }
    else { G.player.x = G.maps.farm.spawn.x; G.player.y = G.maps.farm.spawn.y; }
    audio.beep(440, 0.06);
    return;
  }
  if (o.to === 'house') {
    G.current = 'house';
    G.player.x = o.spawn.x; G.player.y = o.spawn.y;
    audio.beep(440, 0.06);
    return;
  }
  if (o.to === 'mine') {
    G.current = 'mine';
    G.level = 1;
    G.maps.mine = createMineMap(1);
    buildGroundCache(G.maps.mine, 0);
    G.player.x = G.maps.mine.spawn.x;
    G.player.y = G.maps.mine.spawn.y;
    audio.beep(220, 0.1);
    return;
  }
  // 从矿洞回地面
  if (o.to === 'farm' && G.current === 'mine') {
    G.current = 'farm';
    G.player.x = o.spawn.x; G.player.y = o.spawn.y;
  }
}

function goMineNext() {
  G.level += 1;
  G.maps.mine = createMineMap(G.level);
  buildGroundCache(G.maps.mine, 0);
  G.player.x = G.maps.mine.spawn.x;
  G.player.y = G.maps.mine.spawn.y;
  showToast('⛏ 矿洞第 ' + G.level + ' 层');
  audio.beep(220, 0.1);
}

function openShop() {
  ui.shopPanel.classList.remove('hidden');
  renderShop();
}

function openBin() {
  const p = G.player;
  const item = p.inv[p.hot];
  if (!item) { showToast('出货箱：手里没物品'); return; }
  const it = ITEMS[item.id];
  if (!it || !it.sell) { showToast(it ? it.name + ' 不能出售' : '无法出售'); return; }
  G.salePending.push({ id: item.id, value: it.sell });
  item.count -= 1;
  if (item.count <= 0) p.inv[p.hot] = null;
  showToast('📦 已放入出货箱：' + it.name + '（次日结算 +' + it.sell + '）');
  updateHotbar();
}

function talkNpc(n) {
  if (n.talkCD > 0) return;
  n.talkCD = 30;
  n.idx = (n.idx + 1) % n.lines.length;
  showDialog(n.name, n.lines[n.idx], [{ label: '好的', action: closeAllPanels }]);
}

function sleep() {
  showDialog('睡觉', '结束这一天吗？', [
    { label: '是的，睡觉', action: endDay },
    { label: '再忙一会儿', action: closeAllPanels }
  ]);
}

/* ===================== 一天结束 ===================== */
function endDay() {
  closeAllPanels();
  // 出货结算
  let total = 0;
  G.salePending.forEach(function (s) { total += s.value; });
  G.money += total;
  const earned = total;
  // 推进日期
  G.day += 1;
  const newSeasonDay = (G.day - 1) % DAYS_PER_SEASON_;
  const newSeason = Math.floor((G.day - 1) / DAYS_PER_SEASON_) % 4;
  // 浇水状态重置
  const m = G.maps.farm;
  for (const k in m.soil) {
    const s = m.soil[k];
    if (s.crop) {
      if (s.wet || G.weather === 'rain' || G.weather === 'snow') {
        s.crop.days += 1;
      }
      s.wet = false;
    }
  }
  // 换季
  if (newSeason !== G.season) {
    G.season = newSeason;
    clearForage(m);
    clearDeadCrops(m, G.season);
    spawnForage(m, G.season, 22);
    buildGroundCache(m, G.season);
    showToast('🎉 新的季节：' + SEASON_FULL[G.season] + '！');
  }
  // 天气
  const r = Math.random();
  if (G.season === 3) G.weather = r < 0.4 ? 'snow' : 'sunny';
  else G.weather = r < 0.3 ? 'rain' : 'sunny';
  // 体力恢复
  G.player.energy = G.player.maxEnergy;
  G.player.hp = 100;
  G.time = 600;
  G.salePending = [];
  if (earned > 0) showToast('🪙 昨日出货：+' + earned + ' 金币');
  updateHUD();
  saveGame();
  // 黑屏过渡
  ui.fade.classList.remove('hidden');
  ui.fade.style.opacity = '1';
  setTimeout(function () {
    ui.fade.style.opacity = '0';
    setTimeout(function () { ui.fade.classList.add('hidden'); }, 400);
  }, 300);
}

function collapseAndSleep() {
  showToast('😵 你累倒了，被送回家睡觉');
  G.player.energy = Math.floor(G.player.maxEnergy * 0.5);
  G.player.hp = 80;
  endDay();
}

/* ===================== 食用 ===================== */
function eatHand() {
  const p = G.player;
  const item = p.inv[p.hot];
  if (!item) { showToast('手里没物品'); return; }
  const it = ITEMS[item.id];
  if (!it || !it.energy) { showToast(it ? it.name + ' 不能食用' : '无法食用'); return; }
  p.energy = Math.min(p.maxEnergy, p.energy + it.energy);
  item.count -= 1;
  if (item.count <= 0) p.inv[p.hot] = null;
  showToast('🍴 吃了 ' + it.name + '（+' + it.energy + ' 体力）');
  audio.beep(660, 0.06);
  updateHotbar();
  updateHUD();
}
function tryEat(id) {
  const it = ITEMS[id];
  if (it.energy) eatHand();
}

/* ===================== 物品 / Toast / Dialog ===================== */
function addItem(id, count) {
  const p = G.player;
  // 工具不堆叠
  if (ITEMS[id].type === 'tool') {
    for (let i = 0; i < p.inv.length; i++) {
      if (!p.inv[i]) { p.inv[i] = { id: id, count: 1 }; return; }
    }
    return;
  }
  for (let i = 0; i < p.inv.length; i++) {
    if (p.inv[i] && p.inv[i].id === id) { p.inv[i].count += count; return; }
  }
  for (let i = 0; i < p.inv.length; i++) {
    if (!p.inv[i]) { p.inv[i] = { id: id, count: count }; return; }
  }
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = msg;
  ui.toast.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity .4s';
    setTimeout(function () { el.remove(); }, 400);
  }, 2400);
}

function showDialog(name, text, btns) {
  ui.dialogText.innerHTML = '<b style="color:#ffd75e">' + name + '：</b> ' + text;
  ui.dialogBtns.innerHTML = '';
  btns.forEach(function (b) {
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = b.label;
    btn.addEventListener('click', function () { b.action(); });
    ui.dialogBtns.appendChild(btn);
  });
  ui.dialogPanel.classList.remove('hidden');
}

/* ===================== 存档 ===================== */
function saveGame() {
  try {
    const data = JSON.parse(JSON.stringify(G));
    // 地图缓存不可序列化
    Object.keys(data.maps).forEach(function (k) { data.maps[k].cache = null; });
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { console.warn('save failed', e); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    G = JSON.parse(raw);
    Object.keys(G.maps).forEach(function (k) {
      G.maps[k].cache = null;
      if (G.maps[k].type === 'outdoor' || G.maps[k].type === 'house' || G.maps[k].type === 'shop')
        buildGroundCache(G.maps[k], G.season);
    });
    placeNpcsOnMap();
    state = 'play';
    updateHUD();
    updateHotbar();
    return true;
  } catch (e) { console.warn('load failed', e); return false; }
}

/* ===================== 音频 ===================== */
const audio = {
  ctx: null, muted: false,
  ensure: function () { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; },
  beep: function (freq, dur) {
    if (this.muted) return;
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    o.start(now);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.stop(now + dur);
  }
};

function startMusic() {
  if (audio.muted) return;
  const ctx = audio.ensure();
  // 简单环境氛围音（低音垫）
  const notes = [220, 277, 330, 277];
  let i = 0;
  setInterval(function () {
    if (audio.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = notes[i % notes.length];
    g.gain.value = 0;
    o.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    o.start(now);
    g.gain.linearRampToValueAtTime(0.03, now + 0.5);
    g.gain.linearRampToValueAtTime(0, now + 2.5);
    o.stop(now + 2.5);
    i++;
  }, 2500);
}

window.addEventListener('load', init);