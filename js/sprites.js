'use strict';
/* ===== 픽셀아트 엔진 + 캐릭터/자연물/구조물 스프라이트 (모두 코드로 생성) ===== */
const _colCache = new Map();
function C(c) {
  if (Array.isArray(c)) return c.length === 4 ? c : [c[0], c[1], c[2], 255];
  let v = _colCache.get(c);
  if (v) return v;
  let s = c.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255];
  _colCache.set(c, v);
  return v;
}
function shade(c, f) { const a = C(c); return [clamp(a[0] * f, 0, 255) | 0, clamp(a[1] * f, 0, 255) | 0, clamp(a[2] * f, 0, 255) | 0, a[3]]; }
function mix(c1, c2, t) { const a = C(c1), b = C(c2); return [(a[0] + (b[0] - a[0]) * t) | 0, (a[1] + (b[1] - a[1]) * t) | 0, (a[2] + (b[2] - a[2]) * t) | 0, 255]; }
function sameRGB(a, b) { return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

class PG {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c == null) return this;
    const col = C(c), i = (y * this.w + x) * 4, d = this.d;
    if (col[3] >= 255) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; }
    else if (col[3] > 0) {
      const a = col[3] / 255, ia = 1 - a;
      d[i] = d[i] * ia + col[0] * a; d[i + 1] = d[i + 1] * ia + col[1] * a; d[i + 2] = d[i + 2] * ia + col[2] * a;
      d[i + 3] = Math.max(d[i + 3], col[3]);
    }
    return this;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    if (this.d[i + 3] === 0) return null;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  clr(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  hl(x, y, w, c) { return this.rect(x, y, w, 1, c); }
  vl(x, y, h, c) { return this.rect(x, y, 1, h, c); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  thick(x0, y0, x1, y1, c, w) { // 두께 있는 대각선
    this.line(x0, y0, x1, y1, c);
    if (w >= 2) this.line(x0 + 1, y0, x1 + 1, y1, c);
    if (w >= 3) this.line(x0, y0 + 1, x1, y1 + 1, c);
    return this;
  }
  oval(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    return this;
  }
  disc(cx, cy, r, c) { return this.oval(cx, cy, r, r, c); }
  ring(cx, cy, r, c) {
    for (let a = 0; a < TAU; a += 0.05) this.set(Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), c);
    return this;
  }
  // 선택적 외곽선: 이웃 색을 어둡게 하여 테두리를 그린다
  outline(fixed) {
    const w = this.w, h = this.h, src = new Uint8ClampedArray(this.d), d = this.d;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      let best = -1, bl = 1e9;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if (src[j + 3] < 128) continue;
        const l = src[j] + src[j + 1] + src[j + 2];
        if (l < bl) { bl = l; best = j; }
      }
      if (best < 0) continue;
      if (fixed) { const f = C(fixed); d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = f[3]; continue; }
      d[i] = src[best] * 0.3 * 0.55 + 22 * 0.45; d[i + 1] = src[best + 1] * 0.3 * 0.55 + 16 * 0.45; d[i + 2] = src[best + 2] * 0.3 * 0.55 + 30 * 0.45; d[i + 3] = 255;
    }
    return this;
  }
  copy() { const g = new PG(this.w, this.h); g.d.set(this.d); return g; }
  flipX() {
    const g = new PG(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4, j = (y * this.w + (this.w - 1 - x)) * 4;
      g.d[j] = this.d[i]; g.d[j + 1] = this.d[i + 1]; g.d[j + 2] = this.d[i + 2]; g.d[j + 3] = this.d[i + 3];
    }
    return g;
  }
  rot90() { // 시계 방향
    const g = new PG(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4, nx = this.h - 1 - y, ny = x, j = (ny * g.w + nx) * 4;
      g.d[j] = this.d[i]; g.d[j + 1] = this.d[i + 1]; g.d[j + 2] = this.d[i + 2]; g.d[j + 3] = this.d[i + 3];
    }
    return g;
  }
  tint(f, add) {
    const g = this.copy(); add = add || [0, 0, 0];
    for (let i = 0; i < g.d.length; i += 4) { g.d[i] = g.d[i] * f + add[0]; g.d[i + 1] = g.d[i + 1] * f + add[1]; g.d[i + 2] = g.d[i + 2] * f + add[2]; }
    return g;
  }
  silhouette(c) {
    const g = this.copy(), col = C(c);
    for (let i = 0; i < g.d.length; i += 4) if (g.d[i + 3] > 0) { g.d[i] = col[0]; g.d[i + 1] = col[1]; g.d[i + 2] = col[2]; }
    return g;
  }
  stamp(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.d[i + 3];
      if (a === 0) continue;
      this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2], a]);
    }
    return this;
  }
  canvas() {
    if (this._cv) return this._cv;
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    cv.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    this._cv = cv;
    return cv;
  }
  url() { return this.canvas().toDataURL(); }
}

const Art = {
  chars: {}, // key -> [variant] -> {f:[dir][frame] canvas, w:[dir][frame] flash canvas, corpse}
  nature: {}, struct: {}, fx: {},
};

