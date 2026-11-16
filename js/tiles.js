'use strict';
/* ===== 지형/건물 픽셀아트: 지면 청크, 벽, 가구, 지붕 ===== */
const T = { GRASS: 0, DIRT: 1, SAND: 2, WATER: 3, ROAD: 4, WALK: 5, WOOD: 6, TILE: 7, CARPET: 8, CONC: 9, STORE: 10, SOIL: 11, DOCK: 12, LOT: 13, DEEP: 14 };
const WL = { NONE: 0, WALL: 1, WIN: 2, BROKEN: 3, FENCE: 4 };
const CHUNK = 16; // 청크당 타일 수
const FLOOR_T = new Set([T.WOOD, T.TILE, T.CARPET, T.CONC, T.STORE]);

(function () {
  const G = [[50, 84, 42], [60, 98, 48], [72, 112, 56], [86, 128, 64]];
  const G_TUFT = [104, 148, 74], G_DARK = [40, 70, 36], DRY = [128, 132, 72];
  const DIRTC = [[112, 82, 52], [124, 92, 58], [136, 102, 66]];
  const SANDC = [[196, 174, 124], [206, 186, 136], [216, 198, 150]];
  const ASPH = [58, 60, 66];

  function put(d, i, c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  function putv(d, i, c, v) { d[i] = c[0] + v; d[i + 1] = c[1] + v; d[i + 2] = c[2] + v; d[i + 3] = 255; }
  function mixA(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  /* 지면 타일 칠하기 (d: 청크 RGBA, cw: 청크 폭 px) */
  function paintGround(d, cw, W, tx, ty, ox, oy) {
    const t = W.ter[W.idx(tx, ty)];
    const bx = tx * TS, by = ty * TS;
    const P = (px, py) => ((oy + py) * cw + (ox + px)) * 4;
    if (t === T.GRASS) {
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        const n = vnoise(wx * 0.035, wy * 0.035, 11) * 0.65 + vnoise(wx * 0.11, wy * 0.11, 12) * 0.35;
        const h = hash2(wx, wy, 13);
        const v = n + (h - 0.5) * 0.22;
        let c = v < 0.36 ? G[0] : v < 0.5 ? G[1] : v < 0.64 ? G[2] : G[3];
        const dry = vnoise(wx * 0.012, wy * 0.012, 14);
        if (dry > 0.66) c = mixA(c, DRY, Math.min(0.65, (dry - 0.66) * 2.4));
        put(d, P(px, py), c);
      }
      for (let py = 0; py < TS - 1; py++) for (let px = 0; px < TS; px++) {
        if (hash2(bx + px, by + py, 15) < 0.028) { put(d, P(px, py), G_TUFT); put(d, P(px, py + 1), G_DARK); }
      }
      if (hash2(tx, ty, 16) < 0.07) {
        const n = 1 + Math.floor(hash2(tx, ty, 17) * 3);
        const cols = [[236, 236, 228], [240, 210, 70], [220, 120, 160], [150, 150, 230]];
        const col = cols[Math.floor(hash2(tx, ty, 18) * 4)];
        for (let k = 0; k < n; k++) {
          const px = 2 + Math.floor(hash2(tx, ty, 19 + k) * 12), py = 2 + Math.floor(hash2(tx, ty, 29 + k) * 11);
          put(d, P(px, py), col); put(d, P(px, py + 1), [52, 96, 40]);
        }
      }
    } else if (t === T.DIRT || t === T.SOIL) {
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py, h = hash2(wx, wy, 21);
        let c;
        if (t === T.SOIL) c = ((wy % 6) < 3) ? [88, 60, 38] : [72, 48, 30];
        else c = DIRTC[h < 0.3 ? 0 : h < 0.8 ? 1 : 2];
        const v = (vnoise(wx * 0.08, wy * 0.08, 22) - 0.5) * 20;
        putv(d, P(px, py), c, v);
        if (h > 0.985) put(d, P(px, py), [150, 140, 130]);
      }
    } else if (t === T.SAND) {
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py, h = hash2(wx, wy, 23);
        const c = SANDC[h < 0.25 ? 0 : h < 0.85 ? 1 : 2];
        putv(d, P(px, py), c, Math.sin((wx + wy * 0.3) * 0.5) * 4);
      }
      edgeShade(d, cw, W, tx, ty, ox, oy, n => n === T.WATER || n === T.DEEP, [150, 130, 92], 3);
    } else if (t === T.WATER || t === T.DEEP) {
      const dep = W.depth[W.idx(tx, ty)];
      const sh = [70, 128, 164], dp = [34, 74, 120];
      const base = mixA(sh, dp, Math.min(1, dep / 4));
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        const v = (vnoise(wx * 0.07, wy * 0.12, 24) - 0.5) * 14;
        putv(d, P(px, py), base, v);
        if (hash2(wx, wy, 25) < 0.012) put(d, P(px, py), mixA(base, [170, 210, 230], 0.5));
      }
      // 물가 거품
      const land = (x, y) => { if (!W.inb(x, y)) return false; const n = W.ter[W.idx(x, y)]; return n !== T.WATER && n !== T.DEEP && n !== T.DOCK; };
      const L = land(tx - 1, ty), R = land(tx + 1, ty), U = land(tx, ty - 1), D = land(tx, ty + 1);
      if (L || R || U || D) for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const j = hash2(bx + px, by + py, 26) * 1.6;
        let e = 99;
        if (L) e = Math.min(e, px); if (R) e = Math.min(e, 15 - px); if (U) e = Math.min(e, py); if (D) e = Math.min(e, 15 - py);
        if (e < 1.2 + j) put(d, P(px, py), [206, 232, 238]);
        else if (e < 3 + j) put(d, P(px, py), [110, 168, 196]);
      }
    } else if (t === T.ROAD || t === T.LOT) {
      const base = t === T.LOT ? [66, 68, 72] : ASPH;
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py, h = hash2(wx, wy, 31);
        let c = base;
        if (h < 0.09) c = [base[0] + 12, base[1] + 12, base[2] + 12]; else if (h > 0.93) c = [base[0] - 9, base[1] - 9, base[2] - 9];
        const s = vnoise(wx * 0.05, wy * 0.05, 32);
        putv(d, P(px, py), c, (s - 0.5) * 10);
      }
      const m = W.mark[W.idx(tx, ty)];
      const Y = [196, 164, 60], Wt = [200, 200, 192];
      if (m === 1) for (let px = 0; px < TS; px++) { if (((bx + px) >> 3) & 1) continue; put(d, P(px, 7), Y); put(d, P(px, 8), Y); }
      if (m === 2) for (let py = 0; py < TS; py++) { if (((by + py) >> 3) & 1) continue; put(d, P(7, py), Y); put(d, P(8, py), Y); }
      if (m === 3) for (let py = 1; py < TS - 1; py++) for (let px = 0; px < TS; px++) if ((px % 4) < 2) put(d, P(px, py), Wt);
      if (m === 5) for (let px = 1; px < TS - 1; px++) for (let py = 0; py < TS; py++) if ((py % 4) < 2) put(d, P(px, py), Wt);
      if (m === 4) for (let py = 1; py < TS - 1; py++) put(d, P(0, py), Wt);
      if (hash2(tx, ty, 33) < 0.22) { // 균열
        let x = Math.floor(hash2(tx, ty, 34) * 16), y = Math.floor(hash2(tx, ty, 35) * 16);
        for (let k = 0; k < 14; k++) {
          if (x >= 0 && y >= 0 && x < 16 && y < 16) put(d, P(x, y), [40, 41, 46]);
          const r = hash2(tx * 31 + k, ty, 36);
          if (r < 0.5) x += r < 0.25 ? 1 : -1; else y += r < 0.75 ? 1 : -1;
        }
      }
    } else if (t === T.WALK) {
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        const seam = (wx % 8 === 0) || (wy % 8 === 0);
        const bv = (hash2(wx >> 3, wy >> 3, 41) - 0.5) * 14;
        const c = seam ? [110, 110, 114] : [142 + bv, 142 + bv, 144 + bv];
        putv(d, P(px, py), c, (hash2(wx, wy, 42) - 0.5) * 6);
      }
      edgeShade(d, cw, W, tx, ty, ox, oy, n => n === T.ROAD, [92, 92, 96], 1, [166, 166, 168]);
    } else if (t === T.WOOD || t === T.DOCK) {
      const dock = t === T.DOCK;
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        let c;
        if (!dock) {
          const r = wy >> 2, off = Math.floor(hash2(r, 0, 51) * 24);
          const plank = Math.floor((wx + off) / 24), b = hash2(plank, r, 52);
          c = b < 0.33 ? [138, 94, 58] : b < 0.66 ? [126, 84, 50] : [148, 102, 64];
          if ((wx + off) % 24 === 0 || (wy & 3) === 3) c = [94, 62, 36];
          else c = [c[0] + (hash2(wx, wy, 53) - 0.5) * 8, c[1] + (hash2(wx, wy, 53) - 0.5) * 6, c[2]];
        } else {
          const col = wx >> 2, b = hash2(col, 0, 54);
          c = (wx & 3) === 3 ? [26, 48, 70] : (b < 0.5 ? [128, 94, 62] : [116, 84, 54]);
          if ((wx & 3) !== 3 && (wy % 16 === 4) && ((wx & 3) === 1)) c = [70, 70, 74];
        }
        put(d, P(px, py), c);
      }
    } else if (t === T.TILE || t === T.STORE) {
      const store = t === T.STORE;
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        const grout = (wx % 8 === 0) || (wy % 8 === 0);
        let c;
        if (store) c = grout ? [168, 168, 162] : [206, 206, 198];
        else c = grout ? [138, 138, 134] : ((((wx >> 3) + (wy >> 3)) & 1) ? [198, 198, 190] : [164, 168, 172]);
        const dirt = vnoise(wx * 0.1, wy * 0.1, 55);
        putv(d, P(px, py), c, dirt > 0.72 ? -16 : (hash2(wx, wy, 56) - 0.5) * 5);
      }
    } else if (t === T.CARPET) {
      const b = W.bldAt(tx, ty), col = b ? b.carpet : [106, 58, 74];
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        let v = (hash2(wx, wy, 57) - 0.5) * 10;
        if ((wx % 4 === 0) && (wy % 4 === 0)) v += 14;
        putv(d, P(px, py), col, v);
      }
    } else if (t === T.CONC) {
      for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
        const wx = bx + px, wy = by + py;
        let c = [116, 116, 112];
        if (wx % 32 === 0 || wy % 32 === 0) c = [96, 96, 94];
        const st = vnoise(wx * 0.06, wy * 0.06, 58);
        putv(d, P(px, py), c, (hash2(wx, wy, 59) - 0.5) * 10 - (st > 0.7 ? 14 : 0));
      }
    }
  }
  // 이웃 타일 방향으로 테두리 음영
  function edgeShade(d, cw, W, tx, ty, ox, oy, test, col, w, hi) {
    const chk = (x, y) => W.inb(x, y) && test(W.ter[W.idx(x, y)]);
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of sides) {
      if (!chk(tx + dx, ty + dy)) continue;
      for (let k = 0; k < TS; k++) for (let j = 0; j < w + (hi ? 1 : 0); j++) {
        let px, py;
        if (dy === -1) { px = k; py = j; } else if (dy === 1) { px = k; py = 15 - j; } else if (dx === -1) { px = j; py = k; } else { px = 15 - j; py = k; }
        const i = ((oy + py) * cw + (ox + px)) * 4;
        put(d, i, j < w ? col : hi);
      }
    }
  }

  /* 벽 칠하기 */
  function paintWall(d, cw, W, tx, ty, ox, oy) {
    const i0 = W.idx(tx, ty), wl = W.wall[i0];
    const P = (px, py) => ((oy + py) * cw + (ox + px)) * 4;
    const bx = tx * TS, by = ty * TS;
    if (wl === WL.FENCE) {
      const fn = (x, y) => W.inb(x, y) && W.wall[W.idx(x, y)] === WL.FENCE;
      const post = [118, 84, 52], rail = [146, 106, 66], dark = [78, 54, 32];
      const L = fn(tx - 1, ty), R = fn(tx + 1, ty), U = fn(tx, ty - 1), D = fn(tx, ty + 1);
      const rails = (y) => { for (let px = (L ? 0 : 6); px < (R ? 16 : 10); px++) { put(d, P(px, y), rail); put(d, P(px, y + 1), dark); } };
      if (L || R || (!U && !D)) { rails(5); rails(10); }
      if (U || D) for (let py = (U ? 0 : 4); py < (D ? 16 : 13); py++) { put(d, P(6, py), rail); put(d, P(9, py), rail); put(d, P(7, py), dark); put(d, P(10, py), dark); }
      for (let py = 3; py < 14; py++) { put(d, P(7, py), post); put(d, P(8, py), dark); }
      put(d, P(7, 2), [160, 120, 80]); put(d, P(8, 2), post);
      for (let px = 6; px < 10; px++) put(d, P(px, 14), [40, 60, 34]);
      return;
    }
    const wallLike = (x, y) => { if (!W.inb(x, y)) return true; const w = W.wall[W.idx(x, y)]; return w === WL.WALL || w === WL.WIN || w === WL.BROKEN; };
    const face = !wallLike(tx, ty + 1) && !W.isDoorTile(tx, ty + 1);
    const capH = face ? 6 : 16;
    const cap = [58, 52, 56];
    for (let py = 0; py < capH; py++) for (let px = 0; px < TS; px++) putv(d, P(px, py), cap, (hash2(bx + px, by + py, 61) - 0.5) * 8);
    const hi = [96, 88, 92];
    if (!wallLike(tx, ty - 1)) for (let px = 0; px < TS; px++) put(d, P(px, 0), hi);
    if (!wallLike(tx - 1, ty)) for (let py = 0; py < capH; py++) put(d, P(0, py), hi);
    if (!wallLike(tx + 1, ty)) for (let py = 0; py < capH; py++) put(d, P(15, py), [44, 40, 42]);
    if (!face) {
      if (wl === WL.WIN || wl === WL.BROKEN) {
        for (let py = 2; py < 14; py++) for (let px = 5; px < 11; px++) {
          const edge = px === 5 || px === 10 || py === 2 || py === 13;
          put(d, P(px, py), edge ? [200, 196, 186] : (wl === WL.WIN ? ((px + py) % 5 === 0 ? [168, 208, 232] : [93, 143, 176]) : [26, 26, 34]));
        }
        if (wl === WL.BROKEN) { put(d, P(6, 3), [200, 230, 240]); put(d, P(9, 12), [200, 230, 240]); }
      }
      return;
    }
    for (let px = 0; px < TS; px++) put(d, P(px, capH - 1), [118, 108, 112]);
    // 벽면 재질
    const below = W.idx(tx, ty + 1);
    const inside = W.inb(tx, ty + 1) && FLOOR_T.has(W.ter[below]) && W.bld[below] >= 0;
    const b = W.bldAt(tx, ty) || W.bldAt(tx, ty + 1);
    for (let py = capH; py < TS; py++) for (let px = 0; px < TS; px++) {
      const wx = bx + px, yy = py - capH;
      let c;
      if (inside) {
        const wp = b ? b.wallpaper : [184, 168, 138];
        c = wp; let v = (px % 4 === 0) ? -8 : 0;
        if (yy === 0) v -= 26;
        if (py >= 14) { c = py === 14 ? [92, 62, 40] : [70, 46, 30]; v = 0; }
        putv(d, P(px, py), c, v + (hash2(wx, by + py, 62) - 0.5) * 4);
      } else {
        const ext = b ? b.ext : 'brick', ec = b ? b.extCol : [138, 70, 54];
        if (ext === 'brick') {
          const row = yy >> 2, off = (row & 1) * 4;
          const mortar = (yy & 3) === 3 || ((wx + off) % 8 === 0);
          const bv = (hash2((wx + off) >> 3, row + ty * 4, 63) - 0.5) * 22;
          c = mortar ? [ec[0] * 0.72 + 40, ec[1] * 0.72 + 40, ec[2] * 0.72 + 38] : [ec[0] + bv, ec[1] + bv * 0.6, ec[2] + bv * 0.5];
        } else if (ext === 'siding') {
          c = (yy % 3 === 2) ? [ec[0] * 0.72, ec[1] * 0.72, ec[2] * 0.72] : (yy % 3 === 0 ? [ec[0] * 1.08, ec[1] * 1.08, ec[2] * 1.08] : ec);
        } else {
          c = (wx % 16 === 0) ? [ec[0] * 0.8, ec[1] * 0.8, ec[2] * 0.8] : ec;
          c = [c[0] + (hash2(wx, by + py, 64) - 0.5) * 8, c[1] + (hash2(wx, by + py, 64) - 0.5) * 8, c[2] + (hash2(wx, by + py, 64) - 0.5) * 8];
        }
        if (py === 15) c = [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
        put(d, P(px, py), c);
      }
    }
    if (wl === WL.WIN || wl === WL.BROKEN) {
      const fr = inside ? [206, 200, 186] : [224, 222, 214];
      for (let py = 7; py < 14; py++) for (let px = 3; px < 13; px++) {
        const edge = px === 3 || px === 12 || py === 7 || py === 13 || px === 7 || px === 8;
        let c;
        if (edge) c = fr;
        else if (wl === WL.WIN) c = ((px + py) % 6 === 0 || (px + py) % 6 === 1) && py < 11 ? [168, 208, 232] : [93, 143, 176];
        else c = [24, 24, 30];
        put(d, P(px, py), c);
      }
      for (let px = 2; px < 14; px++) put(d, P(px, 14), [190, 186, 176]);
      if (wl === WL.BROKEN) { put(d, P(4, 8), [200, 230, 240]); put(d, P(11, 12), [200, 230, 240]); put(d, P(5, 12), [160, 200, 220]); put(d, P(10, 8), [160, 200, 220]); }
    }
  }
  function paintDoorFrame(d, cw, ox, oy) {
    for (let py = 0; py < 3; py++) for (let px = 0; px < TS; px++) put(d, ((oy + py) * cw + ox + px) * 4, py === 0 ? [96, 88, 92] : [58, 52, 56]);
    for (let px = 0; px < TS; px++) put(d, ((oy + 2) * cw + ox + px) * 4, [118, 108, 112]);
  }

  /* 가구 스프라이트 */
  const furnCache = new Map();
  function box3(g, x, y, w, h, top, cTop, cFront) {
    g.rect(x, y, w, top, cTop); g.hl(x, y, w, shade(cTop, 1.15));
    g.rect(x, y + top, w, h - top, cFront); g.hl(x, y + top, w, shade(cFront, 0.8));
    g.vl(x, y + top, h - top, shade(cFront, 1.12)); g.vl(x + w - 1, y, h, shade(cFront, 0.78));
  }
  function furnSprite(kind, v, w, h) {
    const key = kind + ':' + v + ':' + w + 'x' + h;
    let s = furnCache.get(key);
    if (s) return s;
    const rng = makeRng(strHash(key));
    const g = new PG(w * TS, h * TS);
    const wood = ['#8a5a34', '#7a4e2c', '#9a6a40'][v % 3], woodT = shade(wood, 1.2);
    switch (kind) {
      case 'fridge': box3(g, 2, 0, 12, 15, 3, '#dfe3df', '#c6cac6'); g.hl(3, 7, 10, '#9a9e9a'); g.vl(11, 4, 2, '#7a7e7a'); g.vl(11, 9, 4, '#7a7e7a'); if (rng.chance(0.4)) g.set(5, 10, '#7a2020'); break;
      case 'stove': box3(g, 1, 1, 14, 14, 7, '#404044', '#cfcfcb'); for (const [x, y] of [[4, 3], [11, 3], [4, 6], [11, 6]]) g.ring(x, y - 0.5, 1.6, '#6a6a70'); g.rect(3, 10, 10, 3, '#2a2a30'); g.hl(4, 10, 3, '#5a5a66'); for (const x of [3, 6, 9, 12]) g.set(x, 8, '#2a2a2a'); break;
      case 'counter': case 'sink': box3(g, 0, 1, 16, 14, 5, '#bcb4a2', wood); g.vl(8, 7, 8, shade(wood, 0.75)); g.set(6, 9, '#d8c060'); g.set(10, 9, '#d8c060');
        if (kind === 'sink') { g.rect(4, 2, 8, 3, '#8a9096'); g.rect(5, 3, 6, 1, '#6a7076'); g.set(8, 1, '#c0c4c8'); g.set(8, 0, '#c0c4c8'); }
        else if (rng.chance(0.5)) { g.rect(3, 2, 3, 2, rng.pick(['#d84a3a', '#e8e0c8', '#4a8ad8'])); }
        break;
      case 'table': box3(g, 1, 2, w * 16 - 2, 10, 8, woodT, wood); g.rect(2, 12, 2, 3, shade(wood, 0.7)); g.rect(w * 16 - 4, 12, 2, 3, shade(wood, 0.7));
        g.oval(8, 5.5, 3, 1.6, '#e8e4dc'); g.oval(8, 5.5, 1.6, 0.8, '#c8c4bc'); if (rng.chance(0.6)) { g.rect(20, 3, 2, 3, '#e8e4dc'); } break;
      case 'sofa': { const c = ['#6a4a5a', '#4a5a6e', '#6a6a48', '#7a4a3a'][v % 4]; g.rect(1, 1, 30, 6, shade(c, 0.85)); g.hl(1, 1, 30, shade(c, 1.1)); g.rect(1, 7, 30, 6, c); g.hl(1, 7, 30, shade(c, 1.18)); g.vl(11, 7, 6, shade(c, 0.75)); g.vl(21, 7, 6, shade(c, 0.75)); g.rect(0, 3, 3, 11, shade(c, 0.9)); g.rect(29, 3, 3, 11, shade(c, 0.78)); g.hl(1, 13, 30, shade(c, 0.6)); break; }
      case 'tv': box3(g, 2, 9, 12, 6, 2, woodT, wood); g.rect(3, 1, 10, 8, '#1a1a20'); g.rect(4, 2, 8, 5, '#2e3a46'); g.line(5, 6, 8, 3, '#4e6a80'); if (rng.chance(0.4)) g.line(6, 2, 10, 6, '#9ab0c0'); break;
      case 'bookshelf': box3(g, 1, 0, 14, 15, 2, woodT, wood); for (const sy of [3, 8]) { for (let x = 2; x < 14; x++) { if (rng.chance(0.8)) { const c = rng.pick(['#a83a3a', '#3a6aa8', '#3a8a4a', '#c8a040', '#6a3a8a', '#d8d0c0']); g.vl(x, sy, 4, c); g.set(x, sy, shade(c, 1.2)); } } g.hl(2, sy + 4, 12, shade(wood, 0.7)); } break;
      case 'drawer': box3(g, 1, 2, 14, 13, 3, woodT, wood); for (const y of [5, 8, 11]) { g.hl(2, y + 2, 12, shade(wood, 0.7)); g.set(8, y + 1, '#d8c060'); } break;
      case 'wardrobe': box3(g, 1, 0, 14, 15, 2, shade(wood, 1.1), shade(wood, 0.9)); g.vl(8, 3, 12, shade(wood, 0.6)); g.set(7, 8, '#d8c060'); g.set(9, 8, '#d8c060'); g.hl(2, 14, 12, shade(wood, 0.6)); break;
      case 'bed': { const c = ['#7a3a3a', '#3a5a7a', '#4a6a3a', '#6a5a8a'][v % 4]; g.rect(1, 0, 14, 4, shade(wood, 0.85)); g.hl(1, 0, 14, woodT); g.rect(2, 3, 12, 27, '#e8e4dc'); g.rect(3, 4, 10, 5, '#f8f6f0'); g.hl(3, 8, 10, '#c8c4bc'); g.rect(2, 10, 12, 20, c); g.hl(2, 10, 12, shade(c, 1.3)); g.hl(2, 11, 12, shade(c, 1.12)); g.vl(13, 10, 20, shade(c, 0.75)); g.rect(1, 29, 14, 3, wood); if (rng.chance(0.35)) { g.set(7, 16, '#6a1010'); g.set(8, 17, '#6a1010'); } break; }
      case 'toilet': g.rect(4, 1, 8, 4, '#e8e8e4'); g.hl(4, 1, 8, '#ffffff'); g.oval(8, 9.5, 4.2, 4.5, '#e8e8e4'); g.oval(8, 9.8, 2.6, 2.8, '#9ab4c0'); break;
      case 'bathtub': g.rect(1, 1, 30, 14, '#e8e8e4'); g.hl(1, 1, 30, '#ffffff'); g.rect(3, 3, 26, 10, '#b8c8d0'); g.hl(3, 3, 26, '#8aa0aa'); g.set(28, 2, '#c0c4c8'); g.set(27, 2, '#c0c4c8'); break;
      case 'medcab': box3(g, 3, 1, 10, 10, 2, '#f0f0ec', '#dcdcd8'); g.rect(7, 4, 2, 6, '#d83030'); g.rect(5, 6, 6, 2, '#d83030'); break;
      case 'shelf': {
        box3(g, 1, 0, 14, 15, 2, '#8a8e96', '#6a6e76');
        const pal = v === 1 ? ['#f0f0f0', '#4a8ad8', '#5aaa5a', '#e8e8e8'] : v === 2 ? ['#a8a8b0', '#c83a3a', '#6a6a72', '#d8a040'] : ['#d84a3a', '#e8c040', '#4a8ad8', '#5aaa4a', '#e87a30', '#a84ad8'];
        for (const sy of [3, 8]) { for (let x = 2; x < 14; x += 2) if (rng.chance(0.7)) { const c = rng.pick(pal); g.rect(x, sy + 1, 2, 3, c); g.set(x, sy + 1, shade(c, 1.25)); } g.hl(2, sy + 4, 12, '#4a4e56'); }
        break;
      }
      case 'register': box3(g, 0, 4, 16, 11, 4, '#b8b0a0', '#7a6a58'); g.rect(4, 1, 8, 5, '#4a4e56'); g.rect(5, 2, 4, 2, '#7ab88a'); g.hl(4, 5, 8, '#2a2c30'); break;
      case 'drinkfridge': box3(g, 1, 0, 14, 15, 2, '#d8dce4', '#3a6ab0'); g.rect(3, 3, 10, 11, '#9ac0d8'); for (const sy of [4, 8]) for (let x = 4; x < 12; x += 2) { const c = rng.pick(['#d83030', '#30a050', '#e8e8f0', '#e8a030', '#3060c0']); g.rect(x, sy, 1, 3, c); } g.line(4, 13, 11, 5, '#d8ecf8'); break;
      case 'locker': box3(g, 1, 0, 14, 15, 2, '#7a8a9a', '#5a6a7a'); g.vl(8, 2, 13, '#3a4a5a'); for (const x of [3, 10]) { g.hl(x, 4, 3, '#3a4a5a'); g.hl(x, 6, 3, '#3a4a5a'); } g.set(7, 9, '#c8ccd0'); g.set(9, 9, '#c8ccd0'); break;
      case 'desk': box3(g, 0, 3, 16, 12, 5, woodT, wood); g.rect(10, 9, 5, 5, shade(wood, 0.85)); g.set(12, 11, '#d8c060'); g.rect(2, 1, 5, 4, '#2a2c30'); g.rect(3, 2, 3, 2, '#4a6a7a'); g.rect(9, 4, 4, 3, '#f0ece0'); break;
      case 'workbench': box3(g, 0, 2, 32, 13, 6, '#a87a4a', '#6a4a2a'); g.thick(4, 6, 8, 3, '#a8743e', 2); g.rect(8, 2, 3, 2, '#848c96'); g.rect(14, 4, 8, 2, '#c8ccd4'); g.rect(22, 3, 3, 4, '#a8703e'); g.rect(26, 2, 4, 5, '#c83030'); g.hl(26, 2, 4, '#e85050'); for (let x = 2; x < 30; x += 4) g.set(x, 11, '#4a3018'); break;
      case 'crate': g.rect(1, 1, 14, 14, '#a8783e'); g.hl(1, 1, 14, '#c8985e'); g.rect(1, 1, 14, 3, '#b88a4e'); for (const y of [4, 9]) g.hl(1, y, 14, '#7a5428'); g.line(2, 14, 13, 4, '#7a5428'); g.vl(1, 1, 14, '#c8985e'); g.vl(14, 1, 14, '#7a5428'); break;
      case 'trash': g.rect(4, 5, 8, 9, '#7a7e86'); g.hl(3, 4, 10, '#9a9ea6'); g.hl(4, 13, 8, '#5a5e66'); for (const x of [6, 9]) g.vl(x, 6, 7, '#6a6e76'); break;
      case 'dumpster': g.rect(1, 3, 30, 12, '#3a6a4a'); g.rect(1, 2, 30, 4, '#2e5a3e'); g.hl(1, 2, 30, '#4a8a5e'); g.hl(1, 14, 30, '#22402c'); for (let x = 4; x < 30; x += 6) g.vl(x, 7, 7, '#2e5a3e'); g.rect(3, 14, 2, 2, '#1a1a1e'); g.rect(27, 14, 2, 2, '#1a1a1e'); break;
      case 'bench': for (const y of [4, 7, 10]) { g.rect(1, y, 30, 2, '#9a6a3a'); g.hl(1, y, 30, '#b8885a'); } g.rect(3, 12, 2, 3, '#3a3a40'); g.rect(27, 12, 2, 3, '#3a3a40'); break;
      case 'hydrant': g.rect(5, 5, 6, 9, '#c83030'); g.vl(5, 5, 9, '#e85050'); g.rect(4, 4, 8, 2, '#a82020'); g.rect(6, 2, 4, 2, '#c83030'); g.rect(3, 8, 2, 2, '#a82020'); g.rect(11, 8, 2, 2, '#a82020'); break;
      case 'mailbox': g.rect(7, 9, 2, 6, '#4a4a50'); g.rect(4, 3, 8, 7, '#c83030'); g.hl(4, 3, 8, '#e85050'); g.rect(5, 5, 6, 1, '#4a1010'); break;
      case 'vending': box3(g, 1, 0, 14, 15, 2, '#e04040', '#c02a2a'); g.rect(3, 3, 7, 10, '#9ac0d8'); for (const sy of [4, 8]) for (let x = 4; x < 9; x += 2) g.rect(x, sy, 1, 3, rng.pick(['#f0f0f0', '#30a050', '#e8a030', '#3060c0'])); g.rect(11, 3, 2, 8, '#2a2a30'); g.set(11, 4, '#7af07a'); g.rect(4, 13, 5, 1, '#1a1a1e'); break;
      case 'gaspump': g.rect(3, 1, 10, 14, '#e8e4dc'); g.rect(3, 1, 10, 3, '#c83030'); g.rect(5, 5, 6, 3, '#2a3a2a'); g.hl(6, 6, 3, '#7af07a'); g.vl(13, 5, 7, '#2a2a2a'); g.set(14, 11, '#2a2a2a'); g.vl(3, 1, 14, '#ffffff'); break;
      case 'haybale': g.oval(8, 9, 7, 5.5, '#c8a848'); g.oval(7, 8, 5, 3.5, '#e0c060'); for (let i = 0; i < 6; i++) g.set(rng.int(3, 12), rng.int(5, 12), '#a88a30'); break;
      case 'car': case 'policecar': case 'carwreck': {
        const vert = h > w;
        const cw = 32, chh = 48;
        const cg = new PG(cw, chh);
        const col = kind === 'policecar' ? '#f0f0f0' : kind === 'carwreck' ? '#3e3a36' : ['#a83232', '#2e5a9a', '#d8d8d0', '#2a2a2e', '#d8b030', '#4a7a4a', '#7a7a82'][v % 7];
        const hi = shade(col, 1.15), sh = shade(col, 0.74);
        cg.rect(3, 8, 3, 9, '#1c1c20'); cg.rect(26, 8, 3, 9, '#1c1c20'); cg.rect(3, 32, 3, 9, '#1c1c20'); cg.rect(26, 32, 3, 9, '#1c1c20');
        cg.rect(5, 3, 22, 43, col); cg.vl(5, 4, 41, hi); cg.vl(26, 4, 41, sh); cg.clr(5, 3); cg.clr(26, 3); cg.clr(5, 45); cg.clr(26, 45);
        const glass = kind === 'carwreck' ? '#141416' : '#2e4458', gh = kind === 'carwreck' ? '#2a2420' : '#6a8aa4';
        cg.rect(7, 28, 18, 5, glass); cg.line(9, 32, 12, 28, gh); cg.line(10, 32, 13, 28, gh);
        cg.rect(7, 13, 18, 15, kind === 'policecar' ? '#2a2a2e' : shade(col, 1.06)); cg.hl(7, 13, 18, hi);
        cg.rect(8, 9, 16, 4, glass); cg.line(10, 12, 12, 9, gh);
        cg.hl(5, 40, 22, sh); cg.hl(5, 33, 22, sh);
        if (kind === 'policecar') { cg.rect(7, 34, 18, 11, '#2a2a2e'); cg.rect(7, 4, 18, 5, '#2a2a2e'); cg.rect(10, 19, 5, 3, '#d83030'); cg.rect(17, 19, 5, 3, '#3060e0'); }
        if (kind !== 'carwreck') { cg.rect(7, 44, 4, 2, '#f0ecc8'); cg.rect(21, 44, 4, 2, '#f0ecc8'); cg.rect(7, 3, 4, 1, '#d83030'); cg.rect(21, 3, 4, 1, '#d83030'); }
        cg.rect(3, 27, 2, 2, sh); cg.rect(27, 27, 2, 2, sh);
        const rust = kind === 'carwreck' ? 26 : 7;
        for (let i = 0; i < rust; i++) { const x = rng.int(6, 25), y = rng.int(4, 44); cg.set(x, y, rng.pick(['#8a4a26', '#6a3a1e', '#a85a2e'])); }
        if (kind !== 'carwreck' && rng.chance(0.5)) { cg.line(14, 29, 18, 32, '#c8d8e4'); cg.line(16, 28, 13, 31, '#c8d8e4'); }
        cg.outline();
        const src = vert ? cg : cg.rot90();
        g.stamp(src, Math.floor((g.w - src.w) / 2), Math.floor((g.h - src.h) / 2));
        s = g.canvas(); furnCache.set(key, s); return s;
      }
      default: g.rect(2, 2, 12, 12, '#ff00ff');
    }
    g.outline();
    s = g.canvas();
    furnCache.set(key, s);
    return s;
  }
  Art.furnSprite = furnSprite;

  /* 청크 렌더링 */
  Art.paintChunk = function (W, cx, cy) {
    const cw = CHUNK * TS;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = cw;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cw, cw);
    const d = img.data;
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      if (!W.inb(tx, ty)) continue;
      paintGround(d, cw, W, tx, ty, (tx - tx0) * TS, (ty - ty0) * TS);
    }
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      if (!W.inb(tx, ty)) continue;
      const i = W.idx(tx, ty);
      if (W.wall[i]) paintWall(d, cw, W, tx, ty, (tx - tx0) * TS, (ty - ty0) * TS);
      else if (W.isDoorTile(tx, ty)) paintDoorFrame(d, cw, (tx - tx0) * TS, (ty - ty0) * TS);
    }
    ctx.putImageData(img, 0, 0);
    // 고정 가구(baked)
    const seen = new Set();
    for (let ty = ty0 - 3; ty < ty0 + CHUNK; ty++) for (let tx = tx0 - 3; tx < tx0 + CHUNK; tx++) {
      if (!W.inb(tx, ty)) continue;
      const o = W.obj[W.idx(tx, ty)];
      if (!o || !o.baked || seen.has(o)) continue;
      seen.add(o);
      const spr = furnSprite(o.f || o.k, o.v || 0, o.w || 1, o.h || 1);
      ctx.drawImage(spr, (o.x - tx0) * TS, (o.y - ty0) * TS);
    }
    return cv;
  };

  /* 지붕 렌더링 */
  const FONT3 = { A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'], D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'], G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'], M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'], P: ['110', '101', '110', '100', '100'], R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'], W: ['101', '101', '111', '111', '101'], Y: ['101', '101', '010', '010', '010'], 2: ['110', '001', '010', '100', '111'], 4: ['101', '101', '111', '001', '001'], ' ': ['000', '000', '000', '000', '000'] };
  function text3(g, x, y, str, col) {
    for (const ch of str) { const gl = FONT3[ch] || FONT3[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (gl[r][c] === '1') g.set(x + c, y + r, col); x += 4; }
  }
  Art.roof = function (b) {
    const RW = b.w * TS, RH = (b.h - 1) * TS + 8;
    const g = new PG(RW, RH);
    const rng = makeRng(b.id * 977 + 13);
    const c = C(b.roofCol);
    const sh = (f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
    if (b.roof === 'gable') {
      const ry = Math.floor(RH * 0.36);
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const back = y < ry;
        const yy = back ? y : y - ry - 2;
        const row = Math.floor(yy / 4), within = ((yy % 4) + 4) % 4;
        const off = (row & 1) * 3;
        const sv = (hash2(Math.floor((x + off) / 6), row + (back ? 100 : 0), b.id) - 0.5) * 0.12;
        let f = back ? 0.84 : 1.0 - (y - ry) / RH * 0.22;
        f += sv;
        if (within === 3) f -= 0.22; else if (within === 0) f += 0.08;
        if ((x + off) % 6 === 0 && within !== 3) f -= 0.12;
        g.set(x, y, sh(f));
      }
      for (let x = 0; x < RW; x++) { g.set(x, ry - 1, sh(1.25)); g.set(x, ry, sh(1.08)); g.set(x, ry + 1, sh(0.7)); }
      if (rng.chance(0.6)) {
        const cx = Math.floor(RW * rng.range(0.55, 0.8)), cy = ry - 11;
        if (cy > 1) { g.rect(cx, cy, 7, 9, '#8a4a3a'); g.rect(cx, cy, 7, 3, '#6a3a2e'); g.rect(cx + 1, cy, 5, 2, '#1a1414'); g.vl(cx, cy + 3, 6, '#a85a46'); g.vl(cx + 6, cy, 9, '#5a2e24'); }
      }
    } else {
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
        const h = hash2(x, y, b.id + 5);
        const v = 0.9 + (h - 0.5) * 0.18 + (vnoise(x * 0.1, y * 0.1, b.id) - 0.5) * 0.12;
        g.set(x, y, sh(v));
      }
      for (let x = 0; x < RW; x++) for (let k = 0; k < 3; k++) { g.set(x, k, sh(k === 0 ? 1.3 : 1.15)); g.set(x, RH - 6 - k, sh(1.15)); }
      for (let y = 0; y < RH - 5; y++) for (let k = 0; k < 3; k++) { g.set(k, y, sh(1.2)); g.set(RW - 1 - k, y, sh(0.85)); }
      for (let x = 3; x < RW - 3; x++) g.set(x, 3, sh(0.7));
      for (let y = 3; y < RH - 8; y++) g.set(3, y, sh(0.72));
      const units = Math.max(1, Math.floor(b.w / 5));
      for (let i = 0; i < units; i++) {
        const ux = rng.int(6, RW - 18), uy = rng.int(6, Math.max(7, RH - 26));
        g.rect(ux, uy, 12, 9, '#b4b8bc'); g.rect(ux, uy, 12, 3, '#d4d8dc'); g.ring(ux + 6, uy + 5.5, 2.5, '#7a7e84'); g.hl(ux, uy + 8, 12, '#6a6e74');
      }
      for (let i = 0; i < 2; i++) { const vx = rng.int(6, RW - 8), vy = rng.int(6, Math.max(7, RH - 20)); g.disc(vx, vy, 1.6, '#5a5e64'); g.set(vx - 1, vy - 1, '#8a8e94'); }
    }
    // 지붕 처마/외곽
    for (let x = 0; x < RW; x++) { g.set(x, RH - 3, [36, 30, 32]); g.set(x, RH - 2, b.roof === 'gable' ? [200, 194, 182] : sh(1.05)); g.set(x, RH - 1, b.roof === 'gable' ? [168, 162, 150] : sh(0.8)); g.set(x, 0, [30, 26, 28]); }
    for (let y = 0; y < RH; y++) { g.set(0, y, [30, 26, 28]); g.set(RW - 1, y, [30, 26, 28]); }
    // 낡은 흔적
    for (let i = 0; i < b.w * 2; i++) { const x = rng.int(2, RW - 3), y = rng.int(2, RH - 6); g.set(x, y, rng.chance(0.5) ? [70, 96, 52] : sh(0.55)); }
    if (rng.chance(0.4)) { const x = rng.int(4, RW - 8), y = rng.int(4, RH - 10); g.rect(x, y, 3, 2, [22, 18, 20]); g.set(x + 3, y + 1, [22, 18, 20]); }
    // 간판
    if (b.sign) {
      const s = b.sign, tw = s.text.length * 4 + (s.icon ? 8 : 0) + 5;
      const sx = Math.floor(RW / 2 - tw / 2), sy = RH - 12;
      g.rect(sx, sy, tw, 9, s.bg); g.hl(sx, sy, tw, shade(s.bg, 1.3)); g.hl(sx, sy + 8, tw, shade(s.bg, 0.6));
      g.vl(sx, sy, 9, [30, 26, 28]); g.vl(sx + tw - 1, sy, 9, [30, 26, 28]);
      let tx = sx + 3;
      if (s.icon === 'cross') { g.rect(tx + 2, sy + 2, 2, 5, '#40c060'); g.rect(tx + 1, sy + 3, 4, 2, '#40c060'); tx += 8; }
      if (s.icon === 'star') { g.rect(tx + 2, sy + 2, 2, 5, '#ffd040'); g.rect(tx, sy + 4, 6, 1, '#ffd040'); g.rect(tx + 1, sy + 3, 4, 3, '#ffd040'); tx += 8; }
      text3(g, tx, sy + 2, s.text, s.fg);
    }
    return g.canvas();
  };
})();
