'use strict';
/* ================================================================
   泡泡堂大作战 — Q版 Crazy Arcade 风网页游戏
   网格地图 / 水泡十字爆炸 / 炸箱捡道具 / 困住敌人碰一下消灭
   ================================================================ */

/* ---------- 常量与工具 ---------- */
const TILE = 46, COLS = 15, ROWS = 13;
const W = COLS * TILE, H = ROWS * TILE;
const INK = '#4a3933';
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR;
cv.style.aspectRatio = W + '/' + H;
ctx.scale(DPR, DPR);

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const K = (c, r) => c + ',' + r;
const tileOf = e => [Math.floor(e.x / TILE), Math.floor(e.y / TILE)];

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ---------- 音效（WebAudio 合成） ---------- */
let AC = null, muted = false;
function tone(f0, f1, dur, type, vol, delay) {
  if (muted) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume(); // iOS 需要手势后恢复
    const t = AC.currentTime + (delay || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) { /* 音频不可用时静默 */ }
}
const SND = {
  place() { tone(520, 290, .12, 'sine', .14); },
  kick()  { tone(190, 420, .09, 'square', .12); },
  curse() { tone(320, 80, .55, 'sawtooth', .12); },
  portal() { tone(400, 1300, .22, 'sine', .14); tone(1300, 500, .2, 'sine', .1, .14); },
  pop()   { tone(760, 90, .2, 'square', .1); },
  boom()  { tone(210, 38, .4, 'sawtooth', .2); tone(950, 220, .22, 'triangle', .09, .02); },
  item()  { tone(660, 660, .09, 'sine', .14); tone(990, 990, .14, 'sine', .14, .1); },
  trap()  { tone(430, 170, .32, 'triangle', .16); },
  free()  { tone(280, 820, .2, 'sine', .14); },
  win()   { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .2, 'triangle', .15, i * .13)); },
  lose()  { [392, 330, 262, 196].forEach((f, i) => tone(f, f, .24, 'triangle', .15, i * .17)); },
};

/* ---------- 关卡配置 ---------- */
// 敌人种类：walker 普通 / chaser 追击型(更快更黏人) / bomber 炸弹狂(放泡又勤威力又大) / boss 大魔王(3条命,体型大)
// layout 墙体布局：classic 经典柱阵 / rooms 房间走廊 / diamond 钻石环阵 / maze 对称迷宫
// terr 地形：ice 冰面(加速) mud 泥地(减速) cover 草丛(藏身) portals 传送门对数
const ROUNDS = [
  { types: ['walker', 'walker', 'walker'],                     espd: 100, epow: 2, cool: [2.6, 5.0], boxP: 0.50,
    theme: 0, layout: 'classic', terr: { mud: 3, cover: 6 } },
  { types: ['walker', 'walker', 'chaser', 'bomber'],           espd: 116, epow: 2, cool: [2.0, 4.2], boxP: 0.56,
    theme: 1, layout: 'rooms',   terr: { mud: 5, cover: 5, portals: 1 } },
  { types: ['walker', 'chaser', 'chaser', 'bomber', 'bomber'], espd: 130, epow: 3, cool: [1.6, 3.4], boxP: 0.60,
    theme: 2, layout: 'diamond', terr: { ice: 10, cover: 4, portals: 1 } },
  { types: ['boss', 'chaser', 'bomber', 'walker'],             espd: 135, epow: 3, cool: [1.5, 3.0], boxP: 0.52,
    theme: 3, layout: 'maze',    terr: { ice: 4, mud: 4, cover: 5, portals: 2 } },
];
const THEMES = [
  { name: '青青草原', fA: '#d9f2c4', fB: '#cdeab8', wall: 'cloud', box: 'gift',   cover: 'bush',     decal: 'grass' },
  { name: '阳光沙滩', fA: '#f8e7b9', fB: '#f1dba2', wall: 'sand',  box: 'chest',  cover: 'sandpile', decal: 'beach' },
  { name: '冰雪乐园', fA: '#eaf5fc', fB: '#dceefa', wall: 'ice',   box: 'icebox', cover: 'snowpile', decal: 'snow'  },
  { name: '魔王城堡', fA: '#c3b7d3', fB: '#b7abc8', wall: 'brick', box: 'barrel', cover: 'thorn',    decal: 'stone' },
];
const TYPE_MODS = {
  walker: {},
  chaser: { spd: 1.18, chaseP: 0.78, ball: '#ff5d6e' },
  bomber: { cool: 0.55, pow: 1, ball: '#58c8ff' },
  boss:   { spd: 1.05, pow: 2, cool: 0.6, hp: 3, scale: 1.6, chaseP: 0.7, ball: '#ffd34d' },
};
const ENEMY_COLORS = ['#ff8a5c', '#b48aff', '#6fd86f', '#ffc24d', '#ff7b9c'];
const ENEMY_SPAWNS = [[13, 1], [1, 11], [13, 11], [7, 6], [7, 11]];
const ITEM_INFO = {
  power:  { icon: '💧', label: '威力+1' },
  bubble: { icon: '🫧', label: '泡泡+1' },
  speed:  { icon: '⚡', label: '速度+1' },
  life:   { icon: '❤️', label: '生命+1' },
  needle: { icon: '🪡', label: '针·自动脱困' },
  glove:  { icon: '👋', label: '推推手!' },
  shield: { icon: '🛡️', label: '护盾+1' },
  max:    { icon: '💥', label: '威力拉满!!' },
  skull:  { icon: '💀', label: '!?' },
};
const CURSES = {
  slow:    '🐌 中咒：变慢了!',
  reverse: '🔄 中咒：方向反了!',
  weak:    '💧 中咒：威力变小!',
};
const CURSE_SHORT = { slow: '变慢', reverse: '反向', weak: '威力↓' };

/* ---------- 全局状态 ---------- */
let state = 'title';   // title | playing | paused | clear | over | victory
let grid = [], hiddenItems = {}, terrain = [], portals = [], theme = THEMES[0];
let bubbles = [], explosions = [], items = [], particles = [], floats = [];
let player = null, enemies = [], curCfg = ROUNDS[0];
let roundIdx = 0, score = 0, shake = 0, timeNow = 0, lastKillAt = -9;

/* ---------- 地图生成 ---------- */
const SPAWNS_ALL = () => [[1, 1], ...ENEMY_SPAWNS];
const nearSpawn = (c, r, d) =>
  SPAWNS_ALL().some(([sc, sr]) => Math.abs(c - sc) + Math.abs(r - sr) <= d);

