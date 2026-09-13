// node vm 运行时验证：不依赖浏览器，stub 最小 DOM 后逐脚本加载并验证数据结构
const vm = require('vm');
const fs = require('fs');

function noop() {}
function stubEl() {
  return new Proxy({}, { get(t, p) {
    if (p === 'classList') return { add: noop, remove: noop, contains: () => false, toggle: noop };
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'children' || p === 'childNodes') return [];
    if (p === 'querySelector' || p === 'querySelectorAll') return () => [];
    if (p === 'parentNode') return null;
    if (p === 'getContext') return () => stubCtx();
    if (p === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 0, height: 0 });
    if (p === 'width' || p === 'height') return 100;
    return noop;
  }, set() { return true; } });
}
function stubCtx() { return new Proxy({}, { get(t, p) { return noop; }, set() { return true; } }); }
function stubDoc() {
  return new Proxy({}, { get(t, p) {
    if (p === 'getElementById') return () => stubEl();
    if (p === 'createElement') return () => stubEl();
    if (p === 'body') return stubEl();
    if (p === 'addEventListener' || p === 'removeEventListener') return noop;
    return noop;
  } });
}
function stubWin() {
  return new Proxy({}, { get(t, p) {
    if (p === 'document') return sb.document;
    if (p === 'addEventListener' || p === 'removeEventListener') return noop;
    if (p === 'AudioContext' || p === 'webkitAudioContext') return function () { return {
      createOscillator: () => ({ connect: noop, frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, start: noop, stop: noop }),
      createGain: () => ({ connect: noop, gain: { setValueAtTime: noop, exponentialRampToValueAtTime: noop } }),
      destination: {}, currentTime: 0
    }; };
    if (p === 'innerWidth') return 1280;
    if (p === 'innerHeight') return 720;
    if (p === 'devicePixelRatio') return 1;
    return noop;
  } });
}

const sb = {
  console,
  document: stubDoc(),
  window: null,
  requestAnimationFrame: noop,
  performance: { now: () => 0 },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop }
};
sb.window = stubWin();
vm.createContext(sb);

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra: extra || '' });
  console.log((ok ? '[OK]   ' : '[FAIL] ') + name + (extra ? '  ' + extra : ''));
}

// 加载脚本
let loadOk = true;
for (const f of ['js/data.js', 'js/draw.js', 'js/world.js', 'js/game.js']) {
  try {
    vm.runInContext(fs.readFileSync(f, 'utf8'), sb, { filename: f });
    console.log('loaded ' + f);
  } catch (e) {
    loadOk = false;
    console.log('LOAD FAIL ' + f + ': ' + e.message);
  }
}
if (!loadOk) process.exit(1);

// 取 const — Node vm 中 script-local const 在后续 runInContext 中不可见，需在最后一段同 scope code 里引用
// 策略：把所有验证合并到一个 IIFE 里，与前面脚本在同一 lexical env 不可能（不同 script），
// 改用：在最后一段 code 里通过脚本链加载后再 evaluate。
// 实测：vm.runInContext 多次调用，每个 code 是新 script，const 是 script-local。
// 解决：把验证 code 拼到最后一个脚本末尾做不到（不动原文件）。改为：用 var 暴露？
// data.js 没 export。const 不可跨 script。

// 折中：在每个数据点用 try 取；变量名若 script-local 会 ReferenceError，记 FAIL。
function safe(name) {
  try { return vm.runInContext(name, sb); } catch (e) { return { __ref: e.message }; }
}
function isRef(v) { return v && typeof v === 'object' && '__ref' in v; }