/* ─────────── 사람형 캐릭터 ─────────── */
function _leg(g, x, by, lift, p, front) {
  const top = 14 + by, sy = 17 - lift;
  for (let y = top; y < sy; y++) { g.set(x, y, p.pants); g.set(x + 1, y, p.pantsS); }
  g.rect(x, sy, 2, 2, p.shoe);
  g.set(front ? x : x + 1, sy, p.shoeH);
}
function _arm(g, x, by, sw, p) {
  const top = 8 + by, len = 4 + sw;
  for (let y = top; y < top + len; y++) { g.set(x, y, p.top); g.set(x + 1, y, p.topS); }
  g.set(x, top, p.topH);
  g.set(x, top + len, p.skin); g.set(x + 1, top + len, p.skinS);
}
function humanFrame(dir, f, p, o) {
  const g = new PG(16, 20);
  const by = (f & 1) ? 1 : 0;
  const Z = !!o.zombie;
  if (dir === 0 || dir === 3) {
    const front = dir === 0;
    _leg(g, 5, by, f === 1 ? 1 : 0, p, front);
    _leg(g, 9, by, f === 3 ? 1 : 0, p, front);
    g.rect(5, 13 + by, 6, 1, p.pants); g.set(10, 13 + by, p.pantsS);
    if (!Z) {
      const sw = f === 1 ? 1 : f === 3 ? -1 : 0;
      _arm(g, 2, by, front ? -sw : sw, p);
      _arm(g, 12, by, front ? sw : -sw, p);
      if (p.belt) g.rect(5, 13 + by, 6, 1, p.belt);
    }
    g.rect(4, 8 + by, 8, 5, p.top);
    g.vl(4, 8 + by, 5, p.topH); g.vl(11, 8 + by, 5, p.topS);
    g.hl(4, 12 + by, 8, p.topS);
    const hy = 1 + by;
    if (front) {
      g.set(6, 8 + by, p.topS); g.set(9, 8 + by, p.topS); g.rect(7, 8 + by, 2, 1, p.skinS);
      if (!Z) g.vl(8, 9 + by, 3, p.topS);
      if (o.bag) { g.vl(5, 8 + by, 4, p.bagS); g.vl(10, 8 + by, 4, p.bagS); }
      // 머리(앞)
      g.hl(5, hy, 6, p.hair); g.hl(6, hy, 2, p.hairH);
      g.hl(4, hy + 1, 8, p.hair); g.hl(5, hy + 1, 2, p.hairH);
      g.hl(4, hy + 2, 8, p.hair); g.rect(6, hy + 2, 4, 1, p.skin);
      g.set(4, hy + 3, p.hair); g.set(11, hy + 3, p.hair); g.rect(5, hy + 3, 6, 1, p.skin);
      g.set(6, hy + 3, p.eye); g.set(9, hy + 3, p.eye);
      g.set(4, hy + 4, p.skinS); g.set(11, hy + 4, p.skinS); g.rect(5, hy + 4, 6, 1, p.skin); g.set(10, hy + 4, p.skinS);
      g.rect(6, hy + 5, 4, 1, p.skin); g.set(9, hy + 5, p.skinS);
      g.rect(7, hy + 6, 2, 1, p.skinS);
      if (Z) { g.rect(7, hy + 4, 2, 1, p.mouth); g.set(8, hy + 5, p.blood); }
    } else {
      g.rect(5, 8 + by, 6, 1, p.topS);
      if (o.bag) {
        g.rect(5, 8 + by, 6, 5, p.bag); g.vl(5, 8 + by, 5, p.bagH); g.vl(10, 8 + by, 5, p.bagS);
        g.hl(5, 8 + by, 6, p.bagH); g.rect(6, 10 + by, 4, 1, p.bagS); g.set(7, 11 + by, p.bagH);
      }
      g.hl(5, hy, 6, p.hair); g.hl(6, hy, 2, p.hairH);
      g.hl(4, hy + 1, 8, p.hair); g.hl(5, hy + 1, 2, p.hairH);
      g.hl(4, hy + 2, 8, p.hair);
      g.hl(4, hy + 3, 8, p.hair); g.set(11, hy + 3, p.hairS);
      g.set(4, hy + 4, p.skinS); g.set(11, hy + 4, p.skinS); g.rect(5, hy + 4, 6, 1, p.hair); g.set(10, hy + 4, p.hairS);
      g.rect(6, hy + 5, 4, 1, p.hairS);
      g.rect(7, hy + 6, 2, 1, p.skinS);
    }
    if (Z) {
      const l = f === 1 ? 1 : 0, r = f === 3 ? 1 : 0;
      if (front) {
        g.rect(3, 9 + by, 2, 4 + l, p.topS); g.set(3, 9 + by, p.top);
        g.rect(3, 13 + by + l, 2, 2, p.skin); g.set(4, 14 + by + l, p.skinS);
        g.rect(11, 9 + by, 2, 4 + r, p.topS); g.set(12, 9 + by, p.top);
        g.rect(11, 13 + by + r, 2, 2, p.skin); g.set(12, 14 + by + r, p.skinS);
      } else {
        g.rect(2, 4 + by + l, 2, 6 - l, p.top); g.vl(3, 4 + by + l, 6 - l, p.topS);
        g.rect(2, 3 + by + l, 2, 1, p.skinS);
        g.rect(12, 4 + by + r, 2, 6 - r, p.top); g.vl(13, 4 + by + r, 6 - r, p.topS);
        g.rect(12, 3 + by + r, 2, 1, p.skinS);
      }
    }
  } else {
    // 옆모습(왼쪽을 봄)
    const step = (f & 1) === 1;
    if (!step) {
      // 뒷다리
      g.rect(8, 14, 2, 3, p.pantsS); g.rect(8, 17, 2, 1, p.shoe); g.rect(7, 18, 3, 1, p.shoe);
      // 앞다리
      g.rect(6, 14, 2, 3, p.pants); g.set(7, 15, p.pantsS);
      g.rect(6, 17, 2, 1, p.shoe); g.rect(5, 18, 3, 1, p.shoe); g.set(6, 17, p.shoeH);
    } else {
      g.rect(8, 15, 2, 1, p.pantsS); g.rect(9, 16, 2, 1, p.pantsS);
      g.rect(9, 17, 2, 1, p.shoe); g.rect(9, 18, 3, 1, p.shoe);
      g.rect(6, 15, 2, 1, p.pants); g.rect(5, 16, 2, 1, p.pants);
      g.rect(5, 17, 2, 1, p.shoe); g.rect(4, 18, 3, 1, p.shoe); g.set(5, 17, p.shoeH);
    }
    g.rect(6, 13 + by, 5, 1, p.pants); g.set(10, 13 + by, p.pantsS);
    g.rect(6, 8 + by, 5, 5, p.top);
    g.vl(6, 8 + by, 5, p.topH); g.vl(10, 8 + by, 5, p.topS); g.hl(6, 12 + by, 5, p.topS);
    if (o.bag) {
      g.rect(11, 8 + by, 2, 5, p.bag); g.vl(12, 8 + by, 5, p.bagS); g.set(11, 8 + by, p.bagH);
      g.set(9, 9 + by, p.bagS); g.set(9, 10 + by, p.bagS);
    }
    const hy = 1 + by;
    g.hl(6, hy, 5, p.hair); g.hl(7, hy, 2, p.hairH);
    g.hl(5, hy + 1, 7, p.hair); g.set(6, hy + 1, p.hairH);
    g.rect(5, hy + 2, 2, 1, p.skin); g.rect(7, hy + 2, 5, 1, p.hair);
    g.rect(4, hy + 3, 5, 1, p.skin); g.rect(9, hy + 3, 3, 1, p.hair); g.set(5, hy + 3, p.eye);
    g.rect(4, hy + 4, 6, 1, p.skin); g.set(8, hy + 4, p.skinS); g.rect(10, hy + 4, 2, 1, p.hair);
    g.rect(5, hy + 5, 5, 1, p.skin); g.set(9, hy + 5, p.skinS); g.set(10, hy + 5, p.hairS);
    g.rect(6, hy + 6, 3, 1, p.skinS);
    if (Z) {
      g.set(4, hy + 4, p.mouth); g.set(5, hy + 5, p.blood);
      const a1 = f === 1 ? -1 : 0, a2 = f === 3 ? 1 : 0;
      g.rect(3, 9 + by + a1, 5, 2, p.topS); g.rect(1, 9 + by + a1, 2, 2, p.skinS);
      g.rect(3, 10 + by + a2, 6, 2, p.top); g.hl(3, 10 + by + a2, 6, p.topH); g.rect(1, 10 + by + a2, 2, 2, p.skin);
    } else {
      const s = f === 1 ? 1 : f === 3 ? -1 : 0;
      if (s === 0) { g.rect(7, 8 + by, 2, 4, p.top); g.vl(8, 8 + by, 4, p.topS); g.set(7, 8 + by, p.topH); g.rect(7, 12 + by, 2, 1, p.skin); }
      else if (s === 1) {
        g.rect(7, 8 + by, 2, 1, p.top); g.rect(6, 9 + by, 2, 1, p.top); g.rect(5, 10 + by, 2, 1, p.topS);
        g.rect(4, 11 + by, 2, 1, p.skin);
      } else {
        g.rect(7, 8 + by, 2, 1, p.top); g.rect(8, 9 + by, 2, 1, p.topS); g.rect(9, 10 + by, 2, 1, p.topS);
        g.rect(10, 11 + by, 2, 1, p.skin);
      }
    }
  }
  return g;
}
function zombify(g, p, seed, rate) {
  const cloth = [C(p.top), C(p.topH), C(p.topS), C(p.pants), C(p.pantsS)];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.get(x, y);
    if (!c) continue;
    let isCloth = false;
    for (const k of cloth) if (sameRGB(c, k)) { isCloth = true; break; }
    if (!isCloth) continue;
    const h = hash2(x, y, seed);
    if (h < 0.06 * rate) g.set(x, y, p.skinS);
    else if (h < 0.15 * rate) g.set(x, y, h < 0.1 * rate ? '#5a1212' : '#7c1c1c');
  }
}