// 保证所有非墙格子从玩家出生点可达（箱子视为可通过，反正能炸开）
function ensureConnected() {
  for (let guard = 0; guard < 80; guard++) {
    const seen = new Set([K(1, 1)]);
    const q = [[1, 1]];
    while (q.length) {
      const [c, r] = q.pop();
      for (const [dx, dy] of DIRS) {
        const nc = c + dx, nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        if (grid[nr][nc] === 1 || seen.has(K(nc, nr))) continue;
        seen.add(K(nc, nr)); q.push([nc, nr]);
      }
    }
    let unreached = null;
    outer:
    for (let r = 1; r < ROWS - 1; r++)
      for (let c = 1; c < COLS - 1; c++)
        if (grid[r][c] !== 1 && !seen.has(K(c, r))) { unreached = [c, r]; break outer; }
    if (!unreached) return;
    // 拆一面同时挨着已达区和未达区的墙
    let broke = false;
    fix:
    for (let r = 1; r < ROWS - 1; r++)
      for (let c = 1; c < COLS - 1; c++) {
        if (grid[r][c] !== 1) continue;
        let adjSeen = false, adjUn = false;
        for (const [dx, dy] of DIRS) {
          const nc = c + dx, nr = r + dy;
          if (nc <= 0 || nr <= 0 || nc >= COLS - 1 || nr >= ROWS - 1 || grid[nr][nc] === 1) continue;
          if (seen.has(K(nc, nr))) adjSeen = true; else adjUn = true;
        }
        if (adjSeen && adjUn) { grid[r][c] = 0; broke = true; break fix; }
      }
    if (!broke) return;
  }
}
function buildWalls(layout) {
  const addWall = (c, r) => {
    if (c <= 0 || r <= 0 || c >= COLS - 1 || r >= ROWS - 1) return;
    if (nearSpawn(c, r, 1)) return;
    grid[r][c] = 1;
  };
  const irnd = (a, b) => a + Math.floor(rnd(0, b - a + 1));
  // 蛇形墙链：随机游走，墙一段段连着
  const chain = (len, mirror) => {
    let c = irnd(2, COLS - 3), r = irnd(2, ROWS - 3);
    let [dx, dy] = DIRS[irnd(0, 3)];
    for (let i = 0; i < len; i++) {
      addWall(c, r);
      if (mirror) addWall(COLS - 1 - c, r);
      if (Math.random() < .4) [dx, dy] = DIRS[irnd(0, 3)]; // 偶尔拐弯
      c += dx; r += dy;
    }
  };
  // 堆砌块：2×2 / L 形 / T 形的石堆
  const CLUMP_SHAPES = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],          // 田
    [[0, 0], [1, 0], [0, 1]],                  // L
    [[0, 0], [0, 1], [1, 1]],                  // 反L
    [[0, 0], [1, 0], [2, 0], [1, 1]],          // T
    [[0, 0], [0, 1], [0, 2], [1, 1]],          // 横T
  ];
  const clump = mirror => {
    const shape = CLUMP_SHAPES[irnd(0, CLUMP_SHAPES.length - 1)];
    const c0 = irnd(2, COLS - 5), r0 = irnd(2, ROWS - 5);
    for (const [dc, dr] of shape) {
      addWall(c0 + dc, r0 + dr);
      if (mirror) addWall(COLS - 1 - c0 - dc, r0 + dr);
    }
  };
  // 散点：东一块西一块的单墙
  const scatter = (n, mirror) => {
    for (let i = 0; i < n; i++) {
      const c = irnd(1, COLS - 2), r = irnd(1, ROWS - 2);
      addWall(c, r);
      if (mirror) addWall(COLS - 1 - c, r);
    }
  };

  if (layout === 'rooms') {
    // 残破的房间：隔墙带随机缺口，房间里再堆乱石
    for (let r = 1; r < ROWS - 1; r++)
      if (r !== 2 && r !== 6 && r !== 10) {
        if (Math.random() < .8) addWall(5, r);
        if (Math.random() < .8) addWall(9, r);
      }
    for (let c = 1; c < COLS - 1; c++)
      if (![2, 3, 7, 11, 12].includes(c) && Math.random() < .8) addWall(c, 6);
    clump(); clump(); scatter(4);
  } else if (layout === 'diamond') {
    // 钻石环带随机缺口 + 周围乱石链
    for (let r = 1; r < ROWS - 1; r++)
      for (let c = 1; c < COLS - 1; c++) {
        const md = Math.abs(c - 7) + Math.abs(r - 6);
        if (md === 5 && c !== 7 && r !== 6 && Math.random() < .85) addWall(c, r);
      }
    chain(irnd(3, 5)); chain(irnd(3, 5)); clump(); scatter(5);
  } else if (layout === 'maze') {
    // 左右对称的乱石阵：链 + 堆 + 散
    chain(irnd(4, 6), true); chain(irnd(4, 6), true);
    clump(true);
    scatter(4, true);
  } else {
    // classic：松散柱阵（随机缺席）+ 石链石堆点缀
    for (let r = 2; r < ROWS - 1; r += 2)
      for (let c = 2; c < COLS - 1; c += 2)
        if (Math.random() < .6) addWall(c, r);
    chain(irnd(3, 5)); clump(); scatter(3);
  }
}
function placeTerrain(terr) {
  const cands = [];
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++)
      if (grid[r][c] === 0 && !nearSpawn(c, r, 2)) cands.push([c, r]);
  for (let i = cands.length - 1; i > 0; i--) { // 洗牌
    const j = Math.floor(rnd(0, i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  const put = (n, t) => {
    for (let i = 0; i < n && cands.length; i++) {
      const [c, r] = cands.pop();
      terrain[r][c] = t;
    }
  };
  put(terr.ice || 0, 'ice');
  put(terr.mud || 0, 'mud');
  put(terr.cover || 0, 'cover');
  for (let p = 0; p < (terr.portals || 0); p++) {
    // 找一对相距足够远的格子配成传送门
    if (cands.length < 2) break;
    const a = cands.pop();
    const bi = cands.findIndex(b => Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) >= 7);
    if (bi < 0) { cands.unshift(a); break; }
    const b = cands.splice(bi, 1)[0];
    terrain[a[1]][a[0]] = 'portal';
    terrain[b[1]][b[0]] = 'portal';
    portals.push([a, b]);
  }
}
function genMap(cfg) {
  theme = THEMES[cfg.theme || 0];
  grid = []; hiddenItems = {}; terrain = []; portals = [];
  bubbles = []; explosions = []; items = []; particles = []; floats = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(Array.from({ length: COLS }, (_, c) =>
      (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) ? 1 : 0));
    terrain.push(new Array(COLS).fill(null));
  }
  buildWalls(cfg.layout);
  ensureConnected();
  // 随机摆放箱子并埋道具
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] !== 0 || nearSpawn(c, r, 2)) continue;
      if (Math.random() < cfg.boxP) {
        grid[r][c] = 2;
        const roll = Math.random();
        if (roll < 0.12) hiddenItems[K(c, r)] = 'power';
        else if (roll < 0.24) hiddenItems[K(c, r)] = 'bubble';
        else if (roll < 0.33) hiddenItems[K(c, r)] = 'speed';
        else if (roll < 0.36) hiddenItems[K(c, r)] = 'life';
        else if (roll < 0.43) hiddenItems[K(c, r)] = 'needle';
        else if (roll < 0.48) hiddenItems[K(c, r)] = 'glove';
        else if (roll < 0.53) hiddenItems[K(c, r)] = 'shield';
        else if (roll < 0.545) hiddenItems[K(c, r)] = 'max';
        else if (roll < 0.62) hiddenItems[K(c, r)] = 'skull';
      }
    }
  placeTerrain(cfg.terr || {});
}

/* ---------- 实体 ---------- */
function makePlayer() {
  return {
    kind: 'player', x: 1.5 * TILE, y: 1.5 * TILE,
    spd: 150, power: 2, maxB: 1, active: 0, lives: 3,
    needles: 0, glove: false, shield: 0,
    curse: 0, curseType: null, pushCool: 0,
    dir: 'down', moving: false, phase: 0,
    trapped: 0, mash: 0, mashNeed: 10, invuln: 0, blink: rnd(1, 4),
  };
}
function makeEnemy(c, r, cfg, color, type) {
  const m = TYPE_MODS[type] || {};
  return {
    kind: 'enemy', type, x: (c + .5) * TILE, y: (r + .5) * TILE,
    tc: c, tr: r, spd: cfg.espd * (m.spd || 1) * rnd(.9, 1.1),
    power: cfg.epow + (m.pow || 0), maxB: 1, active: 0,
    chaseP: m.chaseP || 0.4, coolMul: m.cool || 1,
    hp: m.hp || 0, scale: m.scale || 1, ball: m.ball || '#ffd34d',
    dir: 'down', lastDir: null, phase: rnd(0, 9),
    trapped: 0, invuln: 0, cool: rnd(cfg.cool[0], cfg.cool[1]) * (m.cool || 1), blink: rnd(1, 4),
  };
}
const allBeings = () => player ? [player, ...enemies] : [...enemies];

/* ---------- 碰撞 ---------- */
const BODY = 16; // 实体半径
const bubbleAt = (c, r) => bubbles.find(b => b.c === c && b.r === r);
function overlapsTile(e, c, r) {
  const m = BODY + 2;
  return e.x + m > c * TILE && e.x - m < (c + 1) * TILE &&
         e.y + m > r * TILE && e.y - m < (r + 1) * TILE;
}
function solidFor(e, c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  if (grid[r][c] !== 0) return true;
  const b = bubbleAt(c, r);
  return !!(b && !b.ghosts.includes(e));
}
function freePos(e, x, y) {
  const pts = [[x - BODY, y - BODY], [x + BODY, y - BODY], [x - BODY, y + BODY], [x + BODY, y + BODY]];
  return pts.every(p => !solidFor(e, Math.floor(p[0] / TILE), Math.floor(p[1] / TILE)));
}
// 轴向移动 + 拐角吸附（泡泡堂手感的关键）
function moveAxis(e, dx, dy, step) {
  if (dx) {
    const nx = e.x + dx * step;
    if (freePos(e, nx, e.y)) { e.x = nx; return; }
    const rowC = Math.floor(e.y / TILE);
    const aheadC = Math.floor((nx + dx * BODY) / TILE);
    if (!solidFor(e, aheadC, rowC)) {
      const cy = rowC * TILE + TILE / 2;
      const ny = e.y + clamp(cy - e.y, -step, step);
      if (freePos(e, e.x, ny)) e.y = ny;
    } else {
      e.x = dx > 0 ? aheadC * TILE - BODY - .01 : (aheadC + 1) * TILE + BODY + .01;
    }
  } else if (dy) {
    const ny = e.y + dy * step;
    if (freePos(e, e.x, ny)) { e.y = ny; return; }
    const colC = Math.floor(e.x / TILE);
    const aheadR = Math.floor((ny + dy * BODY) / TILE);
    if (!solidFor(e, colC, aheadR)) {
      const cx = colC * TILE + TILE / 2;
      const nx = e.x + clamp(cx - e.x, -step, step);
      if (freePos(e, nx, e.y)) e.x = nx;
    } else {
      e.y = dy > 0 ? aheadR * TILE - BODY - .01 : (aheadR + 1) * TILE + BODY + .01;
    }
  }
}

/* ---------- 水泡与爆炸 ---------- */
function placeBubble(e) {
  if (e.active >= e.maxB || e.trapped > 0) return;
  const [c, r] = tileOf(e);
  if (grid[r][c] !== 0 || bubbleAt(c, r)) return;
  const ghosts = allBeings().filter(o => overlapsTile(o, c, r));
  const power = (e.curseType === 'weak' && e.curse > 0) ? 1 : e.power;
  bubbles.push({ c, r, t: 2.6, owner: e, power, ghosts, born: timeNow, slide: null, fx: null, fy: null });
  e.active++;
  SND.place();
}
// 推推手：把泡泡朝 [dx,dy] 推出去，滑到障碍物前停下
function tryPushBubble(p, dx, dy) {
  const [c, r] = tileOf(p);
  const b = bubbleAt(c + dx, r + dy);
  if (!b || b.slide) return;
  // 必须贴着泡泡且大致对准格中心
  const alignOk = dx ? Math.abs(p.y - (b.r + .5) * TILE) < 14 : Math.abs(p.x - (b.c + .5) * TILE) < 14;
  const edge = dx ? Math.abs((b.c + (dx > 0 ? 0 : 1)) * TILE - p.x) : Math.abs((b.r + (dy > 0 ? 0 : 1)) * TILE - p.y);
  if (!alignOk || edge > BODY + 7) return;
  const nc = b.c + dx, nr = b.r + dy;
  if (nc <= 0 || nr <= 0 || nc >= COLS - 1 || nr >= ROWS - 1 || grid[nr][nc] !== 0 || bubbleAt(nc, nr)) return;
  b.slide = [dx, dy];
  b.fx = (b.c + .5) * TILE; b.fy = (b.r + .5) * TILE;
  p.pushCool = .3;
  SND.kick();
  addFloat(p.x, p.y - 32, '推~!', '#3fa9ff');
}
function breakBox(c, r) {
  grid[r][c] = 0;
  score += 10; updateHud();
  const it = hiddenItems[K(c, r)];
  if (it) { items.push({ c, r, type: it, age: 0 }); delete hiddenItems[K(c, r)]; }
  for (let i = 0; i < 7; i++) particles.push({
    x: (c + .5) * TILE, y: (r + .5) * TILE,
    vx: rnd(-130, 130), vy: rnd(-220, -40),
    t: rnd(.4, .7), max: .7, r: rnd(3, 7), color: Math.random() < .5 ? '#ffb86b' : '#e0823f', sq: true,
  });
}
function destroyItemAt(c, r) {
  const before = items.length;
  items = items.filter(it => it.c !== c || it.r !== r);
  if (items.length < before)
    for (let i = 0; i < 5; i++) particles.push({
      x: (c + .5) * TILE, y: (r + .5) * TILE,
      vx: rnd(-70, 70), vy: rnd(-130, -20), t: .4, max: .4, r: rnd(2, 4), color: '#ffe27a',
    });
}
function explodeBubble(b) {
  if (b.dead) return;
  b.dead = true;
  bubbles = bubbles.filter(x => x !== b);
  b.owner.active = Math.max(0, b.owner.active - 1);
  const tiles = [{ c: b.c, r: b.r, a: 'c' }];
  const set = new Set([K(b.c, b.r)]);
  for (const [dx, dy] of DIRS) {
    const axis = dx ? 'h' : 'v';
    for (let i = 1; i <= b.power; i++) {
      const c = b.c + dx * i, r = b.r + dy * i;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || grid[r][c] === 1) break;
      if (grid[r][c] === 2) {
        breakBox(c, r);
        tiles.push({ c, r, a: axis, cap: true }); set.add(K(c, r));
        break;
      }
      tiles.push({ c, r, a: axis, cap: i === b.power }); set.add(K(c, r));
      destroyItemAt(c, r);
      const ob = bubbleAt(c, r);
      if (ob) { explodeBubble(ob); break; } // 连锁引爆
    }
  }
  explosions.push({ tiles, set, t: .5, max: .5, hit: new Set() });
  shake = Math.min(1, shake + .5);
  SND.boom();
  for (let i = 0; i < 10; i++) particles.push({
    x: (b.c + .5) * TILE + rnd(-10, 10), y: (b.r + .5) * TILE + rnd(-10, 10),
    vx: rnd(-160, 160), vy: rnd(-240, -60), t: rnd(.35, .6), max: .6,
    r: rnd(2.5, 5.5), color: Math.random() < .5 ? '#9adcff' : '#d9f2ff',
  });
}

