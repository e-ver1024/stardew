/* =========================================================================
 *  draw.js  ——  全部美术资源都用 Canvas 程序化绘制（无任何外部图片）
 * ========================================================================= */
'use strict';

/* ---------- 确定性伪随机 ---------- */
function hash2(x, y, salt) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (salt | 0) * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* =========================================================================
 *  地块绘制
 * ========================================================================= */
function drawGroundTile(ctx, px, py, type, tx, ty, season, mapType) {
  const inside = mapType === 'house';
  switch (type) {
    case T.GRASS: {
      const p = GRASS_PALETTE[season];
      ctx.fillStyle = p.base;
      ctx.fillRect(px, py, TILE, TILE);
      // 斑块
      for (let i = 0; i < 5; i++) {
        const r1 = hash2(tx * 8 + i, ty * 8, 11);
        const r2 = hash2(tx * 8 + i, ty * 8, 23);
        const r3 = hash2(tx * 8 + i, ty * 8, 37);
        if (r3 < 0.5) continue;
        ctx.fillStyle = r3 < 0.8 ? p.dark : p.light;
        const w = 4 + r1 * 8, h = 3 + r2 * 6;
        ctx.fillRect(px + r1 * (TILE - w), py + r2 * (TILE - h), w, h);
      }
      // 草叶
      ctx.strokeStyle = p.blade;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const r1 = hash2(tx, ty * 4 + i, 51);
        const r2 = hash2(tx * 4 + i, ty, 67);
        if (r1 < 0.45) continue;
        const bx = px + 2 + r1 * (TILE - 4);
        const by = py + 4 + r2 * (TILE - 8);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (r2 > 0.5 ? 2 : -2), by - 4);
        ctx.stroke();
      }
      break;
    }
    case T.PATH: {
      ctx.fillStyle = '#c49a63';
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 8; i++) {
        const r1 = hash2(tx * 3 + i, ty * 3, 13);
        const r2 = hash2(tx * 3, ty * 3 + i, 29);
        ctx.fillStyle = r1 > 0.5 ? '#b98c55' : '#d0a972';
        ctx.fillRect(px + r1 * 28, py + r2 * 28, 3 + r1 * 3, 2 + r2 * 3);
      }
      break;
    }
    case T.WATER: {
      ctx.fillStyle = mapType === 'mine' ? '#1d3b57' : '#3d86c6';
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 3; i++) {
        const r1 = hash2(tx + i, ty, 91);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(px + r1 * 26, py + i * 11, 10 + r1 * 8, 3);
      }
      break;
    }
    case T.SAND: {
      ctx.fillStyle = '#e3d3a0';
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 6; i++) {
        const r1 = hash2(tx * 5 + i, ty * 5, 17);
        const r2 = hash2(tx * 5, ty * 5 + i, 19);
        ctx.fillStyle = r1 > 0.5 ? '#d7c58e' : '#efdfae';
        ctx.fillRect(px + r1 * 28, py + r2 * 28, 3, 2);
      }
      break;
    }
    case T.WOOD: {
      ctx.fillStyle = inside ? '#a9763f' : '#b8813f';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(px, py + 15, TILE, 2);
      ctx.fillRect(px, py + 31, TILE, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(px, py + 2, TILE, 2);
      break;
    }
    case T.STONE: {
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = '#82888e';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(px + 2, py + 2, TILE - 6, 3);
      break;
    }
    case T.BRICK: {
      ctx.fillStyle = '#8d6a63';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let r = 0; r < 2; r++) {
        ctx.fillRect(px, py + r * 16 + 15, TILE, 1);
        ctx.fillRect(px + (r % 2 ? 8 : 20), py + r * 16, 1, 16);
      }
      break;
    }
    case T.CARPET: {
      ctx.fillStyle = '#8a4a55';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      break;
    }
    case T.MINE: {
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 6; i++) {
        const r1 = hash2(tx * 7 + i, ty * 7, 41);
        const r2 = hash2(tx * 7, ty * 7 + i, 43);
        ctx.fillStyle = r1 > 0.6 ? '#5c4d3e' : '#77664f';
        ctx.fillRect(px + r1 * 28, py + r2 * 28, 4 + r1 * 4, 3 + r2 * 3);
      }
      break;
    }
    case T.WALL: {
      if (inside) {
        ctx.fillStyle = '#c8b191';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#a68a68';
        ctx.fillRect(px, py + 20, TILE, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px, py, TILE, 4);
      } else {
        ctx.fillStyle = '#4a4453';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#3b3644';
        for (let i = 0; i < 4; i++) {
          const r1 = hash2(tx * 9 + i, ty * 9, 71);
          const r2 = hash2(tx * 9, ty * 9 + i, 73);
          ctx.fillRect(px + r1 * 26, py + r2 * 26, 6 + r1 * 6, 5 + r2 * 5);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(px + 2, py + 2, TILE - 4, 3);
      }
      break;
    }
    default:
      ctx.fillStyle = '#333';
      ctx.fillRect(px, py, TILE, TILE);
  }
}