/* ─────────── 덩치 큰 좀비 ─────────── */
function bruteFrame(dir, f, p) {
  const g = new PG(22, 26);
  const by = (f & 1) ? 1 : 0;
  const leg = (x, lift, side) => {
    const top = 19 + by, sy = 22 - lift;
    for (let y = top; y < sy; y++) { g.rect(x, y, 3, 1, p.pants); g.set(x + 2, y, p.pantsS); }
    g.rect(x, sy, 3, 2, p.shoe); g.set(x, sy, p.shoeH);
    if (side) g.set(x - 1, sy + 1, p.shoe);
  };
  const arm = (x, sw, left) => {
    const top = 7 + by, len = 7 + sw;
    g.rect(x, top, 3, len, p.skin); g.vl(left ? x : x + 2, top, len, left ? p.skinH : p.skinS);
    g.rect(x, top + len, 3, 3, p.skin); g.hl(x, top + len + 2, 3, p.skinS); g.set(left ? x : x + 2, top + len, p.skinH);
    g.set(x + 1, top + 2, p.blood);
  };
  if (dir === 0 || dir === 3) {
    const front = dir === 0;
    leg(6, f === 1 ? 1 : 0); leg(13, f === 3 ? 1 : 0);
    g.rect(5, 17 + by, 12, 2, p.pants); g.vl(16, 17 + by, 2, p.pantsS); g.hl(5, 17 + by, 12, p.belt);
    const sw = f === 1 ? 1 : f === 3 ? -1 : 0;
    arm(1, front ? -sw : sw, true); arm(18, front ? sw : -sw, false);
    g.rect(5, 6 + by, 12, 11, p.skin); g.rect(4, 11 + by, 14, 5, p.skin);
    g.vl(16, 6 + by, 11, p.skinS); g.vl(17, 11 + by, 5, p.skinS);
    g.rect(6, 8 + by, 10, 9, p.top); g.rect(5, 11 + by, 12, 5, p.top);
    g.rect(7, 6 + by, 2, 2, p.top); g.rect(13, 6 + by, 2, 2, p.top);
    g.vl(5, 11 + by, 5, p.topH); g.vl(6, 8 + by, 3, p.topH); g.vl(16, 11 + by, 5, p.topS); g.vl(15, 8 + by, 3, p.topS);
    g.hl(5, 16 + by, 12, p.topS);
    const hy = by;
    if (front) {
      g.rect(8, hy, 6, 5, p.skin); g.hl(9, hy, 3, p.skinH); g.vl(13, hy, 5, p.skinS);
      g.hl(8, hy + 1, 6, p.skinS); g.set(9, hy + 2, p.eye); g.set(12, hy + 2, p.eye);
      g.set(7, hy + 2, p.skinS); g.set(14, hy + 2, p.skinS);
      g.rect(10, hy + 4, 2, 1, p.mouth); g.set(11, hy + 5, p.blood);
      g.rect(9, hy + 5, 4, 1, p.skinS);
    } else {
      g.rect(8, hy, 6, 5, p.skin); g.hl(9, hy, 3, p.skinH); g.vl(13, hy, 5, p.skinS);
      g.set(7, hy + 2, p.skinS); g.set(14, hy + 2, p.skinS); g.rect(9, hy + 4, 4, 2, p.skinS);
      g.hl(6, 6 + by, 10, p.topS);
    }
  } else {
    const step = (f & 1) === 1;
    if (!step) { leg(11, 0); leg(7, 0, true); }
    else {
      g.rect(11, 20, 3, 1, p.pantsS); g.rect(12, 21, 3, 1, p.pantsS); g.rect(12, 22, 3, 2, p.shoe);
      g.rect(7, 20, 3, 1, p.pants); g.rect(6, 21, 3, 1, p.pants); g.rect(5, 22, 3, 2, p.shoe); g.set(4, 23, p.shoe);
    }
    g.rect(7, 17 + by, 9, 3, p.pants); g.hl(7, 17 + by, 9, p.belt);
    g.rect(7, 6 + by, 9, 11, p.skin); g.rect(5, 11 + by, 10, 6, p.skin);
    g.rect(7, 8 + by, 9, 9, p.top); g.rect(5, 11 + by, 10, 5, p.top);
    g.vl(5, 11 + by, 5, p.topH); g.vl(15, 8 + by, 9, p.topS); g.hl(5, 16 + by, 11, p.topS);
    const s = f === 1 ? 1 : f === 3 ? -1 : 0;
    g.rect(9 - s, 7 + by, 3, 8, p.skin); g.vl(9 - s, 7 + by, 8, p.skinH);
    g.rect(9 - s * 2, 15 + by, 3, 3, p.skin); g.hl(9 - s * 2, 17 + by, 3, p.skinS);
    const hy = by;
    g.rect(6, hy, 6, 5, p.skin); g.hl(7, hy, 3, p.skinH); g.vl(11, hy, 5, p.skinS);
    g.hl(6, hy + 1, 4, p.skinS); g.set(7, hy + 2, p.eye); g.set(10, hy + 2, p.skinS);
    g.set(6, hy + 4, p.mouth); g.set(7, hy + 5, p.blood); g.rect(7, hy + 5, 4, 1, p.skinS);
  }
  return g;
}

