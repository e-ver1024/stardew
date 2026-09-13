/* =========================================================================
 *  world.js  ——  地图生成、地块与物件管理
 * ========================================================================= */
'use strict';

function key(x, y) { return x + ',' + y; }

function makeMap(id, w, h, base, type) {
  const m = {
    id: id, type: type || 'outdoor', w: w, h: h,
    ground: new Uint8Array(w * h),
    soil: {},      // "x,y" -> {wet:bool, crop:{id,days}}
    objs: {},      // "x,y" -> object
    buildings: [],
    spawn: { x: w * TILE / 2, y: h * TILE / 2 },
    cache: null
  };
  m.ground.fill(base);
  return m;
}

function tileAt(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.WALL;
  return m.ground[y * m.w + x];
}
function setTile(m, x, y, t) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return;
  m.ground[y * m.w + x] = t;
}
function getObj(m, x, y) { return m.objs[key(x, y)]; }
function setObj(m, x, y, o) {
  if (o) { o.x = x; o.y = y; m.objs[key(x, y)] = o; }
  else delete m.objs[key(x, y)];
}
function isSolid(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  if (SOLID_TILES.has(m.ground[y * m.w + x])) return true;
  const o = m.objs[key(x, y)];
  return !!(o && o.solid);
}

/* ---------- 生成辅助 ---------- */
function fillRect(m, x0, y0, x1, y1, t) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTile(m, x, y, t);
}
function pathH(m, x0, x1, y, t) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setTile(m, x, y, t);
}
function pathV(m, y0, y1, x, t) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) setTile(m, x, y, t);
}

function addBuilding(m, type, x, y, w, h, door, action) {
  const b = { type: type, x: x, y: y, w: w, h: h, door: door, action: action };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const isDoor = door && door.dx === i && door.dy === j;
      if (isDoor) {
        // 必须同时保留 action 引用：interact() 靠它识别「开商店」这类非传送门
        setObj(m, x + i, y + j, {
          type: 'door', solid: false,
          action: action || null,
          to: action ? action.to : null,
          spawn: action ? action.spawn : null,
          label: action ? action.label : null
        });
      } else {
        setObj(m, x + i, y + j, { type: 'wall', solid: true, b: b });
      }
    }
  }
  m.buildings.push(b);
  return b;
}

function treeAt(m, x, y, kind) {
  setObj(m, x, y, { type: 'tree', kind: kind || 'oak', solid: true, hp: 3, shake: 0 });
}
function rockAt(m, x, y, metal) {
  setObj(m, x, y, { type: 'rock', metal: metal || null, solid: true, hp: metal ? 3 : 2, shake: 0 });
}

/* =========================================================================
 *  农场大地图
 * ========================================================================= */