/* ---------- 被困 / 破泡 ---------- */
function trapHit(e) {
  if (e.dead || e.trapped > 0 || e.invuln > 0) return;
  if (e.kind === 'player') {
    if (e.shield > 0) {
      e.shield--; e.invuln = 1.5;
      SND.free(); addFloat(e.x, e.y - 40, '🛡️ 护盾抵挡!', '#43b96e');
      updateHud(); return;
    }
    if (e.needles > 0) {
      e.needles--; e.invuln = 1.2;
      SND.free(); addFloat(e.x, e.y - 40, '🪡 针！自动脱困', '#43b96e');
      updateHud(); return;
    }
  }
  e.trapped = e.kind === 'player' ? 4.2 : (e.hp ? 2.4 : 3.2);
  e.mash = 0;
  SND.trap();
  if (e.kind === 'player') addFloat(e.x, e.y - 40, '狂按按键挣脱!', '#ff5d7e');
}
function popEntity(e) {
  SND.pop();
  for (let i = 0; i < 12; i++) particles.push({
    x: e.x + rnd(-8, 8), y: e.y + rnd(-12, 4),
    vx: rnd(-180, 180), vy: rnd(-260, -50), t: rnd(.4, .7), max: .7,
    r: rnd(2.5, 6), color: ['#9adcff', '#fff', '#ffd34d'][Math.floor(rnd(0, 3))],
  });
  if (e.kind === 'enemy') {
    if (e.hp > 1) { // Boss 掉一滴血，短暂无敌后继续战斗
      e.hp--; e.trapped = 0; e.invuln = 2.2;
      score += 150; shake = Math.min(1, shake + .5);
      addFloat(e.x, e.y - 40, `👑 魔王受伤! ❤️×${e.hp}`, '#9b6cf0');
      updateHud(); return;
    }
    e.dead = true;
    enemies = enemies.filter(x => x !== e);
    let gain = e.type === 'boss' ? 300 : 100;
    if (timeNow - lastKillAt < 1.4) { gain += 50; addFloat(e.x, e.y - 44, '连击!', '#ff5d7e'); }
    lastKillAt = timeNow;
    score += gain;
    addFloat(e.x, e.y - 26, '+' + gain, '#ff9b3d');
    updateHud();
    if (!enemies.length && state === 'playing') roundClear();
  } else {
    e.lives--;
    updateHud();
    if (e.lives <= 0) { gameOver(); }
    else {
      e.trapped = 0; e.x = 1.5 * TILE; e.y = 1.5 * TILE; e.invuln = 2.5;
      addFloat(e.x, e.y - 30, '-1 ❤️', '#ff5d7e');
    }
  }
}
function addFloat(x, y, txt, color) {
  floats.push({ x, y, txt, color, t: 1 });
}

/* ---------- 敌人 AI ---------- */
function addBlast(set, c0, r0, p) {
  set.add(K(c0, r0));
  for (const [dx, dy] of DIRS)
    for (let i = 1; i <= p; i++) {
      const c = c0 + dx * i, r = r0 + dy * i;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || grid[r][c] !== 0) break;
      set.add(K(c, r));
    }
}
function dangerSet() {
  const s = new Set();
  for (const b of bubbles) addBlast(s, b.c, b.r, b.power);
  for (const ex of explosions) ex.set.forEach(k => s.add(k));
  return s;
}
const aiPass = (c, r) =>
  c > 0 && r > 0 && c < COLS - 1 && r < ROWS - 1 && grid[r][c] === 0 && !bubbleAt(c, r);

// BFS：从危险区找最近安全格，返回第一步 [c,r]
function bfsToSafe(c0, r0, danger) {
  const q = [[c0, r0, null]];
  const seen = new Set([K(c0, r0)]);
  while (q.length && seen.size < 70) {
    const [c, r, first] = q.shift();
    if (!danger.has(K(c, r))) return first;
    for (const [dx, dy] of DIRS) {
      const nc = c + dx, nr = r + dy, k = K(nc, nr);
      if (aiPass(nc, nr) && !seen.has(k)) {
        seen.add(k);
        q.push([nc, nr, first || [nc, nr]]);
      }
    }
  }
  return null;
}
function shouldBomb(e, c, r) {
  // 旁边有箱子
  for (const [dx, dy] of DIRS)
    if (grid[r + dy] && grid[r + dy][c + dx] === 2) return true;
  // 与玩家同行/同列且射程内无遮挡
  if (player && player.trapped <= 0) {
    const [pc, pr] = tileOf(player);
    if (pr === r && Math.abs(pc - c) <= e.power) {
      let clear = true;
      for (let i = Math.min(pc, c) + 1; i < Math.max(pc, c); i++) if (grid[r][i] !== 0) clear = false;
      if (clear) return true;
    }
    if (pc === c && Math.abs(pr - r) <= e.power) {
      let clear = true;
      for (let i = Math.min(pr, r) + 1; i < Math.max(pr, r); i++) if (grid[i][c] !== 0) clear = false;
      if (clear) return true;
    }
  }
  return Math.random() < 0.04;
}
function enemyDecide(e) {
  const c = e.tc, r = e.tr;
  const danger = dangerSet();
  const setTarget = (tc, tr) => { e.tc = tc; e.tr = tr; e.lastDir = [tc - c, tr - r]; };
  // 1. 脚下危险 → 逃命
  if (danger.has(K(c, r))) {
    const step = bfsToSafe(c, r, danger);
    if (step) setTarget(step[0], step[1]);
    return;
  }
  // 2. 想放泡泡（先确认放完逃得掉）
  if (e.cool <= 0 && e.active < e.maxB && shouldBomb(e, c, r)) {
    const sim = new Set(danger);
    addBlast(sim, c, r, e.power);
    if (bfsToSafe(c, r, sim)) {
      placeBubble(e);
      e.cool = rnd(curCfg.cool[0], curCfg.cool[1]) * e.coolMul;
      const step = bfsToSafe(c, r, dangerSet());
      if (step) setTarget(step[0], step[1]);
      return;
    }
    e.cool = 1;
  }
  // 3. 闲逛：避开危险格，偶尔追玩家（玩家被困时猛扑）
  const opts = DIRS.map(([dx, dy]) => [c + dx, r + dy])
    .filter(([nc, nr]) => aiPass(nc, nr) && !danger.has(K(nc, nr)));
  if (!opts.length) { e.lastDir = null; return; }
  let pick;
  const chaseP = player && player.trapped > 0 ? 0.95 : e.chaseP;
  if (player && Math.random() < chaseP) {
    const [pc, pr] = tileOf(player);
    opts.sort((a, b) =>
      (Math.abs(a[0] - pc) + Math.abs(a[1] - pr)) - (Math.abs(b[0] - pc) + Math.abs(b[1] - pr)));
    pick = opts[0];
  } else if (e.lastDir && Math.random() < 0.55) {
    pick = opts.find(([nc, nr]) => nc === c + e.lastDir[0] && nr === r + e.lastDir[1]) ||
           opts[Math.floor(rnd(0, opts.length))];
  } else {
    pick = opts[Math.floor(rnd(0, opts.length))];
  }
  setTarget(pick[0], pick[1]);
}
function updateEnemy(e, dt) {
  if (e.trapped > 0) {
    e.trapped -= dt;
    if (e.trapped <= 0) popEntity(e);
    return;
  }
  e.cool -= dt;
  e.phase += dt * 8;
  const cx = (e.tc + .5) * TILE, cy = (e.tr + .5) * TILE;
  const dx = cx - e.x, dy = cy - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) { e.x = cx; e.y = cy; enemyDecide(e); return; }
  // 目标格中途被泡泡堵住 → 退回
  if (solidFor(e, e.tc, e.tr) && !overlapsTile(e, e.tc, e.tr)) {
    const [c, r] = tileOf(e);
    e.tc = c; e.tr = r; e.lastDir = null;
    return;
  }
  const step = Math.min(d, e.spd * terrFactor(e) * dt);
  e.x += dx / d * step; e.y += dy / d * step;
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

/* ---------- 玩家 ---------- */
const KEY_DIRS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let dirStack = [];