/* ─────────── 기어다니는 좀비 ─────────── */
function crawlerFrame(dir, f, p) {
  const g = new PG(20, 16);
  const aL = f === 1 ? 1 : 0, aR = f === 3 ? 1 : 0;
  if (dir === 0) {
    g.rect(7, 1, 6, 2, p.blood2); g.hl(8, 1, 4, p.blood);
    g.rect(6, 3, 8, 7, p.top); g.vl(6, 3, 7, p.topH); g.vl(13, 3, 7, p.topS); g.vl(9, 4, 4, p.topS);
    g.rect(5, 7, 2, 2, p.topS); g.rect(4, 9, 2, 2 + aL, p.skinS); g.rect(3, 11 + aL, 2, 2, p.skin);
    g.rect(13, 7, 2, 2, p.topS); g.rect(14, 9, 2, 2 + aR, p.skinS); g.rect(15, 11 + aR, 2, 2, p.skin);
    g.rect(7, 9, 6, 2, p.hair); g.hl(8, 9, 2, p.hairH);
    g.rect(7, 11, 6, 3, p.skin); g.set(8, 11, p.eye); g.set(11, 11, p.eye); g.vl(12, 11, 3, p.skinS);
    g.rect(9, 13, 2, 1, p.mouth); g.rect(8, 14, 4, 1, p.skinS);
  } else if (dir === 3) {
    g.rect(7, 1, 6, 4, p.hair); g.hl(8, 1, 2, p.hairH); g.vl(12, 1, 4, p.hairS);
    g.rect(8, 5, 4, 1, p.skinS);
    g.rect(6, 5, 8, 7, p.top); g.vl(6, 5, 7, p.topH); g.vl(13, 5, 7, p.topS); g.vl(9, 6, 5, p.topS);
    g.rect(7, 12, 6, 2, p.blood2); g.hl(8, 13, 4, p.blood);
    g.rect(5, 6, 2, 2, p.topS); g.rect(4, 4 - aL, 2, 2 + aL, p.skinS); g.rect(3, 2 - aL, 2, 2, p.skin);
    g.rect(13, 6, 2, 2, p.topS); g.rect(14, 4 - aR, 2, 2 + aR, p.skinS); g.rect(15, 2 - aR, 2, 2, p.skin);
  } else {
    g.rect(14, 8, 3, 3, p.blood2); g.set(16, 9, p.blood);
    g.rect(6, 7, 9, 5, p.top); g.hl(6, 7, 9, p.topH); g.hl(6, 11, 9, p.topS);
    g.rect(2, 6, 5, 1, p.hair); g.rect(6, 7, 1, 3, p.hair);
    g.rect(2, 7, 4, 3, p.skin); g.set(3, 7, p.eye); g.rect(2, 9, 2, 1, p.mouth); g.set(5, 9, p.skinS); g.rect(3, 10, 3, 1, p.skinS);
    g.rect(6, 6 - aR, 2, 1, p.topS); g.rect(3, 5 - aR, 3, 1, p.skinS); g.rect(1, 4 - aR, 2, 2, p.skinS);
    g.rect(6, 11, 2, 1, p.top); g.rect(3 - aL, 12, 4, 1, p.skinS); g.rect(1 - aL, 12, 2, 2, p.skin);
  }
  return g;
}