function createFarmMap() {
  const W = 96, H = 78;
  const m = makeMap('farm', W, H, T.GRASS, 'outdoor');

  /* --- 池塘（钓鱼点） --- */
  fillRect(m, 50, 26, 59, 35, T.WATER);
  for (let y = 25; y <= 36; y++) {
    for (let x = 49; x <= 60; x++) {
      const edge = (x === 49 || x === 60 || y === 25 || y === 36);
      const wob = hash2(x, y, 3) < 0.22;
      if (edge && !wob) setTile(m, x, y, T.SAND);
      if (!edge && hash2(x, y, 8) < 0.12) setTile(m, x, y, T.SAND);
    }
  }
  // 池塘外圈沙滩
  for (let y = 24; y <= 37; y++) for (let x = 48; x <= 61; x++) {
    if (tileAt(m, x, y) === T.GRASS && (hash2(x, y, 13) < 0.5)) setTile(m, x, y, T.SAND);
  }

  /* --- 东部湖泊（第二个钓鱼点，更大的湖） --- */
  fillRect(m, 76, 8, 89, 20, T.WATER);
  for (let y = 5; y <= 23; y++) {
    for (let x = 73; x <= 92; x++) {
      const edge = (x === 73 || x === 92 || y === 5 || y === 23);
      if (tileAt(m, x, y) === T.GRASS && (edge || hash2(x, y, 17) < 0.35)) setTile(m, x, y, T.SAND);
    }
  }

  /* --- 南部河流（横贯全图，可钓鱼；上架 3 座木桥） --- */
  function riverY(x) { return 73 + Math.round(Math.sin(x * 0.18) * 1.6); }
  for (let x = 4; x <= W - 5; x++) {
    const y = riverY(x);
    fillRect(m, x, y, x, y + 1, T.WATER);
    for (let k = -2; k <= 3; k++) {
      if (tileAt(m, x, y + k) === T.GRASS && hash2(x, y + k, 19) < 0.6) setTile(m, x, y + k, T.SAND);
    }
  }
  // 木桥：把河道段改成可通行的路
  [23, 55, 78].forEach(function (bx) {
    const by = riverY(bx);
    for (let k = -3; k <= 4; k++) setTile(m, bx, by + k, T.PATH);
  });

  /* --- 道路 --- */
  pathV(m, 39, 49, 23, T.PATH);          // 农场南门 → 小镇
  pathH(m, 12, 40, 49, T.PATH);          // 小镇主街
  pathV(m, 20, 25, 44, T.PATH);          // 商店 → 东路
  pathH(m, 44, 50, 21, T.PATH);          // 商店门前
  pathV(m, 20, 25, 47, T.PATH);          // 商店门口
  pathH(m, 41, 54, 25, T.PATH);          // 农场东门 → 东路
  pathV(m, 7, 25, 56, T.PATH);           // 矿洞 → 东路
  pathH(m, 50, 58, 23, T.PATH);          // 池塘边
  pathV(m, 24, 38, 41, T.PATH);          // 农场东门竖道

  /* --- 新道路：通往东部山区与南部新镇（纵向路直穿河流形成木桥） --- */
  pathH(m, 54, 74, 25, T.PATH);          // 东路向东延伸进东部森林
  pathV(m, 25, 60, 70, T.PATH);          // 东路 → 南部新镇
  pathH(m, 8, 88, 60, T.PATH);           // 南部新镇主街
  pathH(m, 20, 72, 8, T.PATH);           // 北部：矿洞 → 东部森林
  pathV(m, 8, 30, 70, T.PATH);           // 东部：南北连接
  pathV(m, 49, 76, 23, T.PATH);          // 老主街延伸 → 南岸（23 号桥）
  pathV(m, 60, 76, 55, T.PATH);          // 新镇 → 南岸（55 号桥）
  pathV(m, 60, 76, 78, T.PATH);          // 新镇 → 南岸（78 号桥）

  /* --- 农场围栏（留 3 个门） --- */
  const fx0 = 3, fy0 = 10, fx1 = 42, fy1 = 38;
  for (let x = fx0; x <= fx1; x++) {
    if (x === 23) continue; // 北门 / 南门
    if (!getObj(m, x, fy0)) setObj(m, x, fy0, { type: 'fence', solid: true });
    if (!getObj(m, x, fy1)) setObj(m, x, fy1, { type: 'fence', solid: true });
  }
  for (let y = fy0; y <= fy1; y++) {
    if (!getObj(m, fx0, y)) setObj(m, fx0, y, { type: 'fence', solid: true });
    if (y === 25) continue; // 东门：只跳过东侧，西侧围栏照常闭合
    if (!getObj(m, fx1, y)) setObj(m, fx1, y, { type: 'fence', solid: true });
  }
  pathV(m, 39, 40, 23, T.PATH);
  pathV(m, 6, 11, 23, T.PATH);   // 北门外：向北延伸到 y=6，接通北部横路
  pathH(m, 40, 42, 25, T.PATH);

  /* --- 建筑 --- */
  // 玩家家（8x6）门口 (33,19)
  addBuilding(m, 'house', 30, 14, 8, 6, { dx: 3, dy: 5 },
    { to: 'house', spawn: { x: 7 * TILE + 16, y: 6 * TILE + 20 }, label: '回家' });
  fillRect(m, 29, 20, 38, 21, T.STONE);
  // 出货箱
  setObj(m, 27, 21, { type: 'bin', solid: true, w: 2 });
  setObj(m, 28, 21, { type: 'bin2', solid: true });
  // 商店（7x5）门口 (47,19)
  addBuilding(m, 'shop', 44, 15, 7, 5, { dx: 3, dy: 4 },
    { to: 'shop', label: '进入皮埃尔杂货铺' });
  fillRect(m, 46, 20, 49, 21, T.STONE);
  // 矿洞（4x3）洞口 (55,6)
  addBuilding(m, 'cave', 54, 4, 4, 3, { dx: 1, dy: 2 },
    { to: 'mine', spawn: { x: 3 * TILE + 16, y: 3 * TILE + 16 }, label: '进入矿洞' });
  // 小镇民居（装饰）
  addBuilding(m, 'townhouse', 11, 42, 6, 5, null, null);
  addBuilding(m, 'townhouse', 30, 42, 6, 5, null, null);

  /* --- 南部新镇（鹈鹕镇扩展区，主街 y=60 两侧） --- */
  addBuilding(m, 'townhouse', 14, 55, 7, 5, null, null);   // 诊所
  addBuilding(m, 'townhouse', 30, 55, 7, 5, null, null);   // 星之果实餐吧
  addBuilding(m, 'shop', 52, 55, 8, 5, null, null);        // 博物馆（商店外观）
  addBuilding(m, 'townhouse', 10, 66, 6, 5, null, null);
  addBuilding(m, 'townhouse', 28, 66, 6, 5, null, null);
  addBuilding(m, 'townhouse', 62, 62, 6, 5, null, null);
  addBuilding(m, 'townhouse', 76, 50, 6, 5, null, null);
  addBuilding(m, 'townhouse', 82, 63, 6, 5, null, null);

  /* --- 装饰用地块 --- */
  fillRect(m, 12, 26, 20, 32, T.GRASS); // 农田预留区

  /* --- 树木 / 石头 / 杂草 --- */
  const blocked = function (x, y) {
    const t = tileAt(m, x, y);
    if (t === T.WATER || t === T.PATH || t === T.STONE) return true;
    if (getObj(m, x, y)) return true;
    // 建筑门口前方留空
    if (x >= 30 && x <= 37 && y >= 19 && y <= 22) return true;
    if (x >= 44 && x <= 50 && y >= 19 && y <= 22) return true;
    if (x >= 54 && x <= 57 && y >= 7 && y <= 10) return true;
    if (x >= 25 && x <= 30 && y >= 19 && y <= 23) return true;
    return false;
  };

  // 森林（右上）密林
  for (let y = 1; y <= 14; y++) for (let x = 43; x <= 63; x++) {
    if (blocked(x, y)) continue;
    const r = hash2(x, y, 101);
    if (r < 0.30) treeAt(m, x, y, hash2(x, y, 7) < 0.3 ? 'pine' : 'oak');
  }
  // 矿区附近
  for (let y = 15; y <= 23; y++) for (let x = 51; x <= 63; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 103) < 0.10) treeAt(m, x, y, 'oak');
  }
  // 左侧荒地（农场围栏以西）
  for (let y = 8; y <= 44; y++) for (let x = 0; x < fx0; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 107) < 0.22) treeAt(m, x, y, hash2(x, y, 11) < 0.4 ? 'pine' : 'oak');
  }
  // 小镇周围
  for (let y = 38; y <= 51; y++) for (let x = 0; x <= 63; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 109) < 0.07) treeAt(m, x, y, 'oak');
    if (hash2(x, y, 111) < 0.03) rockAt(m, x, y);
  }
  /* --- 东部大森林 + 山区（新增区域：密林、多石；矿脉只保留在矿洞） --- */
  for (let y = 1; y <= H - 2; y++) {
    for (let x = 64; x <= W - 2; x++) {
      if (blocked(x, y)) continue;
      const r = hash2(x, y, 139);
      if (r < 0.30) treeAt(m, x, y, hash2(x, y, 23) < 0.45 ? 'pine' : 'oak');
      else if (r < 0.395) rockAt(m, x, y);
    }
  }
  /* --- 南部新区（新镇南侧、河岸以北）稀疏植被 --- */
  for (let y = 52; y <= 70; y++) {
    for (let x = 0; x <= W - 2; x++) {
      if (blocked(x, y)) continue;
      if (hash2(x, y, 149) < 0.09) treeAt(m, x, y, 'oak');
      if (hash2(x, y, 151) < 0.035) rockAt(m, x, y);
    }
  }
  // 全局稀疏石头
  for (let y = 1; y <= H - 2; y++) for (let x = 0; x <= W - 2; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 113) < 0.025) rockAt(m, x, y);
    else if (hash2(x, y, 127) < 0.02) setObj(m, x, y, { type: 'branch', solid: false });
  }
  // 杂草（农场内更密）
  for (let y = 1; y <= H - 2; y++) for (let x = 0; x <= W - 2; x++) {
    if (blocked(x, y)) continue;
    const inFarm = x > fx0 && x < fx1 && y > fy0 && y < fy1;
    const chance = inFarm ? 0.18 : 0.10;
    if (hash2(x, y, 131) < chance) setObj(m, x, y, { type: 'weeds', solid: false });
  }
  // 农场内零星树桩
  for (let y = fy0 + 1; y < fy1; y++) for (let x = fx0 + 1; x < fx1; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 137) < 0.012) setObj(m, x, y, { type: 'tree', kind: 'stump', solid: true, hp: 1, shake: 0 });
  }
  // 农场内散落树木（原版开局农场就有零星树要砍）
  for (let y = fy0 + 1; y < fy1; y++) for (let x = fx0 + 1; x < fx1; x++) {
    if (blocked(x, y)) continue;
    if (hash2(x, y, 157) < 0.035) treeAt(m, x, y, 'oak');
  }

  m.spawn = { x: 33 * TILE + 16, y: 22 * TILE + 20 };
  return m;
}