// 脚下地形的速度系数：冰面滑得快，泥地拔不动腿
function terrFactor(e) {
  const [c, r] = tileOf(e);
  const t = terrain[r] && terrain[r][c];
  return t === 'ice' ? 1.35 : t === 'mud' ? 0.6 : 1;
}
// 传送门：站上中心就被吸到另一端
function updatePortals(dt) {
  for (const e of allBeings()) {
    e.portalCool = Math.max(0, (e.portalCool || 0) - dt);
    if (e.dead || e.trapped > 0 || e.portalCool > 0) continue;
    const [c, r] = tileOf(e);
    if ((terrain[r] || [])[c] !== 'portal') continue;
    if (Math.abs(e.x - (c + .5) * TILE) > 10 || Math.abs(e.y - (r + .5) * TILE) > 10) continue;
    const pair = portals.find(p =>
      (p[0][0] === c && p[0][1] === r) || (p[1][0] === c && p[1][1] === r));
    if (!pair) continue;
    const [tc, tr] = (pair[0][0] === c && pair[0][1] === r) ? pair[1] : pair[0];
    if (bubbleAt(tc, tr)) continue; // 出口被泡泡堵住
    for (const [px, py] of [[e.x, e.y], [(tc + .5) * TILE, (tr + .5) * TILE]])
      for (let i = 0; i < 6; i++) particles.push({
        x: px + rnd(-8, 8), y: py + rnd(-8, 8),
        vx: rnd(-90, 90), vy: rnd(-160, -30), t: .5, max: .5,
        r: rnd(2, 4.5), color: Math.random() < .5 ? '#c98aff' : '#7be8ff',
      });
    e.x = (tc + .5) * TILE; e.y = (tr + .5) * TILE;
    e.portalCool = 1.8;
    if (e.kind === 'enemy') { e.tc = tc; e.tr = tr; e.lastDir = null; }
    SND.portal();
  }
}
const REV_DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };
function applyCurse(p) {
  const keys = Object.keys(CURSES);
  p.curseType = keys[Math.floor(rnd(0, keys.length))];
  p.curse = 8;
  SND.curse();
  addFloat(p.x, p.y - 48, CURSES[p.curseType], '#9b6cf0');
}
function updatePlayer(p, dt) {
  if (p.invuln > 0) p.invuln -= dt;
  if (p.pushCool > 0) p.pushCool -= dt;
  if (p.curse > 0) {
    p.curse -= dt;
    if (p.curse <= 0) { p.curseType = null; addFloat(p.x, p.y - 36, '✨ 诅咒解除', '#43b96e'); }
  }
  if (p.trapped > 0) {
    p.trapped -= dt;
    if (p.trapped <= 0) popEntity(p);
    return;
  }
  let d = dirStack[dirStack.length - 1];
  if (d && p.curseType === 'reverse') d = REV_DIR[d];
  p.moving = !!d;
  if (d) {
    p.dir = d;
    const [dx, dy] = DIR_VEC[d];
    const spd = p.spd * (p.curseType === 'slow' ? 0.55 : 1) * terrFactor(p);
    moveAxis(p, dx, dy, spd * dt);
    if (p.glove && p.pushCool <= 0) tryPushBubble(p, dx, dy);
  }
  p.phase += dt * (p.moving ? 11 : 3);
  // 捡道具
  const [c, r] = tileOf(p);
  const it = items.find(i => i.c === c && i.r === r);
  if (it) {
    items = items.filter(x => x !== it);
    SND.item();
    switch (it.type) {
      case 'power':  p.power = Math.min(8, p.power + 1); break;
      case 'bubble': p.maxB = Math.min(8, p.maxB + 1); break;
      case 'speed':  p.spd = Math.min(240, p.spd + 18); break;
      case 'life':   p.lives = Math.min(5, p.lives + 1); break;
      case 'needle': p.needles = Math.min(3, p.needles + 1); break;
      case 'glove':  if (p.glove) score += 30; p.glove = true; break;
      case 'shield': p.shield = Math.min(2, p.shield + 1); break;
      case 'max':    p.power = 8; break;
      case 'skull':  applyCurse(p); break;
    }
    score += 20;
    if (it.type !== 'skull') addFloat(p.x, p.y - 34, ITEM_INFO[it.type].label, '#3fa9ff');
    updateHud();
  }
}

/* ---------- 主更新 ---------- */
function update(dt) {
  timeNow += dt;
  // 粒子和飘字始终更新
  for (const pt of particles) {
    pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 700 * dt;
  }
  particles = particles.filter(p => p.t > 0);
  for (const f of floats) { f.t -= dt * .8; f.y -= 34 * dt; }
  floats = floats.filter(f => f.t > 0);
  shake = Math.max(0, shake - dt * 2.4);

  if (state !== 'playing') return;

  updatePlayer(player, dt);
  updateCurseBadge();
  for (const e of [...enemies]) updateEnemy(e, dt);
  updatePortals(dt);

  // 水泡：滑行、清理离开的“幽灵”、倒计时引爆
  for (const b of [...bubbles]) {
    if (b.slide) {
      const [sx, sy] = b.slide, spd = 280;
      b.fx += sx * spd * dt; b.fy += sy * spd * dt;
      const nc = b.c + sx, nr = b.r + sy;
      const cx = (nc + .5) * TILE, cy = (nr + .5) * TILE;
      const passed = sx ? (sx > 0 ? b.fx >= cx : b.fx <= cx) : (sy > 0 ? b.fy >= cy : b.fy <= cy);
      if (passed) {
        b.c = nc; b.r = nr;
        // 滑到别人脚下时让他们能走出去，避免被卡死
        b.ghosts = allBeings().filter(o => overlapsTile(o, nc, nr));
        const fc = nc + sx, fr = nr + sy;
        const blocked = fc <= 0 || fr <= 0 || fc >= COLS - 1 || fr >= ROWS - 1 ||
                        grid[fr][fc] !== 0 || bubbleAt(fc, fr);
        if (blocked) { b.slide = null; b.fx = cx; b.fy = cy; }
      }
    }
    b.ghosts = b.ghosts.filter(o => overlapsTile(o, b.c, b.r));
    b.t -= dt;
    if (b.t <= 0) explodeBubble(b);
  }
  // 爆炸命中判定（每个爆炸对每个实体只结算一次）
  for (const ex of explosions) {
    ex.t -= dt;
    for (const o of allBeings()) {
      if (o.dead || ex.hit.has(o)) continue;
      const [c, r] = tileOf(o);
      if (ex.set.has(K(c, r))) {
        ex.hit.add(o);
        if (o.trapped > 0) popEntity(o); else trapHit(o);
      }
    }
  }
  explosions = explosions.filter(ex => ex.t > 0);

  // 接触结算：碰到被困的对方 → 破泡
  const touchR = e => BODY + BODY * (e.scale || 1) - 4;
  if (player && player.trapped <= 0 && !player.dead) {
    for (const e of [...enemies])
      if (e.trapped > 0 && Math.hypot(e.x - player.x, e.y - player.y) < touchR(e)) popEntity(e);
  }
  if (player && player.trapped > 0) {
    for (const e of enemies)
      if (e.trapped <= 0 && Math.hypot(e.x - player.x, e.y - player.y) < touchR(e)) { popEntity(player); break; }
  }
}