/* 캐릭터 세트 생성: dirs 0=아래 1=왼쪽 2=오른쪽 3=위, 4프레임 */
function buildCharSet(fn, anchor) {
  const f = [[], [], [], []], w = [[], [], [], []];
  for (let fr = 0; fr < 4; fr++) {
    const d0 = fn(0, fr).outline(), d1 = fn(1, fr).outline(), d3 = fn(3, fr).outline();
    const d2 = d1.flipX();
    const set = [d0, d1, d2, d3];
    for (let d = 0; d < 4; d++) { f[d][fr] = set[d].canvas(); w[d][fr] = set[d].silhouette('#ffffff').canvas(); }
  }
  const corpse = fn(0, 0).tint(0.72, [8, 0, 0]).rot90().outline();
  return { f, w, ax: anchor[0], ay: anchor[1], corpse: corpse.canvas(), cax: corpse.w / 2, cay: corpse.h / 2 };
}
const Z_SKINS = [['#8f9e7c', '#6f7e5e', '#aab894'], ['#7f8f78', '#617058', '#9aa890'], ['#a3a48c', '#83846e', '#bcbda6'], ['#7c8a8c', '#5e6c6e', '#96a4a6'], ['#959070', '#767254', '#ada886']];
const Z_TOPS = ['#5e6e8e', '#8e4e48', '#9e9888', '#506048', '#7e6e50', '#585866', '#9a7e3a', '#6a4a6a', '#3e5e6e'];
const Z_PANTS = ['#363846', '#463e30', '#3c4a5a', '#2e2e30', '#5a5046'];
const Z_HAIR = ['#3a2a1e', '#1e1c20', '#6e6a62', '#8e7240', '#4e3a2a'];
function zPal(rng, runner) {
  const sk = rng.pick(Z_SKINS), top = rng.pick(Z_TOPS), pants = rng.pick(Z_PANTS), hair = rng.pick(Z_HAIR);
  return {
    skin: sk[0], skinS: sk[1], skinH: sk[2], hair, hairH: shade(hair, 1.35), hairS: shade(hair, 0.75),
    top, topH: shade(top, 1.18), topS: shade(top, 0.72), pants, pantsS: shade(pants, 0.75),
    shoe: '#2a2420', shoeH: '#40362e', eye: runner ? '#ff3a2a' : '#e6ead2', mouth: '#2a0c0c', blood: '#8a1c1c', blood2: '#5e1010', belt: '#3a2a1e',
  };
}
Art.buildChars = function () {
  const rng = makeRng(90210);
  const C_ = Art.chars;
  C_.walker = []; C_.runner = []; C_.brute = []; C_.crawler = [];
  for (let v = 0; v < 9; v++) {
    const p = zPal(rng, false), seed = rng.int(1, 1e6);
    C_.walker.push(buildCharSet((d, fr) => { const g = humanFrame(d, fr, p, { zombie: true }); zombify(g, p, seed + d * 7, 1); return g; }, [8, 18]));
  }
  for (let v = 0; v < 5; v++) {
    const p = zPal(rng, true), seed = rng.int(1, 1e6);
    p.skin = shade(p.skin, 1.08); p.top = rng.pick(['#8e2e2e', '#2e4e7e', '#4e4e4e', '#7e7e7e']); p.topH = shade(p.top, 1.2); p.topS = shade(p.top, 0.7);
    C_.runner.push(buildCharSet((d, fr) => { const g = humanFrame(d, fr, p, { zombie: true }); zombify(g, p, seed + d * 7, 1.7); return g; }, [8, 18]));
  }
  for (let v = 0; v < 3; v++) {
    const p = zPal(rng, false);
    p.skin = ['#8e9a74', '#a4a68a', '#94a088'][v]; p.skinS = shade(p.skin, 0.74); p.skinH = shade(p.skin, 1.14);
    p.top = ['#c8c0a6', '#56667e', '#8a4a3a'][v]; p.topH = shade(p.top, 1.15); p.topS = shade(p.top, 0.72);
    p.pants = ['#3a4256', '#4a4034', '#2e3440'][v]; p.pantsS = shade(p.pants, 0.75);
    const seed = rng.int(1, 1e6);
    C_.brute.push(buildCharSet((d, fr) => { const g = bruteFrame(d, fr, p); zombify(g, p, seed + d * 7, 1.3); return g; }, [11, 24]));
  }
  for (let v = 0; v < 4; v++) {
    const p = zPal(rng, false), seed = rng.int(1, 1e6);
    C_.crawler.push(buildCharSet((d, fr) => { const g = crawlerFrame(d, fr, p); zombify(g, p, seed + d * 7, 1.4); return g; }, [10, 12]));
  }
};
Art.playerSet = function (lookIdx, hasBag) {
  const key = 'p' + lookIdx + (hasBag ? 'b' : '');
  if (Art.chars[key]) return Art.chars[key][0];
  const L = LOOKS[lookIdx] || LOOKS[0];
  const p = Object.assign({ eye: '#1e1a20', belt: '#2a2018', bag: '#7a5a36', bagH: '#98744a', bagS: '#5a4026', hairS: shade(L.hair, 0.75) }, L);
  Art.chars[key] = [buildCharSet((d, fr) => humanFrame(d, fr, p, { bag: hasBag }), [8, 18])];
  return Art.chars[key][0];
};

