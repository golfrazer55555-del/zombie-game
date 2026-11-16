'use strict';
/* ===== 게임 로직: 플레이어, 좀비, 전투, 아이템, 제작, 저장 ===== */
const FISTS = { dmg: 6, range: 14, arc: 1.2, cd: 0.42, kb: 70, stam: 4, targets: 1, kind: 'blunt' };
const SAVE_KEY = 'zsurv_save_v1', BEST_KEY = 'zsurv_best_v1', PREF_KEY = 'zsurv_pref_v1';
const START_TIME = 1440 + 8 * 60;

function josa(w, a, b) {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xAC00 || c > 0xD7A3) return w + b;
  const j = (c - 0xAC00) % 28;
  if (a === '으로') return w + (j && j !== 8 ? '으로' : '로');
  return w + (j ? a : b);
}
function dirOf(a) { const c = Math.cos(a), s = Math.sin(a); return Math.abs(c) > Math.abs(s) ? (c > 0 ? 2 : 1) : (s > 0 ? 0 : 3); }

function boxHit(W, x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (W.solid(tx, ty)) return true;
  return false;
}
function moveEnt(W, e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  const sx = dx / steps, sy = dy / steps;
  let bx = false, by = false;
  for (let s = 0; s < steps; s++) {
    if (sx) {
      if (!boxHit(W, e.x + sx, e.y, e.r)) e.x += sx;
      else {
        bx = true;
        if (Math.abs(sy) < Math.abs(sx) * 0.5) for (const n of [1, -1]) if (!boxHit(W, e.x + sx, e.y + n * 3, e.r) && !boxHit(W, e.x, e.y + n * 0.9, e.r)) { e.y += n * 0.9; break; }
      }
    }
    if (sy) {
      if (!boxHit(W, e.x, e.y + sy, e.r)) e.y += sy;
      else {
        by = true;
        if (Math.abs(sx) < Math.abs(sy) * 0.5) for (const n of [1, -1]) if (!boxHit(W, e.x + n * 3, e.y + sy, e.r) && !boxHit(W, e.x + n * 0.9, e.y, e.r)) { e.x += n * 0.9; break; }
      }
    }
  }
  return { bx, by };
}

/* ───────── 플레이어 ───────── */
class Player {
  constructor(x, y, look) {
    this.x = x; this.y = y; this.r = 4; this.face = Math.PI / 2; this.aim = this.face; this.dir = 0; this.anim = 0; this.moving = false;
    this.hp = 100; this.hunger = 90; this.thirst = 85; this.energy = 92; this.stamina = 100;
    this.bleed = 0; this.sick = 0; this.hot = 0; this.grab = 0;
    this.inv = new Array(18).fill(null); this.equip = { bag: null, body: null }; this.sel = 0;
    this.cd = 0; this.swing = null; this.reload = 0; this.reloadIt = null; this.hurtT = 0; this.invuln = 0; this.light = false;
    this.sprint = false; this.stepT = 0; this.staRegen = 0; this.action = null; this.look = look || 0;
    this.kbx = 0; this.kby = 0; this.dead = false; this.cause = ''; this.recoil = 0; this.sleeping = false; this.sleepT = 0;
    this.vomitT = 0; this.bleedDrip = 0;
  }
  invSize() { return 18 + (this.equip.bag ? ITEMS[this.equip.bag.id].wear.slots : 0); }
  held() { return this.inv[this.sel] || null; }
  count(id) { let n = 0; for (const s of this.inv) if (s && s.id === id) n += s.n; return n; }
  add(id, n, d) {
    const st = stackOf(id);
    if (st > 1) for (const s of this.inv) { if (n <= 0) break; if (s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; } }
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      if (this.inv[i]) continue;
      const k = Math.min(n, st);
      const it = { id, n: k };
      if (d != null) it.d = d; else { const p = mkItem(id, 1); if (p.d != null) it.d = p.d; }
      this.inv[i] = it; n -= k;
    }
    UI.invChanged();
    return n;
  }
  addItem(it) { // 개별 아이템(내구도 유지)
    if (stackOf(it.id) > 1) return this.add(it.id, it.n, it.d);
    for (let i = 0; i < this.inv.length; i++) if (!this.inv[i]) { const c = { id: it.id, n: it.n }; if (it.d != null) c.d = it.d; this.inv[i] = c; UI.invChanged(); return 0; }
    return it.n;
  }
  remove(id, n) {
    for (let i = this.inv.length - 1; i >= 0 && n > 0; i--) {
      const s = this.inv[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n, s.n); s.n -= k; n -= k;
      if (s.n <= 0) this.inv[i] = null;
    }
    UI.invChanged();
    return n <= 0;
  }
  removeSlot(i, n) { const s = this.inv[i]; if (!s) return; s.n -= n || 1; if (s.n <= 0) this.inv[i] = null; UI.invChanged(); }
  findTool(ids) { for (const s of this.inv) if (s && ids.includes(s.id) && (s.d == null || s.d > 0 || ITEMS[s.id].nodur)) return s; return null; }
  freeSlots() { let n = 0; for (const s of this.inv) if (!s) n++; return n; }
  armor() { return this.equip.body ? ITEMS[this.equip.body.id].wear.armor : 0; }
  resize() {
    const n = this.invSize();
    while (this.inv.length < n) this.inv.push(null);
    if (this.inv.length > n) this.inv.length = n;
  }
}

/* ───────── 좀비 ───────── */
class Zombie {
  constructor(type, x, y, v) {
    const def = ZTYPES[type];
    this.type = type; this.def = def; this.x = x; this.y = y; this.r = def.r;
    this.maxHp = def.hp * G.cfg.zHp; this.hp = this.maxHp;
    this.spd = def.spd * G.cfg.zSpeed * RND.range(0.88, 1.12);
    this.v = v != null ? v : RND.int(0, Art.chars[def.sprite].length - 1);
    this.face = RND.range(0, TAU); this.dir = dirOf(this.face); this.anim = RND() * 4;
    this.state = 'idle'; this.tx = x; this.ty = y; this.think = RND() * 0.4; this.stateT = RND.range(1, 5);
    this.atkT = 0; this.atkCd = 0; this.stun = 0; this.flash = 0; this.kbx = 0; this.kby = 0; this.alpha = 0;
    this.groanT = RND.range(3, 14); this.lost = 0; this.burn = 0; this.stuck = 0; this.sees = false; this.bangT = 0;
    this.moving = false; this.dead = false; this.lx = x; this.ly = y;
  }
  bodyY() { return this.y - (this.type === 'crawler' ? 3 : this.type === 'brute' ? 11 : 7); }
}

/* ───────── 게임 상태 ───────── */
const G = {
  state: 'title', world: null, player: null, zombies: [], projs: [], fires: [], parts: [], rings: [], corpses: [], crackers: [],
  settings: null, cfg: null, time: START_TIME, realT: 0, darkness: 0, shake: 0, hitstop: 0, muzzle: 0, timeScale: 1,
  flow: null, flowT: 0, flowKey: -1, fovT: 0, fovKey: '', visA: null, visT: null, fovR: 22,
  stats: { kills: 0, fish: 0, crafted: 0, meals: 0 }, interact: null, place: null, saveT: 0, spawnT: 0, lastDay: 1,
  hurtFlash: 0, heartT: 0, deathT: 0, demo: false, grid: new Map(), fishGame: null, nightMsg: false, msgOnce: {},
};
G.day = function () { return Math.floor(G.time / 1440); };
G.minute = function () { return G.time % 1440; };
G.isNight = function () { const h = G.minute() / 60; return h >= 20 || h < 5; };
function darknessAt(m) {
  const h = m / 60, N = 0.88;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 20.5) return smooth01((h - 18) / 2.5) * N;
  if (h >= 20.5 || h < 4.5) return N;
  return (1 - smooth01((h - 4.5) / 2.5)) * N;
}

G.toastOnce = function (key, msg, kind) { if (G.msgOnce[key]) return; G.msgOnce[key] = true; UI.toast(msg, kind); };

/* ───────── 새 게임 / 불러오기 ───────── */
G.setup = function (settings, seed) {
  G.settings = settings; G.cfg = deriveSettings(settings);
  const W = new World(seed);
  W.lootMul = G.cfg.loot;
  W.generate();
  G.world = W;
  G.zombies = []; G.projs = []; G.fires = []; G.parts = []; G.rings = []; G.corpses = []; G.crackers = [];
  G.visA = new Float32Array(W.W * W.H); G.visT = new Uint8Array(W.W * W.H);
  G.flow = null; G.flowKey = -1; G.fovKey = ''; G.time = START_TIME; G.realT = 0; G.timeScale = 1;
  G.stats = { kills: 0, fish: 0, crafted: 0, meals: 0 }; G.msgOnce = {}; G.lastDay = G.day(); G.deathT = 0; G.hitstop = 0; G.shake = 0;
  G.fishGame = null;
};
G.newGame = function (settings) {
  const seed = settings.seed && settings.seed.trim() ? (/^\d+$/.test(settings.seed.trim()) ? (+settings.seed.trim()) >>> 0 : strHash(settings.seed.trim())) : (RND.int(1, 2e9) >>> 0);
  G.setup(settings, seed);
  const W = G.world;
  const p = new Player(W.start.x, W.start.y, settings.look);
  G.player = p;
  const st = G.cfg.start;
  if (st === 1) { p.add('knife', 1); p.add('water', 1); p.add('chips', 1); }
  if (st === 2) { p.add('bat', 1); p.add('water', 2); p.add('beans', 2); p.add('bandage', 2); p.add('flashlight', 1); p.add('lighter', 1); p.add('rag', 3); }
  G.spawnInitial();
  G.state = 'play';
  G.computeFOV(true);
  UI.toast('1일차 아침. 살아남아야 한다.', 'big');
  setTimeout(() => UI.toast('집 안의 냉장고·찬장·서랍을 뒤져 물자를 모으세요.', 'hint'), 2500);
  G.save();
};
G.serialize = function () {
  const p = G.player, W = G.world;
  const zt = Object.keys(ZTYPES);
  return {
    v: 1, seed: W.seed, settings: G.settings, time: G.time, realT: G.realT, stats: G.stats, msgOnce: G.msgOnce, lastDay: G.lastDay,
    player: { x: p.x, y: p.y, hp: p.hp, hunger: p.hunger, thirst: p.thirst, energy: p.energy, stamina: p.stamina, bleed: p.bleed, sick: p.sick, hot: p.hot, inv: p.inv, equip: p.equip, sel: p.sel, look: p.look, light: p.light },
    zombies: G.zombies.filter(z => !z.dead).map(z => [zt.indexOf(z.type), Math.round(z.x), Math.round(z.y), Math.round(z.hp), z.v]),
    ground: W.groundItems, mods: W.serializeMods(), explored: bitsToB64(W.explored),
  };
};
G.save = function () {
  if (G.state !== 'play' || G.demo || !G.player || G.player.dead) return false;
  try { return Store.set(SAVE_KEY, JSON.stringify(G.serialize())); } catch (e) { return false; }
};
G.hasSave = function () { const s = Store.get(SAVE_KEY); return !!s; };
G.loadData = function (data) {
  G.setup(data.settings || defaultSettings(), data.seed);
  const W = G.world;
  W.applyMods(data.mods);
  W.groundItems = data.ground || [];
  W.explored = b64ToBits(data.explored || '', W.W * W.H);
  G.time = data.time || START_TIME; G.realT = data.realT || 0; G.stats = data.stats || G.stats; G.msgOnce = data.msgOnce || {}; G.lastDay = data.lastDay || G.day();
  const pd = data.player;
  const p = new Player(pd.x, pd.y, pd.look);
  Object.assign(p, { hp: pd.hp, hunger: pd.hunger, thirst: pd.thirst, energy: pd.energy, stamina: pd.stamina, bleed: pd.bleed || 0, sick: pd.sick || 0, hot: pd.hot || 0, equip: pd.equip || { bag: null, body: null }, sel: pd.sel || 0, light: !!pd.light });
  p.resize();
  for (let i = 0; i < p.inv.length; i++) p.inv[i] = (pd.inv && pd.inv[i]) || null;
  G.player = p;
  const zt = Object.keys(ZTYPES);
  for (const z of data.zombies || []) { const type = zt[z[0]] || 'walker'; const zz = new Zombie(type, z[1], z[2], z[4]); zz.hp = Math.min(zz.maxHp, z[3]); G.zombies.push(zz); }
  G.state = 'play';
  G.computeFOV(true);
  UI.toast(`${G.day()}일차 — 다시 살아남자.`, 'big');
};
G.loadGame = function () {
  const s = Store.get(SAVE_KEY);
  if (!s) return false;
  try { G.loadData(JSON.parse(s)); return true; } catch (e) { console.error(e); return false; }
};