/* 水面动态波纹 */
function drawWaterAnim(ctx, px, py, t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const off = Math.sin(t * 1.6 + px * 0.05 + i * 2.1) * 3;
    const y = py + 9 + i * 13 + off;
    ctx.beginPath();
    ctx.moveTo(px + 5, y);
    ctx.lineTo(px + 13, y - 2);
    ctx.lineTo(px + 21, y + 1);
    ctx.lineTo(px + 27, y - 1);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- 耕地 / 浇水后的土地 ---------- */
function drawTilled(ctx, px, py, wet, tx, ty) {
  ctx.fillStyle = wet ? '#5b3d24' : '#8a5f38';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = wet ? '#4a301b' : '#754f2d';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + 3, py + 5 + i * 10, TILE - 6, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(px + 3, py + 3, TILE - 6, 2);
  if (wet) {
    ctx.fillStyle = 'rgba(90,150,220,0.20)';
    ctx.fillRect(px, py, TILE, TILE);
  }
  // 边角随机土块
  for (let i = 0; i < 3; i++) {
    const r1 = hash2(tx + i, ty, 97);
    const r2 = hash2(tx, ty + i, 101);
    ctx.fillStyle = wet ? '#6b4a2c' : '#9a6c40';
    ctx.fillRect(px + 2 + r1 * 26, py + 2 + r2 * 26, 3, 3);
  }
}

/* =========================================================================
 *  作物绘制
 * ========================================================================= */
function drawCropPlant(ctx, px, py, id, stage, days, mature, t) {
  const def = CROPS[id];
  if (!def) return;
  // 花卉成熟后随风轻摆：用格子坐标做相位差，整片花田会有波浪感
  const sway = (mature && def.shape === 'bloom')
    ? Math.sin((t || 0) / 680 + (px + py) * 0.045) * 1.8 : 0;
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE);
  if (stage === 0) {
    ctx.fillStyle = '#6fbf4a';
    ctx.fillRect(-1, -6, 2, 6);
    ctx.fillStyle = '#8ad35e';
    ctx.beginPath(); ctx.ellipse(-3, -6, 3, 2, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -7, 3, 2, 0.5, 0, 7); ctx.fill();
  } else if (stage === 1) {
    ctx.fillStyle = '#5da83c';
    ctx.fillRect(-1.5, -12, 3, 12);
    ctx.fillStyle = '#79c74d';
    ctx.beginPath(); ctx.ellipse(-5, -10, 4, 3, -0.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -12, 4, 3, 0.6, 0, 7); ctx.fill();
  } else if (stage === 2) {
    ctx.fillStyle = '#4f9c34';
    ctx.fillRect(-2, -18, 4, 18);
    ctx.fillStyle = '#6cbb45';
    ctx.beginPath(); ctx.ellipse(-7, -14, 6, 4, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -16, 6, 4, 0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -20, 5, 4, 0, 0, 7); ctx.fill();
  } else {
    // 成熟
    ctx.fillStyle = '#4f9c34';
    ctx.fillRect(-2, -18, 4, 18);
    ctx.fillStyle = '#6cbb45';
    ctx.beginPath(); ctx.ellipse(-7, -14, 6, 4, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -16, 6, 4, 0.5, 0, 7); ctx.fill();
    if (!mature) {
      ctx.fillStyle = '#6cbb45';
      ctx.beginPath(); ctx.ellipse(0, -20, 5, 4, 0, 0, 7); ctx.fill();
    } else {
      const n = def.shape === 'melon' ? 1 : (def.shape === 'grain' ? 3 : 2);
      // 花卉挺立在枝头，比一般果实高一些
      const baseY = def.shape === 'bloom' ? -27 : -20;
      for (let i = 0; i < n; i++) {
        const ox = n === 1 ? 0 : (i === 0 ? -5 : 5);
        const tilt = sway * (i === 0 ? 1 : 0.7);
        ctx.save();
        ctx.translate(ox + tilt, 0);
        ctx.rotate(sway * 0.012);
        drawCropIcon(ctx, -7, baseY - (i % 2) * 3, 14, def.color, def.shape);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/* =========================================================================
 *  场景物件
 * ========================================================================= */
function drawTree(ctx, px, py, o, season) {
  const pal = TREE_PALETTE[season];
  const shake = o.shake > 0 ? Math.sin(o.shake * 40) * 2 : 0;
  ctx.save();
  ctx.translate(px + TILE / 2 + shake, py + TILE);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0, -2, 13, 5, 0, 0, 7); ctx.fill();
  if (o.kind === 'stump') {
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(-8, -12, 16, 12);
    ctx.fillStyle = '#8a6238';
    ctx.beginPath(); ctx.ellipse(0, -12, 8, 3.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3c22';
    ctx.beginPath(); ctx.ellipse(0, -12, 4, 2, 0, 0, 7); ctx.fill();
    ctx.restore();
    return;
  }
  // 树干
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(-5, -34, 10, 34);
  ctx.fillStyle = '#7d5730';
  ctx.fillRect(-5, -34, 3, 34);
  // 树冠
  const layers = o.kind === 'pine' ? 3 : 4;
  if (o.kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const w = 20 - i * 5, y = -34 - i * 11 + 4;
      ctx.fillStyle = i % 2 ? pal.leaf2 : pal.leaf;
      ctx.beginPath();
      ctx.moveTo(0, y - 16); ctx.lineTo(w, y + 4); ctx.lineTo(-w, y + 4);
      ctx.closePath(); ctx.fill();
    }
  } else {
    const blobs = [
      [0, -44, 15], [-11, -38, 11], [11, -38, 11], [-6, -52, 10], [7, -52, 10]
    ];
    for (let i = 0; i < layers + 1 && i < blobs.length; i++) {
      const b = blobs[i];
      ctx.fillStyle = i % 2 ? pal.leaf2 : pal.leaf;
      ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 7); ctx.fill();
    }
    if (season === 0) { // 春天花点
      ctx.fillStyle = 'rgba(255,220,235,0.75)';
      for (let i = 0; i < 5; i++) {
        const rx = hash2(o.x * 3 + i, o.y, 5) * 26 - 13;
        const ry = -56 + hash2(o.x, o.y + i, 7) * 26;
        ctx.fillRect(rx, ry, 2, 2);
      }
    }
    if (season === 2) { // 秋天落叶点
      ctx.fillStyle = 'rgba(220,120,40,0.6)';
      for (let i = 0; i < 4; i++) {
        const rx = hash2(o.x + i, o.y * 2, 9) * 24 - 12;
        const ry = -54 + hash2(o.x * 2, o.y + i, 3) * 24;
        ctx.fillRect(rx, ry, 2, 2);
      }
    }
  }
  ctx.restore();
}

function drawRock(ctx, px, py, o) {
  const shake = o.shake > 0 ? Math.sin(o.shake * 40) * 2 : 0;
  ctx.save();
  ctx.translate(px + TILE / 2 + shake, py + TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, -2, 12, 4.5, 0, 0, 7); ctx.fill();
  if (o.metal) {
    // 矿脉：石身 + 矿点
    ctx.fillStyle = '#8d8f96';
    ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(-9, -12); ctx.lineTo(0, -17);
    ctx.lineTo(9, -12); ctx.lineTo(11, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a9abb2';
    ctx.beginPath();
    ctx.moveTo(-9, -12); ctx.lineTo(0, -17); ctx.lineTo(3, -8); ctx.lineTo(-4, -5);
    ctx.closePath(); ctx.fill();
    const tint = { copper: '#c87137', iron: '#c9ccd4', gold: '#e8c33a', coal: '#2f2f33', iridium: '#b388ff', amethyst: '#b56cd6', ruby: '#e0455a' }[o.metal] || '#c87137';
    ctx.fillStyle = tint;
    const pts = [[-4, -11], [4, -10], [0, -5]];
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(-3.5, -11.8, 1.2, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#8b8f94';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(-10, -9); ctx.lineTo(-2, -14);
    ctx.lineTo(7, -12); ctx.lineTo(12, -3); ctx.lineTo(9, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a4a8ad';
    ctx.beginPath();
    ctx.moveTo(-10, -9); ctx.lineTo(-2, -14); ctx.lineTo(2, -8); ctx.lineTo(-6, -5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6f737a';
    ctx.beginPath();
    ctx.moveTo(2, -8); ctx.lineTo(7, -12); ctx.lineTo(12, -3); ctx.lineTo(9, 0); ctx.lineTo(6, 0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawWeeds(ctx, px, py, o, season) {
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE);
  const c = season === 3 ? '#9aa79c' : (season === 2 ? '#a08b48' : '#6faa44');
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const r1 = hash2(o.x * 5 + i, o.y, 55);
    const bx = (r1 - 0.5) * 20;
    const h = 8 + hash2(o.x, o.y * 5 + i, 57) * 10;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + (r1 - 0.5) * 8, -h * 0.6, bx + (r1 - 0.5) * 16, -h);
    ctx.stroke();
  }
  ctx.restore();
}

/* 火把（放置版）：木柄 + 火焰 */
function drawTorch(ctx, px, py, t) {
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE - 2);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, 7); ctx.fill();
  // 木柄
  ctx.fillStyle = '#6a4426';
  ctx.fillRect(-2, -16, 4, 16);
  ctx.fillStyle = '#8a5c33';
  ctx.fillRect(-2, -16, 1.5, 16);
  // 缠绕绳
  ctx.fillStyle = '#a8763f';
  ctx.fillRect(-2, -8, 4, 2);
  // 火焰（随 t 跳动）
  const fl = Math.sin(t * 13) * 0.7 + Math.sin(t * 27 + 1) * 0.5;
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.ellipse(0, -18 - fl * 0.5, 3.6 + fl * 0.4, 6 + fl * 0.8, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath();
  ctx.ellipse(0, -17 - fl * 0.5, 2.1, 3.8 + fl * 0.4, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.ellipse(0, -18 - fl * 0.5, 0.9, 1.8, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

function drawBranch(ctx, px, py) {
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, -2, 12, 4, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(6, -5); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(9, -10); ctx.stroke();
  ctx.restore();
}

function drawForage(ctx, px, py, item) {
  ctx.save();
  ctx.translate(px + TILE / 2, py + TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, -2, 7, 3, 0, 0, 7); ctx.fill();
  const it = ITEMS[item] || {};
  const col = it.color || '#8fc46b';
  const form = it.form || 'root';

  if (form === 'mushroom') {
    ctx.fillStyle = '#e8d9b8'; ctx.fillRect(-2, -10, 4, 10);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -10, 8, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-4, -12, 2, 2); ctx.fillRect(2, -13, 2, 2);
  } else if (form === 'crystal') {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(6, -8); ctx.lineTo(3, -1); ctx.lineTo(-3, -1); ctx.lineTo(-6, -8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(3, -8); ctx.lineTo(0, -1); ctx.lineTo(-2, -8);
    ctx.closePath(); ctx.fill();
  } else if (form === 'flower') {
    ctx.strokeStyle = '#5da83c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(5, -8, 5, -12); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 4.5, -15 + Math.sin(a) * 4.5, 3.4, 3.4, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath(); ctx.arc(0, -15, 2.6, 0, 7); ctx.fill();
  } else if (form === 'berry') {
    ctx.strokeStyle = '#4f7a34'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -9); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(-4, -8, 3.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(4.5, -9.5, 3.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0.5, -14, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(-1.2, -9.4, 1.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-4.8, -9.2, 1, 0, 7); ctx.fill();
  } else if (form === 'leaf') {
    ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-3, -16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(2, -17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(6, -13); ctx.stroke();
  } else if (form === 'fern') {
    ctx.strokeStyle = '#5f9a3c'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -13); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(6, -14, 4, -8);
    ctx.quadraticCurveTo(2, -5, 0, -6);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, -13, 2, 0, 7); ctx.fill();
  } else if (form === 'nut') {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -8, 5.5, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6f4a24';
    ctx.beginPath(); ctx.ellipse(0, -13, 4, 2.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-2, -10, 1.6, 2.2, -0.4, 0, 7); ctx.fill();
  } else {
    // root 根茎类（野山葵 / 冬根 / 雪山药）
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4f8a34'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -16); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-2, -12, 2, 3, -0.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawFence(ctx, px, py, o) {
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(2, 26, 28, 5);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(6, 8, 5, 22);
  ctx.fillRect(21, 8, 5, 22);
  ctx.fillStyle = '#a2763f';
  ctx.fillRect(2, 12, 28, 4);
  ctx.fillRect(2, 20, 28, 4);
  ctx.fillStyle = '#7a5330';
  ctx.fillRect(6, 8, 5, 2);
  ctx.fillRect(21, 8, 5, 2);
  ctx.restore();
}

function drawBin(ctx, px, py) {
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(2, 28, 60, 5);
  ctx.fillStyle = '#7a5330';
  ctx.fillRect(2, 12, 60, 18);
  ctx.fillStyle = '#8f6238';
  ctx.fillRect(2, 12, 60, 4);
  ctx.fillStyle = '#5e3f24';
  ctx.fillRect(2, 8, 60, 6);
  ctx.fillStyle = '#a67a44';
  ctx.fillRect(6, 14, 12, 14);
  ctx.fillRect(24, 14, 16, 14);
  ctx.fillRect(46, 14, 12, 14);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(26, 18, 12, 6);
  ctx.restore();
}

function drawBed(ctx, px, py) {
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(0, 6, 64, 26);
  ctx.fillStyle = '#c9d6e8';
  ctx.fillRect(2, 8, 60, 12);
  ctx.fillStyle = '#eef3fa';
  ctx.fillRect(2, 12, 60, 5);
  ctx.fillStyle = '#9aa8bd';
  ctx.fillRect(2, 20, 60, 10);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(0, 2, 6, 30);
  ctx.restore();
}

function drawStairs(ctx, px, py, up) {
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(2, 4, 28, 28);
  for (let i = 0; i < 5; i++) {
    const v = 40 + (up ? (4 - i) : i) * 14;
    ctx.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 12) + ')';
    ctx.fillRect(3, 26 - i * 5, 26, 5);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(3, 26 - (up ? 0 : 4) * 5, 26, 3);
  ctx.restore();
}

/* =========================================================================
 *  建筑
 * ========================================================================= */
function drawHouseBuilding(ctx, px, py, w, h, door) {
  const W = w * TILE, H = h * TILE;
  ctx.save();
  ctx.translate(px, py);
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(4, H - 12, W - 8, 12);
  // 墙体
  ctx.fillStyle = '#e0cba4';
  ctx.fillRect(0, H * 0.35, W, H * 0.65);
  ctx.fillStyle = '#d3bc92';
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, H * 0.35, 1, H * 0.65);
  // 屋顶
  ctx.fillStyle = '#a8452f';
  ctx.beginPath();
  ctx.moveTo(-6, H * 0.38); ctx.lineTo(W * 0.5, -10); ctx.lineTo(W + 6, H * 0.38);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#973a26';
  ctx.beginPath();
  ctx.moveTo(W * 0.5, -10); ctx.lineTo(W + 6, H * 0.38); ctx.lineTo(W * 0.5, H * 0.38);
  ctx.closePath(); ctx.fill();
  // 屋脊高光
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, H * 0.36, W, 3);
  // 窗户
  drawWindow(ctx, W * 0.18, H * 0.48);
  drawWindow(ctx, W * 0.68, H * 0.48);
  // 门
  if (door) {
    const dx = door.dx * TILE, dy = door.dy * TILE;
    ctx.fillStyle = '#6a4426';
    ctx.fillRect(dx + 2, dy + 2, TILE - 4, TILE - 2);
    ctx.fillStyle = '#8a5c33';
    ctx.fillRect(dx + 4, dy + 5, TILE - 8, TILE - 6);
    ctx.fillStyle = '#e8c96a';
    ctx.beginPath(); ctx.arc(dx + TILE - 9, dy + TILE / 2, 2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawWindow(ctx, x, y) {
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x - 2, y - 2, 28, 26);
  ctx.fillStyle = '#8fc9e8';
  ctx.fillRect(x, y, 24, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(x + 2, y + 2, 9, 8);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(x + 11, y, 2, 22);
  ctx.fillRect(x, y + 10, 24, 2);
}

function drawShopBuilding(ctx, px, py, w, h, door) {
  const W = w * TILE, H = h * TILE;
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(4, H - 12, W - 8, 12);
  ctx.fillStyle = '#f0e2c0';
  ctx.fillRect(0, H * 0.32, W, H * 0.68);
  ctx.fillStyle = '#e2d0a8';
  for (let x = 0; x < W; x += 16) ctx.fillRect(x, H * 0.32, 1, H * 0.68);
  // 屋顶
  ctx.fillStyle = '#3f7fa8';
  ctx.beginPath();
  ctx.moveTo(-6, H * 0.35); ctx.lineTo(W * 0.5, -8); ctx.lineTo(W + 6, H * 0.35);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#356f92';
  ctx.beginPath();
  ctx.moveTo(W * 0.5, -8); ctx.lineTo(W + 6, H * 0.35); ctx.lineTo(W * 0.5, H * 0.35);
  ctx.closePath(); ctx.fill();
  // 遮阳条纹
  ctx.fillStyle = '#e8e2d0';
  ctx.fillRect(0, H * 0.30, W, 8);
  ctx.fillStyle = '#c0483f';
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, H * 0.30, 12, 8);
  // 招牌
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(W * 0.22, H * 0.42, W * 0.56, 24);
  ctx.fillStyle = '#f5e6c0';
  ctx.font = 'bold 15px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('皮埃尔杂货铺', W * 0.5, H * 0.42 + 13);
  // 窗
  drawWindow(ctx, W * 0.08, H * 0.62);
  drawWindow(ctx, W * 0.74, H * 0.62);
  if (door) {
    const dx = door.dx * TILE, dy = door.dy * TILE;
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(dx + 2, dy + 2, TILE - 4, TILE - 2);
    ctx.fillStyle = '#7a5228';
    ctx.fillRect(dx + 4, dy + 5, TILE - 8, TILE - 6);
    ctx.fillStyle = '#8fc9e8';
    ctx.fillRect(dx + 7, dy + 8, TILE - 14, 8);
  }
  ctx.restore();
}

function drawCave(ctx, px, py, w, h, door) {
  const W = w * TILE, H = h * TILE;
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = '#6a6258';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H * 0.45);
  ctx.quadraticCurveTo(W * 0.5, -H * 0.25, W, H * 0.45);
  ctx.lineTo(W, H);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#544d45';
  ctx.beginPath();
  ctx.moveTo(W * 0.5, H * 0.1);
  ctx.quadraticCurveTo(W, H * 0.45, W, H);
  ctx.lineTo(W * 0.5, H);
  ctx.closePath(); ctx.fill();
  // 洞口
  if (door) {
    const dx = door.dx * TILE, dy = door.dy * TILE;
    ctx.fillStyle = '#171a22';
    ctx.beginPath();
    ctx.moveTo(dx, dy + TILE);
    ctx.lineTo(dx, dy + 10);
    ctx.quadraticCurveTo(dx + TILE / 2, dy - 8, dx + TILE, dy + 10);
    ctx.lineTo(dx + TILE, dy + TILE);
    ctx.closePath(); ctx.fill();
  }
  // 石块纹理
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 10; i++) {
    const r1 = hash2(i, 3, 21), r2 = hash2(i, 7, 22);
    ctx.fillRect(r1 * W, H * 0.3 + r2 * H * 0.6, 6 + r1 * 8, 4);
  }
  ctx.restore();
}

function drawBuilding(ctx, b, season) {
  const px = b.x * TILE, py = b.y * TILE;
  switch (b.type) {
    case 'house': drawHouseBuilding(ctx, px, py, b.w, b.h, b.door); break;
    case 'shop': drawShopBuilding(ctx, px, py, b.w, b.h, b.door); break;
    case 'cave': drawCave(ctx, px, py, b.w, b.h, b.door); break;
    case 'townhouse': drawHouseBuilding(ctx, px, py, b.w, b.h, null); break;
  }
}

/* =========================================================================
 *  角色（16x16 像素，放大 2 倍）
 * ========================================================================= */
function drawChar(ctx, cx, cy, dir, frame, o, scale) {
  const S = scale || 2;
  const U = S;                 // 一个美术像素 = S 屏幕像素
  const left = Math.round(cx - 8 * U);     // 精灵宽 16 美术像素
  const top = Math.round(cy - 16 * U);     // 脚底对齐 cy（精灵高 16 美术像素 = 32px）
  const bob = (frame === 1 || frame === 3) ? 1 : 0;
  // art px
  function P(ax, ay, aw, ah, col) {
    ctx.fillStyle = col;
    ctx.fillRect(left + ax * U, top + ay * U, aw * U, ah * U);
  }
  const skin = o.skin || '#f2c99a';
  const hair = o.hair || '#6b4a2a';
  const shirt = o.shirt || '#4a7fc1';
  const pants = o.pants || '#3a4a6a';
  const shoe = '#3a2a1c';

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 9 * (S / 2) + 2, 4 * (S / 2) + 1, 0, 0, 7);
  ctx.fill();

  const bodyTop = 8 + bob;
  // 腿
  let l1 = 0, l2 = 0;
  if (frame === 1) { l1 = -1; l2 = 1; }
  if (frame === 3) { l1 = 1; l2 = -1; }
  if (dir === 'left' || dir === 'right') { l1 = frame === 1 ? -2 : (frame === 3 ? 2 : 0); l2 = -l1; }
  P(5, 12 + l1, 3, 4 - Math.abs(l1), pants);
  P(8, 12 + l2, 3, 4 - Math.abs(l2), pants);
  P(5, 15 + l1, 3, 1, shoe);
  P(8, 15 + l2, 3, 1, shoe);
  // 身体
  P(4, bodyTop, 8, 5, shirt);
  P(4, bodyTop + 4, 8, 1, 'rgba(0,0,0,0.18)');
  // 手臂
  if (dir === 'left' || dir === 'right') {
    P(dir === 'left' ? 4 : 11, bodyTop + 1, 1, 4, shirt);
  } else {
    P(3, bodyTop + 1 + (frame === 1 ? 1 : 0), 1, 4, shirt);
    P(12, bodyTop + 1 + (frame === 3 ? 1 : 0), 1, 4, shirt);
  }
  // 头
  P(5, 2 + bob, 6, 6, skin);
  // 头发
  if (dir === 'up') {
    P(5, 1 + bob, 6, 5, hair);
  } else {
    P(5, 1 + bob, 6, 3, hair);
    P(4, 2 + bob, 1, 4, hair);
    P(11, 2 + bob, 1, 4, hair);
    if (dir === 'left') P(5, 1 + bob, 3, 5, hair);
    if (dir === 'right') P(8, 1 + bob, 3, 5, hair);
  }
  // 眼睛
  if (dir === 'down') {
    P(6, 5 + bob, 1, 1, '#2a2320');
    P(9, 5 + bob, 1, 1, '#2a2320');
  } else if (dir === 'left') {
    P(6, 5 + bob, 1, 1, '#2a2320');
  } else if (dir === 'right') {
    P(9, 5 + bob, 1, 1, '#2a2320');
  }
  // 帽子（农夫草帽）
  if (o.hat) {
    P(3, 1 + bob, 10, 1, o.hat);
    P(4, 0 + bob, 8, 1, o.hat);
    P(5, -1 + bob, 6, 1, o.hat);
    P(4, 1 + bob, 8, 1, 'rgba(0,0,0,0.15)');
  }
  return { left: left, top: top, U: U };
}

/* 挥动工具动画 */
function drawSwing(ctx, cx, cy, dir, kind, prog) {
  const ang = (-Math.PI * 0.75) + prog * Math.PI * 1.1;
  const cx2 = cx + (dir === 'left' ? -16 : dir === 'right' ? 16 : 0);
  const cy2 = cy - 16;
  ctx.save();
  ctx.translate(cx2, cy2);
  ctx.rotate(ang);
  ctx.fillStyle = '#8a5c33';
  ctx.fillRect(0, -1.5, 16, 3);
  ctx.fillStyle = '#b8b8c0';
  if (kind === 'hoe') { ctx.fillRect(14, -5, 5, 8); }
  else if (kind === 'axe') { ctx.fillStyle = '#c9ccd4'; ctx.fillRect(13, -6, 7, 9); }
  else if (kind === 'pickaxe') { ctx.fillStyle = '#c9ccd4'; ctx.fillRect(12, -7, 10, 4); }
  else if (kind === 'can') { ctx.fillStyle = '#7fa8c9'; ctx.fillRect(12, -6, 8, 9); }
  else if (kind === 'scythe') { ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.quadraticCurveTo(22, -8, 24, 2); ctx.lineTo(13, 2); ctx.fill(); }
  else if (kind === 'rod') {
    ctx.strokeStyle = '#a8763f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14, -12, 26, -14); ctx.stroke();
  }
  ctx.restore();
}

/* =========================================================================
 *  物品图标
 * ========================================================================= */
function drawCropIcon(ctx, x, y, s, color, shape) {
  ctx.save();
  ctx.translate(x, y);
  const u = s / 14;
  function R(ax, ay, aw, ah, col) { ctx.fillStyle = col; ctx.fillRect(ax * u, ay * u, aw * u, ah * u); }
  function C(ax, ay, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax * u, ay * u, r * u, 0, 7); ctx.fill(); }
  switch (shape) {
    case 'root': // 防风草
      R(5, 1, 4, 4, '#6cbb45'); R(3, 2, 8, 2, '#79c74d');
      R(4, 4, 6, 9, color); R(5, 4, 4, 3, '#ffffff');
      R(5, 11, 4, 2, '#e0d090');
      break;
    case 'tuber': // 土豆
      C(7, 8, 5.5, color); C(4.5, 6.5, 2.6, color); C(9.5, 10, 2.6, color);
      C(5.5, 8.5, 1, '#8a6a3a'); C(9, 6.5, 1, '#8a6a3a');
      R(6, 1, 2, 3, '#6cbb45');
      break;
    case 'flower': // 花椰菜
      C(7, 8, 5.5, color); C(4.5, 6, 3, color); C(9.5, 6, 3, color);
      C(6, 5, 2.2, '#e8eede'); C(9, 8.5, 2, '#dde5cf');
      R(4, 12, 6, 2, '#6cbb45');
      break;
    case 'bloom': { // 观赏花卉：茎叶 + 六瓣花冠 + 花心
      R(6.2, 5.5, 1.6, 8.5, '#4f9c34');           // 主茎
      R(2.2, 8.6, 4, 1.8, '#6cbb45');             // 左叶
      R(8, 11.2, 3.8, 1.8, '#6cbb45');            // 右叶
      const petals = [[7, 2.4], [10.3, 4.4], [10.3, 7.6], [7, 9.6], [3.7, 7.6], [3.7, 4.4]];
      for (let i = 0; i < petals.length; i++) C(petals[i][0], petals[i][1], 2.3, color);
      C(7, 6, 2.3, '#ffe27a');                    // 花心
      C(7, 6, 1.1, '#f0ae2a');
      break;
    }
    case 'bean': // 青豆
      R(3, 5, 3, 8, color); R(7, 4, 3, 9, '#8ad35e');
      R(3, 5, 3, 2, '#a5e07a');
      break;
    case 'berry': // 浆果
      C(5, 6, 2.6, color); C(9, 6, 2.6, color); C(7, 10, 2.8, color);
      C(4.4, 5.4, 0.9, 'rgba(255,255,255,0.6)');
      R(6, 1, 3, 3, '#5da83c');
      break;
    case 'melon': // 瓜
      C(7, 9, 6, color);
      R(3, 6, 1, 7, 'rgba(0,0,0,0.18)'); R(6, 4, 1, 10, 'rgba(0,0,0,0.18)'); R(9, 5, 1, 9, 'rgba(0,0,0,0.18)');
      R(6, 1, 2, 3, '#5da83c');
      break;
    case 'grain': // 麦穗
      R(6, 3, 2, 10, '#c9a83c');
      for (let i = 0; i < 4; i++) { C(4.5, 4 + i * 2.4, 1.6, color); C(9.5, 4 + i * 2.4, 1.6, color); }
      C(7, 2.5, 1.8, color);
      break;
    case 'fruit': // 番茄/茄子
      C(7, 8, 5.5, color);
      C(5.5, 6.5, 1.6, 'rgba(255,255,255,0.35)');
      R(6, 2, 2, 3, '#5da83c'); R(3, 3, 8, 1, '#5da83c');
      break;
    case 'pepper': // 辣椒
      R(6, 2, 2, 2, '#5da83c');
      C(7, 6, 2.4, color); C(7, 9, 2.6, color); C(6.6, 12, 2, color);
      C(6, 5, 0.8, 'rgba(255,255,255,0.4)');
      break;
    default:
      C(7, 8, 5.5, color);
  }
  ctx.restore();
}

function drawItemIcon(ctx, id, x, y, s) {
  const it = ITEMS[id];
  ctx.save();
  ctx.translate(x, y);
  const u = s / 14;
  function R(ax, ay, aw, ah, col) { ctx.fillStyle = col; ctx.fillRect(ax * u, ay * u, aw * u, ah * u); }
  function C(ax, ay, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax * u, ay * u, r * u, 0, 7); ctx.fill(); }
  if (!it) { ctx.restore(); return; }
  switch (it.type) {
    case 'tool': {
      const c = '#8a5c33', m = '#c9ccd4';
      if (it.kind === 'hoe') { R(9, 2, 3, 11, c); R(3, 1, 8, 4, m); }
      else if (it.kind === 'axe') { R(9, 2, 3, 11, c); R(4, 1, 7, 6, m); R(4, 1, 3, 2, 'rgba(255,255,255,.5)'); }
      else if (it.kind === 'pickaxe') { R(9, 2, 3, 11, c); R(1, 3, 11, 3, m); R(2, 3, 3, 1, 'rgba(255,255,255,.5)'); }
      else if (it.kind === 'can') { R(2, 5, 8, 7, m); R(10, 7, 3, 3, m); R(1, 3, 4, 2, m); R(4, 8, 4, 2, 'rgba(90,150,220,.85)'); }
      else if (it.kind === 'scythe') { R(10, 3, 2, 10, c); ctx.fillStyle = m; ctx.beginPath(); ctx.moveTo(2 * u, 3 * u); ctx.quadraticCurveTo(10 * u, 1 * u, 11 * u, 6 * u); ctx.lineTo(9 * u, 6 * u); ctx.quadraticCurveTo(8 * u, 3 * u, 2 * u, 5 * u); ctx.fill(); }
      else if (it.kind === 'rod') {
        // 水平镜像：从 (12,12) 弯向 (2,1)，鱼线垂落到 (3,8)
        ctx.strokeStyle = c; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(12 * u, 12 * u); ctx.quadraticCurveTo(6 * u, 6 * u, 2 * u, 1 * u); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1 * u;
        ctx.beginPath(); ctx.moveTo(2 * u, 1 * u); ctx.quadraticCurveTo(1 * u, 5 * u, 3 * u, 8 * u); ctx.stroke();
      }
      break;
    }
    case 'seed': {
      R(3, 4, 8, 9, '#c9a86a'); R(3, 4, 8, 2, '#b08f52');
      R(4, 3, 6, 2, '#a98a55');
      const col = it.color || '#8fc46b';
      C(5.5, 7, 1.2, col); C(8.5, 8.5, 1.2, col); C(6.5, 11, 1.2, col);
      R(6.5, 2, 1, 3, '#6cbb45');
      break;
    }
    case 'crop': drawCropIcon(ctx, 0, 0, s, it.color, it.shape); break;
    case 'forage': {
      const col = it.color || '#8fc46b';
      const form = it.form || 'root';
      if (form === 'mushroom') {
        R(6, 5, 2, 8, '#e8d9b8');
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(7 * u, 5 * u, 5 * u, 3.4 * u, 0, Math.PI, 0); ctx.fill();
      } else if (form === 'crystal') {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(7 * u, 1 * u); ctx.lineTo(11 * u, 7 * u); ctx.lineTo(9 * u, 12 * u); ctx.lineTo(5 * u, 12 * u); ctx.lineTo(3 * u, 7 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.moveTo(7 * u, 1 * u); ctx.lineTo(8.6 * u, 7 * u); ctx.lineTo(7 * u, 12 * u); ctx.lineTo(6 * u, 7 * u); ctx.closePath(); ctx.fill();
      } else if (form === 'flower') {
        ctx.strokeStyle = '#5da83c'; ctx.lineWidth = 1.4 * u;
        ctx.beginPath(); ctx.moveTo(7 * u, 13 * u); ctx.lineTo(7 * u, 8 * u); ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          C(7 + Math.cos(a) * 3, 5.5 + Math.sin(a) * 3, 2.1, col);
        }
        C(7, 5.5, 1.6, '#fff3a8');
      } else if (form === 'berry') {
        ctx.strokeStyle = '#4f7a34'; ctx.lineWidth = 1.2 * u;
        ctx.beginPath(); ctx.moveTo(7 * u, 13 * u); ctx.lineTo(7 * u, 8 * u); ctx.stroke();
        C(4.4, 7.6, 2.4, col); C(9.6, 6.8, 2.2, col); C(7, 3.6, 2.3, col);
        C(5.6, 6.8, 0.8, 'rgba(255,255,255,.5)');
      } else if (form === 'leaf') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.8 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(5 * u, 13 * u); ctx.lineTo(3.5 * u, 2 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7 * u, 13 * u); ctx.lineTo(8 * u, 1.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9 * u, 13 * u); ctx.lineTo(12 * u, 5 * u); ctx.stroke();
      } else if (form === 'fern') {
        ctx.strokeStyle = '#5f9a3c'; ctx.lineWidth = 1.5 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(7 * u, 13 * u); ctx.lineTo(7 * u, 6 * u); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 1.8 * u;
        ctx.beginPath(); ctx.moveTo(7 * u, 6 * u); ctx.quadraticCurveTo(12 * u, 5 * u, 10 * u, 10 * u); ctx.quadraticCurveTo(8.5 * u, 12 * u, 7 * u, 11 * u); ctx.stroke();
      } else if (form === 'nut') {
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(7 * u, 9 * u, 4.2 * u, 4.6 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6f4a24'; ctx.beginPath(); ctx.ellipse(7 * u, 5.2 * u, 3.2 * u, 1.9 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(5.4 * u, 7.6 * u, 1.2 * u, 1.7 * u, -0.4, 0, 7); ctx.fill();
      } else {
        C(7, 8, 4.6, col); R(6.5, 2, 1, 6, '#5da83c'); C(5, 4, 1.6, '#79c74d');
      }
      break;
    }
    case 'fish': {
      const col = it.color || '#c08a4a';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(6.6 * u, 8 * u, 5.4 * u, 3.4 * u, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11 * u, 8 * u); ctx.lineTo(14 * u, 4.5 * u); ctx.lineTo(14 * u, 11.5 * u); ctx.closePath(); ctx.fill();
      C(4, 7, 0.9, '#20242c');
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(4 * u, 6 * u, 5 * u, 1.2 * u);
      break;
    }
    default: {
      // 材料
      if (it.shape === 'wood') { R(1, 4, 12, 6, '#8a5c33'); R(1, 4, 12, 2, '#a2763f'); C(2.6, 7, 1.6, '#c49a63'); C(11.6, 7, 1.6, '#c49a63'); }
      else if (it.shape === 'stone') { C(5, 9, 3.4, '#9aa0a6'); C(9.5, 8, 2.8, '#8a9096'); C(7, 5.4, 2.4, '#adb3b9'); C(6, 4.6, 0.9, 'rgba(255,255,255,.6)'); }
      else if (it.shape === 'fiber') {
        ctx.strokeStyle = '#7bb35a'; ctx.lineWidth = 1.6 * u;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo((3 + i * 2) * u, 13 * u); ctx.quadraticCurveTo((5 + i * 2) * u, 7 * u, (4 + i * 2.2) * u, 1.5 * u); ctx.stroke(); }
      }
      else if (it.shape === 'sap') { R(4, 3, 6, 10, '#7a9a4a'); R(5, 5, 4, 6, '#a8c86a'); R(6, 2, 2, 2, '#5a7a34'); }
      else if (it.shape === 'coal') { C(5.4, 8, 3.2, '#2f2f33'); C(9.4, 6.6, 2.4, '#3d3d42'); C(7.6, 11, 2.4, '#26262a'); C(4.6, 7, 0.9, 'rgba(255,255,255,.3)'); }
      else if (it.shape === 'ore') {
        C(5.4, 8, 3.4, '#8d8f96'); C(9.4, 6.6, 2.6, '#a4a8ad');
        const t = it.tint || '#c87137';
        C(5, 7, 1.5, t); C(9, 9, 1.3, t); C(7.4, 11, 1.2, t);
        C(4.4, 6.2, 0.6, 'rgba(255,255,255,.6)');
      } else if (it.shape === 'gem') {
        const g = it.color || '#b56cd6';
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(7 * u, 1.5 * u); ctx.lineTo(12 * u, 5.5 * u); ctx.lineTo(10.5 * u, 11.5 * u); ctx.lineTo(3.5 * u, 11.5 * u); ctx.lineTo(2 * u, 5.5 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath(); ctx.moveTo(7 * u, 1.5 * u); ctx.lineTo(9 * u, 5.5 * u); ctx.lineTo(7 * u, 11.5 * u); ctx.lineTo(5 * u, 5.5 * u); ctx.closePath(); ctx.fill();
        C(5.2, 7.5, 0.9, 'rgba(255,255,255,.7)');
      } else if (it.shape === 'torch') {
        R(6, 6, 2, 8, '#6a4426'); R(6, 6, 1, 8, '#8a5c33');
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.ellipse(7 * u, 4.5 * u, 2.6 * u, 4 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff8a2a';
        ctx.beginPath(); ctx.ellipse(7 * u, 4.8 * u, 1.5 * u, 2.5 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(7 * u, 3.6 * u, 0.7 * u, 0, 7); ctx.fill();
      } else if (it.shape === 'drop') {
        ctx.fillStyle = it.color || '#9a9';
        ctx.beginPath();
        ctx.moveTo(7 * u, 2 * u);
        ctx.quadraticCurveTo(11.5 * u, 7 * u, 10.5 * u, 9.5 * u);
        ctx.arc(7 * u, 9.5 * u, 3.5 * u, 0, Math.PI);
        ctx.quadraticCurveTo(2.5 * u, 7 * u, 7 * u, 2 * u);
        ctx.fill();
        C(5.8, 9.2, 1, 'rgba(255,255,255,.65)');
      } else if (it.shape === 'workbench') {
        R(1, 5, 12, 3, '#96693c');
        R(2, 8, 2, 4, '#7a5230'); R(10, 8, 2, 4, '#7a5230');
        R(4, 2, 4, 2, '#c9ccd4'); R(5.5, 3, 1.4, 2, '#8a6238');
        R(9.5, 2, 2.5, 2, '#9aa0a6');
      } else if (it.shape === 'fence') {
        R(2, 3, 2.5, 9, '#8a6238'); R(9.5, 3, 2.5, 9, '#8a6238');
        R(1, 4, 12, 1.6, '#a2763f'); R(1, 8.5, 12, 1.6, '#a2763f');
      } else if (it.shape === 'meat') {
        ctx.fillStyle = it.color || '#c07858';
        ctx.beginPath(); ctx.ellipse(7.5 * u, 8.5 * u, 4.6 * u, 3.4 * u, -0.7, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.ellipse(6.3 * u, 7.4 * u, 1.8 * u, 1 * u, -0.7, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2ead8';
        ctx.fillRect(10.4 * u, 2.6 * u, 1.5 * u, 4.2 * u);
        C(10.1, 2.6, 1.1, '#f2ead8'); C(12.1, 3.4, 1.1, '#f2ead8');
      } else if (it.shape === 'campfire') {
        C(3, 12, 1.7, '#8a9096'); C(11, 12, 1.7, '#8a9096');
        C(2, 9, 1.4, '#8a9096'); C(12, 9, 1.4, '#8a9096');
        R(3.5, 9.5, 7, 1.6, '#6a4426');
        ctx.fillStyle = '#ff8a2a';
        ctx.beginPath(); ctx.ellipse(7 * u, 6 * u, 3.2 * u, 4.2 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.ellipse(7 * u, 6.8 * u, 1.8 * u, 2.6 * u, 0, 0, 7); ctx.fill();
      } else C(7, 8, 5, it.color || '#999');
    }
  }
  ctx.restore();
}

/* 天气粒子 */
function drawRain(ctx, W, H, t, snow) {
  ctx.save();
  if (snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 140; i++) {
      const sx = (hash2(i, 1, 5) * W + t * (8 + hash2(i, 2, 6) * 14)) % W;
      const sy = (hash2(i, 3, 7) * H + t * (18 + hash2(i, 4, 8) * 22)) % H;
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else {
    ctx.strokeStyle = 'rgba(180,215,255,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 170; i++) {
      const sx = (hash2(i, 11, 9) * W + t * 30) % W;
      const sy = (hash2(i, 12, 10) * H + t * 480) % H;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 3, sy + 12); ctx.stroke();
    }
  }
  ctx.restore();
}

/* =========================================================================
 *  夜晚怪物：史莱姆 / 蝙蝠 / 幽灵（受击闪白，掉血后显示血条）
 * ========================================================================= */
function drawMonster(ctx, mo) {
  const def = mo.def, x = mo.x, y = mo.y, t = Game.t;
  const hurt = mo.hurtT > 0;
  const bob = def.fly ? Math.sin(t * 4.5 + mo.wob) * 5 - 10 : 0;
  const by = y + bob;
  const body = hurt ? '#ffffff' : def.color;
  ctx.save();
  // 影子（飞行怪的影子更小更淡）
  ctx.fillStyle = def.fly ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(x, y + 12, def.fly ? 7 : 11, def.fly ? 3 : 4.5, 0, 0, 7); ctx.fill();

  if (mo.kind === 'slime') {
    const sq = 1 + Math.sin(t * 6 + mo.wob) * 0.1;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(x, by + 3, 13 * sq, 10 / sq, 0, 0, 7); ctx.fill();
    ctx.fillStyle = hurt ? '#dddddd' : def.dark;
    ctx.beginPath(); ctx.ellipse(x, by + 8, 10 * sq, 4.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#22331f';
    ctx.beginPath(); ctx.arc(x - 4, by - 1, 1.7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, by - 1, 1.7, 0, 7); ctx.fill();
  } else if (mo.kind === 'bat') {
    const flap = Math.sin(t * 16 + mo.wob) * 0.6;
    ctx.fillStyle = hurt ? '#eeeeee' : def.dark;
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(x + s * 4, by - 2);
      ctx.rotate(s * flap);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(s * 12, -6); ctx.lineTo(s * 13, 1); ctx.lineTo(s * 8, 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(x, by, 5.5, 6.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, by - 5); ctx.lineTo(x - 2.5, by - 11); ctx.lineTo(x - 0.5, by - 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 4, by - 5); ctx.lineTo(x + 2.5, by - 11); ctx.lineTo(x + 0.5, by - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath(); ctx.arc(x - 2, by - 1, 1.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 2, by - 1, 1.1, 0, 7); ctx.fill();
  } else { // ghost 幽灵
    ctx.globalAlpha = 0.82 + Math.sin(t * 3 + mo.wob) * 0.08;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, by - 1, 11, Math.PI, 0);
    ctx.lineTo(x + 11, by + 7);
    // 底部三个扇贝形波纹
    for (let i = 0; i < 3; i++) {
      const sy = by + 8 + Math.sin(t * 5 + i * 2 + mo.wob) * 1.5;
      ctx.arc(x + 11 - 3.67 * (i + 0.5), sy, 3.67, 0, Math.PI);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#33465a';
    ctx.beginPath(); ctx.arc(x - 4, by - 3, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, by - 3, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, by + 3, 2.2, 3, 0, 0, 7); ctx.fill();
  }

  // 血条（受创后显示）
  if (mo.hp < def.hp) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 12, by - 22, 24, 4);
    ctx.fillStyle = '#e05a4a';
    ctx.fillRect(x - 12, by - 22, 24 * Math.max(0, mo.hp) / def.hp, 4);
  }
  ctx.restore();
}

/* =========================================================================
 *  野外小动物：兔子（蹦跳）/ 野鸡（啄地）/ 青蛙（鼓眼）
 * ========================================================================= */
function drawAnimal(ctx, an) {
  const def = an.def, x = an.x, y = an.y, t = Game.t;
  const hop = an.kind === 'rabbit' ? Math.abs(Math.sin(t * (an.fleeing ? 14 : 5) + an.wob)) * 6
            : an.kind === 'frog' ? Math.abs(Math.sin(t * (an.fleeing ? 12 : 3.5) + an.wob)) * 5 : 0;
  const peck = an.kind === 'pheasant' && !an.fleeing ? Math.max(0, Math.sin(t * 3 + an.wob)) * 3 : 0;
  const by = y - hop;
  ctx.save();
  // 影子（跳起时缩小）
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, y + 11, 10 - hop * 0.4, 4, 0, 0, 7); ctx.fill();

  if (an.kind === 'rabbit') {
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(x, by + 2, 10, 7.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + (an.dir === 'left' ? -8 : 8), by - 4, 5.5, 0, 7); ctx.fill();
    // 长耳朵
    ctx.beginPath(); ctx.ellipse(x + (an.dir === 'left' ? -9 : 9) - 2, by - 13, 1.8, 6, -0.15, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + (an.dir === 'left' ? -9 : 9) + 2, by - 13, 1.8, 6, 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = def.dark;
    ctx.beginPath(); ctx.arc(x + (an.dir === 'left' ? -10 : 10), by - 4, 1.1, 0, 7); ctx.fill();
    // 短尾
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - (an.dir === 'left' ? -9 : 9), by + 2, 2.5, 0, 7); ctx.fill();
  } else if (an.kind === 'pheasant') {
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(x, by, 9.5, 7, 0, 0, 7); ctx.fill();
    // 尾羽
    ctx.fillStyle = def.dark;
    ctx.beginPath();
    ctx.moveTo(x + (an.dir === 'left' ? 8 : -8), by - 2);
    ctx.lineTo(x + (an.dir === 'left' ? 20 : -20), by - 7);
    ctx.lineTo(x + (an.dir === 'left' ? 18 : -18), by + 1);
    ctx.closePath(); ctx.fill();
    // 头 + 喙
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.arc(x + (an.dir === 'left' ? -7 : 7), by - 5 + peck, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0a03c';
    ctx.beginPath();
    ctx.moveTo(x + (an.dir === 'left' ? -11 : 11), by - 5 + peck);
    ctx.lineTo(x + (an.dir === 'left' ? -15 : 15), by - 4 + peck);
    ctx.lineTo(x + (an.dir === 'left' ? -11 : 11), by - 3 + peck);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(x + (an.dir === 'left' ? -7.5 : 7.5), by - 6 + peck, 1, 0, 7); ctx.fill();
  } else { // frog
    const sq = 1 + Math.sin(t * (an.fleeing ? 12 : 3.5) + an.wob) * 0.12;
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.ellipse(x, by + 3, 10 * sq, 7.5 / sq, 0, 0, 7); ctx.fill();
    // 鼓眼睛
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.arc(x - 4, by - 5, 2.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, by - 5, 2.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#22331f';
    ctx.beginPath(); ctx.arc(x - 4, by - 5.5, 1.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, by - 5.5, 1.2, 0, 7); ctx.fill();
    // 嘴
    ctx.strokeStyle = def.dark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, by + 1, 4, 0.3, Math.PI - 0.3); ctx.stroke();
  }
  ctx.restore();
}

/* 火堆：石圈 + 交叉木柴 + 双层跳动火焰 */
function drawCampfire(ctx, px, py) {
  const t = Game.t;
  ctx.save();
  ctx.translate(px, py);
  // 石圈
  ctx.fillStyle = '#8a9096';
  [[3, 22], [10, 26], [21, 26], [28, 22], [2, 14], [30, 14]].forEach(function (p) {
    ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, 7); ctx.fill();
  });
  // 交叉木柴
  ctx.fillStyle = '#6a4426';
  ctx.save();
  ctx.translate(16, 22); ctx.rotate(0.5);
  ctx.fillRect(-9, -2, 18, 4);
  ctx.rotate(-1.0);
  ctx.fillRect(-9, -2, 18, 4);
  ctx.restore();
  // 火焰（外橙内黄，随时间跳动）
  const fl = Math.sin(t * 11) * 1.2 + Math.sin(t * 23 + 1) * 0.8;
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath(); ctx.ellipse(16, 12 - fl * 0.6, 7 + fl * 0.5, 11 + fl, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.ellipse(16, 14 - fl * 0.5, 4.5, 7 + fl * 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath(); ctx.ellipse(16, 16, 2.2, 3.5, 0, 0, 7); ctx.fill();
  ctx.restore();
}
