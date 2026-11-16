'use strict';
/* ===== 월드: 지형 생성, 건물, 충돌/시야 질의 ===== */
const SOLID_OBJ = new Set(['tree', 'rockbig', 'campfire', 'barricade', 'box', 'furn', 'lamp']);

function mkItem(id, n, rng) {
  const def = ITEMS[id];
  const it = { id, n: n || 1 };
  if (def.gun) it.d = rng ? rng.int(0, Math.ceil(def.gun.mag / 2)) : 0;
  else if (id === 'flashlight') it.d = rng ? rng.int(35, 100) : 100;
  else if (def.dur) it.d = rng ? Math.round(def.dur * rng.range(0.45, 1)) : def.dur;
  return it;
}
function stackOf(id) { return ITEMS[id].stack || 1; }
function addToList(list, id, n, d, cap) {
  const st = stackOf(id);
  if (st > 1) for (const s of list) { if (n <= 0) break; if (s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; } }
  while (n > 0 && (cap == null || list.length < cap)) { const k = Math.min(n, st); const it = { id, n: k }; if (d != null) it.d = d; list.push(it); n -= k; }
  return n;
}
function rollLoot(table, rng, mul) {
  const L = LOOT[table];
  const items = [];
  if (!L) return items;
  const emptyP = clamp(L.empty * (mul < 1 ? 1.5 : mul > 1 ? 0.55 : 1), 0, 0.92);
  if (rng() < emptyP) return items;
  let rolls = rng.int(L.rolls[0], L.rolls[1]);
  rolls = Math.max(1, Math.round(rolls * mul));
  const wl = L.items.map(e => [e, e[1]]);
  for (let k = 0; k < rolls; k++) {
    const e = rng.weighted(wl);
    const n = rng.int(e[2], Math.max(e[2], Math.round(e[3] * (mul > 1 ? 1.25 : 1))));
    const proto = mkItem(e[0], 1, rng);
    if (stackOf(e[0]) > 1) addToList(items, e[0], n, proto.d, 12);
    else items.push(proto);
  }
  return items;
}