/* ================================================================
   绘制
   ================================================================ */
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 7, rnd(-1, 1) * shake * 7);

  drawFloor();
  drawBlocks();
  for (const it of items) drawItem(it);
  for (const b of bubbles) drawBubble(b);
  for (const ex of explosions) drawExplosion(ex);

  const beings = allBeings().filter(e => !e.dead).sort((a, b) => a.y - b.y);
  for (const e of beings) drawBeing(ctx, e);
  drawCovers(); // 草丛盖在角色上面

  for (const pt of particles) {
    ctx.globalAlpha = clamp(pt.t / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    if (pt.sq) { ctx.fillRect(pt.x - pt.r, pt.y - pt.r, pt.r * 2, pt.r * 2); }
    else { ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  for (const f of floats) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.font = '700 17px "ZCOOL KuaiLe","Baloo 2",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff';
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawStar(g, x, y, r1, r2, n, rot) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n;
    const rad = i % 2 ? r2 : r1;
    g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
}
function drawFloor() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;
      ctx.fillStyle = (c + r) % 2 ? theme.fB : theme.fA;
      ctx.fillRect(x, y, TILE, TILE);
      if (grid[r][c] !== 0) continue;
      drawDecal(c, r, x, y);
      const t = terrain[r][c];
      if (t === 'ice') {        // 冰面：滑溜溜
        ctx.fillStyle = 'rgba(190,230,255,.75)';
        rr(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 10, y + 30); ctx.lineTo(x + 26, y + 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 22, y + 34); ctx.lineTo(x + 34, y + 22); ctx.stroke();
      } else if (t === 'mud') { // 泥地：黏糊糊
        ctx.fillStyle = '#b08a5a';
        rr(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 14); ctx.fill();
        ctx.strokeStyle = '#93714a'; ctx.lineWidth = 2.5;
        rr(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 14); ctx.stroke();
        ctx.fillStyle = '#9a7850';
        const bp = Math.sin(timeNow * 3 + c * 2 + r) * 1.5;
        ctx.beginPath(); ctx.arc(x + 15, y + 18, 3.5 + bp, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 30, y + 28, 2.5 - bp * .6, 0, 7); ctx.fill();
      } else if (t === 'portal') drawPortal(x, y, c + r);
    }
}
function drawDecal(c, r, x, y) {
  const h = (c * 53 + r * 97) % 100;
  const ox = x + 9 + (h * 13) % 26, oy = y + 9 + (h * 29) % 26;
  switch (theme.decal) {
    case 'grass':
      if (h < 8) {        // 小花
        ctx.fillStyle = h % 2 ? '#ff9bb5' : '#fff';
        for (let i = 0; i < 4; i++)
          { ctx.beginPath(); ctx.arc(ox + Math.cos(i * 1.57) * 3.5, oy + Math.sin(i * 1.57) * 3.5, 2.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, 7); ctx.fill();
      } else if (h < 18) { // 草簇
        ctx.strokeStyle = 'rgba(110,175,85,.8)'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++)
          { ctx.beginPath(); ctx.moveTo(ox + i * 3, oy + 4); ctx.quadraticCurveTo(ox + i * 4, oy - 2, ox + i * 5, oy - 5); ctx.stroke(); }
      } else if (h < 23) { // 小石子
        ctx.fillStyle = 'rgba(150,160,150,.5)';
        ctx.beginPath(); ctx.ellipse(ox, oy, 3.5, 2.5, .4, 0, 7); ctx.fill();
      }
      break;
    case 'beach':
      if (h < 7) {        // 海星
        ctx.fillStyle = '#ff9b66';
        drawStar(ctx, ox, oy, 6, 2.6, 5, h); ctx.fill();
        ctx.strokeStyle = '#e07840'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (h < 14) { // 贝壳
        ctx.fillStyle = '#ffd9e3';
        ctx.beginPath(); ctx.arc(ox, oy, 5, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e8a0b5'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox - 3, oy - 1); ctx.lineTo(ox - 1, oy - 4); ctx.moveTo(ox + 1, oy - 4.5); ctx.lineTo(ox + 3, oy - 1); ctx.stroke();
      } else if (h < 26) { // 湿沙
        ctx.fillStyle = 'rgba(200,160,100,.25)';
        ctx.beginPath(); ctx.ellipse(ox, oy, 8, 5, .3, 0, 7); ctx.fill();
      }
      break;
    case 'snow':
      if (h < 12) {       // 雪花闪光
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy);
        ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4);
        ctx.moveTo(ox - 2.6, oy - 2.6); ctx.lineTo(ox + 2.6, oy + 2.6);
        ctx.moveTo(ox - 2.6, oy + 2.6); ctx.lineTo(ox + 2.6, oy - 2.6); ctx.stroke();
      } else if (h < 22) {
        ctx.fillStyle = 'rgba(160,200,235,.5)';
        ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, 7); ctx.fill();
      }
      break;
    case 'stone':         // 石板缝 + 裂纹 + 魔法符文
      ctx.strokeStyle = 'rgba(70,60,95,.22)'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      if (h < 9) {
        ctx.strokeStyle = 'rgba(70,60,95,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox - 6, oy - 4); ctx.lineTo(ox - 1, oy); ctx.lineTo(ox - 3, oy + 5); ctx.stroke();
      } else if (h < 14) {
        ctx.globalAlpha = .35 + Math.sin(timeNow * 2 + h) * .2;
        ctx.fillStyle = '#b06cf0';
        drawStar(ctx, ox, oy, 4.5, 1.8, 4, .7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
  }
}
function drawPortal(x, y, seed) {
  const cx = x + TILE / 2, cy = y + TILE / 2;
  const ang = timeNow * 2.5 + seed;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
  g.addColorStop(0, 'rgba(190,240,255,.95)');
  g.addColorStop(.6, 'rgba(170,110,250,.55)');
  g.addColorStop(1, 'rgba(170,110,250,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, 17, 0, 7); ctx.fill();
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 3; i++) {  // 旋转的弧光
    ctx.strokeStyle = i % 2 ? '#b06cf0' : '#6fd8ff';
    ctx.beginPath(); ctx.arc(cx, cy, 14, ang + i * 2.1, ang + i * 2.1 + 1.2); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  drawStar(ctx, cx, cy, 4 + Math.sin(timeNow * 5 + seed) * 1.2, 1.6, 4, ang); ctx.fill();
}
function drawBlocks() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = r * TILE;
      const h = (c * 53 + r * 97) % 100;
      if (grid[r][c] === 1) drawWall(x, y, h);
      else if (grid[r][c] === 2) drawBox(x, y, h);
    }
}
function drawWall(x, y, h) {
  switch (theme.wall) {
    case 'sand':   // 沙堡块：城垛 + 小拱门
      ctx.fillStyle = '#dec183';
      rr(ctx, x + 2, y + 8, TILE - 4, TILE - 10, 6); ctx.fill();
      ctx.fillStyle = '#ecd29b';
      rr(ctx, x + 2, y + 6, TILE - 4, TILE - 16, 6); ctx.fill();
      ctx.fillStyle = '#e4c88e';
      for (let i = 0; i < 3; i++) { rr(ctx, x + 4 + i * 14, y + 2, 10, 9, 3); ctx.fill(); }
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#b89455';
      rr(ctx, x + 2, y + 6, TILE - 4, TILE - 8, 6); ctx.stroke();
      for (let i = 0; i < 3; i++) { rr(ctx, x + 4 + i * 14, y + 2, 10, 9, 3); ctx.stroke(); }
      if (h < 18) { // 小拱门
        ctx.fillStyle = '#a8854c';
        ctx.beginPath(); ctx.arc(x + 23, y + 36, 7, Math.PI, 0); ctx.lineTo(x + 30, y + 44); ctx.lineTo(x + 16, y + 44); ctx.closePath(); ctx.fill();
      }
      break;
    case 'ice':    // 大冰块
      ctx.fillStyle = 'rgba(170,218,248,.95)';
      rr(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 9); ctx.fill();
      ctx.fillStyle = 'rgba(225,245,255,.95)';
      ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 30, y + 4); ctx.lineTo(x + 4, y + 30); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#8db9da';
      rr(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 9); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 26, y + 32); ctx.lineTo(x + 36, y + 22); ctx.stroke();
      break;
    case 'brick':  // 城堡砖墙，偶有火把
      ctx.fillStyle = '#6e6280';
      rr(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(48,40,64,.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 15); ctx.lineTo(x + 45, y + 15);
      ctx.moveTo(x + 1, y + 30); ctx.lineTo(x + 45, y + 30);
      ctx.moveTo(x + 23, y + 1); ctx.lineTo(x + 23, y + 15);
      ctx.moveTo(x + 12, y + 15); ctx.lineTo(x + 12, y + 30);
      ctx.moveTo(x + 34, y + 15); ctx.lineTo(x + 34, y + 30);
      ctx.moveTo(x + 23, y + 30); ctx.lineTo(x + 23, y + 45);
      ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#403655';
      rr(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5); ctx.stroke();
      if (h < 10) { // 火把
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 21, y + 22, 4, 14);
        const fl = Math.sin(timeNow * 9 + h) * 2;
        ctx.fillStyle = '#ff9b3d';
        ctx.beginPath(); ctx.ellipse(x + 23, y + 16, 5, 8 + fl, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath(); ctx.ellipse(x + 23, y + 18, 2.5, 4 + fl * .5, 0, 0, 7); ctx.fill();
      } else if (h < 16) { // 青苔
        ctx.fillStyle = 'rgba(110,160,90,.55)';
        ctx.beginPath(); ctx.ellipse(x + 10, y + 40, 7, 4, 0, 0, 7); ctx.fill();
      }
      break;
    default:       // cloud 云朵硬块
      ctx.fillStyle = '#dce8f5';
      rr(ctx, x + 2, y + 4, TILE - 4, TILE - 6, 12); ctx.fill();
      ctx.fillStyle = '#f4f9ff';
      rr(ctx, x + 2, y + 2, TILE - 4, TILE - 12, 12); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#b6c8de';
      rr(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 12); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(x + 14, y + 13, 4.5, 0, 7); ctx.fill();
  }
}
function drawBox(x, y, h) {
  switch (theme.box) {
    case 'chest':  // 宝箱
      ctx.fillStyle = '#8c5c2e';
      rr(ctx, x + 4, y + 5, TILE - 8, 16, 7); ctx.fill();
      ctx.fillStyle = '#a9743f';
      rr(ctx, x + 4, y + 17, TILE - 8, 24, 5); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      rr(ctx, x + 4, y + 5, TILE - 8, 36, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 5, y + 19); ctx.lineTo(x + 41, y + 19); ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(x + 19, y + 5, 8, 36);
      ctx.strokeRect(x + 19, y + 5, 8, 36);
      ctx.beginPath(); ctx.arc(x + 23, y + 22, 4, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'icebox': // 冻住的箱子
      ctx.fillStyle = '#bfe2f5';
      rr(ctx, x + 4, y + 6, TILE - 8, TILE - 10, 8); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#7ea8c2';
      rr(ctx, x + 4, y + 6, TILE - 8, TILE - 10, 8); ctx.stroke();
      // 顶上积雪
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 12);
      ctx.quadraticCurveTo(x + 10, y + 2, x + 17, y + 9);
      ctx.quadraticCurveTo(x + 23, y + 1, x + 30, y + 8);
      ctx.quadraticCurveTo(x + 38, y + 2, x + 42, y + 12);
      ctx.lineTo(x + 4, y + 12); ctx.fill();
      // 睡着的脸
      ctx.strokeStyle = '#5e83a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 14, y + 24); ctx.lineTo(x + 20, y + 24);
      ctx.moveTo(x + 27, y + 24); ctx.lineTo(x + 33, y + 24); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 23, y + 31, 3, 0, Math.PI); ctx.stroke();
      break;
    case 'barrel': // 木桶
      ctx.fillStyle = '#7a5230';
      rr(ctx, x + 6, y + 4, TILE - 12, TILE - 8, 12); ctx.fill();
      ctx.strokeStyle = '#5e3d22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 17, y + 6); ctx.lineTo(x + 17, y + 40);
      ctx.moveTo(x + 29, y + 6); ctx.lineTo(x + 29, y + 40); ctx.stroke();
      ctx.fillStyle = '#c9c2b8';
      ctx.fillRect(x + 6, y + 12, TILE - 12, 5);
      ctx.fillRect(x + 6, y + 29, TILE - 12, 5);
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      rr(ctx, x + 6, y + 4, TILE - 12, TILE - 8, 12); ctx.stroke();
      break;
    default:       // gift 点心箱
      ctx.fillStyle = '#e0823f';
      rr(ctx, x + 4, y + 7, TILE - 8, TILE - 11, 9); ctx.fill();
      ctx.fillStyle = '#ffb86b';
      rr(ctx, x + 4, y + 4, TILE - 8, TILE - 14, 9); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      rr(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 9); ctx.stroke();
      ctx.fillStyle = '#ff7b9c';
      ctx.fillRect(x + TILE / 2 - 3, y + 5, 6, TILE - 10);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x + 16, y + 22, 2.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 30, y + 22, 2.2, 0, 7); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.arc(x + 23, y + 26, 4, .3, Math.PI - .3); ctx.stroke();
  }
}
// 草丛等遮挡物：画在角色上面，藏进去就只露个影子
function drawCovers() {
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++) {
      if (terrain[r][c] !== 'cover') continue;
      const x = c * TILE, y = r * TILE;
      const inWater = explosions.some(ex => ex.set.has(K(c, r)));
      ctx.globalAlpha = inWater ? .3 : .94;
      const sway = Math.sin(timeNow * 2 + c * 1.7 + r) * 1.2;
      switch (theme.cover) {
        case 'sandpile': // 沙丘 + 海草
          ctx.fillStyle = '#ecd49e';
          ctx.beginPath(); ctx.ellipse(x + 23, y + 28, 19, 14, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = '#c9a86b'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(x + 23, y + 28, 19, 14, 0, 0, 7); ctx.stroke();
          ctx.strokeStyle = '#6fae62'; ctx.lineWidth = 2.5;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath(); ctx.moveTo(x + 23 + i * 7, y + 22);
            ctx.quadraticCurveTo(x + 23 + i * 9 + sway, y + 10, x + 23 + i * 11 + sway, y + 5);
            ctx.stroke();
          }
          break;
        case 'snowpile': // 雪堆
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.ellipse(x + 23, y + 28, 19, 14, 0, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 14, y + 18, 9, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 30, y + 16, 11, 0, 7); ctx.fill();
          ctx.strokeStyle = '#bcd8ec'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(x + 23, y + 28, 19, 14, 0, 0, 7); ctx.stroke();
          ctx.fillStyle = '#dceefa';
          ctx.beginPath(); ctx.ellipse(x + 25, y + 33, 10, 4, 0, 0, 7); ctx.fill();
          break;
        case 'thorn':    // 荆棘丛
          ctx.fillStyle = '#5d4a73';
          for (const [bx, by, br] of [[14, 26, 11], [30, 25, 12], [22, 16, 11]])
            { ctx.beginPath(); ctx.arc(x + bx, y + by + sway * .5, br, 0, 7); ctx.fill(); }
          ctx.strokeStyle = '#46365a'; ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            const a = i * 1.25 + .4;
            ctx.beginPath();
            ctx.moveTo(x + 22 + Math.cos(a) * 10, y + 22 + Math.sin(a) * 8);
            ctx.lineTo(x + 22 + Math.cos(a) * 17, y + 22 + Math.sin(a) * 14);
            ctx.stroke();
          }
          ctx.fillStyle = '#ff5d6e';
          ctx.beginPath(); ctx.arc(x + 16, y + 20, 2.5, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 29, y + 29, 2.5, 0, 7); ctx.fill();
          break;
        default:         // bush 灌木丛
          ctx.fillStyle = '#5cab46';
          for (const [bx, by, br] of [[14, 26, 12], [31, 26, 12], [22, 15, 12]])
            { ctx.beginPath(); ctx.arc(x + bx + sway * .4, y + by, br, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#6fbf57';
          for (const [bx, by, br] of [[14, 24, 8], [30, 24, 8], [22, 13, 8]])
            { ctx.beginPath(); ctx.arc(x + bx + sway * .4, y + by, br, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#ff7b9c';
          ctx.beginPath(); ctx.arc(x + 17, y + 19, 2.3, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 28, y + 28, 2.3, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
}
function drawItem(it) {
  it.age = (it.age || 0) + 1 / 60;
  const x = (it.c + .5) * TILE, y = (it.r + .5) * TILE + Math.sin(timeNow * 4 + it.c) * 3;
  const s = Math.min(1, it.age * 5);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(74,57,51,.18)';
  ctx.beginPath(); ctx.ellipse(0, 16, 12, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fffdf6';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ITEM_INFO[it.type].icon, 0, 1.5);
  ctx.restore();
}
function drawBubble(b) {
  const x = b.slide ? b.fx : (b.c + .5) * TILE;
  const y = b.slide ? b.fy : (b.r + .5) * TILE;
  const urgent = b.t < 0.75;
  const wob = Math.sin((timeNow - b.born) * (urgent ? 22 : 6));
  const rad = 19 + wob * (urgent ? 2.5 : 1.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + wob * .04, 1 - wob * .04);
  const g = ctx.createRadialGradient(-5, -6, 3, 0, 0, rad);
  g.addColorStop(0, urgent ? 'rgba(255,235,240,.95)' : 'rgba(225,245,255,.95)');
  g.addColorStop(.65, urgent ? 'rgba(255,150,170,.7)' : 'rgba(120,200,255,.7)');
  g.addColorStop(1, urgent ? 'rgba(245,90,120,.85)' : 'rgba(60,150,235,.85)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.ellipse(-6, -7, 4.5, 3, -.6, 0, 7); ctx.fill();
  ctx.restore();
}
function drawExplosion(ex) {
  const p = ex.t / ex.max;             // 1 → 0
  const grow = p > .8 ? (1 - p) / .2 : 1; // 起爆瞬间撑开
  const wph = TILE * (.32 + .42 * grow * p) ; // 水柱半宽
  ctx.save();
  ctx.globalAlpha = clamp(p * 1.6, 0, 1);
  for (const t of ex.tiles) {
    const x = (t.c + .5) * TILE, y = (t.r + .5) * TILE;
    ctx.fillStyle = '#5ec1ff';
    if (t.a === 'c') { ctx.beginPath(); ctx.arc(x, y, wph * 1.25, 0, 7); ctx.fill(); }
    else if (t.a === 'h') { rr(ctx, x - TILE / 2 - 1, y - wph, TILE + 2, wph * 2, t.cap ? wph : 4); ctx.fill(); }
    else { rr(ctx, x - wph, y - TILE / 2 - 1, wph * 2, TILE + 2, t.cap ? wph : 4); ctx.fill(); }
  }
  // 亮芯
  for (const t of ex.tiles) {
    const x = (t.c + .5) * TILE, y = (t.r + .5) * TILE;
    const w2 = wph * .5;
    ctx.fillStyle = '#dff4ff';
    if (t.a === 'c') { ctx.beginPath(); ctx.arc(x, y, w2 * 1.4, 0, 7); ctx.fill(); }
    else if (t.a === 'h') { rr(ctx, x - TILE / 2, y - w2, TILE, w2 * 2, w2); ctx.fill(); }
    else { rr(ctx, x - w2, y - TILE / 2, w2 * 2, TILE, w2); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------- 角色绘制 ---------- */
function drawBeing(g, e) {
  const blinkOn = (timeNow % e.blink) > e.blink - .12;
  if (e.invuln > 0 && Math.floor(timeNow * 10) % 2) return; // 无敌闪烁
  if (e.trapped > 0) { drawTrapped(g, e, blinkOn); return; }
  if (e.kind === 'player') drawCutie(g, e.x, e.y, e, blinkOn, false);
  else drawBlob(g, e.x, e.y, e, blinkOn, false);
}
function drawTrapped(g, e) {
  const bob = Math.sin(timeNow * 5) * 3;
  const x = e.x, y = e.y - 6 + bob;
  const danger = e.trapped < 1.2;
  g.save();
  g.translate(x, y); g.scale(.82, .82); g.translate(-x, -y);
  if (e.kind === 'player') drawCutie(g, x, y, e, false, true);
  else drawBlob(g, x, y, e, false, true);
  g.restore();
  // 外层大泡泡（按体型放大，Boss 也能装下）
  const sc = e.scale || 1;
  const flash = danger && Math.floor(timeNow * 8) % 2;
  const gr = g.createRadialGradient(x - 8 * sc, y - 12 * sc, 4, x, y - 4, 30 * sc);
  gr.addColorStop(0, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, flash ? 'rgba(255,120,140,.45)' : 'rgba(110,190,255,.4)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y - 4, 29 * sc, 0, 7); g.fill();
  g.lineWidth = 3; g.strokeStyle = flash ? 'rgba(255,160,175,.95)' : 'rgba(255,255,255,.9)';
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath(); g.ellipse(x - 9 * sc, y - 15 * sc, 6 * sc, 4 * sc, -.6, 0, 7); g.fill();
  // 玩家挣脱进度条
  if (e.kind === 'player') {
    const w = 46, pr = clamp(e.mash / e.mashNeed, 0, 1);
    g.fillStyle = 'rgba(74,57,51,.75)';
    rr(g, x - w / 2, y - 46, w, 8, 4); g.fill();
    g.fillStyle = '#ffd34d';
    if (pr > 0) { rr(g, x - w / 2 + 1.5, y - 44.5, (w - 3) * pr, 5, 2.5); g.fill(); }
  }
}
// 兔耳小可爱（玩家）
function drawCutie(g, x, y, e, blinkOn, panic) {
  const walk = e.moving ? Math.sin(e.phase) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.phase)) * 2.5 : Math.sin(timeNow * 2.5) * 1.2;
  const dir = e.dir || 'down';
  const lookX = dir === 'left' ? -3.5 : dir === 'right' ? 3.5 : 0;
  const back = dir === 'up';
  g.save();
  g.translate(x, y - bob);
  g.lineWidth = 2.6; g.strokeStyle = INK;
  // 影子
  g.fillStyle = 'rgba(74,57,51,.2)';
  g.beginPath(); g.ellipse(0, 20 + bob, 14, 4.5, 0, 0, 7); g.fill();
  // 脚
  g.fillStyle = '#ff8aa6';
  g.beginPath(); g.ellipse(-7, 18 + walk * 2.5, 5.5, 3.8, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(7, 18 - walk * 2.5, 5.5, 3.8, 0, 0, 7); g.fill(); g.stroke();
  // 身体（背带裤）
  g.fillStyle = '#58b7ff';
  rr(g, -12, 2, 24, 15, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffd34d';
  g.beginPath(); g.arc(0, 10, 3, 0, 7); g.fill();
  // 兔耳
  for (const s of [-1, 1]) {
    const sway = Math.sin(timeNow * 3 + s) * 2 + walk * s * 1.5;
    g.fillStyle = '#7ecbff';
    g.beginPath();
    g.ellipse(s * 8 + sway * .4, -27, 5, 11, s * .25, 0, 7);
    g.fill(); g.stroke();
    g.fillStyle = '#ffd9e3';
    g.beginPath(); g.ellipse(s * 8 + sway * .4, -26, 2.3, 6.5, s * .25, 0, 7); g.fill();
  }
  // 头
  g.fillStyle = '#ffe9d4';
  g.beginPath(); g.arc(0, -7, 15.5, 0, 7); g.fill(); g.stroke();
  // 发帽
  g.fillStyle = '#7ecbff';
  g.beginPath(); g.arc(0, -9, 15.5, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  g.beginPath(); g.arc(0, -9, 15.5, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
  if (back) { // 背面只画后脑勺
    g.fillStyle = '#7ecbff';
    g.beginPath(); g.arc(0, -7, 15.5, 0, 7); g.fill(); g.stroke();
    g.restore(); return;
  }
  // 脸
  if (panic) {
    g.lineWidth = 2.2;
    for (const s of [-1, 1]) { // >_< 眼
      g.beginPath();
      g.moveTo(s * 8 - s * 3, -10); g.lineTo(s * 4, -7); g.lineTo(s * 8 - s * 3, -4);
      g.stroke();
    }
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(0 , -1, 3, 4, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = INK;
    if (blinkOn) {
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-9 + lookX, -7); g.lineTo(-3 + lookX, -7); g.stroke();
      g.beginPath(); g.moveTo(3 + lookX, -7); g.lineTo(9 + lookX, -7); g.stroke();
    } else {
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(s * 6 + lookX, -7, 3.2, 4.2, 0, 0, 7); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(s * 6 + lookX + 1.2, -8.5, 1.3, 0, 7); g.fill();
        g.fillStyle = INK;
      }
    }
    g.lineWidth = 2;
    g.beginPath(); g.arc(lookX, -1.5, 3.2, .25, Math.PI - .25); g.stroke();
  }
  // 腮红
  g.fillStyle = 'rgba(255,140,160,.55)';
  g.beginPath(); g.ellipse(-11 + lookX, -2, 3, 2, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(11 + lookX, -2, 3, 2, 0, 0, 7); g.fill();
  // 中咒标记
  if (e.curse > 0) {
    g.font = '13px serif'; g.textAlign = 'center';
    g.fillText('💀', 0, -40 + Math.sin(timeNow * 5) * 2.5);
  }
  g.restore();
}
// 果冻小怪（敌人）
function drawBlob(g, x, y, e, blinkOn, panic) {
  const sq = Math.sin(e.phase) * .08;
  const dir = e.dir || 'down';
  const lookX = dir === 'left' ? -3 : dir === 'right' ? 3 : 0;
  const sc = e.scale || 1;
  g.save();
  g.translate(x, y);
  g.scale(sc, sc);
  g.lineWidth = 2.6; g.strokeStyle = INK;
  g.fillStyle = 'rgba(74,57,51,.2)';
  g.beginPath(); g.ellipse(0, 19, 14, 4.5, 0, 0, 7); g.fill();
  // 小脚
  g.fillStyle = e.color;
  g.beginPath(); g.ellipse(-8, 17, 5, 3.5, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(8, 17, 5, 3.5, 0, 0, 7); g.fill(); g.stroke();
  if (e.hp) {
    // Boss 王冠 + 血量
    g.fillStyle = '#ffd34d';
    g.beginPath();
    g.moveTo(-10, -17); g.lineTo(-10, -27); g.lineTo(-5, -21); g.lineTo(0, -29);
    g.lineTo(5, -21); g.lineTo(10, -27); g.lineTo(10, -17);
    g.closePath(); g.fill(); g.stroke();
    g.font = '9px serif'; g.textAlign = 'center';
    g.fillText('❤️'.repeat(e.hp), 0, -33);
  } else {
    // 呆毛天线（颜色区分种类：黄=普通 红=追击 蓝=炸弹狂）
    g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(4, -24, 0, -27); g.stroke();
    g.fillStyle = e.ball || '#ffd34d';
    g.beginPath(); g.arc(0, -28, 3.5, 0, 7); g.fill(); g.stroke();
  }
  // 果冻身体
  g.fillStyle = e.color;
  g.save();
  g.scale(1 + sq, 1 - sq);
  g.beginPath();
  g.moveTo(-15, 14);
  g.quadraticCurveTo(-17, -16, 0, -16);
  g.quadraticCurveTo(17, -16, 15, 14);
  g.quadraticCurveTo(0, 19, -15, 14);
  g.closePath(); g.fill(); g.stroke();
  // 肚皮
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(0, 7, 9, 6.5, 0, 0, 7); g.fill();
  g.restore();
  // 脸
  if (panic) {
    g.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 8 - s * 3, -7); g.lineTo(s * 4, -4); g.lineTo(s * 8 - s * 3, -1);
      g.stroke();
    }
    g.beginPath(); g.arc(0, 4, 3, 0, Math.PI); g.stroke();
  } else {
    // 凶凶小眉毛
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-9 + lookX, -10); g.lineTo(-3 + lookX, -8); g.stroke();
    g.beginPath(); g.moveTo(9 + lookX, -10); g.lineTo(3 + lookX, -8); g.stroke();
    if (blinkOn) {
      g.beginPath(); g.moveTo(-9 + lookX, -4); g.lineTo(-3 + lookX, -4); g.stroke();
      g.beginPath(); g.moveTo(3 + lookX, -4); g.lineTo(9 + lookX, -4); g.stroke();
    } else {
      for (const s of [-1, 1]) {
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(s * 6 + lookX, -4, 4, 4.6, 0, 0, 7); g.fill(); g.stroke();
        g.fillStyle = INK;
        g.beginPath(); g.arc(s * 6 + lookX * 1.5, -3.5, 2, 0, 7); g.fill();
      }
    }
    // 小尖牙嘴
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-4 + lookX, 3); g.lineTo(-1 + lookX, 6); g.lineTo(2 + lookX, 3); g.lineTo(5 + lookX, 6); g.stroke();
  }
  g.restore();
}

/* ---------- 标题预览动画 ---------- */
const pv = document.getElementById('pv');
const pctx = pv ? pv.getContext('2d') : null;
function drawPreview() {
  if (!pctx) return;
  pctx.clearRect(0, 0, 300, 120);
  const hopP = Math.abs(Math.sin(timeNow * 3));
  drawCutie(pctx, 90, 70 - hopP * 8, { dir: 'down', moving: true, phase: timeNow * 9 }, false, false);
  drawBlob(pctx, 175, 74, { dir: 'left', phase: timeNow * 7, color: '#ff8a5c', blink: 3 },
    (timeNow % 3) > 2.9, false);
  drawBlob(pctx, 238, 74, { dir: 'left', phase: timeNow * 7 + 2, color: '#b48aff', blink: 4 },
    false, false);
  // 中间飘个小泡泡
  const by = 56 + Math.sin(timeNow * 2.2) * 6;
  const gr = pctx.createRadialGradient(128, by - 4, 2, 132, by, 14);
  gr.addColorStop(0, 'rgba(255,255,255,.95)');
  gr.addColorStop(1, 'rgba(110,190,255,.55)');
  pctx.fillStyle = gr;
  pctx.beginPath(); pctx.arc(132, by, 13, 0, 7); pctx.fill();
  pctx.lineWidth = 2; pctx.strokeStyle = 'rgba(255,255,255,.9)'; pctx.stroke();
}

/* ================================================================
   UI / 流程
   ================================================================ */
const $ = id => document.getElementById(id);
const hud = $('hud'), titleEl = $('title'), msgEl = $('msg');

function updateHud() {
  if (!player) return;
  $('hearts').textContent = '❤️'.repeat(Math.max(0, player.lives)) || '💔';
  $('stPow').textContent = player.power;
  $('stBub').textContent = player.maxB;
  $('stSpd').textContent = 1 + Math.round((player.spd - 150) / 18);
  $('stNeedle').textContent = player.needles;
  $('stShield').textContent = player.shield;
  $('stGlove').textContent = player.glove ? '✓' : '–';
  $('stRound').textContent = roundIdx + 1;
  $('stEn').textContent = enemies.length;
  $('stScore').textContent = score;
}
function updateCurseBadge() {
  const b = $('bCurse');
  if (player && player.curseType) {
    b.style.display = 'inline-flex';
    $('stCurse').textContent = CURSE_SHORT[player.curseType] + ' ' + Math.ceil(player.curse) + 's';
  } else {
    b.style.display = 'none';
  }
}
function showMsg(title, sub, btnText, onClick, btn2Text, onClick2) {
  $('msgTitle').textContent = title;
  $('msgSub').innerHTML = sub;
  const btn = $('msgBtn');
  btn.textContent = btnText;
  btn.onclick = () => { btn.blur(); onClick(); }; // blur 防止空格键误触发按钮
  const btn2 = $('msgBtn2');
  if (btn2Text) {
    btn2.style.display = '';
    btn2.textContent = btn2Text;
    btn2.onclick = () => { btn2.blur(); onClick2(); };
  } else {
    btn2.style.display = 'none';
  }
  msgEl.classList.remove('hide');
}
function backToTitle() {
  state = 'title';
  player = null; enemies = []; dirStack = []; stickDir = null;
  genMap(ROUNDS[0]);
  msgEl.classList.add('hide');
  hud.classList.remove('on');
  titleEl.classList.remove('hide');
  refreshLevelSel();
}
function startRound() {
  curCfg = ROUNDS[roundIdx];
  genMap(curCfg);
  player.x = 1.5 * TILE; player.y = 1.5 * TILE;
  player.trapped = 0; player.active = 0; player.invuln = 2; player.dir = 'down';
  dirStack = []; stickDir = null;
  enemies = [];
  let si = 0;
  for (const t of curCfg.types) {
    const [c, r] = t === 'boss' ? [7, 6] : ENEMY_SPAWNS[si++];
    const color = t === 'boss' ? '#9b6cf0' : ENEMY_COLORS[si % ENEMY_COLORS.length];
    enemies.push(makeEnemy(c, r, curCfg, color, t));
  }
  msgEl.classList.add('hide');
  titleEl.classList.add('hide');
  hud.classList.add('on');
  state = 'playing';
  updateHud();
  addFloat(player.x + 70, player.y, `第 ${roundIdx + 1} 关 · ${theme.name}!`, '#ff7b9c');
}
/* ---------- 选关 ---------- */
let selRound = 0;
const loadClear = () => { try { return +localStorage.getItem('ppt_clear') || 0; } catch (e) { return 0; } };
const saveClear = n => { try { localStorage.setItem('ppt_clear', Math.max(loadClear(), n)); } catch (e) { /* 隐私模式等 */ } };
function selectLevel(i) {
  selRound = clamp(i, 0, ROUNDS.length - 1);
  refreshLevelSel();
}
function refreshLevelSel() {
  const cleared = loadClear();
  document.querySelectorAll('#levelSel .lv').forEach(btn => {
    const i = +btn.dataset.i;
    btn.classList.toggle('sel', i === selRound);
    btn.querySelector('em').textContent = cleared > i ? '⭐' : '';
  });
}
function startGame() {
  roundIdx = selRound; score = 0;
  player = makePlayer();
  // 跳关开局给点属性补偿，不然空手打后面几关太苦
  player.power += selRound;
  player.maxB += Math.ceil(selRound / 2);
  player.spd += selRound * 12;
  startRound();
}
function roundClear() {
  SND.win();
  saveClear(roundIdx + 1);
  if (roundIdx >= ROUNDS.length - 1) {
    state = 'victory';
    setTimeout(() => showMsg('🏆 全部通关！', `你拯救了泡泡世界！<br>最终得分 <b style="color:#e2596f">${score}</b> 分 · 剩余 ${'❤️'.repeat(player.lives)}`, '再玩一次', startGame, '回主菜单', backToTitle), 700);
  } else {
    state = 'clear';
    const next = THEMES[ROUNDS[roundIdx + 1].theme].name;
    setTimeout(() => showMsg(`🎉 第 ${roundIdx + 1} 关通关！`, `当前得分 <b style="color:#e2596f">${score}</b> 分<br>下一站：<b>${next}</b> —— 敌人更多更快，小心！`, '下一关 ▸', () => { roundIdx++; startRound(); }, '回主菜单', backToTitle), 700);
  }
}
function gameOver() {
  state = 'over';
  SND.lose();
  setTimeout(() => showMsg('💦 泡泡破了…', `止步第 ${roundIdx + 1} 关 · 得分 <b style="color:#e2596f">${score}</b> 分<br>再来一局雪耻吧！`, '重新挑战', startGame, '回主菜单', backToTitle), 700);
}
function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showMsg('⏸ 暂停中', '喝口水休息一下～<br>按 <b>Esc / P</b> 继续游戏', '继续游戏', togglePause, '回主菜单', backToTitle);
  } else if (state === 'paused') {
    state = 'playing';
    msgEl.classList.add('hide');
  }
}
function toggleMute() {
  muted = !muted;
  $('btnMute').textContent = muted ? '🔇' : '🔊';
}

/* ---------- 输入 ---------- */
function tryEscapeMash() {
  player.mash++;
  if (player.mash >= player.mashNeed) {
    player.trapped = 0; player.invuln = 1.2;
    SND.free();
    addFloat(player.x, player.y - 36, '挣脱啦!', '#43b96e');
  }
}
window.addEventListener('keydown', ev => {
  const d = KEY_DIRS[ev.code];
  const handled = d || ev.code === 'Space' || ev.code === 'KeyJ';
  if (handled) ev.preventDefault();
  if (ev.repeat) return;
  if (ev.code === 'KeyM') { toggleMute(); return; }
  if (ev.code === 'KeyP' || ev.code === 'Escape') {
    if (state === 'playing' || state === 'paused') togglePause();
    return;
  }
  if (state === 'title') {
    if (d === 'left') { selectLevel(selRound - 1); SND.item(); return; }
    if (d === 'right') { selectLevel(selRound + 1); SND.item(); return; }
    if (ev.code === 'Space' || ev.code === 'Enter') { startGame(); return; }
    return;
  }
  if ((state === 'clear' || state === 'over' || state === 'victory') && ev.code === 'Enter') {
    const btn = $('msgBtn');
    if (btn.onclick) btn.onclick();
    return;
  }
  if (state !== 'playing') return;
  if (player.trapped > 0) { if (handled) tryEscapeMash(); return; }
  if (d) { dirStack = dirStack.filter(x => x !== d); dirStack.push(d); }
  if (ev.code === 'Space' || ev.code === 'KeyJ') placeBubble(player);
});
window.addEventListener('keyup', ev => {
  const d = KEY_DIRS[ev.code];
  if (d) dirStack = dirStack.filter(x => x !== d);
});
window.addEventListener('blur', () => { dirStack = []; }); // 失焦时松开所有方向键

/* ---------- 移动端：浮动虚拟摇杆 ---------- */
const IS_TOUCH = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) ||
                 ('ontouchstart' in window);
if (IS_TOUCH && document.body) document.body.classList.add('touch');

const stickZone = $('stickZone'), stickBase = $('stickBase'), stickKnob = $('stickKnob');
let stickId = null, stickOX = 0, stickOY = 0, stickDir = null;

function setStickDir(d) {
  if (d === stickDir) return;
  if (stickDir) dirStack = dirStack.filter(x => x !== stickDir);
  stickDir = d;
  if (d) {
    dirStack = dirStack.filter(x => x !== d);
    dirStack.push(d);
    // 被困时来回搓摇杆也算挣扎
    if (player && player.trapped > 0 && state === 'playing') tryEscapeMash();
  }
}
function stickRelease() {
  setStickDir(null);
  stickId = null;
}
stickZone.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (stickId !== null || state !== 'playing') return;
  stickId = ev.pointerId;
  try { stickZone.setPointerCapture(ev.pointerId); } catch (e) { /* 老浏览器 */ }
  stickOX = ev.clientX; stickOY = ev.clientY;
  stickBase.style.left = stickOX + 'px';
  stickBase.style.top = stickOY + 'px';
  stickKnob.style.transform = 'translate(-50%,-50%)';
  if (player && player.trapped > 0) tryEscapeMash();
});
stickZone.addEventListener('pointermove', ev => {
  if (ev.pointerId !== stickId) return;
  ev.preventDefault();
  let dx = ev.clientX - stickOX, dy = ev.clientY - stickOY;
  let dist = Math.hypot(dx, dy);
  // 拖太远时摇杆底座跟着手指走，反向变招更跟手
  if (dist > 72) {
    const pull = (dist - 72) / dist;
    stickOX += dx * pull; stickOY += dy * pull;
    stickBase.style.left = stickOX + 'px';
    stickBase.style.top = stickOY + 'px';
    dx = ev.clientX - stickOX; dy = ev.clientY - stickOY;
    dist = Math.hypot(dx, dy);
  }
  // 视觉：摇杆头限制在底座内
  const lim = Math.min(1, 38 / Math.max(1, dist));
  stickKnob.style.transform = `translate(calc(-50% + ${dx * lim}px), calc(-50% + ${dy * lim}px))`;
  // 死区 12px，超过后取主导轴为方向
  if (dist < 12) { setStickDir(null); return; }
  setStickDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
stickZone.addEventListener('pointerup', ev => { if (ev.pointerId === stickId) stickRelease(); });
stickZone.addEventListener('pointercancel', ev => { if (ev.pointerId === stickId) stickRelease(); });
stickZone.addEventListener('contextmenu', ev => ev.preventDefault());

$('btnBubble').addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (state !== 'playing') return;
  if (player.trapped > 0) { tryEscapeMash(); return; }
  placeBubble(player);
});
$('btnBubble').addEventListener('contextmenu', ev => ev.preventDefault());
$('btnPause').addEventListener('click', ev => {
  ev.target.blur();
  if (state === 'playing' || state === 'paused') togglePause();
});
$('btnStart').addEventListener('click', ev => { ev.target.blur(); startGame(); });
$('btnMute').addEventListener('click', toggleMute);
document.querySelectorAll('#levelSel .lv').forEach(btn => {
  btn.addEventListener('click', () => { btn.blur(); selectLevel(+btn.dataset.i); SND.item(); });
});
refreshLevelSel();

/* 标题页飘泡泡装饰 */
(function spawnTitleBubbles() {
  for (let i = 0; i < 10; i++) {
    const b = document.createElement('div');
    b.className = 'bub';
    const s = rnd(14, 46);
    b.style.cssText = `width:${s}px;height:${s}px;left:${rnd(2, 95)}%;` +
      `animation-duration:${rnd(7, 16)}s;animation-delay:${rnd(0, 12)}s;opacity:${rnd(.35, .8)}`;
    titleEl.appendChild(b);
  }
})();

/* ---------- 主循环 ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (state === 'title') drawPreview();
  if (grid.length) draw();
  // 移动端控件随游戏状态显隐；标题态隐藏舞台框
  if (document.body) {
    const playingNow = state === 'playing';
    document.body.classList.toggle('playing', playingNow);
    document.body.classList.toggle('title', state === 'title');
    if (IS_TOUCH) {
      stickBase.style.display = playingNow && stickId !== null ? 'block' : 'none';
      $('stickHint').style.display = playingNow && stickId === null ? 'block' : 'none';
    }
  }
  requestAnimationFrame(frame);
}
genMap(ROUNDS[0]); // 标题页背后先铺一张地图当背景
requestAnimationFrame(frame);

/* 冒烟测试钩子（不影响游戏） */
window.__test = {
  get state() { return state; }, get player() { return player; },
  get enemies() { return enemies; }, get bubbles() { return bubbles; },
  get items() { return items; }, get grid() { return grid; },
  get terrain() { return terrain; }, get portals() { return portals; },
  setRound(i) { roundIdx = i; },
  get selRound() { return selRound; },
  startGame, startRound, placeBubble, applyCurse, trapHit, popEntity,
  backToTitle, togglePause, selectLevel,
};