console.log('\n=== 数据层验证 ===');
{
  const v = safe('ITEMS');
  check('ITEMS 存在', !isRef(v) && typeof v === 'object', !isRef(v) ? 'count=' + Object.keys(v).length : v.__ref);
}
{
  const v = safe('FISH');
  check('FISH 长度 === 13 (四季鱼种)', !isRef(v) && Array.isArray(v) && v.length === 13, !isRef(v) ? 'len=' + v.length : v.__ref);
}
{
  const v = safe('FISH_BY_SEASON');
  check('FISH_BY_SEASON 长度 === 4 (四季索引)', !isRef(v) && Array.isArray(v) && v.length === 4, !isRef(v) ? 'len=' + v.length : v.__ref);
}
{
  const v = safe('QUALITY');
  check('QUALITY 长度 === 4 (普通/银/金/铱)', !isRef(v) && Array.isArray(v) && v.length === 4, !isRef(v) ? 'len=' + v.length : v.__ref);
}
{
  const v = safe('ITEMS');
  if (!isRef(v) && v) {
    check('iridium_ore 铱矿石', !!v.iridium_ore);
    check('amethyst 紫水晶', !!v.amethyst);
    check('ruby 红宝石', !!v.ruby);
    check('torch 火把', !!v.torch);
  }
}
{
  const v = safe('drawTorch');
  check('drawTorch() 函数', !isRef(v) && typeof v === 'function');
}
{
  const v = safe('spawnRockFx');
  check('spawnRockFx() 粒子特效', !isRef(v) && typeof v === 'function');
}
{
  const v = safe('Game');
  check('Game const 已声明', !isRef(v) && typeof v === 'object');
  if (!isRef(v) && v) {
    check('Game.particles[]', Array.isArray(v.particles));
    check('Game.mining 字段 (长按挖矿)', 'mining' in v);
    check('Game.fishing 字段', 'fishing' in v);
    check('Game.inv.length === 36', v.inv && v.inv.length === 36);
  }
}

// 启动游戏流程
console.log('\n=== 启动流程验证 ===');
{
  const ok = safe('newGame(); (typeof Game.maps.farm === "object")');
  // 更简单：调 newGame 后取 Game.maps.farm
  try {
    vm.runInContext('cacheDom()', sb);  // 先建 dom 映射，否则 refreshInv 里 dom.hotbar undefined
    vm.runInContext('newGame()', sb);
    const farm = safe('Game.maps.farm');
    check('newGame() 后 Game.maps.farm 已创建', !isRef(farm) && typeof farm === 'object');
    const spawnForageCount = safe('Object.keys(Game.maps.farm.soil).length');
    check('农场地图含 soil/objs', !isRef(spawnForageCount));
    const npcs = safe('Game.npcs.length');
    check('NPC 数量 > 0', !isRef(npcs) && npcs > 0, 'npcs=' + npcs);
    const fishingOk = safe('typeof startFishing === "function"');
    check('startFishing 函数', !isRef(fishingOk) && fishingOk === true);
    const saveOk = safe('typeof saveGame === "function" && typeof loadGame === "function"');
    check('saveGame/loadGame 存档函数', !isRef(saveOk) && saveOk === true);
  } catch (e) {
    check('newGame() 执行', false, e.message);
  }
}

console.log('\n=== 地图统计 ===');
{
  const w = safe('Game.maps.farm.w');
  const h = safe('Game.maps.farm.h');
  check('农场地图尺寸', !isRef(w) && !isRef(h), w + ' x ' + h + ' 格 (原 64x52)');
  const stats = safe(`(()=>{
    let water=0, path=0, sand=0, trees=0, rocks=0, weeds=0;
    const m = Game.maps.farm;
    for (let i=0;i<m.ground.length;i++){
      const t = m.ground[i];
      if (t===2) water++; else if (t===1) path++; else if (t===3) sand++;
    }
    Object.keys(m.objs).forEach(function(k){
      const o = m.objs[k];
      if (o.type==='tree') trees++;
      else if (o.type==='rock') rocks++;
      else if (o.type==='weeds') weeds++;
    });
    return {water, path, sand, trees, rocks, weeds, bld: m.buildings.length, objs: Object.keys(m.objs).length};
  })()`);
  if (!isRef(stats)) {
    console.log('  水域 ' + stats.water + ' 格 | 道路 ' + stats.path + ' | 沙滩 ' + stats.sand);
    console.log('  树 ' + stats.trees + ' | 石 ' + stats.rocks + ' | 杂草 ' + stats.weeds);
    console.log('  建筑 ' + stats.bld + ' 座 | 物件总数 ' + stats.objs);
    check('水域存在(池塘+湖泊+河流)', stats.water > 200);
    check('树木数量充足', stats.trees > 500);
    check('建筑数量 >= 10', stats.bld >= 10);
    check('物件总数合理(<6000, 保证帧率)', stats.objs < 6000);
  } else check('地图统计', false, stats.__ref);
  const walkable = safe('(()=>{ const m=Game.maps.farm; return !isSolid(m, Math.floor(m.spawn.x/TILE), Math.floor(m.spawn.y/TILE)); })()');
  check('出生点可通行', !isRef(walkable) && walkable === true);
}

