// 用 node vm 生成农场地图的 ASCII 俯视图，用于验证区域布局
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
    return noop;
  } });
}
function stubWin() {
  return new Proxy({}, { get(t, p) {
    if (p === 'document') return sb.document;
    if (p === 'AudioContext' || p === 'webkitAudioContext') return function () { return {
      createOscillator: () => ({ connect: noop, frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, start: noop, stop: noop }),
      createGain: () => ({ connect: noop, gain: { setValueAtTime: noop, exponentialRampToValueAtTime: noop } }),
      destination: {}, currentTime: 0 }; };
    if (p === 'innerWidth') return 1280;
    if (p === 'innerHeight') return 720;
    if (p === 'devicePixelRatio') return 1;
    return noop;
  } });
}
const sb = {
  console, document: stubDoc(), window: null,
  requestAnimationFrame: noop, performance: { now: () => 0 },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop }
};
sb.window = stubWin();
vm.createContext(sb);
for (const f of ['js/data.js', 'js/draw.js', 'js/world.js', 'js/game.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), sb, { filename: f });
}
vm.runInContext('cacheDom()', sb);
vm.runInContext('newGame()', sb);

const out = vm.runInContext(`(()=>{
  const m = Game.maps.farm;
  const rows = [];
  for (let y = 0; y < m.h; y++) {
    let line = '';
    for (let x = 0; x < m.w; x++) {
      const o = getObj(m, x, y);
      const t = tileAt(m, x, y);
      let ch = '.';
      if (o) {
        if (o.type === 'wall') ch = 'B';
        else if (o.type === 'door') ch = 'D';
        else if (o.type === 'tree') ch = o.kind === 'stump' ? 's' : (o.kind === 'pine' ? 'P' : 'T');
        else if (o.type === 'rock') ch = o.metal ? 'O' : 'o';
        else if (o.type === 'weeds') ch = 'w';
        else if (o.type === 'fence') ch = '|';
        else if (o.type === 'bin' || o.type === 'bin2') ch = 'X';
        else if (o.type === 'branch') ch = ',';
        else if (o.type === 'forage') ch = '*';
        else if (o.type === 'sign') ch = 'S';
        else ch = '?';
      } else if (t === 2) ch = '~';
      else if (t === 1) ch = '#';
      else if (t === 3) ch = ':';
      else if (t === 5) ch = '=';
      else if (t === 7) ch = 'W';
      line += ch;
    }
    rows.push(line);
  }
  return { rows, w: m.w, h: m.h, spawn: m.spawn, buildings: m.buildings.map(function(b){return b.type+'('+b.x+','+b.y+','+b.w+'x'+b.h+')';}) };
})()`, sb);

// 加坐标刻度
console.log('地图尺寸: ' + out.w + ' x ' + out.h + '   出生点: (' + Math.floor(out.spawn.x/32) + ',' + Math.floor(out.spawn.y/32) + ')');
console.log('图例: . 草地  # 路  ~ 水  : 沙  B 建筑墙  D 门  T 阔叶树  P 松树  s 树桩  o 石  O 矿脉  w 杂草  | 栅栏  X 出货箱  , 树枝  * 采集物  S 牌子');
console.log('');
// 列刻度（每10）
let head = '     ';
for (let x = 0; x < out.w; x++) head += (x % 10 === 0 ? String(Math.floor(x/10) % 10) : ' ');
console.log(head);
out.rows.forEach(function (line, y) {
  const tag = (y % 5 === 0) ? String(y).padStart(4, ' ') : '    ';
  console.log(tag + ' ' + line);
});
console.log('');
console.log('建筑: ' + out.buildings.join(', '));