/* ───────── 좀비 생성 ───────── */
G.zWeights = function () {
  const c = G.cfg;
  return [['walker', 70], ['runner', c.wRunner], ['brute', c.wBrute], ['crawler', c.wCrawler]].filter(e => e[1] > 0);
};
G.spawnZombie = function (minD, maxD, inTown) {
  const W = G.world, p = G.player;
  for (let t = 0; t < 60; t++) {
    let tx, ty;
    if (inTown) { tx = RND.int(W.town.x0, W.town.x1); ty = RND.int(W.town.y0, W.town.y1); }
    else { tx = RND.int(3, W.W - 4); ty = RND.int(3, W.H - 4); }
    if (W.solid(tx, ty)) continue;
    const x = tx * TS + 8, y = ty * TS + 10;
    const d = p ? dist(x, y, p.x, p.y) / TS : 99;
    if (d < minD || d > maxD) continue;
    if (G.visA && G.visA[W.idx(tx, ty)] > 0.3 && minD > 10) continue;
    if (W.bld[W.idx(tx, ty)] >= 0 && RND() < 0.5) continue;
    const z = new Zombie(RND.weighted(G.zWeights()), x, y);
    G.zombies.push(z);
    return z;
  }
  return null;
};
G.spawnInitial = function () {
  const n = G.cfg.zCount;
  for (let i = 0; i < n; i++) G.spawnZombie(16, 999, RND() < 0.62);
};

/* ───────── 소음 ───────── */
G.noise = function (x, y, radius, visual, src) {
  const r = radius * TS;
  for (const z of G.zombies) {
    if (z.dead || z === src) continue;
    const d = dist(x, y, z.x, z.y);
    if (d > r) continue;
    if (z.state === 'chase') continue;
    z.state = 'investigate'; z.tx = x + RND.range(-20, 20); z.ty = y + RND.range(-20, 20); z.stateT = RND.range(10, 18); z.stuck = 0;
  }
  if (visual || radius >= 9) G.rings.push({ x, y, r: 4, max: Math.min(r, 260), t: 0 });
};

/* ───────── 파티클/데칼 ───────── */
G.part = function (x, y, z, vx, vy, vz, life, col, size, grav, kind) {
  if (G.parts.length > 1100) G.parts.shift();
  G.parts.push({ x, y, z, vx, vy, vz, life, max: life, col, size: size || 1, grav: grav == null ? 260 : grav, kind: kind || '' });
};
G.blood = function (x, y, ang, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = ang + RND.range(-(spread || 0.9), spread || 0.9), s = RND.range(25, 95);
    G.part(x, y, RND.range(4, 10), Math.cos(a) * s, Math.sin(a) * s * 0.7, RND.range(20, 80), RND.range(0.4, 0.9), RND.pick(['#8a1414', '#a01c1c', '#6e0e0e', '#b02424']), RND() < 0.3 ? 2 : 1, 300, 'blood');
  }
};
G.decal = function (x, y, col, w, h) {
  const key = Math.floor(x / (CHUNK * TS)) + ',' + Math.floor(y / (CHUNK * TS));
  let cv = G.world.decals.get(key);
  if (!cv) { cv = document.createElement('canvas'); cv.width = cv.height = CHUNK * TS; G.world.decals.set(key, cv); }
  const c2 = cv.getContext('2d');
  c2.fillStyle = col;
  const lx = Math.floor(x) - Math.floor(x / (CHUNK * TS)) * CHUNK * TS, ly = Math.floor(y) - Math.floor(y / (CHUNK * TS)) * CHUNK * TS;
  c2.fillRect(lx, ly, w || 1, h || 1);
};
G.bloodPool = function (x, y, r) {
  for (let i = 0; i < r * r * 1.6; i++) {
    const a = RND.range(0, TAU), d = Math.sqrt(RND()) * r;
    G.decal(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, RND.pick(['rgba(110,14,14,0.85)', 'rgba(90,10,10,0.9)', 'rgba(130,20,20,0.75)']), RND() < 0.4 ? 2 : 1, 1);
  }
};
G.debris = function (x, y, cols, n, spd) {
  for (let i = 0; i < n; i++) { const a = RND.range(0, TAU), s = RND.range(20, spd || 80); G.part(x, y, RND.range(2, 8), Math.cos(a) * s, Math.sin(a) * s * 0.7, RND.range(30, 90), RND.range(0.4, 1), RND.pick(cols), 1, 280, 'debris'); }
};

/* ───────── 바닥 아이템 ───────── */
G.drop = function (x, y, it) {
  const W = G.world;
  for (const g of W.groundItems) if (g.id === it.id && stackOf(it.id) > 1 && dist(g.x, g.y, x, y) < 8 && g.n + it.n <= stackOf(it.id)) { g.n += it.n; return; }
  const g = Object.assign({ x: x + RND.range(-3, 3), y: y + RND.range(-3, 3) }, it);
  W.groundItems.push(g);
};
G.give = function (id, n, d) {
  const p = G.player;
  const left = p.add(id, n, d);
  if (left > 0) { G.drop(p.x, p.y, { id, n: left, d }); UI.toast('가방이 가득 차서 바닥에 내려놓았다.', 'warn'); }
};

/* ───────── 시야(FOV) ───────── */
G.computeFOV = function (force) {
  const W = G.world, p = G.player;
  const key = Math.round(p.x / 3) + ',' + Math.round(p.y / 3);
  if (!force && key === G.fovKey) return;
  G.fovKey = key;
  const R = G.fovR, ptx = Math.floor(p.x / TS), pty = Math.floor((p.y - 4) / TS);
  const vt = G.visT;
  for (let y = pty - R - 1; y <= pty + R + 1; y++) for (let x = ptx - R - 1; x <= ptx + R + 1; x++) if (W.inb(x, y)) vt[W.idx(x, y)] = 0;
  const ox = p.x / TS, oy = (p.y - 5) / TS;
  const rays = 420;
  for (let i = 0; i < rays; i++) {
    const a = i / rays * TAU, dx = Math.cos(a) * 0.3, dy = Math.sin(a) * 0.3;
    let x = ox, y = oy;
    for (let s = 0; s < R / 0.3; s++) {
      const tx = Math.floor(x), ty = Math.floor(y);
      if (!W.inb(tx, ty)) break;
      vt[W.idx(tx, ty)] = 1;
      if (s > 0 && W.opaque(tx, ty)) break;
      x += dx; y += dy;
    }
  }
  // 바깥에 있을 때 지붕은 보이는 것으로 처리
  const inside = W.bldAt(ptx, Math.floor(p.y / TS));
  for (const b of W.buildings) {
    if (inside && b.id === inside.id) continue;
    if (b.x0 > ptx + R || b.x0 + b.w < ptx - R || b.y0 > pty + R || b.y0 + b.h < pty - R) continue;
    let seen = false;
    for (let y = b.y0; y < b.y0 + b.h && !seen; y++) for (let x = b.x0; x < b.x0 + b.w; x++) if ((y === b.y0 || y === b.y0 + b.h - 1 || x === b.x0 || x === b.x0 + b.w - 1) && vt[W.idx(x, y)]) { seen = true; break; }
    if (seen) for (let y = b.y0; y < b.y0 + b.h - 1; y++) for (let x = b.x0; x < b.x0 + b.w; x++) vt[W.idx(x, y)] = 2;
  }
  // 탐험 기록
  for (let y = pty - R; y <= pty + R; y++) for (let x = ptx - R; x <= ptx + R; x++) {
    if (!W.inb(x, y)) continue;
    const i = W.idx(x, y);
    if (vt[i] && !W.explored[i]) { W.explored[i] = 1; if (UI.mapPixel) UI.mapPixel(x, y); }
  }
};
G.updateVis = function (dt) {
  const W = G.world, p = G.player, R = G.fovR + 2;
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  const k = 1 - Math.exp(-dt * 9);
  for (let y = pty - R; y <= pty + R; y++) for (let x = ptx - R; x <= ptx + R; x++) {
    if (!W.inb(x, y)) continue;
    const i = W.idx(x, y);
    const t = G.visT[i] ? 1 : 0;
    G.visA[i] += (t - G.visA[i]) * k;
  }
};
G.visAt = function (x, y) { const W = G.world, tx = Math.floor(x / TS), ty = Math.floor(y / TS); return W.inb(tx, ty) ? G.visA[W.idx(tx, ty)] : 0; };