// 采集物扩展 + 滚轮缩放（2026-09-08 追加）
console.log('\n=== 采集物与缩放验证 ===');
{
  const f = safe(`(function(){
    const forms = ['mushroom','crystal','flower','berry','leaf','fern','nut','root'];
    let total = 0, bad = 0;
    for (const k of Object.keys(FORAGE)) FORAGE[k].forEach(function (it) {
      total++;
      if (!ITEMS[it.id] || forms.indexOf(it.form) < 0) bad++;
    });
    return { total: total, bad: bad };
  })()`);
  check('采集物 >= 30 种', !isRef(f) && f.total >= 30, '共 ' + f.total + ' 种');
  check('采集物全部注册 ITEMS 且外形受支持', !isRef(f) && f.bad === 0);

  const z = safe(`(function(){
    setZoom(1.5, 400, 300);
    for (let i = 0; i < 40; i++) updateZoom(0.05);
    const near = Math.abs(Game.zoom - 1.5) < 0.01;
    setZoom(0.1, 400, 300);
    for (let i = 0; i < 40; i++) updateZoom(0.05);
    const far = Math.abs(Game.zoom - ZOOM_MIN) < 0.001;
    const m = Game.maps.farm;
    const inX = Game.cam.x >= -2 && Game.cam.x <= m.w * TILE - Game.W / Game.zoom + 2;
    const inY = Game.cam.y >= -2 && Game.cam.y <= m.h * TILE - Game.H / Game.zoom + 2;
    const w = screenToWorld(400, 300);
    const map = Math.abs(w.x - (Game.cam.x + 400 / Game.zoom)) < 0.01;
    return { near: near, far: far, in: inX && inY, map: map };
  })()`);
  check('缩放上限 1.5 生效', !isRef(z) && z.near);
  check('缩放下限钳制在 ZOOM_MIN', !isRef(z) && z.far);
  check('缩放后相机仍在地图范围内', !isRef(z) && z.in);
  check('screenToWorld 缩放映射正确', !isRef(z) && z.map);
}