class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.W = 144; this.H = 144;
    const N = this.W * this.H;
    this.ter = new Uint8Array(N);
    this.wall = new Uint8Array(N);
    this.mark = new Uint8Array(N);
    this.bld = new Int16Array(N).fill(-1);
    this.depth = new Uint8Array(N);
    this.obj = new Array(N).fill(null);
    this.explored = new Uint8Array(N);
    this.buildings = [];
    this.chunks = new Map();
    this.decals = new Map();
    this.mods = new Set();
    this.wallMods = new Set();
    this.groundItems = [];
    this.landmarks = [];
    this.lootMul = 1;
  }
  idx(x, y) { return y * this.W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  bldAt(tx, ty) { if (!this.inb(tx, ty)) return null; const b = this.bld[this.idx(tx, ty)]; return b >= 0 ? this.buildings[b] : null; }
  objAt(tx, ty) { return this.inb(tx, ty) ? this.obj[this.idx(tx, ty)] : null; }
  isDoorTile(tx, ty) { const o = this.objAt(tx, ty); return !!o && (o.k === 'door' || o.k === 'doorway'); }
  isWater(tx, ty) { if (!this.inb(tx, ty)) return false; const t = this.ter[this.idx(tx, ty)]; return t === T.WATER || t === T.DEEP; }
  objSolid(o) {
    if (!o) return false;
    if (o.k === 'door') return !o.open;
    return SOLID_OBJ.has(o.k) && o.solid !== false;
  }
  solid(tx, ty) {
    if (!this.inb(tx, ty)) return true;
    const i = this.idx(tx, ty), t = this.ter[i];
    if (t === T.WATER || t === T.DEEP) return true;
    const w = this.wall[i];
    if (w === WL.WALL || w === WL.WIN || w === WL.FENCE) return true;
    return this.objSolid(this.obj[i]);
  }
  opaque(tx, ty) {
    if (!this.inb(tx, ty)) return true;
    const i = this.idx(tx, ty);
    if (this.wall[i] === WL.WALL) return true;
    const o = this.obj[i];
    if (o && ((o.k === 'door' && !o.open) || o.k === 'barricade')) return true;
    return false;
  }
  // 좀비가 부술 수 있는 장애물
  breakable(tx, ty) {
    if (!this.inb(tx, ty)) return null;
    const i = this.idx(tx, ty), o = this.obj[i];
    if (o && o.k === 'door' && !o.open) return o;
    if (o && o.k === 'barricade') return o;
    if (this.wall[i] === WL.WIN) return { k: 'window', x: tx, y: ty };
    return null;
  }
  passCost(tx, ty) {
    if (!this.inb(tx, ty)) return 0;
    if (!this.solid(tx, ty)) return 1;
    return this.breakable(tx, ty) ? 9 : 0;
  }
  setObj(o) {
    const w = o.w || 1, h = o.h || 1;
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) if (this.inb(x, y)) this.obj[this.idx(x, y)] = o;
  }
  clearObj(o) {
    const w = o.w || 1, h = o.h || 1;
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) if (this.inb(x, y) && this.obj[this.idx(x, y)] === o) this.obj[this.idx(x, y)] = null;
  }
  modified(o) { this.mods.add(this.idx(o.x, o.y)); }
  replaceObj(old, nu, x, y) {
    if (old) { this.clearObj(old); this.mods.add(this.idx(old.x, old.y)); }
    if (nu) { this.setObj(nu); this.mods.add(this.idx(nu.x, nu.y)); }
    else if (x != null) this.mods.add(this.idx(x, y));
  }
  invalidate(tx, ty) {
    const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx * 2, y = ty + dy * 2;
      this.chunks.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    }
    this.chunks.delete(cx + ',' + cy);
  }
  breakWindow(tx, ty) {
    const i = this.idx(tx, ty);
    if (this.wall[i] !== WL.WIN) return;
    this.wall[i] = WL.BROKEN;
    this.wallMods.add(i);
    this.invalidate(tx, ty);
  }
  container(o) {
    if (!o.cont) {
      const rng = makeRng((this.seed ^ Math.imul(this.idx(o.x, o.y) + 7, 2654435761)) >>> 0);
      o.cont = rollLoot(o.loot, rng, this.lootMul);
      this.modified(o);
    }
    return o.cont;
  }

  /* ───────────── 월드 생성 ───────────── */
  generate() {
    const R = makeRng(this.seed);
    const W = this.W, H = this.H;
    const S = this;
    const setT = (x, y, t) => { if (S.inb(x, y)) S.ter[S.idx(x, y)] = t; };
    const getT = (x, y) => S.inb(x, y) ? S.ter[S.idx(x, y)] : -1;
    const fillT = (x0, y0, w, h, t) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setT(x, y, t); };
    this.ter.fill(T.GRASS);

    // ── 마을 도로망 ──
    const BW = 22, BH = 16, NX = 3, NY = 3;
    const TX = 30 + R.int(-3, 3), TY = 39 + R.int(-4, 4);
    const rx = [], ry = [];
    for (let i = 0; i <= NX; i++) rx.push(TX + i * (BW + 5));
    for (let j = 0; j <= NY; j++) ry.push(TY + j * (BH + 5));
    const townX0 = rx[0] - 1, townX1 = rx[NX] + 3, townY0 = ry[0] - 1, townY1 = ry[NY] + 3;
    this.town = { x0: townX0, y0: townY0, x1: townX1, y1: townY1 };
    // 마을 밖으로 이어지는 도로
    const exitH = R.int(1, 2), exitV = R.int(1, 2);
    const hSpan = (j) => j === exitH ? [0, W - 1] : [townX0, townX1];
    const vSpan = (i) => i === exitV ? [0, H - 1] : [townY0, townY1];
    for (let i = 0; i <= NX; i++) { const [a, b] = vSpan(i); for (let y = a; y <= b; y++) { setT(rx[i] - 1, y, T.WALK); setT(rx[i] + 3, y, T.WALK); } }
    for (let j = 0; j <= NY; j++) { const [a, b] = hSpan(j); for (let x = a; x <= b; x++) { setT(x, ry[j] - 1, T.WALK); setT(x, ry[j] + 3, T.WALK); } }
    for (let i = 0; i <= NX; i++) { const [a, b] = vSpan(i); for (let y = a; y <= b; y++) for (let k = 0; k < 3; k++) setT(rx[i] + k, y, T.ROAD); }
    for (let j = 0; j <= NY; j++) { const [a, b] = hSpan(j); for (let x = a; x <= b; x++) for (let k = 0; k < 3; k++) setT(x, ry[j] + k, T.ROAD); }
    const isInter = (x, y) => { for (const X of rx) if (x >= X && x <= X + 2) for (const Y of ry) if (y >= Y && y <= Y + 2) return true; return false; };
    for (let j = 0; j <= NY; j++) { const [a, b] = hSpan(j); for (let x = a; x <= b; x++) if (!isInter(x, ry[j] + 1)) this.mark[this.idx(x, ry[j] + 1)] = 1; }
    for (let i = 0; i <= NX; i++) { const [a, b] = vSpan(i); for (let y = a; y <= b; y++) if (!isInter(rx[i] + 1, y)) this.mark[this.idx(rx[i] + 1, y)] = 2; }
    for (const X of rx) for (const Y of ry) {
      for (let k = 0; k < 3; k++) {
        if (getT(X + k, Y - 1) === T.ROAD) this.mark[this.idx(X + k, Y - 1)] = 3;
        if (getT(X + k, Y + 3) === T.ROAD) this.mark[this.idx(X + k, Y + 3)] = 3;
        if (getT(X - 1, Y + k) === T.ROAD) this.mark[this.idx(X - 1, Y + k)] = 5;
        if (getT(X + 3, Y + k) === T.ROAD) this.mark[this.idx(X + 3, Y + k)] = 5;
      }
    }

    // ── 건물 도우미 ──
    const WALLPAPERS = [[184, 168, 138], [138, 160, 168], [168, 140, 138], [154, 170, 138], [192, 186, 172], [150, 140, 170], [176, 150, 120]];
    const ROOFS = ['#8a3a2c', '#4a5262', '#3a5a42', '#6a4a32', '#7a2e2e', '#525a4a', '#3e4a66'];
    const SIDING = [[168, 176, 184], [200, 184, 144], [144, 168, 144], [184, 150, 120], [176, 176, 168], [150, 160, 186]];
    const CARPETS = [[106, 58, 74], [58, 78, 106], [88, 98, 62], [110, 90, 64], [76, 64, 96]];
    const addFurn = (k, x, y, extra) => {
      const def = FURN[k] || {};
      const o = Object.assign({ k: 'furn', f: k, x, y, w: def.w || 1, h: def.h || 1, v: R.int(0, 6), baked: true, loot: def.loot || null, cont: null }, extra || {});
      o.k = 'furn';
      this.setObj(o);
      return o;
    };
    // 가구 정의의 k는 스프라이트 이름: 스프라이트 렌더링 시 f 사용
    const free = (x, y) => this.inb(x, y) && !this.wall[this.idx(x, y)] && !this.obj[this.idx(x, y)] && FLOOR_T.has(this.ter[this.idx(x, y)]);
    const makeBuilding = (kind, x0, y0, w, h, o) => {
      const id = this.buildings.length;
      const b = Object.assign({ id, kind, x0, y0, w, h, roof: 'gable', roofCol: R.pick(ROOFS), ext: R.chance(0.5) ? 'brick' : 'siding', extCol: [138, 70, 54], wallpaper: R.pick(WALLPAPERS), carpet: R.pick(CARPETS), sign: null, doors: [] }, o || {});
      if (!o || !o.extCol) {
        if (b.ext === 'siding') b.extCol = R.pick(SIDING);
        else if (b.ext === 'brick') b.extCol = R.pick([[138, 70, 54], [150, 86, 62], [120, 64, 56], [146, 104, 78]]);
        else b.extCol = [158, 158, 154];
      }
      this.buildings.push(b);
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const i = this.idx(x, y);
        this.bld[i] = id;
        this.obj[i] = null;
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        this.wall[i] = edge ? WL.WALL : 0;
        this.ter[i] = b.floor || T.WOOD;
      }
      // 정문
      const dx = b.doorX != null ? b.doorX : x0 + R.int(2, w - 3);
      this.wall[this.idx(dx, y0 + h - 1)] = 0;
      const door = { k: 'door', x: dx, y: y0 + h - 1, open: false, hp: 130, max: 130 };
      this.setObj(door); b.doors.push(door);
      b.door = { x: dx, y: y0 + h - 1 };
      // 창문
      for (let x = x0 + 1; x < x0 + w - 1; x++) {
        if (Math.abs(x - dx) <= 1) continue;
        if ((x - x0) % 3 === 1 && R.chance(0.85)) this.wall[this.idx(x, y0 + h - 1)] = WL.WIN;
        if ((x - x0) % 3 === 2 && R.chance(0.5)) this.wall[this.idx(x, y0)] = WL.WIN;
      }
      for (let y = y0 + 2; y < y0 + h - 2; y++) {
        if (R.chance(0.18)) this.wall[this.idx(x0, y)] = WL.WIN;
        if (R.chance(0.18)) this.wall[this.idx(x0 + w - 1, y)] = WL.WIN;
      }
      // 문 앞 길
      for (let y = y0 + h; y < y0 + h + 6; y++) { const t = getT(dx, y); if (t === T.GRASS || t === T.DIRT) setT(dx, y, b.path || T.WALK); else break; }
      return b;
    };
    // 연결성 검사: 문에서 모든 바닥에 갈 수 있는가
    const connected = (b) => {
      const sx = b.door.x, sy = b.door.y - 1;
      const seen = new Set([this.idx(sx, sy)]);
      const st = [[sx, sy]];
      let cnt = 0;
      while (st.length) {
        const [x, y] = st.pop(); cnt++;
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ddx, ny = y + ddy, i = this.idx(nx, ny);
          if (seen.has(i) || this.bld[i] !== b.id || this.wall[i] || this.obj[i]) continue;
          seen.add(i); st.push([nx, ny]);
        }
      }
      let total = 0;
      for (let y = b.y0 + 1; y < b.y0 + b.h - 1; y++) for (let x = b.x0 + 1; x < b.x0 + b.w - 1; x++) { const i = this.idx(x, y); if (!this.wall[i] && !this.obj[i]) total++; }
      return cnt >= total;
    };
    const keepClear = (b) => {
      const s = new Set();
      s.add(this.idx(b.door.x, b.door.y - 1)); s.add(this.idx(b.door.x, b.door.y - 2));
      return s;
    };
    const tryPlace = (b, k, cands, clear) => {
      const def = FURN[k] || {};
      const fw = def.w || 1, fh = def.h || 1;
      R.shuffle(cands);
      for (const [x, y] of cands) {
        let ok = true;
        for (let yy = y; yy < y + fh && ok; yy++) for (let xx = x; xx < x + fw && ok; xx++) if (!free(xx, yy) || this.bld[this.idx(xx, yy)] !== b.id || clear.has(this.idx(xx, yy))) ok = false;
        if (!ok) continue;
        const o = addFurn(k, x, y);
        if (connected(b)) return o;
        this.clearObj(o);
      }
      return null;
    };
    const roomCells = (r, side) => {
      const out = [];
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
        const nearTop = this.wall[this.idx(x, y - 1)] === WL.WALL || this.wall[this.idx(x, y - 1)] === WL.WIN;
        const nearL = this.wall[this.idx(x - 1, y)] && this.wall[this.idx(x - 1, y)] !== WL.FENCE;
        const nearR = this.wall[this.idx(x + 1, y)] && this.wall[this.idx(x + 1, y)] !== WL.FENCE;
        const nearB = this.wall[this.idx(x, y + 1)] === WL.WALL;
        if (side === 'top' ? nearTop : side === 'any' ? (nearTop || nearL || nearR || nearB) : side === 'mid' ? !(nearTop || nearL || nearR || nearB) : (nearL || nearR)) out.push([x, y]);
      }
      return out;
    };
    const furnishRoom = (b, r, type, clear) => {
      const setF = (t) => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) this.ter[this.idx(x, y)] = t; };
      const lists = {
        kitchen: [['fridge', 'top'], ['stove', 'top'], ['counter', 'top'], ['sink', 'top'], ['counter', 'any'], ['table', 'mid']],
        living: [['sofa', 'top'], ['tv', 'any'], ['bookshelf', 'any'], ['drawer', 'any'], ['table', 'mid']],
        bedroom: [['bed', 'top'], ['wardrobe', 'top'], ['drawer', 'any'], ['bookshelf', 'any']],
        bath: [['toilet', 'top'], ['medcab', 'top'], ['bathtub', 'any']],
        studio: [['bed', 'top'], ['fridge', 'top'], ['counter', 'top'], ['drawer', 'any'], ['wardrobe', 'any'], ['stove', 'top']],
      };
      if (type === 'kitchen' || type === 'bath') setF(T.TILE);
      else if (type === 'bedroom') setF(R.chance(0.6) ? T.CARPET : T.WOOD);
      else setF(T.WOOD);
      for (const [k, side] of lists[type]) {
        if (R.chance(0.12) && k !== 'bed' && k !== 'fridge') continue;
        tryPlace(b, k, roomCells(r, side), clear);
      }
    };
    const buildHouse = (x0, y0, w, h, o) => {
      const b = makeBuilding('house', x0, y0, w, h, o);
      const clear = keepClear(b);
      const ix0 = x0 + 1, iy0 = y0 + 1, ix1 = x0 + w - 2, iy1 = y0 + h - 2;
      const rooms = [];
      if (w >= 9) {
        let sx = ix0 + Math.floor((ix1 - ix0) * R.range(0.4, 0.6));
        if (Math.abs(sx - b.door.x) <= 1) sx = b.door.x < sx ? sx + 2 : sx - 2;
        sx = clamp(sx, ix0 + 2, ix1 - 2);
        for (let y = iy0; y <= iy1; y++) this.wall[this.idx(sx, y)] = WL.WALL;
        const gy = R.int(iy0 + 1, iy1 - 1);
        this.wall[this.idx(sx, gy)] = 0; clear.add(this.idx(sx - 1, gy)); clear.add(this.idx(sx + 1, gy)); clear.add(this.idx(sx, gy));
        const left = { x0: ix0, y0: iy0, x1: sx - 1, y1: iy1 }, right = { x0: sx + 1, y0: iy0, x1: ix1, y1: iy1 };
        const doorLeft = b.door.x < sx;
        const big = doorLeft ? left : right, other = doorLeft ? right : left;
        rooms.push([big, 'living']);
        if (other.y1 - other.y0 >= 5) {
          const sy = other.y0 + Math.floor((other.y1 - other.y0) * R.range(0.4, 0.6));
          for (let x = other.x0; x <= other.x1; x++) this.wall[this.idx(x, sy)] = WL.WALL;
          let gx = R.int(other.x0, other.x1);
          this.wall[this.idx(gx, sy)] = 0; clear.add(this.idx(gx, sy - 1)); clear.add(this.idx(gx, sy + 1)); clear.add(this.idx(gx, sy));
          rooms.push([{ x0: other.x0, y0: other.y0, x1: other.x1, y1: sy - 1 }, 'bedroom']);
          rooms.push([{ x0: other.x0, y0: sy + 1, x1: other.x1, y1: other.y1 }, R.chance(0.5) ? 'bath' : 'kitchen']);
          // 거실 쪽이 부엌 역할
          if (rooms[2][1] === 'bath') rooms[0][1] = 'kitchen_living';
        } else rooms.push([other, 'bedroom']);
      } else rooms.push([{ x0: ix0, y0: iy0, x1: ix1, y1: iy1 }, 'studio']);
      for (const [r, t] of rooms) {
        if (t === 'kitchen_living') { furnishRoom(b, r, 'kitchen', clear); tryPlace(b, 'sofa', roomCells(r, 'any'), clear); tryPlace(b, 'tv', roomCells(r, 'any'), clear); }
        else furnishRoom(b, r, t, clear);
      }
      if (R.chance(0.5)) tryPlace(b, 'trash', roomCells({ x0: ix0, y0: iy0, x1: ix1, y1: iy1 }, 'any'), clear);
      return b;
    };
    const shopRows = (b, k, v, rows, clear) => {
      for (const y of rows) for (let x = b.x0 + 2; x <= b.x0 + b.w - 3; x++) {
        if ((x - b.x0) % 5 === 0) continue;
        if (free(x, y) && !clear.has(this.idx(x, y))) { const o = addFurn(k, x, y, { v }); if (!connected(b)) this.clearObj(o); }
      }
    };
    const buildShop = (kind, x0, y0, w, h) => {
      const cfg = {
        mart: { floor: T.STORE, roof: 'flat', roofCol: '#7a7a7c', ext: 'concrete', sign: { text: 'MART 24', bg: '#2a6ab0', fg: '#ffffff' }, loot: 'mart', v: 0 },
        pharmacy: { floor: T.STORE, roof: 'flat', roofCol: '#808084', ext: 'concrete', sign: { text: 'PHARMACY', bg: '#f0f0f0', fg: '#2a8a4a', icon: 'cross' }, loot: 'pharmacy', v: 1 },
        hardware: { floor: T.CONC, roof: 'flat', roofCol: '#6e6a66', ext: 'brick', sign: { text: 'TOOLS', bg: '#d87a20', fg: '#2a1a0a' }, loot: 'hardware', v: 2 },
        police: { floor: T.TILE, roof: 'flat', roofCol: '#5e6470', ext: 'concrete', sign: { text: 'POLICE', bg: '#1e3a6a', fg: '#ffffff', icon: 'star' }, loot: 'police', v: 2 },
        gas: { floor: T.STORE, roof: 'flat', roofCol: '#868686', ext: 'concrete', sign: { text: 'GAS', bg: '#c83030', fg: '#ffffff' }, loot: 'mart', v: 0 },
        warehouse: { floor: T.CONC, roof: 'flat', roofCol: '#6a7068', ext: 'siding', sign: { text: 'STORAGE', bg: '#3a4a3a', fg: '#e8e8d8' }, loot: 'crate', v: 2 },
      }[kind];
      const b = makeBuilding(kind, x0, y0, w, h, { floor: cfg.floor, roof: cfg.roof, roofCol: cfg.roofCol, ext: cfg.ext, sign: cfg.sign });
      const clear = keepClear(b);
      const ix0 = x0 + 1, iy0 = y0 + 1, ix1 = x0 + w - 2, iy1 = y0 + h - 2;
      for (let x = b.door.x - 1; x <= b.door.x + 1; x++) for (let y = iy1 - 1; y <= iy1; y++) clear.add(this.idx(x, y));
      const mk = (k, x, y, ex) => { if (free(x, y) && !clear.has(this.idx(x, y))) { const o = addFurn(k, x, y, ex); if (!connected(b)) { this.clearObj(o); return null; } return o; } return null; };
      if (kind === 'mart' || kind === 'gas' || kind === 'pharmacy') {
        for (let x = ix0; x <= ix1; x++) if (R.chance(kind === 'pharmacy' ? 0.5 : 0.75)) mk(kind === 'pharmacy' ? 'shelf' : 'drinkfridge', x, iy0, { v: cfg.v, loot: kind === 'pharmacy' ? 'pharmacy' : 'drinks' });
        const rows = []; for (let y = iy0 + 2; y <= iy1 - 2; y += 2) rows.push(y);
        for (const y of rows) for (let x = ix0 + 1; x <= ix1 - 1; x++) { if ((x - ix0) % 5 === 0) continue; mk('shelf', x, y, { v: cfg.v, loot: cfg.loot }); }
        mk('register', b.door.x + 2 <= ix1 ? b.door.x + 2 : b.door.x - 2, iy1 - 1, {});
        if (kind === 'pharmacy') { mk('medcab', ix0, iy1 - 1, {}); mk('medcab', ix1, iy1 - 1, {}); }
      } else if (kind === 'hardware') {
        for (let x = ix0; x <= ix1; x++) if (R.chance(0.7)) mk('shelf', x, iy0, { v: 2, loot: 'hardware' });
        for (let y = iy0 + 2; y <= iy1 - 2; y += 2) for (let x = ix0 + 1; x <= ix1 - 1; x++) { if ((x - ix0) % 4 === 0) continue; mk('shelf', x, y, { v: 2, loot: 'hardware' }); }
        tryPlace(b, 'workbench', roomCells({ x0: ix0, y0: iy0, x1: ix1, y1: iy1 }, 'any'), clear);
        mk('register', b.door.x + 2 <= ix1 ? b.door.x + 2 : b.door.x - 2, iy1 - 1, {});
      } else if (kind === 'police') {
        const sy = iy0 + Math.floor((iy1 - iy0) / 2);
        for (let x = ix0; x <= ix1; x++) this.wall[this.idx(x, sy)] = WL.WALL;
        const gx = clamp(b.door.x + R.int(-3, 3), ix0 + 1, ix1 - 1);
        this.wall[this.idx(gx, sy)] = 0; clear.add(this.idx(gx, sy + 1)); clear.add(this.idx(gx, sy - 1));
        for (let x = ix0; x <= ix1; x++) for (let y = iy0; y < sy; y++) this.ter[this.idx(x, y)] = T.CONC;
        for (let x = ix0; x <= ix1; x++) if (R.chance(0.7)) mk('locker', x, iy0, { loot: 'police' });
        for (let x = ix0 + 1; x <= ix1 - 1; x += 3) mk('desk', x, sy + 2, { loot: 'desk' });
        mk('locker', ix0, sy + 1, { loot: 'police' }); mk('drawer', ix1, sy + 1, { loot: 'desk' });
        mk('crate', ix1, iy0 + 2, { loot: 'police' });
      } else if (kind === 'warehouse') {
        for (let k = 0; k < 6; k++) {
          const cx = R.int(ix0 + 1, ix1 - 2), cy = R.int(iy0, iy1 - 2);
          for (let dy = 0; dy < 2; dy++) for (let ddx = 0; ddx < 2; ddx++) if (R.chance(0.75)) mk('crate', cx + ddx, cy + dy, { loot: 'crate' });
        }
        for (let x = ix0; x <= ix1; x++) if (R.chance(0.5)) mk('shelf', x, iy0, { v: 2, loot: 'hardware' });
        tryPlace(b, 'workbench', roomCells({ x0: ix0, y0: iy0, x1: ix1, y1: iy1 }, 'any'), clear);
      }
      return b;
    };
    // ── 바깥 사물 ──
    const placeOut = (k, x, y, extra) => {
      const def = FURN[k] || {}, fw = (extra && extra.w) || def.w || 1, fh = (extra && extra.h) || def.h || 1;
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) {
        if (!this.inb(xx, yy) || this.obj[this.idx(xx, yy)] || this.wall[this.idx(xx, yy)] || this.bld[this.idx(xx, yy)] >= 0) return null;
        const t = getT(xx, yy); if (t === T.WATER || t === T.DEEP) return null;
      }
      return addFurn(k, x, y, Object.assign({ w: fw, h: fh }, extra || {}));
    };
    const placeCar = (x, y, horiz, kind) => {
      kind = kind || (R.chance(0.15) ? 'carwreck' : 'car');
      return placeOut(kind, x, y, { w: horiz ? 3 : 2, h: horiz ? 2 : 3, v: R.int(0, 6), loot: kind === 'carwreck' ? null : (kind === 'policecar' ? 'policecar' : 'car') });
    };
    const fenceLine = (x0, y0, x1, y1, gaps) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!this.inb(x, y)) continue;
        const i = this.idx(x, y);
        if (gaps && gaps.has(i)) continue;
        if (this.ter[i] === T.GRASS && !this.obj[i] && !this.wall[i] && this.bld[i] < 0) this.wall[i] = WL.FENCE;
      }
    };
    const addTree = (x, y, v) => {
      if (!this.inb(x, y)) return false;
      const i = this.idx(x, y);
      if (this.ter[i] !== T.GRASS || this.obj[i] || this.wall[i] || this.bld[i] >= 0) return false;
      this.obj[i] = { k: 'tree', x, y, v: v != null ? v : R.int(0, 6), hp: 4 };
      return true;
    };

    // ── 블록 배치 ──
    const types = R.shuffle(['police', 'mart', 'pharmacy', 'hardware', 'gas', 'warehouse', 'houses', 'houses', 'houses']);
    for (let bj = 0; bj < NY; bj++) for (let bi = 0; bi < NX; bi++) {
      const type = types[bj * NX + bi];
      const lx0 = rx[bi] + 4, lx1 = rx[bi + 1] - 2, ly0 = ry[bj] + 4, ly1 = ry[bj + 1] - 2;
      const front = ly1 - 3; // 건물 앞벽 행
      const backFence = () => fenceLine(lx0, ly0, lx1, ly0);
      const houseAt = (x, w) => { const h = R.int(7, Math.min(10, front - ly0)); return buildHouse(x, front - h + 1, w, h); };
      const yardDeco = (x0, x1) => {
        for (let k = 0; k < 3; k++) { const x = R.int(x0, x1), y = R.int(ly0 + 1, ly0 + 2); if (R.chance(0.6)) addTree(x, y); else this.obj[this.idx(x, y)] = this.obj[this.idx(x, y)] || (getT(x, y) === T.GRASS && !this.wall[this.idx(x, y)] ? { k: 'bush', x, y, v: R.int(0, 1), berry: R.chance(0.3) ? 0 : -1 } : null); }
        const tx = R.int(x0, x1); placeOut(R.chance(0.7) ? 'trash' : 'mailbox', tx, ly1 - 1, { loot: 'trash' });
      };
      if (type === 'houses') {
        const w1 = R.int(8, 10), w2 = R.int(8, 10);
        const gap = BW - w1 - w2;
        const x1 = lx0 + R.int(0, Math.max(0, Math.floor(gap / 2) - 1));
        const b1 = houseAt(x1, w1);
        const x2 = lx1 - w2 + 1 - R.int(0, Math.max(0, Math.floor(gap / 2) - 1));
        const b2 = houseAt(x2, w2);
        backFence();
        const midX = Math.floor((b1.x0 + b1.w + b2.x0) / 2);
        fenceLine(midX, ly0, midX, front - 1);
        yardDeco(lx0, b1.x0 + b1.w); yardDeco(b2.x0, lx1);
        if (R.chance(0.5)) placeCar(midX - 1 >= b1.x0 + b1.w ? midX - 1 : midX + 1, front - 1, false);
      } else if (type === 'police') {
        const w = 16, h = R.int(10, 11);
        const x0 = lx0 + R.int(1, BW - w - 1);
        const b = buildShop('police', x0, front - h + 1, w, h);
        this.landmarks.push({ x: b.door.x, y: b.door.y, name: '경찰서' });
        for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) if (getT(x, y) === T.GRASS && y > front) setT(x, y, T.LOT);
        placeCar(lx0 + 1, front + 1, true, 'policecar');
        if (R.chance(0.7)) placeCar(lx1 - 3, front + 1, true, 'policecar');
        backFence();
      } else if (type === 'mart' || type === 'pharmacy' || type === 'hardware') {
        const w = type === 'pharmacy' ? R.int(9, 10) : R.int(11, 13), h = type === 'pharmacy' ? 7 : R.int(8, 9);
        const leftShop = R.chance(0.5);
        const x0 = leftShop ? lx0 + 1 : lx1 - w;
        const b = buildShop(type, x0, front - h + 1, w, h);
        this.landmarks.push({ x: b.door.x, y: b.door.y, name: { mart: '편의점', pharmacy: '약국', hardware: '철물점' }[type] });
        const rest0 = leftShop ? x0 + w + 1 : lx0, rest1 = leftShop ? lx1 : x0 - 2;
        if (type === 'mart') {
          for (let y = ly0 + 1; y <= ly1; y++) for (let x = rest0; x <= rest1; x++) if (getT(x, y) === T.GRASS) setT(x, y, T.LOT);
          for (let x = rest0 + 1; x < rest1; x += 3) { for (let y = ly0 + 2; y <= ly0 + 4; y++) this.mark[this.idx(x, y)] = 4; if (x + 1 <= rest1 && R.chance(0.55)) placeCar(x, ly0 + 2, false); }
          placeOut('vending', b.x0 + b.w, front, { loot: 'vending' }) || placeOut('vending', b.x0 - 1, front, { loot: 'vending' });
          placeOut('dumpster', rest1 - 2, ly1 - 1, { loot: 'trash' });
        } else {
          const w2 = Math.min(10, rest1 - rest0 - 1);
          if (w2 >= 7) houseAt(rest0 + Math.floor((rest1 - rest0 + 1 - w2) / 2), w2);
          yardDeco(rest0, rest1);
          if (type === 'hardware') for (let k = 0; k < 3; k++) placeOut('crate', R.int(b.x0, b.x0 + b.w - 1), ly0 + 1 + (k % 2), { loot: 'crate' });
        }
        backFence();
      } else if (type === 'gas') {
        const w = 9, h = 6;
        const x0 = lx0 + R.int(1, 3);
        const b = buildShop('gas', x0, ly0 + 1, w, h);
        this.landmarks.push({ x: b.door.x, y: b.door.y, name: '주유소' });
        for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) if (getT(x, y) === T.GRASS) setT(x, y, T.LOT);
        for (let k = 0; k < 3; k++) { const px = lx0 + 5 + k * 5; if (px + 1 <= lx1) { placeOut('gaspump', px, ly0 + 10); } }
        placeCar(lx1 - 4, ly0 + 2, false);
        placeOut('dumpster', lx1 - 2, ly1 - 1, { loot: 'trash' });
      } else if (type === 'warehouse') {
        const w = R.int(15, 17), h = R.int(10, 11);
        const x0 = lx0 + R.int(1, BW - w - 1);
        const b = buildShop('warehouse', x0, front - h + 1, w, h);
        this.landmarks.push({ x: b.door.x, y: b.door.y, name: '창고' });
        for (let y = front + 1; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) if (getT(x, y) === T.GRASS) setT(x, y, T.LOT);
        placeOut('dumpster', lx0 + 1, front + 1, { loot: 'trash' });
        placeCar(lx1 - 3, front + 1, true);
      }
    }
    // 가로등/소화전/쓰레기통 (인도)
    for (let y = townY0; y <= townY1; y++) for (let x = townX0; x <= townX1; x++) {
      if (getT(x, y) !== T.WALK || this.obj[this.idx(x, y)]) continue;
      const h = hash2(x, y, this.seed);
      if (h < 0.035) { const o = placeOut('trash', x, y, { loot: 'trash' }); if (o) o.v = 0; }
      else if (h < 0.045) placeOut('hydrant', x, y);
      else if (h > 0.975 && ((x + y) % 2 === 0)) { this.obj[this.idx(x, y)] = { k: 'lamp', x, y }; }
    }
    // 도로 위 버려진 차
    for (let k = 0; k < 14; k++) {
      const j = R.int(0, NY), i = R.int(0, NX);
      if (R.chance(0.5)) { const x = R.int(townX0, townX1 - 3); const y = ry[j] + (R.chance(0.5) ? 0 : 1); if (getT(x, y) === T.ROAD && getT(x + 2, y + 1) === T.ROAD && !isInter(x, y) && !isInter(x + 2, y)) placeCar(x, y, true); }
      else { const y = R.int(townY0, townY1 - 3); const x = rx[i] + (R.chance(0.5) ? 0 : 1); if (getT(x, y) === T.ROAD && getT(x + 1, y + 2) === T.ROAD && !isInter(x, y) && !isInter(x, y + 2)) placeCar(x, y, false); }
    }

    // ── 호수 ──
    const lakeSpots = [[18, 20], [126, 20], [18, 124], [126, 124], [16, 72], [128, 72], [72, 18], [72, 126]];
    const ls = R.pick(lakeSpots.filter(([x, y]) => !(x > townX0 - 12 && x < townX1 + 12 && y > townY0 - 12 && y < townY1 + 12)));
    const lr = R.int(10, 13);
    this.lake = { x: ls[0], y: ls[1], r: lr };
    for (let y = ls[1] - lr - 6; y <= ls[1] + lr + 6; y++) for (let x = ls[0] - lr - 6; x <= ls[0] + lr + 6; x++) {
      if (!this.inb(x, y) || x < 3 || y < 3 || x > W - 4 || y > H - 4) continue;
      const d = dist(x, y, ls[0], ls[1]) / lr + (fbm(x * 0.15, y * 0.15, this.seed + 3, 2) - 0.5) * 0.7;
      if (d < 1) { if (getT(x, y) === T.GRASS) setT(x, y, T.WATER); }
      else if (d < 1.18 && getT(x, y) === T.GRASS) setT(x, y, T.SAND);
    }
    // 작은 연못
    for (let k = 0; k < 2; k++) {
      let px = R.int(10, W - 10), py = R.int(10, H - 10), tries = 0;
      while (tries++ < 30 && (px > townX0 - 4 && px < townX1 + 4 && py > townY0 - 4 && py < townY1 + 4 || dist(px, py, ls[0], ls[1]) < lr + 15)) { px = R.int(10, W - 10); py = R.int(10, H - 10); }
      const pr = R.range(3, 4.5);
      for (let y = py - 6; y <= py + 6; y++) for (let x = px - 6; x <= px + 6; x++) {
        if (!this.inb(x, y)) continue;
        const d = dist(x, y, px, py) / pr + (vnoise(x * 0.4, y * 0.4, k + 9) - 0.5) * 0.5;
        if (d < 1 && getT(x, y) === T.GRASS) setT(x, y, T.WATER);
        else if (d < 1.25 && getT(x, y) === T.GRASS) setT(x, y, T.SAND);
      }
    }
    // 물 깊이
    const N = W * H, q = [];
    const dd = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) { const t = this.ter[i]; if (t !== T.WATER) { dd[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ddx, ny = y + ddy; if (!this.inb(nx, ny)) continue;
        const j = this.idx(nx, ny); if (dd[j] >= 0) continue;
        dd[j] = dd[i] + 1; q.push(j);
      }
    }
    for (let i = 0; i < N; i++) if (this.ter[i] === T.WATER) { this.depth[i] = Math.min(5, dd[i] - 1); if (dd[i] > 3) this.ter[i] = T.DEEP; }

    // ── 마을 밖 시설 ──
    const placeFree = (w, h, avoid) => {
      for (let t = 0; t < 300; t++) {
        const x = R.int(6, W - w - 7), y = R.int(6, H - h - 7);
        if (x + w > townX0 - 4 && x < townX1 + 4 && y + h > townY0 - 4 && y < townY1 + 4) continue;
        if (avoid && avoid.some(a => dist(x + w / 2, y + h / 2, a[0], a[1]) < a[2])) continue;
        let ok = true;
        for (let yy = y - 2; yy < y + h + 4 && ok; yy++) for (let xx = x - 2; xx < x + w + 2 && ok; xx++) { const tt = getT(xx, yy); if (tt !== T.GRASS && tt !== T.SAND) ok = false; if (this.bld[this.idx(xx, yy)] >= 0) ok = false; }
        if (ok) return [x, y];
      }
      return null;
    };
    const dirtPath = (x0, y0, x1, y1) => {
      let x = x0, y = y0, n = 0;
      while ((x !== x1 || y !== y1) && n++ < 400) {
        for (let k = 0; k < 2; k++) { const tx = x + (Math.abs(x1 - x) < Math.abs(y1 - y) ? k : 0), ty = y + (Math.abs(x1 - x) < Math.abs(y1 - y) ? 0 : k); if (getT(tx, ty) === T.GRASS || getT(tx, ty) === T.SAND) setT(tx, ty, T.DIRT); }
        if (Math.abs(x1 - x) > Math.abs(y1 - y)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
        if (R.chance(0.08)) { if (R.chance(0.5)) x += R.chance(0.5) ? 1 : -1; else y += R.chance(0.5) ? 1 : -1; }
        if (this.bld[this.idx(clamp(x, 0, W - 1), clamp(y, 0, H - 1))] >= 0) break;
      }
    };
    const nearestTownEdge = (x, y) => [clamp(x, townX0, townX1), clamp(y, townY0, townY1)];
    // 낚시터 오두막 + 부두
    {
      let best = null;
      for (let a = 0; a < TAU; a += 0.2) {
        const x = Math.round(ls[0] + Math.cos(a) * (lr + 3)), y = Math.round(ls[1] + Math.sin(a) * (lr + 3));
        const d = dist(x, y, (townX0 + townX1) / 2, (townY0 + townY1) / 2);
        if (getT(x, y) === T.GRASS || getT(x, y) === T.SAND) if (!best || d < best[2]) best = [x, y, d, a];
      }
      if (best) {
        // 부두: 물 쪽으로
        const ax = -Math.cos(best[3]), ay = -Math.sin(best[3]);
        let x = best[0], y = best[1];
        for (let k = 0; k < 12; k++) {
          x = Math.round(best[0] + ax * k); y = Math.round(best[1] + ay * k);
          if (!this.inb(x, y)) break;
          const t = getT(x, y);
          if (t === T.WATER || t === T.DEEP) { setT(x, y, T.DOCK); if (k > 9) break; } else if (t === T.DOCK) continue; else if (k > 6) break;
        }
        this.landmarks.push({ x: best[0], y: best[1], name: '낚시터' });
        const sp = placeFree(7, 6, null);
        const cx = clamp(best[0] + Math.round(Math.cos(best[3]) * 6) - 3, 6, W - 14), cy = clamp(best[1] + Math.round(Math.sin(best[3]) * 6) - 3, 6, H - 14);
        let okc = true;
        for (let yy = cy - 1; yy < cy + 7 && okc; yy++) for (let xx = cx - 1; xx < cx + 8 && okc; xx++) { const tt = getT(xx, yy); if (tt !== T.GRASS && tt !== T.SAND && tt !== T.DIRT) okc = false; }
        const pos = okc ? [cx, cy] : sp;
        if (pos) {
          const b = buildHouse(pos[0], pos[1], 7, 6, { kind: 'cabin', ext: 'siding', extCol: [132, 96, 62], roofCol: '#4a3a2a', path: T.DIRT });
          for (const yy of [b.y0 + 1]) for (let xx = b.x0 + 1; xx < b.x0 + b.w - 1; xx++) { const o = this.obj[this.idx(xx, yy)]; if (o && o.loot) o.loot = 'cabin'; }
          tryPlace(b, 'crate', roomCells({ x0: b.x0 + 1, y0: b.y0 + 1, x1: b.x0 + b.w - 2, y1: b.y0 + b.h - 2 }, 'any'), keepClear(b));
          for (let yy = b.y0; yy < b.y0 + b.h; yy++) for (let xx = b.x0; xx < b.x0 + b.w; xx++) { const o = this.obj[this.idx(xx, yy)]; if (o && o.k === 'furn' && o.f === 'crate') o.loot = 'cabin'; }
          dirtPath(b.door.x, b.door.y + 1, ...nearestTownEdge(b.door.x, b.door.y + 1));
          dirtPath(b.door.x, b.door.y + 1, best[0], best[1]);
        }
      }
    }
    // 농장
    {
      const sp = placeFree(20, 14, [[ls[0], ls[1], lr + 12]]);
      if (sp) {
        const [fx, fy] = sp;
        const hb = buildHouse(fx, fy, 9, 7, { kind: 'farm', ext: 'siding', roofCol: '#7a2e2e', path: T.DIRT });
        const sb = buildShop('warehouse', fx + 11, fy + 1, 8, 6);
        sb.kind = 'barn'; sb.sign = null; sb.roof = 'gable'; sb.roofCol = '#8a3a2a'; sb.ext = 'siding'; sb.extCol = [150, 64, 48];
        for (let yy = sb.y0; yy < sb.y0 + sb.h; yy++) for (let xx = sb.x0; xx < sb.x0 + sb.w; xx++) { const o = this.obj[this.idx(xx, yy)]; if (o && o.k === 'furn') o.loot = 'shed'; }
        this.landmarks.push({ x: hb.door.x, y: hb.door.y, name: '농장' });
        for (let yy = fy + 9; yy < fy + 13; yy++) for (let xx = fx; xx < fx + 12; xx++) if (getT(xx, yy) === T.GRASS) setT(xx, yy, T.SOIL);
        for (let yy = fy + 9; yy < fy + 13; yy++) for (let xx = fx; xx < fx + 12; xx++) if (getT(xx, yy) === T.SOIL && R.chance(0.35)) this.obj[this.idx(xx, yy)] = { k: 'crop', x: xx, y: yy, c: R.chance(0.5) ? 'potato' : 'carrot', t0: -99999 };
        fenceLine(fx - 1, fy + 8, fx + 12, fy + 8, new Set([this.idx(hb.door.x, fy + 8), this.idx(hb.door.x + 1, fy + 8)]));
        fenceLine(fx - 1, fy + 14, fx + 12, fy + 14);
        fenceLine(fx - 1, fy + 8, fx - 1, fy + 14); fenceLine(fx + 12, fy + 8, fx + 12, fy + 14);
        for (let k = 0; k < 3; k++) placeOut('haybale', fx + 12 + R.int(0, 6), fy + 8 + R.int(0, 4));
        dirtPath(hb.door.x + 1, fy + 8, ...nearestTownEdge(hb.door.x, hb.door.y));
      }
    }
    // 숲속 오두막
    for (let k = 0; k < 2; k++) {
      const sp = placeFree(6, 5, [[ls[0], ls[1], lr + 8]]);
      if (!sp) continue;
      const b = buildHouse(sp[0], sp[1], R.int(6, 7), 5, { kind: 'cabin', ext: 'siding', extCol: [120, 88, 56], roofCol: '#3e4a36', path: T.DIRT });
      for (let yy = b.y0; yy < b.y0 + b.h; yy++) for (let xx = b.x0; xx < b.x0 + b.w; xx++) { const o = this.obj[this.idx(xx, yy)]; if (o && o.loot) o.loot = R.chance(0.5) ? 'cabin' : o.loot; }
      this.landmarks.push({ x: b.door.x, y: b.door.y, name: '오두막' });
      if (R.chance(0.6)) dirtPath(b.door.x, b.door.y + 1, ...nearestTownEdge(b.door.x, b.door.y + 1));
    }

    // ── 숲/덤불/바위 ──
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = this.idx(x, y);
      if (this.ter[i] !== T.GRASS || this.obj[i] || this.wall[i] || this.bld[i] >= 0) continue;
      const inTown = x >= townX0 - 1 && x <= townX1 + 1 && y >= townY0 - 1 && y <= townY1 + 1;
      const border = Math.min(x, y, W - 1 - x, H - 1 - y);
      const n = fbm(x / 18, y / 18, this.seed + 1, 3);
      let p = inTown ? 0.012 : n > 0.56 ? 0.3 : n > 0.46 ? 0.11 : 0.03;
      if (border < 6) p = Math.max(p, 0.62 - border * 0.06);
      const r = hash2(x, y, this.seed + 2);
      if (r < p) {
        const pine = fbm(x / 30, y / 30, this.seed + 7, 2) > 0.55;
        const v = hash2(x, y, 3) < 0.05 ? 10 + (hash2(x, y, 4) < 0.5 ? 0 : 1) : pine ? 7 + Math.floor(hash2(x, y, 5) * 3) : Math.floor(hash2(x, y, 6) * 7);
        this.obj[i] = { k: 'tree', x, y, v, hp: 4 };
      } else if (r < p + (inTown ? 0.01 : 0.035)) {
        this.obj[i] = { k: 'bush', x, y, v: Math.floor(hash2(x, y, 8) * 2), berry: hash2(x, y, 9) < 0.45 ? 0 : -1 };
      } else if (!inTown && r < p + 0.045) {
        const big = hash2(x, y, 10) < 0.35;
        this.obj[i] = { k: big ? 'rockbig' : 'rock', x, y, v: big ? 2 : Math.floor(hash2(x, y, 11) * 2) };
      }
    }
    // 바닥 줍기 아이템
    for (let k = 0; k < 420; k++) {
      const x = R.int(4, W - 5), y = R.int(4, H - 5), i = this.idx(x, y);
      if (this.ter[i] !== T.GRASS || this.obj[i] || this.wall[i]) continue;
      if (x >= townX0 && x <= townX1 && y >= townY0 && y <= townY1 && R.chance(0.8)) continue;
      const id = R.chance(0.62) ? 'stick' : 'stone';
      this.groundItems.push({ x: x * TS + R.int(3, 13), y: y * TS + R.int(4, 13), id, n: 1 });
    }
    // 시작 위치: 마을 안쪽의 집
    const houses = this.buildings.filter(b => b.kind === 'house');
    const sb = houses.length ? R.pick(houses) : this.buildings[0];
    this.start = { x: sb.door.x * TS + 8, y: (sb.door.y - 1) * TS + 10, bld: sb.id };
    this.mods.clear(); this.wallMods.clear();
  }

  /* 시야 판정 (타일 레이캐스트) */
  los(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 6);
    let lastT = -1;
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = ax + dx * t, y = ay + dy * t;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS), k = ty * this.W + tx;
      if (k === lastT) continue; lastT = k;
      if (this.opaque(tx, ty)) return false;
    }
    return true;
  }

  /* 저장/불러오기용 변경 내역 */
  serializeMods() {
    const objs = [];
    for (const i of this.mods) {
      const x = i % this.W, y = (i / this.W) | 0;
      const o = this.obj[i];
      if (o && o.x === x && o.y === y) { const c = Object.assign({}, o); delete c.shake; delete c.flash; objs.push([i, c]); }
      else objs.push([i, null]);
    }
    const walls = [];
    for (const i of this.wallMods) walls.push([i, this.wall[i]]);
    return { objs, walls };
  }
  applyMods(m) {
    if (!m) return;
    for (const [i, o] of m.objs) {
      const cur = this.obj[i];
      if (cur) this.clearObj(cur);
      if (o) this.setObj(o);
      this.mods.add(i);
    }
    for (const [i, w] of m.walls) { this.wall[i] = w; this.wallMods.add(i); }
    this.chunks.clear();
  }
}