/* ─────────── 자연물 ─────────── */
function treeSprite(seed, kind) {
  const rng = makeRng(seed);
  const g = new PG(34, 44);
  const trunk = kind === 2 ? ['#6e6258', '#8a7c70', '#4e443c'] : ['#6a4a30', '#86603e', '#4a321e'];
  if (kind === 0) { // 활엽수
    g.rect(15, 28, 4, 12, trunk[0]); g.vl(15, 28, 12, trunk[1]); g.vl(18, 28, 12, trunk[2]);
    g.rect(13, 39, 8, 2, trunk[0]); g.set(13, 39, trunk[1]); g.set(20, 40, trunk[2]);
    g.set(16, 33, trunk[2]); g.set(17, 30, trunk[2]);
    const pal = rng.pick([['#2f5a2c', '#3f7436', '#58904a', '#78ac5c'], ['#35602e', '#477a38', '#62944a', '#86b462'], ['#2c5434', '#3a6a40', '#4e8450', '#6ea068'], ['#4a5a2a', '#62743a', '#7e9048', '#a0ac5c']]);
    const blobs = [];
    const n = rng.int(5, 7);
    for (let i = 0; i < n; i++) blobs.push([17 + rng.range(-8, 8), 16 + rng.range(-8, 6), rng.range(5.5, 8.5)]);
    blobs.push([17, 18, 9]);
    for (const b of blobs) g.disc(b[0], b[1] + 1.5, b[2], pal[0]);
    for (const b of blobs) g.disc(b[0], b[1], b[2] - 0.8, pal[1]);
    for (const b of blobs) g.disc(b[0] - 1.6, b[1] - 1.8, b[2] * 0.6, pal[2]);
    for (const b of blobs) if (rng.chance(0.7)) g.disc(b[0] - 2.4, b[1] - 3, b[2] * 0.28, pal[3]);
    for (let y = 0; y < 34; y++) for (let x = 0; x < 34; x++) {
      const c = g.get(x, y); if (!c) continue;
      const h = hash2(x, y, seed);
      if (sameRGB(c, C(pal[1])) && h < 0.12) g.set(x, y, pal[0]);
      else if (sameRGB(c, C(pal[2])) && h < 0.1) g.set(x, y, pal[3]);
      else if (sameRGB(c, C(pal[2])) && h > 0.93) g.set(x, y, pal[1]);
    }
    if (rng.chance(0.25)) for (let i = 0; i < 5; i++) g.set(rng.int(8, 26), rng.int(8, 26), rng.pick(['#c84a3a', '#e0b040']));
  } else if (kind === 1) { // 침엽수
    g.rect(15, 32, 4, 9, trunk[0]); g.vl(15, 32, 9, trunk[1]); g.vl(18, 32, 9, trunk[2]);
    const pal = [['#1e4430', '#2a5a3c', '#3a7048', '#52885a'], ['#21452c', '#2e5c36', '#3e7444', '#58905a']][rng.int(0, 1)];
    const tiers = 4;
    for (let t = 0; t < tiers; t++) {
      const base = 36 - t * 8, hw = 14 - t * 3, ht = 12;
      for (let y = 0; y < ht; y++) {
        const w = Math.round(hw * (y / ht));
        const yy = base - ht + y;
        for (let x = -w; x <= w; x++) {
          const col = x < -w * 0.35 ? pal[2] : x > w * 0.45 ? pal[0] : pal[1];
          g.set(17 + x, yy, col);
        }
        if (y === ht - 1) for (let x = -w; x <= w; x++) if (hash2(x, t, seed) < 0.5) g.set(17 + x, yy + 1, pal[0]);
      }
      for (let k = 0; k < 6; k++) g.set(17 + rng.int(-hw + 3, -1), base - rng.int(2, 9), pal[3]);
    }
  } else { // 고사목
    g.rect(15, 18, 4, 22, trunk[0]); g.vl(15, 18, 22, trunk[1]); g.vl(18, 18, 22, trunk[2]);
    g.rect(13, 39, 8, 2, trunk[0]);
    const br = (x0, y0, x1, y1) => { g.line(x0, y0, x1, y1, trunk[0]); g.line(x0 + 1, y0, x1 + 1, y1, trunk[2]); };
    br(16, 26, 7, 16); br(7, 16, 5, 10); br(17, 22, 26, 12); br(26, 12, 29, 9); br(17, 18, 15, 6); br(11, 20, 9, 22); br(22, 17, 25, 19);
  }
  return g.outline();
}
function bushSprite(seed, berries) {
  const rng = makeRng(seed);
  const g = new PG(18, 15);
  const pal = ['#2a5228', '#386a32', '#4e8644', '#6aa258'];
  const bl = [[9, 9, 6], [5, 10, 4], [13, 10, 4], [9, 6, 4]];
  for (const b of bl) g.disc(b[0], b[1] + 1, b[2], pal[0]);
  for (const b of bl) g.disc(b[0], b[1], b[2] - 0.6, pal[1]);
  for (const b of bl) g.disc(b[0] - 1, b[1] - 1.2, b[2] * 0.55, pal[2]);
  for (let i = 0; i < 4; i++) g.set(rng.int(4, 12), rng.int(4, 8), pal[3]);
  if (berries) for (let i = 0; i < 7; i++) { const x = rng.int(3, 14), y = rng.int(5, 12); g.set(x, y, '#c42840'); g.set(x, y - 1, '#ff6070'); }
  return g.outline();
}
function rockSprite(seed, big) {
  const rng = makeRng(seed);
  const w = big ? 20 : 12, h = big ? 16 : 10;
  const g = new PG(w, h);
  const cx = w / 2, cy = h / 2 + 1;
  g.oval(cx, cy, w / 2 - 1.5, h / 2 - 1.5, '#6e6e74');
  g.oval(cx - 1, cy - 1, w / 2 - 3, h / 2 - 3, '#86868c');
  g.oval(cx - 2, cy - 2, w / 4 - 1, h / 4 - 0.5, '#a0a0a6');
  for (let i = 0; i < (big ? 6 : 3); i++) g.set(rng.int(2, w - 3), rng.int(cy, h - 3), '#58585e');
  if (rng.chance(0.4)) for (let i = 0; i < 3; i++) g.set(rng.int(2, w - 3), rng.int(1, cy), '#6a8a4a');
  return g.outline();
}
Art.buildNature = function () {
  const N = Art.nature;
  N.trees = [];
  for (let i = 0; i < 7; i++) N.trees.push({ c: treeSprite(1000 + i * 77, 0).canvas(), ax: 17, ay: 40 });
  for (let i = 0; i < 3; i++) N.trees.push({ c: treeSprite(5000 + i * 55, 1).canvas(), ax: 17, ay: 40 });
  for (let i = 0; i < 2; i++) N.trees.push({ c: treeSprite(9000 + i * 33, 2).canvas(), ax: 17, ay: 40 });
  N.treeFlash = N.trees.map(t => { const g = new PG(t.c.width, t.c.height); const ctx = g.canvas().getContext('2d'); ctx.drawImage(t.c, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 99, 99); return g.canvas(); });
  N.bush = [bushSprite(11, false).canvas(), bushSprite(12, false).canvas()];
  N.berry = [bushSprite(11, true).canvas(), bushSprite(12, true).canvas()];
  N.rock = [rockSprite(1, false).canvas(), rockSprite(2, false).canvas(), rockSprite(3, true).canvas()];
  const st = new PG(14, 10);
  st.oval(7, 6, 5.5, 3.5, '#6a4a30'); st.oval(7, 5, 4.5, 2.6, '#b08a5e'); st.ring(7, 5, 2.4, '#8e6a44'); st.set(7, 5, '#8e6a44');
  st.rect(2, 6, 1, 2, '#4a321e'); N.stump = st.outline().canvas();
  // 작물 단계 (0 새싹, 1 성장, 2 수확 가능)
  N.crop = { potato: [], carrot: [] };
  for (const k of ['potato', 'carrot']) for (let s = 0; s < 3; s++) {
    const g = new PG(16, 16);
    g.oval(8, 12, 6, 3, '#4e3420'); g.oval(8, 11.5, 5, 2.2, '#5e4028');
    const lc = k === 'potato' ? ['#3e7a32', '#5a9a44'] : ['#4a8a30', '#6aaa40'];
    if (s === 0) { g.set(7, 10, lc[1]); g.set(8, 9, lc[1]); g.set(9, 10, lc[0]); }
    if (s === 1) { g.vl(8, 6, 5, lc[0]); g.line(8, 8, 5, 6, lc[1]); g.line(8, 8, 11, 6, lc[1]); g.set(4, 5, lc[1]); g.set(12, 5, lc[1]); }
    if (s === 2) {
      if (k === 'potato') { g.disc(8, 7, 4.5, lc[0]); g.disc(7, 6, 3, lc[1]); g.set(6, 4, '#b080d0'); g.set(10, 5, '#b080d0'); g.set(8, 3, '#e0c0f0'); g.oval(8, 11.5, 3, 1.4, '#c8a060'); }
      else { for (let i = -3; i <= 3; i++) g.line(8, 10, 8 + i * 1.5, 3 + Math.abs(i), i % 2 ? lc[0] : lc[1]); g.rect(7, 10, 3, 2, '#e8782a'); g.set(7, 10, '#ffa050'); }
    }
    N.crop[k].push(g.outline().canvas());
  }
};

