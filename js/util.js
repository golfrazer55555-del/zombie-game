'use strict';
/* ===== 공용 유틸리티 ===== */
const TAU = Math.PI * 2;
const TS = 16; // 타일 크기(px)

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}
function fmt2(n) { n = Math.floor(n); return (n < 10 ? '0' : '') + n; }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const r = mulberry32(seed >>> 0);
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.range = (a, b) => a + r() * (b - a);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  r.weighted = list => {
    let tot = 0; for (const e of list) tot += e[1];
    let x = r() * tot;
    for (const e of list) { x -= e[1]; if (x <= 0) return e[0]; }
    return list[list.length - 1][0];
  };
  r.shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  return r;
}
// 게임플레이용 난수(결정적일 필요 없음)
const RND = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
function fbm(x, y, s, oct) {
  oct = oct || 3;
  let sum = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 31); n += amp; amp *= 0.5; f *= 2; }
  return sum / n;
}
function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// localStorage는 막혀 있을 수 있으므로 항상 try/catch
const Store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
};

// 비트셋 <-> base64
function bitsToB64(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
function b64ToBits(b64, len) {
  const out = new Uint8Array(len);
  try { const s = atob(b64); for (let i = 0; i < s.length && i < len; i++) out[i] = s.charCodeAt(i); } catch (e) { /* 무시 */ }
  return out;
}