// 夜晚怪物系统（2026-09-08 追加）
console.log('\n=== 夜晚怪物验证 ===');
{
  const mo = safe(`(function(){
    const lootOk = ['slimegel','batwing','ectoplasm'].every(function (k) { return ITEMS[k] && ITEMS[k].sell > 0; });
    Game.time = 1200;   // 夜晚 20:00
    Game.map = Game.maps.farm;
    Game.monsters.length = 0;
    for (let i = 0; i < 20; i++) spawnMonster();
    let outside = true;
    Game.monsters.forEach(function (m2) {
      const tx = Math.floor(m2.x / TILE), ty = Math.floor(m2.y / TILE);
      if (tx >= FARM_FENCE.x0 && tx <= FARM_FENCE.x1 && ty >= FARM_FENCE.y0 && ty <= FARM_FENCE.y1) outside = false;
    });
    const nNight = Game.monsters.length;
    // 白天不出怪
    Game.monsters.length = 0; Game.time = 600;
    for (let i = 0; i < 10; i++) updateMonsters(0.1);
    const nDay = Game.monsters.length;
    // 接触伤害
    Game.time = 1200; Game.energy = 100;
    const m3 = { kind: 'slime', def: MONSTERS.slime, x: Game.player.x + 10, y: Game.player.y, hp: 3, vx: 0, vy: 0, dir: 'down', anim: 0, frame: 0, wait: 9, hitCd: 0, hurtT: 0, wob: 0 };
    Game.monsters.length = 0; Game.monsters.push(m3);
    updateMonsters(0.05);
    const dmgOk = Game.energy === 100 - MONSTERS.slime.dmg && m3.hitCd > 0;
    // 击杀掉落
    const m4 = { kind: 'bat', def: MONSTERS.bat, x: Game.player.x + TILE, y: Game.player.y, hp: 2, vx: 0, vy: 0, dir: 'down', anim: 0, frame: 0, wait: 9, hitCd: 0, hurtT: 0, wob: 0 };
    Game.monsters.length = 0; Game.monsters.push(m4);
    attackMonster(m4); if (m4.hp > 0) attackMonster(m4);
    const killOk = Game.monsters.indexOf(m4) < 0 && Game.inv.some(function (s) { return s && s.id === 'batwing'; });
    Game.monsters.length = 0;
    return { lootOk: lootOk, outside: outside, nNight: nNight, nDay: nDay, dmgOk: dmgOk, killOk: killOk };
  })()`);
  check('三种怪物与掉落物注册', !isRef(mo) && mo.lootOk);
  check('怪物只刷在围栏外', !isRef(mo) && mo.outside);
  check('夜间能生成怪物', !isRef(mo) && mo.nNight > 0, '生成 ' + mo.nNight + ' 只');
  check('白天不生成怪物', !isRef(mo) && mo.nDay === 0);
  check('接触伤害扣体力并进入冷却', !isRef(mo) && mo.dmgOk);
  check('点击攻击可击杀并掉落', !isRef(mo) && mo.killOk);
}

// 制作系统（2026-09-08 追加）
console.log('\n=== 制作系统验证 ===');
{
  const cr = safe(`(function(){
    const reg = RECIPES.every(function (r) { return ITEMS[r.out] && r.cost.every(function (c) { return ITEMS[c[0]]; }); });
    const shop = shopStock().some(function (s) { return s.id === 'workbench'; }) && ITEMS.workbench.buy === 250;
    Game.inv = new Array(36).fill(null);
    addItem('wood', 2); addItem('sap', 4);
    doCraft(0);
    const craft = countItem('wood') === 1 && countItem('sap') === 2 && countItem('torch') === 1;
    const placeOk = (function () {
      Game.inv = new Array(36).fill(null);
      addItem('workbench', 1); Game.sel = 0;
      const m = Game.map;
      const tx = Math.floor(Game.player.x / TILE) + 1, ty = Math.floor(Game.player.y / TILE);
      setObj(m, tx, ty, null);
      useAt(tx, ty);
      const o = getObj(m, tx, ty);
      return !!o && o.type === 'workbench' && countItem('workbench') === 0;
    })();
    Game.inv = new Array(36).fill(null);
    return { reg: reg, shop: shop, craft: craft, placeOk: placeOk };
  })()`);
  check('配方材料/产物全部注册', !isRef(cr) && cr.reg);
  check('工作台上架商店且价格 250', !isRef(cr) && cr.shop);
  check('制作消耗材料并产出物品', !isRef(cr) && cr.craft);
  check('手持工作台可放置到空地', !isRef(cr) && cr.placeOk);
}

console.log('\n=== 汇总 ===');
const okCount = results.filter(r => r.ok).length;
const failCount = results.length - okCount;
console.log('通过: ' + okCount + ' / ' + results.length + (failCount ? '  失败: ' + failCount : ''));
process.exit(failCount ? 1 : 0);