/* ─────────── 구조물 ─────────── */
Art.buildStructs = function () {
  const S = Art.struct;
  // 문: 닫힘/열림
  const door = (open) => {
    const g = new PG(16, 16);
    if (!open) {
      g.rect(2, 3, 12, 13, '#7a4a2a'); g.vl(2, 3, 13, '#94603a'); g.vl(13, 3, 13, '#5a341c');
      g.rect(4, 5, 8, 4, '#6a3e22'); g.rect(4, 10, 8, 4, '#6a3e22'); g.hl(4, 5, 8, '#5a341c'); g.hl(4, 10, 8, '#5a341c');
      g.set(11, 9, '#e0c050'); g.set(11, 10, '#a08030'); g.hl(2, 3, 12, '#a87448');
    } else {
      g.rect(1, 3, 3, 13, '#7a4a2a'); g.vl(1, 3, 13, '#94603a'); g.vl(3, 3, 13, '#5a341c'); g.set(2, 9, '#e0c050');
    }
    return g.outline().canvas();
  };
  S.doorClosed = door(false); S.doorOpen = door(true);
  // 바리케이드
  const bar = () => {
    const g = new PG(16, 16);
    g.rect(1, 2, 2, 13, '#6a4a2a'); g.rect(13, 2, 2, 13, '#6a4a2a');
    for (const y of [3, 7, 11]) { g.rect(0, y, 16, 3, '#a8784a'); g.hl(0, y, 16, '#c4966a'); g.hl(0, y + 2, 16, '#7a5432'); g.set(2, y + 1, '#c8c8c8'); g.set(13, y + 1, '#c8c8c8'); }
    g.line(1, 13, 14, 3, '#8a5e36'); g.line(1, 14, 14, 4, '#6a4424');
    return g.outline();
  };
  const bg = bar();
  S.barricade = bg.canvas();
  // 보관함
  const bx = new PG(16, 16);
  bx.rect(1, 4, 14, 11, '#8a5a32'); bx.rect(1, 4, 14, 4, '#a8744a'); bx.hl(1, 4, 14, '#c4905e');
  bx.hl(1, 8, 14, '#5a3a1e'); bx.vl(4, 4, 11, '#6a6a72'); bx.vl(11, 4, 11, '#6a6a72'); bx.rect(7, 8, 2, 3, '#d8c060');
  S.box = bx.outline().canvas();
  // 모닥불 받침
  const cf = new PG(18, 14);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; cf.disc(9 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 3.5, 1.6, i % 2 ? '#7a7a80' : '#929298'); }
  cf.thick(4, 10, 13, 6, '#6a4424', 2); cf.thick(5, 6, 13, 10, '#86603a', 2);
  S.campfire = cf.outline().canvas();
  const ash = new PG(18, 14);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ash.disc(9 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 3.5, 1.6, i % 2 ? '#6a6a70' : '#808086'); }
  ash.oval(9, 8.5, 4, 2, '#3a3a3a'); ash.set(8, 8, '#a04a20');
  S.campfireOut = ash.outline().canvas();
  // 불꽃 프레임
  S.flame = [];
  for (let k = 0; k < 4; k++) {
    const g = new PG(12, 14), r = makeRng(77 + k);
    for (let y = 0; y < 12; y++) {
      const w = Math.max(0, Math.round((y / 12) * 4.5 + r.range(-0.6, 0.6)));
      for (let x = -w; x <= w; x++) {
        const t = Math.abs(x) / (w + 0.01);
        const col = y > 8 && t < 0.5 ? '#fff4b0' : (t < 0.45 && y > 4 ? '#ffd040' : (y < 4 ? '#e04a1a' : '#ff8a20'));
        g.set(6 + x + Math.round(Math.sin(y * 0.7 + k) * 0.6), y + 1, col);
      }
    }
    S.flame.push(g.canvas());
  }
  // 그림자
  const sh = (w, h) => { const g = new PG(w, h); g.oval(w / 2, h / 2, w / 2, h / 2, [0, 0, 0, 90]); return g.canvas(); };
  S.shadow = sh(12, 5); S.shadowBig = sh(18, 7); S.shadowTree = sh(24, 9);
  // 낚시찌
  const bob = new PG(5, 6); bob.rect(1, 0, 3, 3, '#e83030'); bob.rect(1, 3, 3, 2, '#f0f0f0'); bob.set(2, 0, '#ff8080');
  S.bobber = bob.outline().canvas();
  // 상호작용 표시(손가락 화살표)
  const ar = new PG(9, 7); ar.rect(1, 1, 7, 2, '#ffe070'); ar.rect(2, 3, 5, 1, '#ffe070'); ar.rect(3, 4, 3, 1, '#ffe070'); ar.set(4, 5, '#ffe070'); ar.hl(1, 1, 7, '#fff6c0');
  S.marker = ar.outline().canvas();
  // 총구 화염
  const mf = new PG(11, 11);
  mf.disc(5.5, 5.5, 3.5, '#ffb030'); mf.disc(5.5, 5.5, 2, '#fff4c0');
  mf.line(5, 0, 5, 10, '#ffd060'); mf.line(0, 5, 10, 5, '#ffd060');
  S.muzzle = mf.canvas();
  // 화살(날아가는)
  const arw = new PG(12, 3); arw.hl(1, 1, 9, '#c8a070'); arw.set(10, 1, '#d0d0d8'); arw.set(11, 1, '#f0f0f0'); arw.set(0, 0, '#e04040'); arw.set(0, 2, '#e04040'); arw.set(1, 0, '#f0f0f0'); arw.set(1, 2, '#f0f0f0');
  S.arrow = arw.canvas();
};