/* ───────── 흐름장(길찾기) ───────── */
G.computeFlow = function () {
  const W = G.world, p = G.player, R = 28, N = R * 2 + 1;
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  const ox = ptx - R, oy = pty - R;
  const d = new Float32Array(N * N).fill(1e9);
  const heap = [];
  const push = (v, i) => { heap.push([v, i]); let c = heap.length - 1; while (c > 0) { const pa = (c - 1) >> 1; if (heap[pa][0] <= heap[c][0]) break; const t = heap[pa]; heap[pa] = heap[c]; heap[c] = t; c = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } } return top; };
  const si = R * N + R; d[si] = 0; push(0, si);
  const cost = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cost[y * N + x] = W.passCost(ox + x, oy + y);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [v, i] = pop();
    if (v > d[i]) continue;
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy, m] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx, c = cost[j];
      if (!c) continue;
      if (dx && dy && (cost[y * N + nx] !== 1 || cost[ny * N + x] !== 1)) continue;
      const nv = v + c * m;
      if (nv < d[j]) { d[j] = nv; push(nv, j); }
    }
  }
  G.flow = { d, ox, oy, N };
};
G.flowDir = function (z) {
  const F = G.flow; if (!F) return null;
  const tx = Math.floor(z.x / TS) - F.ox, ty = Math.floor(z.y / TS) - F.oy;
  if (tx < 1 || ty < 1 || tx >= F.N - 1 || ty >= F.N - 1) return null;
  const cur = F.d[ty * F.N + tx];
  if (cur >= 1e9) return null;
  let best = cur, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const v = F.d[(ty + dy) * F.N + tx + dx];
    if (v < best) { best = v; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;
  const cx = (tx + bx + F.ox) * TS + 8, cy = (ty + by + F.oy) * TS + 9;
  return [cx - z.x, cy - z.y];
};

/* ───────── 피해/사망 ───────── */
G.hurtPlayer = function (dmg, cause, kind, ang) {
  const p = G.player;
  if (p.dead || p.invuln > 0) return;
  dmg *= 1 - p.armor();
  p.hp -= dmg; p.hurtT = 0.35; p.invuln = 0.22; G.hurtFlash = 0.5;
  G.shake = Math.max(G.shake, 4 + dmg * 0.15);
  if (ang != null) { p.kbx += Math.cos(ang) * 60; p.kby += Math.sin(ang) * 60; }
  G.blood(p.x, p.y - 8, ang != null ? ang : RND.range(0, TAU), 7, 1.2);
  SFX.play('hurt', p.x, p.y, 0.9);
  if (kind === 'bite') { SFX.play('bite', p.x, p.y, 0.7); if (RND() < 0.3 * (1 - p.armor() * 0.6)) { if (p.bleed <= 0) UI.toast('물려서 피가 난다! 붕대로 지혈하세요.', 'bad'); p.bleed = Math.max(p.bleed, RND.range(40, 90)); } }
  if (p.sleeping) G.wake('공격을 받아 잠에서 깼다!');
  if (p.action) { if (G.fishGame) { G.fishGame = null; UI.fishEnd(); } p.action = null; }
  UI.onHurt();
  if (p.hp <= 0) G.die(cause);
};
G.die = function (cause) {
  const p = G.player;
  if (p.dead) return;
  p.dead = true; p.hp = 0; p.cause = cause;
  G.state = 'dead'; G.deathT = 0;
  SFX.play('death', null, null, 0.8);
  G.bloodPool(p.x, p.y, 7);
  const days = (G.time - START_TIME) / 1440;
  const best = +(Store.get(BEST_KEY) || 0);
  if (days > best) Store.set(BEST_KEY, String(days));
  Store.del(SAVE_KEY);
  setTimeout(() => UI.gameOver({ days, best: Math.max(best, days), cause, stats: G.stats }), 2200);
};
G.damageZombie = function (z, dmg, ang, kb, kind) {
  if (z.dead) return;
  z.hp -= dmg; z.flash = 0.12;
  const m = z.def.mass;
  z.kbx += Math.cos(ang) * kb / m; z.kby += Math.sin(ang) * kb / m;
  z.stun = Math.max(z.stun, z.def.stun * (kind === 'blunt' || kind === 'metal' ? 1.3 : 1));
  G.blood(z.x, z.bodyY(), ang, Math.min(12, 3 + Math.round(dmg / 6)), 0.8);
  if (RND() < 0.4) G.decal(z.x + RND.range(-6, 6), z.y + RND.range(-2, 4), 'rgba(120,16,16,0.8)', 1, 1);
  if (z.state !== 'chase') { z.state = 'chase'; z.tx = G.player.x; z.ty = G.player.y; z.lost = 0; }
  if (z.hp <= 0) G.killZombie(z, ang);
};
G.killZombie = function (z, ang) {
  z.dead = true; G.stats.kills++;
  G.corpses.push({ x: z.x, y: z.y, type: z.def.sprite, v: z.v, t: 0, flip: Math.cos(ang) < 0 });
  if (G.corpses.length > 70) G.corpses.shift();
  G.bloodPool(z.x, z.y - 1, z.type === 'brute' ? 7 : 5);
  SFX.play('zDie', z.x, z.y, 0.8, { pitch: z.type === 'brute' ? 0.6 : 1 });
  const items = rollLoot('zombie', RND, 1);
  for (const it of items) G.drop(z.x, z.y, it);
};

/* ───────── 근접 공격 ───────── */
G.meleeStart = function (it) {
  const p = G.player;
  if (p.cd > 0 || p.reload > 0) return;
  const m = it && ITEMS[it.id].melee ? ITEMS[it.id].melee : FISTS;
  const tired = p.stamina < m.stam;
  p.stamina = Math.max(0, p.stamina - m.stam); p.staRegen = 0.7;
  p.cd = m.cd * (tired ? 1.6 : 1);
  p.swing = { t: 0, dur: Math.min(0.2, m.cd * 0.55), a: p.aim, arc: m.arc, thrust: !!m.thrust, hit: false, m, it, tired };
  SFX.play('swing', p.x, p.y, 0.6);
  if (tired) G.toastOnce('tired' + G.day(), '지쳐서 힘이 빠진다...', 'warn');
};
G.meleeResolve = function (sw) {
  const p = G.player, W = G.world, m = sw.m;
  const cands = [];
  for (const z of G.zombies) {
    if (z.dead) continue;
    const d = dist(p.x, p.y - 4, z.x, z.bodyY() + 3) - z.r;
    if (d > m.range + 2) continue;
    const a = Math.atan2(z.bodyY() + 3 - (p.y - 4), z.x - p.x);
    if (Math.abs(angDiff(sw.a, a)) > m.arc / 2 + (d < 6 ? 0.7 : 0.15)) continue;
    if (!W.los(p.x, p.y - 4, z.x, z.y - 4)) continue;
    cands.push([d, z, a]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  let hits = 0;
  for (const [, z, a] of cands) {
    const dmg = m.dmg * RND.range(0.85, 1.15) * (sw.tired ? 0.7 : 1);
    G.damageZombie(z, dmg, a, m.kb, m.kind);
    if (m.burn) z.burn = Math.max(z.burn, 3);
    hits++;
    if (hits >= m.targets) break;
  }
  if (hits) {
    G.hitstop = 0.05; G.shake = Math.max(G.shake, 1.6);
    SFX.play(m.kind === 'blade' || m.kind === 'pierce' ? 'hitBlade' : m.kind === 'metal' ? 'hitMetal' : m.kind === 'fire' ? 'hitFire' : 'hitBlunt', p.x, p.y, 0.9);
    G.noise(p.x, p.y, 4);
    G.wear(sw.it, 1);
  } else {
    // 나무 베기
    if (m.chop) {
      const fx = p.x + Math.cos(sw.a) * 13, fy = p.y - 3 + Math.sin(sw.a) * 13;
      let tree = null;
      for (const [ox, oy] of [[0, 0], [Math.cos(sw.a) * 6, Math.sin(sw.a) * 6], [0, 6]]) { const o = W.objAt(Math.floor((fx + ox) / TS), Math.floor((fy + oy) / TS)); if (o && o.k === 'tree') { tree = o; break; } }
      if (tree) G.chop(tree, m.chop, sw.it);
    }
    // 망치 수리
    if (sw.it && sw.it.id === 'hammer') {
      const fx = p.x + Math.cos(sw.a) * 14, fy = p.y - 3 + Math.sin(sw.a) * 14;
      const o = W.objAt(Math.floor(fx / TS), Math.floor(fy / TS));
      if (o && (o.k === 'barricade' || o.k === 'door') && o.hp < o.max) {
        if (p.count('plank') >= 1 && p.count('nails') >= 2) {
          p.remove('plank', 1); p.remove('nails', 2);
          o.hp = Math.min(o.max, o.hp + 90); W.modified(o);
          SFX.play('craft', p.x, p.y, 0.8); G.noise(p.x, p.y, 5); G.wear(sw.it, 1);
          UI.toast(`수리했다 (${Math.round(o.hp / o.max * 100)}%)`, 'good');
        } else UI.toast('수리하려면 판자 1개와 못 2개가 필요하다.', 'warn');
      }
    }
  }
};
G.wear = function (it, n) {
  if (!it || it.d == null || ITEMS[it.id].nodur || ITEMS[it.id].gun) return;
  it.d -= n;
  if (it.d <= 0) {
    const p = G.player, i = p.inv.indexOf(it);
    if (i >= 0) p.inv[i] = null;
    SFX.play('hitMetal', p.x, p.y, 0.5);
    UI.toast(`${josa(ITEMS[it.id].name, '이', '가')} 부서졌다!`, 'bad');
  }
  UI.invChanged();
};
G.chop = function (tree, power, it) {
  const W = G.world, p = G.player;
  tree.hp -= power; tree.shake = 0.25; W.modified(tree);
  SFX.play('chop', tree.x * TS + 8, tree.y * TS + 8, 0.9);
  G.debris(tree.x * TS + 8, tree.y * TS + 6, ['#c8985e', '#8a5e36', '#e0c090'], 6, 70);
  G.noise(p.x, p.y, 6);
  G.wear(it, 1);
  if (tree.hp <= 0) {
    W.replaceObj(tree, { k: 'stump', x: tree.x, y: tree.y });
    SFX.play('treeFall', tree.x * TS + 8, tree.y * TS + 8, 0.9);
    G.debris(tree.x * TS + 8, tree.y * TS - 8, ['#3f7436', '#58904a', '#2f5a2c'], 22, 90);
    G.give('log', RND.int(2, 3)); G.give('stick', RND.int(1, 2));
    UI.toast('나무를 베었다. 통나무를 얻었다.', 'good');
    G.noise(p.x, p.y, 9);
  }
};

/* ───────── 사격 ───────── */
G.fire = function (it) {
  const p = G.player, def = ITEMS[it.id], g = def.gun;
  if (p.cd > 0 || p.reload > 0) return;
  if (!it.d) {
    if (p.count(g.ammo) > 0) G.startReload(it);
    else { SFX.play('empty', p.x, p.y, 0.8); p.cd = 0.35; G.toastOnce('noammo' + it.id + Math.floor(G.realT / 30), `${ITEMS[g.ammo].name}이 없다.`, 'warn'); }
    return;
  }
  it.d--; p.cd = g.cd; UI.invChanged();
  const a = p.aim, mx = p.x + Math.cos(a) * 11, my = p.y - 7 + Math.sin(a) * 9;
  if (g.proj) {
    G.projs.push({ k: 'arrow', x: mx, y: my, vx: Math.cos(a) * g.proj, vy: Math.sin(a) * g.proj, a, life: g.range / g.proj, dmg: g.dmg });
  } else {
    for (let k = 0; k < g.pellets; k++) G.hitscan(mx, my, a + RND.range(-g.spread, g.spread), g.range * RND.range(0.9, 1), g.dmg, g.pierce);
    G.muzzle = 0.06; G.muzzleX = mx; G.muzzleY = my; G.muzzleA = a;
    G.part(p.x, p.y - 8, 6, -Math.sin(a) * 40 + RND.range(-15, 15), Math.cos(a) * 30, 60, 0.8, '#e0b040', 1, 300, 'casing');
  }
  p.recoil = 2;
  G.shake = Math.max(G.shake, g.shake);
  SFX.play(g.snd, p.x, p.y, 1);
  G.noise(p.x, p.y, g.noise, g.noise > 5);
  if (!it.d && p.count(g.ammo) > 0) setTimeout(() => { if (G.player === p && !p.dead && p.held() === it) G.startReload(it); }, Math.min(400, g.cd * 1000));
};
G.startReload = function (it) {
  const p = G.player, g = ITEMS[it.id].gun;
  if (!g || p.reload > 0 || it.d >= g.mag) return;
  if (p.count(g.ammo) <= 0) { UI.toast(`${ITEMS[g.ammo].name}이 없다.`, 'warn'); return; }
  p.reload = g.reload; p.reloadMax = g.reload; p.reloadIt = it;
  if (!g.proj) SFX.play('reload', p.x, p.y, 0.8);
};
G.hitscan = function (x, y, a, range, dmg, pierce) {
  const W = G.world, dx = Math.cos(a), dy = Math.sin(a);
  let wallT = range;
  for (let t = 4; t < range; t += 3) {
    const px = x + dx * t, py = y + dy * t + 5, tx = Math.floor(px / TS), ty = Math.floor(py / TS);
    if (!W.inb(tx, ty)) { wallT = t; break; }
    const i = W.idx(tx, ty), wl = W.wall[i], o = W.obj[i];
    if (wl === WL.WIN) { W.breakWindow(tx, ty); SFX.play('glass', px, py, 0.9); G.debris(px, py, ['#c8e0f0', '#a0c8e0', '#ffffff'], 8, 70); G.noise(px, py, 8); wallT = t; break; }
    if (wl === WL.WALL || (o && ((o.k === 'door' && !o.open) || o.k === 'barricade' || o.k === 'tree'))) { wallT = t; break; }
  }
  const hits = [];
  for (const z of G.zombies) {
    if (z.dead) continue;
    const cx = z.x - x, cy = z.bodyY() - y, rr = z.r + 3;
    const proj = cx * dx + cy * dy;
    if (proj < 0 || proj > wallT) continue;
    const perp = Math.abs(cx * dy - cy * dx);
    if (perp > rr) continue;
    hits.push([proj, z]);
  }
  hits.sort((p1, p2) => p1[0] - p2[0]);
  let endT = wallT, dd = dmg;
  for (let k = 0; k < hits.length && k < pierce; k++) {
    G.damageZombie(hits[k][1], dd * RND.range(0.9, 1.1), a, 90, 'pierce');
    dd *= 0.7; endT = hits[k][0];
  }
  if (hits.length === 0 || pierce > hits.length) {
    endT = wallT;
    if (wallT < range) G.debris(x + dx * wallT, y + dy * wallT, ['#d8d0b8', '#a8a090', '#ffe080'], 4, 50);
  } else endT = hits[Math.min(hits.length, pierce) - 1][0];
  G.projs.push({ k: 'tracer', x, y, x2: x + dx * endT, y2: y + dy * endT, life: 0.07 });
};

/* ───────── 투척 ───────── */
G.throwItem = function (slot) {
  const p = G.player, it = p.inv[slot];
  if (!it || p.cd > 0) return;
  p.cd = 0.7;
  let tx, ty;
  const R = 125;
  if (Input.usingMouse && Input.mouse) { const d = Math.min(R, dist(p.x, p.y, Input.mouse.wx, Input.mouse.wy)); tx = p.x + Math.cos(p.aim) * d; ty = p.y + Math.sin(p.aim) * d; }
  else { tx = p.x + Math.cos(p.aim) * R * 0.85; ty = p.y + Math.sin(p.aim) * R * 0.85; }
  const d = dist(p.x, p.y, tx, ty);
  G.projs.push({ k: 'throw', id: it.id, sx: p.x, sy: p.y - 6, tx, ty, t: 0, dur: 0.25 + d / 220, x: p.x, y: p.y - 6, z: 0 });
  p.removeSlot(slot, 1);
  SFX.play('throw', p.x, p.y, 0.7);
};
G.landThrow = function (pr) {
  const x = pr.x, y = pr.y;
  if (pr.id === 'bottle') {
    SFX.play('glass', x, y, 1); G.debris(x, y, ['#8ccc9a', '#c8f0d0', '#6aa878'], 12, 80); G.noise(x, y, 14, true);
  } else if (pr.id === 'molotov') {
    SFX.play('glass', x, y, 1); SFX.play('ignite', x, y, 1);
    G.fires.push({ x, y, r: 24, t: 9, max: 9 }); G.noise(x, y, 10, true);
    G.decal(x - 10, y - 4, 'rgba(20,16,14,0.5)', 20, 8);
  } else if (pr.id === 'firecracker') {
    G.crackers.push({ x, y, t: 4.5, next: 0 });
  }
};

/* ───────── 소비/사용 ───────── */
G.consume = function (slot) {
  const p = G.player, it = p.inv[slot];
  if (!it || p.cd > 0) return;
  const def = ITEMS[it.id], f = def.food;
  const useful = (f.h > 0 && p.hunger < 99) || (f.t > 0 && p.thirst < 99) || (f.e > 0 && p.energy < 99);
  if (!useful) { UI.toast(def.drink ? '목이 마르지 않다.' : '배가 부르다.', 'warn'); return; }
  p.hunger = clamp(p.hunger + (f.h || 0), 0, 100);
  p.thirst = clamp(p.thirst + (f.t || 0), 0, 100);
  p.energy = clamp(p.energy + (f.e || 0), 0, 100);
  p.removeSlot(slot, 1);
  if (f.ret) G.give(f.ret, 1);
  p.cd = 0.7; G.stats.meals++;
  SFX.play(def.drink ? 'drink' : 'eat', p.x, p.y, 0.8);
  if (f.sick && RND() < f.sick) { p.sick = Math.max(p.sick, RND.range(120, 240)); setTimeout(() => { UI.toast('속이 좋지 않다... 병에 걸렸다.', 'bad'); SFX.play('eatBad', G.player.x, G.player.y, 0.7); }, 1200); }
  UI.toast(`${josa(def.name, '을', '를')} ${def.drink ? '마셨다' : '먹었다'}.`);
};
G.useMed = function (slot) {
  const p = G.player, it = p.inv[slot];
  if (!it || p.cd > 0) return;
  const def = ITEMS[it.id], m = def.med;
  if (m.cure) { if (p.sick <= 0) { UI.toast('아프지 않다.', 'warn'); return; } p.sick = 0; UI.toast('병이 나았다.', 'good'); }
  else if (m.bleed || m.hp) {
    if (p.bleed <= 0 && p.hp >= 99.5) { UI.toast('치료할 상처가 없다.', 'warn'); return; }
    if (m.bleed && p.bleed > 0) { p.bleed = 0; UI.toast('지혈했다.', 'good'); }
    p.hp = Math.min(100, p.hp + (m.hp || 0));
  } else if (m.hot) { if (p.hp >= 99.5) { UI.toast('치료할 상처가 없다.', 'warn'); return; } p.hot += m.hot; UI.toast('진통제를 먹었다. 서서히 회복된다.', 'good'); }
  p.removeSlot(slot, 1);
  p.cd = 0.8;
  SFX.play('pickup', p.x, p.y, 0.5);
};
G.useBattery = function (slot) {
  const p = G.player;
  let best = null;
  for (const s of p.inv) if (s && s.id === 'flashlight' && (!best || s.d < best.d)) best = s;
  if (!best) { UI.toast('충전할 손전등이 없다.', 'warn'); return; }
  if (best.d >= 99) { UI.toast('손전등이 이미 가득 충전되어 있다.', 'warn'); return; }
  best.d = 100; p.removeSlot(slot, 1);
  SFX.play('reload', p.x, p.y, 0.4);
  UI.toast('손전등을 충전했다.', 'good');
};
G.repairWith = function (slot) {
  const p = G.player, it = p.held();
  const tape = p.inv[slot];
  if (!tape) return;
  let target = null;
  for (const s of p.inv) if (s && ITEMS[s.id].melee && ITEMS[s.id].dur && !ITEMS[s.id].nodur && s.d < ITEMS[s.id].dur && (!target || s.d / ITEMS[s.id].dur < target.d / ITEMS[target.id].dur)) target = s;
  if (it && ITEMS[it.id].melee && ITEMS[it.id].dur && !ITEMS[it.id].nodur && it.d < ITEMS[it.id].dur) target = it;
  if (!target) { UI.toast('수리할 근접 무기가 없다.', 'warn'); return; }
  target.d = Math.min(ITEMS[target.id].dur, target.d + ITEMS.tape.repair);
  p.removeSlot(slot, 1);
  SFX.play('craft', p.x, p.y, 0.6);
  UI.toast(`${josa(ITEMS[target.id].name, '을', '를')} 테이프로 수리했다.`, 'good');
};
G.toggleLight = function () {
  const p = G.player;
  const fl = p.inv.find(s => s && s.id === 'flashlight');
  if (!fl) { UI.toast('손전등이 없다.', 'warn'); p.light = false; return; }
  if (!p.light && fl.d <= 0) { UI.toast('손전등 배터리가 없다. 배터리를 사용하세요.', 'warn'); return; }
  p.light = !p.light;
  SFX.play('empty', p.x, p.y, 0.5);
};

/* ───────── 설치/심기 ───────── */
G.placeTarget = function () {
  const p = G.player, W = G.world;
  let tx, ty;
  if (Input.usingMouse && Input.mouse && dist(p.x, p.y, Input.mouse.wx, Input.mouse.wy) < 40) { tx = Math.floor(Input.mouse.wx / TS); ty = Math.floor(Input.mouse.wy / TS); }
  else { tx = Math.floor((p.x + Math.cos(p.aim) * 15) / TS); ty = Math.floor((p.y - 3 + Math.sin(p.aim) * 15) / TS); }
  if (tx === Math.floor(p.x / TS) && ty === Math.floor(p.y / TS)) { tx += Math.round(Math.cos(p.aim)); ty += Math.round(Math.sin(p.aim)); }
  return { tx, ty };
};
G.canPlace = function (kind, tx, ty) {
  const W = G.world;
  if (!W.inb(tx, ty)) return false;
  const i = W.idx(tx, ty), t = W.ter[i], o = W.obj[i], wl = W.wall[i];
  if (t === T.WATER || t === T.DEEP) return false;
  if (kind === 'seed') return (t === T.GRASS || t === T.DIRT || t === T.SOIL) && !o && !wl && W.bld[i] < 0;
  if (wl && !(kind === 'barricade' && wl === WL.BROKEN)) return false;
  if (o && !(kind === 'barricade' && o.k === 'doorway')) return false;
  if (kind === 'campfire' && FLOOR_T.has(t)) return false;
  const x0 = tx * TS, y0 = ty * TS;
  const p = G.player;
  if (p.x + p.r > x0 && p.x - p.r < x0 + TS && p.y + p.r > y0 && p.y - p.r < y0 + TS) return false;
  for (const z of G.zombies) if (!z.dead && z.x + z.r > x0 && z.x - z.r < x0 + TS && z.y + z.r > y0 && z.y - z.r < y0 + TS) return false;
  return true;
};
G.placeItem = function (slot) {
  const p = G.player, it = p.inv[slot], W = G.world;
  if (!it || p.cd > 0) return;
  const def = ITEMS[it.id], kind = def.place || (def.seed ? 'seed' : null);
  const { tx, ty } = G.placeTarget();
  if (!G.canPlace(kind, tx, ty)) { UI.toast('여기에는 놓을 수 없다.', 'warn'); p.cd = 0.3; return; }
  const prev = W.objAt(tx, ty);
  let o;
  if (kind === 'seed') o = { k: 'crop', x: tx, y: ty, c: def.seed, t0: G.time };
  else if (kind === 'campfire') o = { k: 'campfire', x: tx, y: ty, fuel: 240 };
  else if (kind === 'barricade') o = { k: 'barricade', x: tx, y: ty, hp: 260, max: 260, prev: prev && prev.k === 'doorway' ? 'doorway' : null };
  else if (kind === 'box') o = { k: 'box', x: tx, y: ty, cont: [] };
  W.replaceObj(prev, o);
  p.removeSlot(slot, 1);
  p.cd = 0.4;
  SFX.play(kind === 'seed' ? 'bush' : 'craft', tx * TS + 8, ty * TS + 8, 0.8);
  if (kind !== 'seed') G.noise(p.x, p.y, 5);
  UI.toast(kind === 'seed' ? `${josa(def.name, '을', '를')} 심었다. 하루 반 뒤에 수확할 수 있다.` : `${josa(def.name, '을', '를')} 설치했다.`, 'good');
};

/* ───────── 낚시 ───────── */
G.startFish = function (it) {
  const p = G.player, W = G.world;
  if (p.action) return;
  for (const d of [16, 24, 32, 40]) {
    const x = p.x + Math.cos(p.aim) * d, y = p.y - 2 + Math.sin(p.aim) * d;
    if (W.isWater(Math.floor(x / TS), Math.floor(y / TS))) {
      p.action = { type: 'fish', bx: x, by: y, t: 0, wait: RND.range(3, 10) * (G.isNight() ? 1.25 : 1), state: 'wait', it, px: p.x, py: p.y };
      SFX.play('cast', p.x, p.y, 0.7);
      setTimeout(() => SFX.play('plop', x, y, 0.6), 320);
      return;
    }
  }
  UI.toast('물가를 바라보고 사용하세요.', 'warn');
};
G.fishPress = function () {
  const p = G.player, a = p.action;
  if (!a) return;
  if (a.state === 'wait') { p.action = null; UI.toast('낚싯줄을 감았다.'); return; }
  if (a.state === 'bite') { a.state = 'game'; G.fishGame = { t: 0, zone: RND.range(0.18, 0.72), w: RND.range(0.14, 0.22), speed: RND.range(1.6, 2.6) }; UI.fishStart(G.fishGame); return; }
  if (a.state === 'game') {
    const fg = G.fishGame, pos = 0.5 + 0.5 * Math.sin(fg.t * fg.speed * Math.PI);
    UI.fishEnd();
    if (pos >= fg.zone && pos <= fg.zone + fg.w) {
      const r = RND();
      if (r < 0.16) { const junk = RND.pick(['scrap', 'bottle', 'cloth']); G.give(junk, 1); UI.toast(`쓰레기를 건졌다... (${ITEMS[junk].name})`); }
      else { const big = r > 0.8; G.give('fish', big ? 2 : 1); G.stats.fish++; UI.toast(big ? '커다란 잉어를 낚았다! (생선 x2)' : RND.pick(['붕어를 낚았다!', '메기를 낚았다!', '피라미를 낚았다!']), 'good'); SFX.play('catch', null, null, 0.7); }
      SFX.play('splash', a.bx, a.by, 0.7);
      G.wear(a.it, 1);
    } else { UI.toast('물고기를 놓쳤다.', 'warn'); SFX.play('fail', null, null, 0.7); }
    G.fishGame = null;
    a.state = 'wait'; a.t = 0; a.wait = RND.range(4, 10);
  }
};
G.updateFish = function (dt) {
  const p = G.player, a = p.action;
  if (dist(p.x, p.y, a.px, a.py) > 3 || p.held() !== a.it) { p.action = null; if (G.fishGame) { G.fishGame = null; UI.fishEnd(); } return; }
  a.t += dt;
  if (a.state === 'wait' && a.t >= a.wait) { a.state = 'bite'; a.biteT = 0.95; SFX.play('splash', a.bx, a.by, 0.8); G.debris(a.bx, a.by, ['#d8eef5', '#a8d0e8'], 5, 30); }
  else if (a.state === 'bite') { a.biteT -= dt; if (a.biteT <= 0) { a.state = 'wait'; a.t = 0; a.wait = RND.range(3, 8); UI.toast('입질을 놓쳤다.', 'warn'); } }
  else if (a.state === 'game') { G.fishGame.t += dt; if (G.fishGame.t > 6) { UI.fishEnd(); G.fishGame = null; a.state = 'wait'; a.t = 0; UI.toast('물고기가 도망갔다.', 'warn'); } }
};

/* ───────── 잠 ───────── */
G.trySleep = function () {
  const p = G.player;
  if (p.energy > 80) { UI.toast('아직 졸리지 않다.', 'warn'); return; }
  for (const z of G.zombies) {
    if (z.dead) continue;
    const d = dist(z.x, z.y, p.x, p.y) / TS;
    if ((z.state === 'chase' && d < 16) || (d < 8 && G.visAt(z.x, z.y) > 0.5)) { UI.toast('근처에 좀비가 있어 잠들 수 없다.', 'warn'); return; }
  }
  p.sleeping = true; p.sleepT = 0; p.action = null; p.light = false;
  G.timeScale = 32;
  SFX.play('sleep', null, null, 0.6);
  UI.sleep(true);
  G.save();
};
G.wake = function (msg) {
  const p = G.player;
  if (!p.sleeping) return;
  p.sleeping = false; G.timeScale = 1;
  UI.sleep(false);
  if (msg) UI.toast(msg, 'warn');
  G.save();
};

/* ───────── 제작 ───────── */
G.nearFire = function () {
  const p = G.player, W = G.world, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  for (let y = pty - 2; y <= pty + 2; y++) for (let x = ptx - 2; x <= ptx + 2; x++) { const o = W.objAt(x, y); if (o && o.k === 'campfire' && o.fuel > 0) return true; }
  return false;
};
G.recipeStatus = function (r) {
  const p = G.player;
  const need = r.need.map(([id, n]) => ({ id, n, have: p.count(id) }));
  const tools = (r.tools || []).map(group => ({ group, ok: !!p.findTool(group) }));
  const fire = r.fire ? G.nearFire() : true;
  const ok = need.every(e => e.have >= e.n) && tools.every(t => t.ok) && fire;
  return { need, tools, fire, ok };
};
G.craft = function (r) {
  const p = G.player;
  const st = G.recipeStatus(r);
  if (!st.ok) { UI.toast('재료가 부족하다.', 'warn'); return false; }
  for (const [id, n] of r.need) p.remove(id, n);
  for (const t of st.tools) { const tool = p.findTool(t.group); if (tool && ['saw', 'axe', 'stoneaxe', 'hammer', 'lighter'].includes(tool.id)) G.wear(tool, 1); }
  const def = ITEMS[r.out];
  if (def.stack > 1) G.give(r.out, r.n);
  else for (let k = 0; k < r.n; k++) { const it = mkItem(r.out, 1); if (r.out === 'torch') it.d = 100; if (def.gun) it.d = 0; if (p.addItem(it) > 0) G.drop(p.x, p.y, it); }
  for (const [id, n] of (r.ret || [])) G.give(id, n);
  G.stats.crafted++;
  SFX.play(r.fire ? 'crackle' : 'craft', p.x, p.y, 0.8);
  G.noise(p.x, p.y, r.fire ? 2 : 4);
  UI.toast(`${josa(def.name, '을', '를')} 만들었다${r.n > 1 ? ' (x' + r.n + ')' : ''}.`, 'good');
  return true;
};

/* ───────── 상호작용 ───────── */
G.findInteract = function () {
  const p = G.player, W = G.world;
  if (p.sleeping || p.dead) return null;
  let best = null, bestS = 1e9;
  const fx = Math.cos(p.face), fy = Math.sin(p.face);
  const py = p.y - 3;
  const consider = (x, y, act, label, target, prio, maxD) => {
    const dx = x - p.x, dy = y - py, d = Math.hypot(dx, dy);
    if (d > (maxD || 22)) return;
    const dot = (dx * fx + dy * fy) / (d || 1);
    const s = d - dot * 6 - (prio || 0);
    if (s < bestS) { bestS = s; best = { x, y, act, label, target }; }
  };
  for (const g of W.groundItems) {
    if (Math.abs(g.x - p.x) > 20 || Math.abs(g.y - py) > 20) continue;
    const def = ITEMS[g.id];
    consider(g.x, g.y, 'pickup', `줍기 · ${def.name}${g.n > 1 ? ' x' + g.n : ''}`, g, 5, 18);
  }
  const ptx = Math.floor(p.x / TS), pty = Math.floor(py / TS);
  const seen = new Set();
  for (let ty = pty - 2; ty <= pty + 2; ty++) for (let tx = ptx - 2; tx <= ptx + 2; tx++) {
    const o = W.objAt(tx, ty);
    if (!o || seen.has(o)) continue;
    seen.add(o);
    const ow = o.w || 1, oh = o.h || 1;
    const nx = clamp(p.x, o.x * TS + 2, (o.x + ow) * TS - 2), ny = clamp(py, o.y * TS + 2, (o.y + oh) * TS - 2);
    if (o.k === 'door') consider(o.x * TS + 8, o.y * TS + 8, 'door', o.open ? '문 닫기' : '문 열기', o, 1);
    else if (o.k === 'furn') {
      const def = FURN[o.f] || {};
      if (def.bed) consider(nx, ny, 'sleep', `잠자기 · ${def.name}`, o, 0);
      else if (o.loot) consider(nx, ny, 'search', o.cont ? `열기 · ${def.name}${o.cont.length ? '' : ' (빈)'}` : `뒤지기 · ${def.name}`, o, 0);
    } else if (o.k === 'box') consider(nx, ny, 'search', '열기 · 보관함', o, 0);
    else if (o.k === 'campfire') consider(nx, ny, 'fire', o.fuel > 0 ? '요리 · 모닥불' : '불 피우기 · 모닥불', o, 1);
    else if (o.k === 'crop') { const g = G.cropStage(o); consider(nx, ny, g >= 2 ? 'harvest' : 'none', g >= 2 ? `수확 · ${o.c === 'potato' ? '감자' : '당근'}` : `자라는 중 · ${Math.floor(G.cropProg(o) * 100)}%`, o, 1); }
    else if (o.k === 'bush') { const d = G.day(); if (o.berry >= 0 && d >= o.berry) consider(nx, ny, 'bush', '열매 따기 · 덤불', o, 0); else if (!(o.stick > d)) consider(nx, ny, 'bush', '나뭇가지 꺾기 · 덤불', o, -2); }
    else if (o.k === 'barricade') consider(nx, ny, 'none', `바리케이드 ${Math.round(o.hp / o.max * 100)}%`, o, -4);
  }
  // 물
  for (const d of [10, 18]) {
    const x = p.x + fx * d, y = py + fy * d;
    if (W.isWater(Math.floor(x / TS), Math.floor(y / TS))) { consider(x, y, 'water', p.count('bottle') ? '물 담기 · 빈 병' : '물 마시기', null, -3, 24); break; }
  }
  return best;
};
G.cropProg = function (o) { return clamp((G.time - o.t0) / (36 * 60), 0, 1); };
G.cropStage = function (o) { const g = G.cropProg(o); return g >= 1 ? 2 : g >= 0.35 ? 1 : 0; };
G.doInteract = function () {
  const p = G.player, it = G.interact, W = G.world;
  if (!it || p.action) return;
  const o = it.target;
  switch (it.act) {
    case 'pickup': {
      const def = ITEMS[o.id];
      let left;
      if (stackOf(o.id) > 1) left = p.add(o.id, o.n, o.d); else left = p.addItem(o);
      if (left >= o.n) { UI.toast('가방이 가득 찼다.', 'warn'); return; }
      SFX.play('pickup', p.x, p.y, 0.6);
      UI.toast(`${def.name}${o.n - left > 1 ? ' x' + (o.n - left) : ''} 획득`);
      if (left > 0) o.n = left; else W.groundItems.splice(W.groundItems.indexOf(o), 1);
      break;
    }
    case 'door': {
      if (o.open) {
        const x0 = o.x * TS, y0 = o.y * TS;
        const blocked = [p, ...G.zombies.filter(z => !z.dead)].some(e => e.x + e.r > x0 && e.x - e.r < x0 + TS && e.y + e.r > y0 && e.y - e.r < y0 + TS);
        if (blocked) { UI.toast('문 앞에 뭔가 있다.', 'warn'); return; }
        o.open = false; SFX.play('doorClose', o.x * TS + 8, o.y * TS + 8, 0.8);
      } else { o.open = true; SFX.play('doorOpen', o.x * TS + 8, o.y * TS + 8, 0.8); }
      W.modified(o); G.noise(p.x, p.y, 2); G.fovKey = '';
      break;
    }
    case 'search': {
      const first = o.k === 'furn' && !o.cont;
      p.action = { type: 'search', o, t: 0, dur: first ? 0.85 : 0.2, px: p.x, py: p.y };
      if (first) { SFX.play('bush', p.x, p.y, 0.4); G.noise(p.x, p.y, 2); }
      break;
    }
    case 'sleep': G.trySleep(); break;
    case 'fire': UI.openCraft('cook', o); break;
    case 'harvest': {
      const n = RND.int(2, 4), name = o.c;
      W.replaceObj(o, null, o.x, o.y);
      G.give(name, n); G.give('seed_' + name, RND() < 0.5 ? 2 : 1);
      SFX.play('bush', p.x, p.y, 0.7);
      UI.toast(`${o.c === 'potato' ? '감자' : '당근'} ${n}개와 씨앗을 수확했다.`, 'good');
      break;
    }
    case 'bush': {
      const d = G.day();
      if (o.berry >= 0 && d >= o.berry) { const n = RND.int(2, 4); G.give('berries', n); o.berry = d + 2; UI.toast(`산딸기 ${n}개를 땄다.`); }
      else { const n = RND.int(1, 2); G.give('stick', n); o.stick = d + 1; UI.toast(`나뭇가지 ${n}개를 꺾었다.`); }
      W.modified(o); SFX.play('bush', p.x, p.y, 0.7); G.noise(p.x, p.y, 2);
      break;
    }
    case 'water': {
      const nb = p.count('bottle');
      if (nb > 0) { p.remove('bottle', nb); G.give('water_dirty', nb); UI.toast(`흙탕물 ${nb}병을 담았다. 모닥불에 끓여 마시자.`); SFX.play('splash', it.x, it.y, 0.6); }
      else {
        if (p.thirst > 97) { UI.toast('목이 마르지 않다.', 'warn'); return; }
        p.thirst = Math.min(100, p.thirst + 18); SFX.play('drink', p.x, p.y, 0.7);
        if (RND() < 0.35) { p.sick = Math.max(p.sick, RND.range(90, 180)); setTimeout(() => UI.toast('물이 더러웠다... 병에 걸렸다.', 'bad'), 1000); }
        else UI.toast('물을 마셨다. (끓이지 않은 물은 위험하다)');
      }
      break;
    }
  }
};
G.addFuel = function (o) {
  const p = G.player, W = G.world;
  const opts = [['log', 150], ['plank', 90], ['stick', 45], ['rag', 20]];
  for (const [id, mins] of opts) {
    if (p.count(id) > 0) {
      if (o.fuel <= 0 && !p.findTool(['lighter'])) { UI.toast('불을 붙이려면 라이터가 필요하다.', 'warn'); return false; }
      p.remove(id, 1); o.fuel = Math.min(720, Math.max(0, o.fuel) + mins); W.modified(o);
      SFX.play('ignite', o.x * TS + 8, o.y * TS + 8, 0.5);
      UI.toast(`${josa(ITEMS[id].name, '을', '를')} 땔감으로 넣었다.`);
      return true;
    }
  }
  UI.toast('땔감(나뭇가지·통나무·판자)이 없다.', 'warn');
  return false;
};

/* ───────── 주 행동(공격 버튼) ───────── */
G.primaryLabel = function () {
  const p = G.player, it = p.held();
  if (p.action && p.action.type === 'fish') return p.action.state === 'wait' ? '감기' : '챔질!';
  if (!it) return '공격';
  const def = ITEMS[it.id];
  if (def.food) return def.drink ? '마시기' : '먹기';
  if (def.med) return '치료';
  if (def.place) return '설치';
  if (def.seed) return '심기';
  if (def.throw) return '던지기';
  if (def.tool === 'rod') return '낚시';
  if (def.tool === 'sleepbag') return '잠자기';
  if (def.battery) return '충전';
  if (it.id === 'tape') return '수리';
  if (def.gun) return '사격';
  return '공격';
};
G.primary = function (pressed) {
  const p = G.player;
  if (p.dead || p.sleeping) return;
  if (p.action && p.action.type === 'fish') { if (pressed) G.fishPress(); return; }
  if (p.action) return;
  const it = p.held(), slot = p.sel;
  const def = it ? ITEMS[it.id] : null;
  if (!def) return G.meleeStart(null);
  if (def.gun) return G.fire(it);
  if (def.melee) return G.meleeStart(it);
  if (!pressed) { if (def.cat === 'mat' || def.cat === 'ammo' || def.cat === 'wear' || def.tool === 'saw' || def.tool === 'lighter') { if (!(def.battery || it.id === 'tape')) G.meleeStart(null); } return; }
  if (def.food) return G.consume(slot);
  if (def.med) return G.useMed(slot);
  if (def.place || def.seed) return G.placeItem(slot);
  if (def.throw) return G.throwItem(slot);
  if (def.tool === 'rod') return G.startFish(it);
  if (def.tool === 'sleepbag') return G.trySleep();
  if (def.battery) return G.useBattery(slot);
  if (it.id === 'tape') return G.repairWith(slot);
  if (def.tool === 'flashlight') return G.toggleLight();
  return G.meleeStart(null);
};

/* ───────── 플레이어 갱신 ───────── */
G.autoAim = function (range) {
  const p = G.player;
  let best = null, bs = 1e9;
  for (const z of G.zombies) {
    if (z.dead || z.alpha < 0.3) continue;
    const d = dist(p.x, p.y, z.x, z.y);
    if (d > range) continue;
    const a = Math.atan2(z.bodyY() - (p.y - 6), z.x - p.x);
    const off = Math.abs(angDiff(p.face, a));
    const s = d + off * 30;
    if ((off < 1.9 || d < 26) && s < bs) { bs = s; best = a; }
  }
  return best;
};
G.updatePlayer = function (dt, gm) {
  const p = G.player, W = G.world;
  const inp = Input;
  // 상태 타이머
  p.cd = Math.max(0, p.cd - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.invuln = Math.max(0, p.invuln - dt); p.grab = Math.max(0, p.grab - dt); p.recoil = Math.max(0, p.recoil - dt * 12);
  if (p.sleeping) {
    p.sleepT += gm;
    p.energy = Math.min(100, p.energy + 0.3 * gm);
    const h = G.minute() / 60;
    if ((p.energy >= 100 && h >= 6 && h < 19) || p.sleepT > 12 * 60 || (p.energy >= 100 && p.sleepT > 9 * 60)) G.wake('잠에서 깼다. 개운하다.');
    else for (const z of G.zombies) if (!z.dead && z.state === 'chase' && dist(z.x, z.y, p.x, p.y) < 5 * TS) { G.wake('인기척에 잠에서 깼다!'); break; }
    if (inp.anyPressed) G.wake();
  }
  // 이동
  let mx = inp.move.x, my = inp.move.y;
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) { mx /= mlen; my /= mlen; }
  const moving = mlen > 0.15 && !p.sleeping;
  if (p.action && p.action.type === 'search' && moving) p.action = null;
  let spd = 44 * Math.min(1, mlen * 1.15);
  const wantSprint = inp.sprint && moving && p.energy > 3;
  p.sprint = false;
  if (wantSprint && p.stamina > 1) { spd = 76; p.sprint = true; p.stamina = Math.max(0, p.stamina - 15 * dt); p.staRegen = 0.8; p.thirst = Math.max(0, p.thirst - 0.03 * dt); }
  if (p.energy < 20) spd *= 0.85;
  if (p.grab > 0) spd *= 0.45;
  if (p.hunger <= 0 || p.thirst <= 0) spd *= 0.9;
  const ti = W.idx(Math.floor(p.x / TS), Math.floor(p.y / TS));
  if (W.wall[ti] === WL.BROKEN) spd *= 0.45;
  if (p.action && (p.action.type === 'fish' || p.action.type === 'search')) spd = 0;
  if (p.sleeping) spd = 0;
  const vx = moving ? mx * spd : 0, vy = moving ? my * spd : 0;
  moveEnt(W, p, (vx + p.kbx) * dt, (vy + p.kby) * dt);
  p.kbx *= Math.exp(-dt * 10); p.kby *= Math.exp(-dt * 10);
  p.moving = moving && spd > 0;
  // 조준
  const it = p.held(), def = it ? ITEMS[it.id] : null;
  let aim = null;
  if (inp.usingMouse && inp.mouse) aim = Math.atan2(inp.mouse.wy - (p.y - 7), inp.mouse.wx - p.x);
  else if (inp.aimStick) aim = inp.aimStick;
  else if (inp.attack || inp.attackPressed) {
    const range = def && def.gun ? def.gun.range * 0.9 : (def && def.melee ? def.melee.range + 22 : 36);
    if (!def || def.gun || def.melee) aim = G.autoAim(range);
  }
  if (aim == null) aim = p.moving ? Math.atan2(my, mx) : p.face;
  p.aim = aim;
  if (inp.usingMouse || inp.aimStick != null || inp.attack || p.swing || !p.moving) p.face = aim; else p.face = Math.atan2(my, mx);
  p.dir = dirOf(p.face);
  if (p.moving) { p.anim += dt * (spd / 44) * 7.5; p.stepT -= dt * (spd / 44); if (p.stepT <= 0) { p.stepT = 0.34; const t = W.ter[ti]; SFX.play('step', p.x, p.y, p.sprint ? 0.5 : 0.3, { hard: t !== T.GRASS && t !== T.DIRT && t !== T.SAND && t !== T.SOIL }); G.noise(p.x, p.y, p.sprint ? 6 : 1.6); if (p.sprint) G.part(p.x, p.y, 1, RND.range(-10, 10), RND.range(-5, 5), 10, 0.4, '#a09880', 1, 20, 'dust'); } }
  else p.anim = 0;
  // 스태미나
  if (p.staRegen > 0) p.staRegen -= dt; else p.stamina = Math.min(100, p.stamina + 24 * dt * (p.energy < 20 ? 0.5 : 1));
  // 행동
  if (p.swing) { p.swing.t += dt; if (!p.swing.hit && p.swing.t >= p.swing.dur * 0.45) { p.swing.hit = true; G.meleeResolve(p.swing); } if (p.swing.t >= p.swing.dur) p.swing = null; }
  if (p.reload > 0) {
    if (!p.reloadIt || p.held() !== p.reloadIt) { p.reload = 0; p.reloadIt = null; }
    else { p.reload -= dt; if (p.reload <= 0) { const g = ITEMS[p.reloadIt.id].gun; const n = Math.min(g.mag - p.reloadIt.d, p.count(g.ammo)); p.remove(g.ammo, n); p.reloadIt.d += n; p.reloadIt = null; UI.invChanged(); } }
  }
  if (p.action) {
    if (p.action.type === 'search') { p.action.t += dt; if (p.action.t >= p.action.dur) { const o = p.action.o; p.action = null; UI.openContainer(o); } }
    else if (p.action.type === 'fish') G.updateFish(dt);
  }
  if (!p.sleeping) {
    if (inp.attackPressed) G.primary(true);
    else if (inp.attack) G.primary(false);
    if (inp.interactPressed) G.doInteract();
    if (inp.reloadPressed && it && def.gun) G.startReload(it);
    if (inp.lightPressed) G.toggleLight();
  }
  // 손전등/횃불
  const fl = p.light ? p.inv.find(s => s && s.id === 'flashlight') : null;
  if (p.light) { if (!fl) p.light = false; else { fl.d = Math.max(0, fl.d - 0.2 * gm); if (fl.d <= 0) { p.light = false; UI.toast('손전등 배터리가 다 됐다.', 'warn'); } } }
  if (it && it.id === 'torch') { it.d -= (100 / 180) * gm; if (it.d <= 0) { p.inv[p.sel] = null; UI.toast('횃불이 다 타버렸다.', 'warn'); UI.invChanged(); } }
  // 생존 수치 (게임 분 단위)
  const nm = G.cfg.needs * (p.sick > 0 ? 1.5 : 1) * (p.sleeping ? 0.5 : 1);
  p.hunger = Math.max(0, p.hunger - 0.0347 * gm * nm);
  p.thirst = Math.max(0, p.thirst - 0.0556 * gm * nm);
  if (!p.sleeping) p.energy = Math.max(0, p.energy - 0.0556 * gm * (p.sprint ? 1.6 : 1));
  let cause = null;
  if (p.hunger <= 0) { p.hp -= 0.06 * gm; cause = '굶주림'; G.toastOnce('starve' + G.day(), '배가 고파 쓰러질 것 같다! 음식을 먹으세요.', 'bad'); }
  if (p.thirst <= 0) { p.hp -= 0.12 * gm; cause = '탈수'; G.toastOnce('thirst' + G.day(), '목이 타들어 간다! 물을 마시세요.', 'bad'); }
  if (p.energy <= 0) { p.hp -= 0.02 * gm; cause = cause || '탈진'; G.toastOnce('exhaust' + G.day(), '너무 피곤하다. 잠을 자야 한다.', 'bad'); }
  if (p.hunger > 40 && p.thirst > 40 && p.bleed <= 0 && p.sick <= 0) p.hp = Math.min(100, p.hp + 0.04 * gm * (p.sleeping ? 3 : 1));
  if (p.bleed > 0) {
    p.bleed -= dt; p.hp -= 0.35 * dt; cause = '출혈';
    p.bleedDrip -= dt; if (p.bleedDrip <= 0) { p.bleedDrip = RND.range(0.6, 1.4); G.decal(p.x + RND.range(-2, 2), p.y + RND.range(-1, 2), 'rgba(120,16,16,0.85)', 1, 1); }
  }
  if (p.sick > 0) {
    p.sick -= gm; p.hp -= 0.02 * gm; cause = cause || '병';
    p.vomitT -= dt; if (p.vomitT <= 0) { p.vomitT = RND.range(40, 90); if (!p.sleeping) { p.hunger = Math.max(0, p.hunger - 6); p.thirst = Math.max(0, p.thirst - 6); SFX.play('eatBad', p.x, p.y, 0.6); G.debris(p.x + Math.cos(p.face) * 6, p.y - 4, ['#8a9a3a', '#a0a848', '#6a7a2a'], 8, 40); UI.toast('구역질이 난다...', 'bad'); } }
  }
  if (p.hot > 0) { const h = Math.min(p.hot, 1.6 * dt); p.hot -= h; p.hp = Math.min(100, p.hp + h); }
  if (!p.sleeping) {
    const d = G.day();
    if (p.hunger < 30) G.toastOnce('hungry' + d, '배가 고프다. 음식을 들고 사용하거나 가방에서 먹으세요.', 'hint');
    if (p.thirst < 30) G.toastOnce('thirsty' + d, '목이 마르다. 물이나 음료를 마시자.', 'hint');
    if (p.energy < 30) G.toastOnce('sleepy' + d, '피곤하다. 침대나 침낭에서 잠을 자자.', 'hint');
  }
  if (p.hp <= 0) G.die(cause || '부상');
  // 심장 박동
  if (p.hp < 30) { G.heartT -= dt; if (G.heartT <= 0) { G.heartT = 0.6 + p.hp / 40; SFX.play('heart', null, null, 0.5 + (30 - p.hp) / 60); } }
};

/* ───────── 좀비 갱신 ───────── */
G.rebuildGrid = function () {
  const grid = G.grid; grid.clear();
  for (const z of G.zombies) {
    if (z.dead) continue;
    const k = (Math.floor(z.x / 32) << 12) | Math.floor(z.y / 32);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(z);
  }
};
G.perceive = function (z, interval) {
  const p = G.player, W = G.world;
  if (p.dead) { z.sees = false; return; }
  const d = dist(z.x, z.y, p.x, p.y);
  let sight = z.def.sight;
  if (G.darkness > 0.45) { const lit = p.light || (p.held() && p.held().id === 'torch'); sight *= lit ? 1.3 : 0.55; }
  if (p.sleeping) sight *= 0.6;
  let sees = false;
  if (d < 20) sees = true;
  else if (d < sight) {
    const toP = Math.atan2(p.y - z.y, p.x - z.x);
    const front = z.state === 'chase' || Math.abs(angDiff(z.face, toP)) < 1.6 || d < sight * 0.4;
    if (front && W.los(z.x, z.y - 6, p.x, p.y - 6)) sees = true;
  }
  if (sees) {
    if (z.state !== 'chase') {
      z.state = 'chase';
      G.toastOnce('spotted', '좀비에게 들켰다! 싸우거나, 시야에서 벗어나 따돌리세요.', 'warn');
      SFX.play(z.type === 'runner' ? 'screech' : z.type === 'brute' ? 'roar' : z.type === 'crawler' ? 'gurgle' : 'zAttack', z.x, z.y, 0.75);
    }
    z.tx = p.x; z.ty = p.y; z.lost = 0; z.sees = true;
  } else {
    z.sees = false;
    // 장애물을 두드리는 중이고 플레이어가 가까우면 포기하지 않는다
    const banging = z.bangT > 0 && d < 8 * TS;
    if (z.state === 'chase' && !banging) { z.lost += interval; if (z.lost > 7) { z.state = 'investigate'; z.stateT = 8; } }
  }
};
G.updateZombie = function (z, dt) {
  const p = G.player, W = G.world;
  const dP = dist(z.x, z.y, p.x, p.y);
  const near = dP < 42 * TS;
  z.flash = Math.max(0, z.flash - dt); z.atkCd = Math.max(0, z.atkCd - dt); z.bangT = Math.max(0, z.bangT - dt);
  if (z.burn > 0) { z.burn -= dt; z.hp -= 7 * dt; if (RND() < dt * 14) G.part(z.x + RND.range(-4, 4), z.y - RND.range(2, 14), 2, RND.range(-5, 5), 0, 30, 0.5, RND.pick(['#ffd040', '#ff8a20', '#e04a1a']), 1, -40, 'fire'); if (z.hp <= 0) { G.killZombie(z, 0); return; } }
  z.think -= dt;
  if (z.think <= 0) { z.think = near ? RND.range(0.18, 0.32) : RND.range(0.8, 1.4); if (near) G.perceive(z, near ? 0.25 : 1); }
  let mvx = 0, mvy = 0, spd = z.spd;
  if (z.stun > 0) { z.stun -= dt; spd = 0; }
  if (z.atkT > 0) {
    z.atkT -= dt; spd = 0;
    if (z.atkT <= 0) {
      if (dist(z.x, z.y, p.x, p.y) < z.def.reach + p.r + 5 && !p.dead) {
        G.hurtPlayer(z.def.dmg * G.cfg.zDmg * RND.range(0.85, 1.15), '좀비', 'bite', Math.atan2(p.y - z.y, p.x - z.x));
        if (z.def.grab) { p.grab = z.def.grab; G.toastOnce('grab', '기어다니는 좀비가 발목을 붙잡았다!', 'bad'); }
      }
      z.atkCd = z.def.atk;
    }
  }
  switch (z.state) {
    case 'idle':
      z.stateT -= dt;
      if (z.stateT <= 0) { z.state = 'wander'; const a = RND.range(0, TAU), r = RND.range(2, 7) * TS; z.tx = z.x + Math.cos(a) * r; z.ty = z.y + Math.sin(a) * r; z.stateT = RND.range(4, 9); }
      break;
    case 'wander': case 'investigate': {
      const dx = z.tx - z.x, dy = z.ty - z.y, d = Math.hypot(dx, dy);
      z.stateT -= dt;
      if (d < 6 || z.stateT <= 0) { z.state = 'idle'; z.stateT = RND.range(2, 7); break; }
      mvx = dx / d; mvy = dy / d;
      if (z.state === 'wander') spd *= 0.45; else spd *= 0.8;
      break;
    }
    case 'chase': {
      if (p.dead) { z.state = 'idle'; break; }
      let dx, dy;
      const close = dP < 3.2 * TS && z.sees;
      if (close) { dx = p.x - z.x; dy = p.y - z.y; }
      else {
        const fd = (dP < 27 * TS) ? G.flowDir(z) : null;
        if (fd) { dx = fd[0]; dy = fd[1]; }
        else { dx = z.tx - z.x; dy = z.ty - z.y; if (Math.hypot(dx, dy) < 6 && !z.sees) { z.state = 'idle'; z.stateT = RND.range(3, 6); } }
      }
      const d = Math.hypot(dx, dy) || 1;
      mvx = dx / d; mvy = dy / d;
      if (dP < z.def.reach + p.r + 2 && z.atkCd <= 0 && z.atkT <= 0 && z.stun <= 0 && !p.dead) { z.atkT = 0.36; SFX.play('zAttack', z.x, z.y, 0.6, { pitch: z.type === 'brute' ? 0.6 : 1.1 }); }
      if (dP < z.def.reach + p.r - 1) spd *= 0.2;
      break;
    }
  }
  // 이동
  if (spd > 0 && (mvx || mvy)) {
    z.face = Math.atan2(mvy, mvx);
    const ox = z.x, oy = z.y;
    const res = moveEnt(W, z, mvx * spd * dt, mvy * spd * dt);
    const moved = Math.hypot(z.x - ox, z.y - oy);
    z.moving = moved > spd * dt * 0.25;
    if (!z.moving && (res.bx || res.by) && (z.state === 'chase' || z.state === 'investigate')) {
      // 막힘: 부술 수 있는 장애물?
      const fx = z.x + mvx * (z.r + 4), fy = z.y + mvy * (z.r + 4);
      const ob = W.breakable(Math.floor(fx / TS), Math.floor(fy / TS));
      if (ob && z.bangT <= 0 && z.stun <= 0) G.zombieBreak(z, ob);
      else { z.stuck += dt; if (z.stuck > 1.5 && z.state === 'investigate') { z.state = 'idle'; z.stateT = 1; z.stuck = 0; } }
    } else z.stuck = 0;
    if (z.moving) z.anim += dt * (z.type === 'runner' ? 11 : z.type === 'crawler' ? 4 : 5.5) * (spd / Math.max(1, z.spd));
  } else z.moving = false;
  if (z.atkT > 0 || z.state === 'chase') z.face = z.atkT > 0 || z.sees ? Math.atan2(p.y - z.y, p.x - z.x) : z.face;
  z.dir = dirOf(z.face);
  // 넉백
  if (Math.abs(z.kbx) + Math.abs(z.kby) > 1) { moveEnt(W, z, z.kbx * dt, z.kby * dt); z.kbx *= Math.exp(-dt * 9); z.kby *= Math.exp(-dt * 9); } else { z.kbx = 0; z.kby = 0; }
  // 신음
  if (near) { z.groanT -= dt; if (z.groanT <= 0) { z.groanT = z.state === 'chase' ? RND.range(2.5, 6) : RND.range(6, 16); SFX.play(z.type === 'brute' ? 'roar' : z.type === 'crawler' ? 'gurgle' : z.type === 'runner' && z.state === 'chase' ? 'screech' : 'groan', z.x, z.y, 0.6, { pitch: z.type === 'runner' ? 1.3 : 1 }); } }
  // 화면 페이드
  const va = G.visAt(z.x, z.y - 4);
  z.alpha += ((va > 0.5 ? 1 : 0) - z.alpha) * Math.min(1, dt * 8);
};
G.zombieBreak = function (z, ob) {
  const W = G.world;
  z.bangT = z.def.atk;
  const dmg = z.def.dmg * G.cfg.zDmg * (z.def.breaker || 1) * 0.6;
  if (ob.k === 'window') {
    W.breakWindow(ob.x, ob.y);
    SFX.play('glass', ob.x * TS + 8, ob.y * TS + 8, 1);
    G.debris(ob.x * TS + 8, ob.y * TS + 10, ['#c8e0f0', '#a0c8e0', '#ffffff'], 10, 70);
    G.noise(ob.x * TS + 8, ob.y * TS + 8, 9, false, z);
    G.fovKey = '';
    return;
  }
  ob.hp -= dmg; ob.shake = 0.2;
  SFX.play('doorBang', ob.x * TS + 8, ob.y * TS + 8, 1);
  G.noise(ob.x * TS + 8, ob.y * TS + 8, 7, false, z);
  G.debris(ob.x * TS + 8, ob.y * TS + 10, ['#8a5e36', '#a8784a', '#5a3a1e'], 3, 50);
  G.shake = Math.max(G.shake, dist(G.player.x, G.player.y, ob.x * TS, ob.y * TS) < 6 * TS ? 1.2 : 0);
  W.modified(ob);
  if (ob.hp <= 0) {
    const name = ob.k === 'door' ? '문' : '바리케이드';
    W.replaceObj(ob, ob.k === 'door' || ob.prev === 'doorway' ? { k: 'doorway', x: ob.x, y: ob.y } : null, ob.x, ob.y);
    G.debris(ob.x * TS + 8, ob.y * TS + 8, ['#8a5e36', '#a8784a', '#5a3a1e', '#c8985e'], 18, 90);
    SFX.play('treeFall', ob.x * TS + 8, ob.y * TS + 8, 0.5);
    G.fovKey = '';
    if (dist(G.player.x, G.player.y, ob.x * TS, ob.y * TS) < 14 * TS) UI.toast(`${josa(name, '이', '가')} 부서졌다!`, 'bad');
  }
};
G.separate = function () {
  const p = G.player, W = G.world;
  for (const [k, list] of G.grid) {
    const cx = k >> 12, cy = k & 4095;
    for (const a of list) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nb = G.grid.get(((cx + dx) << 12) | (cy + dy));
        if (!nb) continue;
        for (const b of nb) {
          if (b === a || b.id < a.id) continue;
          const ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy), m = a.r + b.r - 1;
          if (d >= m || d < 0.01) continue;
          const push = (m - d) / 2, nx = ddx / d, ny = ddy / d;
          const wa = b.def.mass / (a.def.mass + b.def.mass), wb = 1 - wa;
          moveEnt(W, a, -nx * push * wa * 2, -ny * push * wa * 2);
          moveEnt(W, b, nx * push * wb * 2, ny * push * wb * 2);
        }
      }
      // 플레이어와 겹침
      const ddx = a.x - p.x, ddy = a.y - p.y, d = Math.hypot(ddx, ddy), m = a.r + p.r;
      if (d < m && d > 0.01 && !p.dead) {
        const push = m - d, nx = ddx / d, ny = ddy / d;
        moveEnt(W, a, nx * push * 0.85, ny * push * 0.85);
        moveEnt(W, p, -nx * push * 0.15, -ny * push * 0.15);
      }
    }
  }
};