/* =========================================================================
 *  房屋内景
 * ========================================================================= */
function createHouseMap() {
  const W = 14, H = 10;
  const m = makeMap('house', W, H, T.WOOD, 'house');
  for (let x = 0; x < W; x++) { setTile(m, x, 0, T.WALL); setTile(m, x, H - 1, T.WALL); }
  for (let y = 0; y < H; y++) { setTile(m, 0, y, T.WALL); setTile(m, W - 1, y, T.WALL); }
  fillRect(m, 4, 3, 7, 5, T.CARPET);
  // 床（可睡觉）
  setObj(m, 1, 1, { type: 'bed', solid: true, w: 2 });
  setObj(m, 2, 1, { type: 'bed2', solid: true });
  // 出口
  setObj(m, 7, H - 1, { type: 'door', solid: false, to: 'farm', spawn: { x: 33 * TILE + 16, y: 21 * TILE + 24 }, label: '出门' });
  // 家具（装饰）
  setObj(m, 10, 1, { type: 'table', solid: true });
  setObj(m, 10, 6, { type: 'plant', solid: true });
  m.spawn = { x: 7 * TILE + 16, y: 6 * TILE + 20 };
  return m;
}

/* =========================================================================
 *  矿洞（每层随机）
 * ========================================================================= */