/* ───────── 투사체/불/폭죽 ───────── */
G.updateProjs = function (dt) {
  const W = G.world;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const pr = G.projs[i];
    if (pr.k === 'tracer') { pr.life -= dt; if (pr.life <= 0) G.projs.splice(i, 1); continue; }
    if (pr.k === 'arrow') {
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      pr.life -= dt;
      let hit = null;
      for (const z of G.zombies) { if (z.dead) continue; if (dist(nx, ny, z.x, z.bodyY()) < z.r + 3) { hit = z; break; } }
      const tx = Math.floor(nx / TS), ty = Math.floor((ny + 5) / TS);
      const blocked = W.inb(tx, ty) && (W.wall[W.idx(tx, ty)] === WL.WALL || W.wall[W.idx(tx, ty)] === WL.WIN || (W.obj[W.idx(tx, ty)] && W.objSolid(W.obj[W.idx(tx, ty)]) && W.obj[W.idx(tx, ty)].k !== 'furn'));
      if (hit) { G.damageZombie(hit, pr.dmg * RND.range(0.9, 1.1), pr.a, 60, 'pierce'); SFX.play('arrowHit', nx, ny, 0.8); if (RND() < 0.6) G.drop(hit.x, hit.y + 2, { id: 'arrow', n: 1 }); G.projs.splice(i, 1); continue; }
      if (blocked || pr.life <= 0) { SFX.play('arrowHit', nx, ny, 0.5); if (RND() < 0.8) G.drop(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02 + 5, { id: 'arrow', n: 1 }); G.projs.splice(i, 1); continue; }
      pr.x = nx; pr.y = ny;
      continue;
    }
    if (pr.k === 'throw') {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      const nx = lerp(pr.sx, pr.tx, k), ny = lerp(pr.sy, pr.ty, k);
      const tx = Math.floor(nx / TS), ty = Math.floor((ny + 6) / TS);
      const hitWall = W.inb(tx, ty) && (W.wall[W.idx(tx, ty)] === WL.WALL || (W.obj[W.idx(tx, ty)] && W.obj[W.idx(tx, ty)].k === 'door' && !W.obj[W.idx(tx, ty)].open));
      if (W.inb(tx, ty) && W.wall[W.idx(tx, ty)] === WL.WIN) { W.breakWindow(tx, ty); SFX.play('glass', nx, ny, 0.8); }
      pr.x = nx; pr.y = ny; pr.z = Math.sin(k * Math.PI) * (10 + pr.dur * 14);
      if (k >= 1 || hitWall) { if (hitWall) { pr.x = lerp(pr.sx, pr.tx, Math.max(0, k - 0.06)); pr.y = lerp(pr.sy, pr.ty, Math.max(0, k - 0.06)); } pr.y += 6; G.landThrow(pr); G.projs.splice(i, 1); }
    }
  }
  for (let i = G.fires.length - 1; i >= 0; i--) {
    const f = G.fires[i];
    f.t -= dt;
    if (RND() < dt * 40) { const a = RND.range(0, TAU), r = Math.sqrt(RND()) * f.r; G.part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, 1, RND.range(-6, 6), 0, RND.range(20, 45), RND.range(0.4, 0.9), RND.pick(['#fff4b0', '#ffd040', '#ff8a20', '#e04a1a']), RND() < 0.3 ? 2 : 1, -30, 'fire'); }
    if (RND() < dt * 8) G.part(f.x + RND.range(-f.r, f.r) * 0.6, f.y, 8, RND.range(-4, 4), 0, 14, 1.6, 'rgba(60,56,54,0.5)', 2, -6, 'smoke');
    if (RND() < dt * 10) SFX.play('crackle', f.x, f.y, 0.8);
    for (const z of G.zombies) if (!z.dead && dist(z.x, z.y, f.x, f.y) < f.r) { z.hp -= 16 * dt; z.burn = Math.max(z.burn, 2.5); if (z.hp <= 0) G.killZombie(z, 0); }
    const p = G.player;
    if (dist(p.x, p.y, f.x, f.y) < f.r * 0.9 && !p.dead) { p.hp -= 9 * dt; p.hurtT = 0.1; G.toastOnce('burn' + Math.floor(G.realT), '앗 뜨거워!', 'bad'); if (p.hp <= 0) G.die('화상'); }
    if (f.t <= 0) G.fires.splice(i, 1);
  }
  for (let i = G.crackers.length - 1; i >= 0; i--) {
    const c = G.crackers[i];
    c.t -= dt; c.next -= dt;
    if (c.next <= 0) { c.next = RND.range(0.15, 0.4); SFX.play('pop', c.x, c.y, 0.9, { range: 40 }); G.noise(c.x, c.y, 22, RND() < 0.3); G.debris(c.x, c.y, ['#ffe060', '#ff8a20', '#ffffff'], 5, 60); }
    if (c.t <= 0) G.crackers.splice(i, 1);
  }
};
G.updateParts = function (dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.life -= dt;
    if (q.life <= 0) { G.parts.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= q.grav * dt;
    if (q.grav > 0 && q.z <= 0) {
      q.z = 0;
      if (q.kind === 'blood') { G.decal(q.x, q.y, q.col, q.size, 1); G.parts.splice(i, 1); continue; }
      q.vz *= -0.35; q.vx *= 0.5; q.vy *= 0.5;
      if (Math.abs(q.vz) < 12) { q.vz = 0; q.grav = 0; q.vx *= 0.2; q.vy *= 0.2; }
    }
    if (q.kind === 'smoke') { q.vx *= 0.98; }
  }
  for (let i = G.rings.length - 1; i >= 0; i--) { const r = G.rings[i]; r.t += dt; r.r += dt * 380; if (r.r >= r.max) G.rings.splice(i, 1); }
  for (const c of G.corpses) c.t += dt;
};

/* ───────── 월드 갱신 ───────── */
G.updateWorldObjs = function (gm) {
  const W = G.world, p = G.player;
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  for (let y = pty - 24; y <= pty + 24; y++) for (let x = ptx - 30; x <= ptx + 30; x++) {
    const o = W.objAt(x, y);
    if (!o || o.x !== x || o.y !== y) continue;
    if (o.k === 'campfire' && o.fuel > 0) { o.fuel -= gm; if (o.fuel <= 0) { o.fuel = 0; W.modified(o); } if (RND() < 0.25) { G.part(x * TS + 8 + RND.range(-3, 3), y * TS + 8, 6, RND.range(-3, 3), 0, 18, 1.8, 'rgba(70,66,64,0.45)', 2, -5, 'smoke'); } if (RND() < 0.15) SFX.play('crackle', x * TS + 8, y * TS + 8, 0.5, { range: 10 }); }
    if (o.shake > 0) o.shake -= 1 / 60;
  }
};
G.dailyRespawn = function () {
  const W = G.world, p = G.player;
  let n = 0;
  for (let t = 0; t < 400 && n < 36; t++) {
    const x = RND.int(4, W.W - 5), y = RND.int(4, W.H - 5), i = W.idx(x, y);
    if (W.ter[i] !== T.GRASS || W.obj[i] || W.wall[i]) continue;
    if (dist(x * TS, y * TS, p.x, p.y) < 20 * TS) continue;
    if (x >= W.town.x0 && x <= W.town.x1 && y >= W.town.y0 && y <= W.town.y1) continue;
    W.groundItems.push({ x: x * TS + RND.int(3, 13), y: y * TS + RND.int(4, 13), id: RND() < 0.6 ? 'stick' : 'stone', n: 1 });
    n++;
  }
  if (W.groundItems.length > 900) W.groundItems.splice(0, W.groundItems.length - 900);
};