function createMineMap(level) {
  const W = 26, H = 20;
  const m = makeMap('mine', W, H, T.MINE, 'mine');
  for (let x = 0; x < W; x++) { setTile(m, x, 0, T.WALL); setTile(m, x, H - 1, T.WALL); }
  for (let y = 0; y < H; y++) { setTile(m, 0, y, T.WALL); setTile(m, W - 1, y, T.WALL); }
  const sx = 3, sy = 3;
  // 矿石随深度递进：1-2铜 / 3-4铜铁 / 5-7铁金 / 8+金银铱
  const METAL_TABLE = [
    [['copper', 1.0]],
    [['copper', 0.55], ['iron', 0.45]],
    [['iron', 0.55], ['gold', 0.45]],
    [['iron', 0.35], ['gold', 0.35], ['iridium', 0.30]]
  ];
  function pickMetal(x, y) {
    const idx = level <= 2 ? 0 : level <= 4 ? 1 : level <= 7 ? 2 : 3;
    let r = Math.random();
    for (let i = 0; i < METAL_TABLE[idx].length; i++) {
      if (r < METAL_TABLE[idx][i][1]) return METAL_TABLE[idx][i][0];
      r -= METAL_TABLE[idx][i][1];
    }
    return METAL_TABLE[idx][0][0];
  }
  function pickGem(x, y) {
    return Math.random() < 0.5 ? 'amethyst' : 'ruby';
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (x < sx + 3 && y < sy + 3) continue; // 出生点留空
      const r = Math.random();
      if (r < 0.055) rockAt(m, x, y, pickMetal(x, y));
      else if (r < 0.075) rockAt(m, x, y, 'coal');
      else if (r < 0.20) rockAt(m, x, y, null);
      else if (r < 0.205) rockAt(m, x, y, pickGem(x, y)); // 稀有宝石矿脉
    }
  }
  // 下一层梯子（每次进入随机位置）
  let lx = W - 4, ly = H - 4;
  for (let tries = 0; tries < 60; tries++) {
    const tx = 2 + Math.floor(Math.random() * (W - 4));
    const ty = 2 + Math.floor(Math.random() * (H - 4));
    if (!isSolid(m, tx, ty) && (Math.abs(tx - sx) + Math.abs(ty - sy)) > 8) { lx = tx; ly = ty; break; }
  }
  setObj(m, lx, ly, { type: 'stairs', solid: false, down: true });
  // 出口梯子
  setObj(m, sx, sy, { type: 'leave', solid: false, to: 'farm', spawn: { x: 55 * TILE + 16, y: 8 * TILE + 10 }, label: '离开矿洞' });
  m.spawn = { x: sx * TILE + 16, y: (sy + 1) * TILE + 16 };
  m.level = level;
  return m;
}

/* =========================================================================
 *  地面缓存（提升渲染性能）
 * ========================================================================= */
function buildGroundCache(m, season) {
  const c = makeCanvas(m.w * TILE, m.h * TILE);
  const ctx = c.getContext('2d');
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      drawGroundTile(ctx, x * TILE, y * TILE, m.ground[y * m.w + x], x, y, season, m.type);
    }
  }
  m.cache = c;
  m.cacheSeason = season;
  return c;
}

/* =========================================================================
 *  每日刷新：野外采集物
 * ========================================================================= */
function spawnForage(m, season, count) {
  const list = FORAGE[season];
  if (!list || !list.length) return;
  // 权重表：稀有品种权重低（如紫蘑菇 5、雪山药 8）
  let total = 0;
  for (let i = 0; i < list.length; i++) total += (list[i].w || 10);
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 60) {
    const x = 1 + Math.floor(Math.random() * (m.w - 2));
    const y = 1 + Math.floor(Math.random() * (m.h - 2));
    const t = tileAt(m, x, y);
    if (t !== T.GRASS && t !== T.SAND) continue;   // 草地和沙滩都会长
    if (getObj(m, x, y)) continue;
    if (m.soil[key(x, y)]) continue;
    let r = Math.random() * total, pick = list[list.length - 1];
    for (let i = 0; i < list.length; i++) {
      r -= (list[i].w || 10);
      if (r <= 0) { pick = list[i]; break; }
    }
    setObj(m, x, y, { type: 'forage', solid: false, item: pick.id });
    placed++;
  }
}

/* 清理上一季留下的采集物 */
function clearForage(m) {
  Object.keys(m.objs).forEach(function (k) {
    if (m.objs[k].type === 'forage') delete m.objs[k];
  });
}

/* 清理过期作物（换季） */
function clearDeadCrops(m, season) {
  Object.keys(m.soil).forEach(function (k) {
    const s = m.soil[k];
    if (s.crop && CROPS[s.crop.id] && CROPS[s.crop.id].season !== season) delete m.soil[k];
  });
}