G.update = function (dt) {
  if (G.state !== 'play' && G.state !== 'dead') return;
  const p = G.player;
  if (G.state === 'dead') { G.deathT += dt; G.updateParts(dt); G.shake *= Math.exp(-dt * 6); return; }
  if (G.cfg.menuPause && UI.panelOpen()) { G.updateParts(dt * 0.3); return; }
  G.realT += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; G.updateParts(dt * 0.25); return; }
  const gm = dt * (1440 / G.cfg.daySec) * G.timeScale;
  G.time += gm;
  G.darkness = darknessAt(G.minute());
  if (G.day() !== G.lastDay) { G.lastDay = G.day(); G.dailyRespawn(); UI.toast(`${G.day()}일차가 밝았다.`, 'big'); G.save(); }
  if (G.minute() >= 18 * 60 && G.minute() < 18 * 60 + 40) G.toastOnce('dusk' + G.day(), '해가 지고 있다. 밤이 되기 전에 안전한 곳을 찾자.', 'warn');
  const night = G.isNight();
  if (night && !G.nightMsg) { G.nightMsg = true; UI.toast('밤이 되었다. 어둠 속에선 시야가 좁아진다.', 'warn'); }
  if (!night) G.nightMsg = false;
  G.updatePlayer(dt, gm);
  // 흐름장
  G.flowT -= dt;
  const pk = Math.floor(p.x / TS) * 1000 + Math.floor(p.y / TS);
  if (G.flowT <= 0 || (pk !== G.flowKey && G.flowT < 0.2)) { G.flowT = 0.35; G.flowKey = pk; G.computeFlow(); }
  // 좀비
  const subs = p.sleeping ? 4 : 1;
  for (let s = 0; s < subs; s++) for (const z of G.zombies) if (!z.dead && (s === 0 || dist(z.x, z.y, p.x, p.y) < 30 * TS)) G.updateZombie(z, dt);
  G.zombies = G.zombies.filter(z => !z.dead);
  G.zombies.forEach((z, i) => { z.id = i; });
  G.rebuildGrid(); G.separate();
  G.updateProjs(dt); G.updateParts(dt); G.updateWorldObjs(gm);
  G.computeFOV(false); G.updateVis(dt);
  G.interact = G.findInteract();
  // 재생성
  G.spawnT -= dt;
  if (G.spawnT <= 0) { G.spawnT = 12; if (G.cfg.respawn && G.zombies.length < G.cfg.zCount) for (let k = 0; k < 3 && G.zombies.length < G.cfg.zCount; k++) G.spawnZombie(30, 60, RND() < 0.5); }
  // 시체 정리
  if (G.corpses.length && G.corpses[0].t > 240) G.corpses.shift();
  // 자동 저장
  G.saveT += dt;
  if (G.saveT > 60) { G.saveT = 0; G.save(); }
  G.shake *= Math.exp(-dt * 9); G.muzzle = Math.max(0, G.muzzle - dt); G.hurtFlash = Math.max(0, G.hurtFlash - dt);
  SFX.L.x = p.x; SFX.L.y = p.y;
};
