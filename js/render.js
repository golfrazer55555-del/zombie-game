'use strict';
/* ===== 렌더러: 저해상도 캔버스에 그린 뒤 정수배 확대 ===== */
const Render = (function () {
  let cv, ctx, W = 320, H = 180, scale = 1, dpr = 1;
  let shadeCv, shadeCtx, fogCv, fogCtx, fogImg, vigCv;
  const cam = { x: 0, y: 0, rx: 0, ry: 0, init: false };
  let paintBudget = 0, frame = 0;

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d', { alpha: false });
    shadeCv = document.createElement('canvas'); shadeCtx = shadeCv.getContext('2d');
    fogCv = document.createElement('canvas'); fogCtx = fogCv.getContext('2d');
    vigCv = document.createElement('canvas');
    resize();
  }
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth, ch = window.innerHeight;
    const devW = Math.max(1, Math.round(cw * dpr)), devH = Math.max(1, Math.round(ch * dpr));
    scale = Math.max(1, Math.round(Math.min(devW, devH) / 250));
    W = Math.ceil(devW / scale); H = Math.ceil(devH / scale);
    cv.width = W; cv.height = H;
    cv.style.width = (W * scale / dpr) + 'px'; cv.style.height = (H * scale / dpr) + 'px';
    ctx.imageSmoothingEnabled = false;
    shadeCv.width = Math.ceil(W / 2) + 2; shadeCv.height = Math.ceil(H / 2) + 2;
    const fw = Math.ceil(W / TS) + 4, fh = Math.ceil(H / TS) + 4;
    fogCv.width = fw; fogCv.height = fh; fogImg = fogCtx.createImageData(fw, fh);
    vigCv.width = W; vigCv.height = H;
    const vc = vigCv.getContext('2d');
    const g = vc.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    vc.fillStyle = g; vc.fillRect(0, 0, W, H);
  }
  function screenToWorld(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return { wx: cam.rx + (clientX - r.left) / r.width * W, wy: cam.ry + (clientY - r.top) / r.height * H };
  }

  function chunk(Wd, cx, cy, force) {
    const key = cx + ',' + cy;
    let c = Wd.chunks.get(key);
    if (!c && (force || paintBudget > 0)) { paintBudget--; c = Art.paintChunk(Wd, cx, cy); Wd.chunks.set(key, c); }
    return c;
  }
  function prewarm() {
    const Wd = G.world, p = G.player || { x: Wd.W * 8, y: Wd.H * 8 };
    const cx = Math.floor(p.x / (CHUNK * TS)), cy = Math.floor(p.y / (CHUNK * TS));
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && y >= 0 && x * CHUNK < Wd.W && y * CHUNK < Wd.H) chunk(Wd, x, y, true);
  }
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function pline(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    ctx.fillStyle = c;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (;;) { ctx.fillRect(x0, y0, 1, 1); if ((x0 === x1 && y0 === y1) || n++ > 600) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function pcircle(cx, cy, r, c) { ctx.fillStyle = c; const n = Math.max(12, Math.floor(r * 1.4)); for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.62), 1, 1); } }

  /* 캐릭터 */
  function drawChar(set, dir, fr, x, y, flash, alpha) {
    const img = flash ? set.w[dir][fr] : set.f[dir][fr];
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, Math.round(x - set.ax), Math.round(y - set.ay));
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  function drawHeld(p) {
    const it = p.held();
    if (!it) return;
    const def = ITEMS[it.id], ic = Art.icon[it.id];
    if (!ic || !def.hold) return;
    let a = p.aim, ox = 0, oy = 0;
    const sw = p.swing;
    if (sw && def.melee) {
      const k = clamp(sw.t / sw.dur, 0, 1);
      if (sw.thrust) { const f = Math.sin(k * Math.PI); ox = Math.cos(a) * f * 7; oy = Math.sin(a) * f * 7; }
      else { const e = 1 - Math.pow(1 - k, 2); a = sw.a - sw.arc / 2 + sw.arc * e; }
    } else if (def.melee && !p.moving) a = p.aim - 0.5;
    if (def.gun) { ox -= Math.cos(a) * p.recoil; oy -= Math.sin(a) * p.recoil; }
    const hx = p.x + Math.cos(p.aim) * 3 + ox, hy = p.y - 8 + Math.sin(p.aim) * 2 + oy;
    ctx.save();
    ctx.translate(Math.round(hx), Math.round(hy));
    ctx.rotate(a - def.hold.a);
    if (def.hold.a === 0 && Math.cos(a) < 0) ctx.scale(1, -1);
    ctx.drawImage(ic.c, -def.hold.gx, -def.hold.gy);
    ctx.restore();
  }
  function drawPlayer(p) {
    const set = Art.playerSet(p.look, !!p.equip.bag);
    if (p.dead || p.sleeping) {
      ctx.drawImage(set.corpse, Math.round(p.x - set.cax), Math.round(p.y - set.cay - 2));
      if (p.sleeping && frame % 50 < 25) { const k = (frame % 100) / 100; px(p.x + 4 + k * 6, p.y - 14 - k * 10, 3, 1, '#e8e8f0'); px(p.x + 6 + k * 6, p.y - 13 - k * 10, 1, 1, '#e8e8f0'); px(p.x + 4 + k * 6, p.y - 12 - k * 10, 3, 1, '#e8e8f0'); }
      return;
    }
    const fr = p.moving ? Math.floor(p.anim) % 4 : 0;
    const behind = p.dir === 3;
    if (behind) drawHeld(p);
    drawChar(set, p.dir, fr, p.x, p.y, p.hurtT > 0.22, 1);
    if (!behind) drawHeld(p);
  }
  function drawZombie(z) {
    if (z.alpha < 0.03) return;
    const set = Art.chars[z.def.sprite][z.v] || Art.chars[z.def.sprite][0];
    const fr = z.moving ? Math.floor(z.anim) % 4 : (z.type === 'walker' ? Math.floor(frame / 30) % 2 * 0 : 0);
    let x = z.x, y = z.y;
    if (z.atkT > 0) { const k = 1 - z.atkT / 0.36; const a = Math.atan2(G.player.y - z.y, G.player.x - z.x); x += Math.cos(a) * k * 3; y += Math.sin(a) * k * 2; }
    const sway = z.type === 'walker' && z.moving ? Math.round(Math.sin(z.anim * 1.6)) * 0.5 : 0;
    drawChar(set, z.dir, fr, x + sway, y, z.flash > 0, z.alpha);
  }

  /* 사물 */
  function drawObj(o, tx, ty, layer) {
    const x = tx * TS, y = ty * TS, S = Art.struct, N = Art.nature;
    const sh = o.shake > 0 ? Math.round(Math.sin(frame * 1.7) * 1.5) : 0;
    switch (o.k) {
      case 'door': {
        ctx.drawImage(o.open ? S.doorOpen : S.doorClosed, x + sh, y);
        if (!o.open && o.hp < o.max) { const n = Math.floor((1 - o.hp / o.max) * 8); for (let i = 0; i < n; i++) px(x + 3 + ((i * 5) % 10), y + 5 + ((i * 3) % 9), 2, 1, '#2a160a'); }
        break;
      }
      case 'stump': ctx.drawImage(N.stump, x + 1, y + 5); break;
      case 'bush': { const has = o.berry >= 0 && G.day() >= o.berry; ctx.drawImage((has ? N.berry : N.bush)[o.v % 2], x - 1, y + 2); break; }
      case 'rock': ctx.drawImage(N.rock[o.v % 2], x + 2, y + 5); break;
      case 'rockbig': ctx.drawImage(N.rock[2], x - 2, y + 1); break;
      case 'crop': ctx.drawImage(N.crop[o.c][G.cropStage(o)], x, y); break;
      case 'campfire': {
        ctx.drawImage(o.fuel > 0 ? S.campfire : S.campfireOut, x - 1, y + 2);
        if (o.fuel > 0) ctx.drawImage(S.flame[Math.floor(frame / 5) % 4], x + 2, y - 4);
        break;
      }
      case 'barricade': {
        ctx.drawImage(S.barricade, x + sh, y);
        const n = Math.floor((1 - o.hp / o.max) * 7); for (let i = 0; i < n; i++) px(x + 2 + ((i * 6) % 12), y + 4 + ((i * 5) % 9), 2, 1, '#2a160a');
        break;
      }
      case 'box': ctx.drawImage(S.box, x, y); break;
    }
  }
  function drawTree(o) {
    const t = Art.nature.trees[o.v] || Art.nature.trees[0];
    const sh = o.shake > 0 ? Math.round(Math.sin(frame * 2.1) * 1.5) : 0;
    const x = o.x * TS + 8, y = o.y * TS + 14;
    const p = G.player;
    let a = 1;
    if (p && !G.demo && p.y < y - 2 && p.y > y - 40 && Math.abs(p.x - x) < 16) a = 0.5;
    if (a < 1) ctx.globalAlpha = a;
    ctx.drawImage(t.c, Math.round(x - t.ax + sh), Math.round(y - t.ay));
    if (a < 1) ctx.globalAlpha = 1;
  }
  function drawLamp(o) {
    const x = o.x * TS + 7, y = o.y * TS + 13;
    px(x, y - 30, 2, 30, '#3a3c42'); px(x, y - 30, 1, 30, '#5a5c64'); px(x - 2, y - 1, 6, 2, '#2a2c30');
    px(x - 4, y - 32, 8, 2, '#3a3c42'); px(x - 4, y - 30, 3, 1, '#9a9c88');
  }

  /* 빛 */
  function radial(c2, x, y, r, a) {
    const g = c2.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.45, `rgba(0,0,0,${a * 0.85})`); g.addColorStop(0.75, `rgba(0,0,0,${a * 0.4})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill();
  }
  function cone(c2, x, y, ang, len, half, a) {
    const g = c2.createRadialGradient(x, y, 0, x, y, len);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.85})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = g; c2.beginPath(); c2.moveTo(x, y); c2.arc(x, y, len, ang - half, ang + half); c2.closePath(); c2.fill();
  }
  function collectLights(cx, cy) {
    const L = [], Wd = G.world, p = G.player;
    const flick = (k) => 1 + Math.sin(G.realT * 13 + k) * 0.04 + Math.sin(G.realT * 7.3 + k * 2) * 0.03;
    if (p && !G.demo) {
      L.push({ x: p.x, y: p.y - 6, r: p.dead ? 0 : 30, a: 0.55 });
      if (p.light && !p.dead && !p.sleeping) { L.push({ cone: true, x: p.x + Math.cos(p.aim) * 3, y: p.y - 7, ang: p.aim, len: 140, half: 0.42, a: 1 }); L.push({ x: p.x, y: p.y - 6, r: 40, a: 0.6 }); }
      const h = p.held();
      if (h && h.id === 'torch') L.push({ x: p.x + Math.cos(p.aim) * 6, y: p.y - 12, r: 78 * flick(1), a: 1, warm: true });
    }
    const tx0 = Math.floor(cx / TS) - 6, ty0 = Math.floor(cy / TS) - 6, tx1 = tx0 + Math.ceil(W / TS) + 12, ty1 = ty0 + Math.ceil(H / TS) + 12;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) { const o = Wd.objAt(tx, ty); if (o && o.k === 'campfire' && o.fuel > 0 && o.x === tx && o.y === ty) L.push({ x: tx * TS + 8, y: ty * TS + 6, r: 88 * flick(tx), a: 1, warm: true }); }
    for (const f of G.fires) L.push({ x: f.x, y: f.y, r: 70 * flick(f.x), a: Math.min(1, f.t / 2), warm: true });
    for (const c of G.crackers) L.push({ x: c.x, y: c.y, r: 34 * flick(c.y), a: 0.8, warm: true });
    if (G.muzzle > 0) L.push({ x: G.muzzleX, y: G.muzzleY, r: 100, a: 0.9, warm: true });
    return L;
  }

  /* 메인 그리기 */
  function draw(dt) {
    frame++;
    paintBudget = 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, W, H);
    const Wd = G.world;
    if (!Wd) return;
    const p = G.player;
    // 카메라
    let tx, ty;
    if (G.demo) { tx = G.demoCam.x - W / 2; ty = G.demoCam.y - H / 2; }
    else {
      let lx = 0, ly = 0;
      if (Input.usingMouse && Input.mouse && !p.dead) { lx = clamp((Input.mouse.wx - p.x) * 0.18, -30, 30); ly = clamp((Input.mouse.wy - p.y) * 0.18, -22, 22); }
      tx = p.x - W / 2 + lx; ty = p.y - 10 - H / 2 + ly;
    }
    tx = clamp(tx, 0, Wd.W * TS - W); ty = clamp(ty, -8, Wd.H * TS - H);
    if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
    const k = 1 - Math.exp(-dt * (G.demo ? 2 : 9));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    const shk = G.shake * (UI.prefs.shake ? 1 : 0);
    const cx = Math.round(cam.x + (shk > 0.2 ? RND.range(-shk, shk) : 0));
    const cy = Math.round(cam.y + (shk > 0.2 ? RND.range(-shk, shk) : 0));
    cam.rx = cam.x; cam.ry = cam.y;
    ctx.setTransform(1, 0, 0, 1, -cx, -cy);

    // 지면 청크 + 데칼
    const CS = CHUNK * TS;
    const c0 = Math.floor(cx / CS), c1 = Math.floor((cx + W) / CS), r0 = Math.floor(cy / CS), r1 = Math.floor((cy + H) / CS);
    for (let cy2 = r0; cy2 <= r1; cy2++) for (let cx2 = c0; cx2 <= c1; cx2++) {
      if (cx2 < 0 || cy2 < 0 || cx2 * CHUNK >= Wd.W || cy2 * CHUNK >= Wd.H) continue;
      const c = chunk(Wd, cx2, cy2, false);
      if (c) ctx.drawImage(c, cx2 * CS, cy2 * CS);
      const d = Wd.decals.get(cx2 + ',' + cy2);
      if (d) ctx.drawImage(d, cx2 * CS, cy2 * CS);
    }
    // 주변 청크 미리 칠하기
    if (paintBudget > 0) for (let cy2 = r0 - 1; cy2 <= r1 + 1 && paintBudget > 0; cy2++) for (let cx2 = c0 - 1; cx2 <= c1 + 1 && paintBudget > 0; cx2++) if (cx2 >= 0 && cy2 >= 0 && cx2 * CHUNK < Wd.W && cy2 * CHUNK < Wd.H) chunk(Wd, cx2, cy2, false);

    const vx0 = Math.floor(cx / TS) - 2, vy0 = Math.floor(cy / TS) - 2, vx1 = Math.floor((cx + W) / TS) + 2, vy1 = Math.floor((cy + H) / TS) + 4;
    // 물 반짝임
    const t = G.realT;
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      if (!Wd.isWater(x, y)) continue;
      const h1 = hash2(x, y, 5), h2 = hash2(x, y, 6);
      const ph = Math.sin(t * 1.4 + h1 * 9);
      if (ph > 0.2) { ctx.globalAlpha = (ph - 0.2) * 0.7; px(x * TS + ((h2 * 12 + t * 3) % 12), y * TS + 3 + h1 * 10, 4, 1, '#b8dcec'); ctx.globalAlpha = 1; }
    }
    // 바닥 사물
    const sorted = [];
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      const o = Wd.objAt(x, y);
      if (!o || o.baked || o.x !== x || o.y !== y) continue;
      if (o.k === 'tree') { sorted.push([y * TS + 14, 1, o]); continue; }
      if (o.k === 'lamp') { sorted.push([y * TS + 13, 2, o]); continue; }
      drawObj(o, x, y);
    }
    // 바닥 아이템
    for (const g of Wd.groundItems) {
      if (g.x < cx - 16 || g.x > cx + W + 16 || g.y < cy - 16 || g.y > cy + H + 16) continue;
      if (G.visAt(g.x, g.y) < 0.4) continue;
      const bob = Math.round(Math.sin(t * 3 + g.x) * 0.6);
      ctx.drawImage(Art.struct.shadow, Math.round(g.x - 6), Math.round(g.y + 2));
      ctx.drawImage(Art.icon[g.id].c, Math.round(g.x - 8), Math.round(g.y - 10 + bob));
    }
    // 시체
    for (const c of G.corpses) {
      if (c.x < cx - 30 || c.x > cx + W + 30 || c.y < cy - 30 || c.y > cy + H + 30) continue;
      const set = Art.chars[c.type][c.v] || Art.chars[c.type][0];
      const a = c.t > 220 ? Math.max(0, 1 - (c.t - 220) / 20) : 1;
      ctx.globalAlpha = a * Math.min(1, G.visAt(c.x, c.y) + 0.2);
      ctx.drawImage(set.corpse, Math.round(c.x - set.cax), Math.round(c.y - set.cay - 2));
      ctx.globalAlpha = 1;
    }
    // 소음 고리
    for (const r of G.rings) { ctx.globalAlpha = Math.max(0, 0.45 * (1 - r.r / r.max)); pcircle(r.x, r.y, r.r, '#f0e8c8'); ctx.globalAlpha = 1; }
    // 설치 미리보기
    if (p && !G.demo && !p.dead) {
      const h = p.held(), def = h ? ITEMS[h.id] : null;
      if (def && (def.place || def.seed)) {
        const { tx: gx, ty: gy } = G.placeTarget();
        const ok = G.canPlace(def.place || 'seed', gx, gy);
        ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.15;
        ctx.strokeStyle = ok ? '#8fe07a' : '#e05a4a'; ctx.lineWidth = 1;
        ctx.strokeRect(gx * TS + 0.5, gy * TS + 0.5, 15, 15);
        ctx.globalAlpha = 0.45;
        const spr = def.place === 'campfire' ? Art.struct.campfire : def.place === 'barricade' ? Art.struct.barricade : def.place === 'box' ? Art.struct.box : Art.nature.crop[def.seed][0];
        ctx.drawImage(spr, gx * TS, gy * TS + (def.place === 'campfire' ? 2 : 0));
        ctx.globalAlpha = 1;
      }
    }
    // 그림자
    const ents = [];
    if (p && !G.demo) ents.push([p.y, 0, p]);
    for (const z of G.zombies) {
      if (z.dead || z.x < cx - 30 || z.x > cx + W + 30 || z.y < cy - 20 || z.y > cy + H + 40) continue;
      if (z.alpha > 0.03) { ctx.globalAlpha = z.alpha; ctx.drawImage(z.type === 'brute' ? Art.struct.shadowBig : Art.struct.shadow, Math.round(z.x - (z.type === 'brute' ? 9 : 6)), Math.round(z.y - 2)); ctx.globalAlpha = 1; }
      ents.push([z.y, 3, z]);
    }
    if (p && !G.demo && !p.dead && !p.sleeping) ctx.drawImage(Art.struct.shadow, Math.round(p.x - 6), Math.round(p.y - 2));
    for (const s of sorted) if (s[1] === 1) ctx.drawImage(Art.struct.shadowTree, s[2].x * TS - 4, s[2].y * TS + 10);
    for (const pr of G.projs) if (pr.k === 'throw' || pr.k === 'arrow') ents.push([pr.y + 6, 4, pr]);
    for (const e of ents) sorted.push(e);
    sorted.sort((a, b) => a[0] - b[0]);
    for (const [, kind, e] of sorted) {
      if (kind === 0) drawPlayer(e);
      else if (kind === 1) drawTree(e);
      else if (kind === 2) drawLamp(e);
      else if (kind === 3) drawZombie(e);
      else if (kind === 4) {
        if (e.k === 'arrow') { ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.rotate(e.a); ctx.drawImage(Art.struct.arrow, -6, -1); ctx.restore(); }
        else { ctx.drawImage(Art.struct.shadow, Math.round(e.x - 6), Math.round(e.y + 4)); ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y - e.z)); ctx.rotate(e.t * 12); ctx.drawImage(Art.icon[e.id].c, -8, -8); ctx.restore(); }
      }
    }
    // 낚시찌
    if (p && p.action && p.action.type === 'fish') {
      const a = p.action, bob = a.state === 'bite' ? 2 : Math.round(Math.sin(t * 3));
      const rx = p.x + Math.cos(p.aim) * 14, ry = p.y - 16;
      pline(rx, ry, a.bx, a.by + bob, 'rgba(230,230,230,0.7)');
      ctx.drawImage(Art.struct.bobber, Math.round(a.bx - 2), Math.round(a.by - 3 + bob));
      if (a.state !== 'wait') { px(a.bx - 1, a.by - 14, 2, 6, '#ffe060'); px(a.bx - 1, a.by - 6, 2, 2, '#ffe060'); }
    }
    // 지붕
    const pin = p && !G.demo ? Wd.bldAt(Math.floor(p.x / TS), Math.floor(p.y / TS)) : null;
    for (const b of Wd.buildings) {
      const target = pin && pin.id === b.id ? 0 : 1;
      if (b._ra == null) b._ra = target;
      b._ra += (target - b._ra) * Math.min(1, dt * 8);
      if (b.x0 * TS > cx + W || (b.x0 + b.w) * TS < cx || b.y0 * TS - 8 > cy + H || (b.y0 + b.h) * TS < cy) continue;
      if (b._ra < 0.02) continue;
      if (!b._roof) b._roof = Art.roof(b);
      ctx.globalAlpha = b._ra;
      ctx.drawImage(b._roof, b.x0 * TS, b.y0 * TS - 8);
      ctx.globalAlpha = 1;
    }
    // 파티클
    for (const q of G.parts) {
      if (q.x < cx - 4 || q.x > cx + W + 4 || q.y < cy - 20 || q.y > cy + H + 20) continue;
      if (q.kind === 'smoke' || q.kind === 'fire' || q.kind === 'dust') ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      const s = q.kind === 'smoke' ? q.size + Math.floor((1 - q.life / q.max) * 3) : q.size;
      px(q.x, q.y - q.z, s, s, q.col);
      ctx.globalAlpha = 1;
    }
    for (const pr of G.projs) if (pr.k === 'tracer') { ctx.globalAlpha = clamp(pr.life / 0.07, 0, 1); pline(pr.x, pr.y, pr.x2, pr.y2, '#ffe9a0'); ctx.globalAlpha = 1; }

    // ── 시야 + 어둠 ──
    const sw = shadeCv.width, shh = shadeCv.height;
    const scx = Math.floor(cx / 2) * 2, scy = Math.floor(cy / 2) * 2;
    shadeCtx.setTransform(1, 0, 0, 1, 0, 0);
    shadeCtx.clearRect(0, 0, sw, shh);
    const dark = G.darkness;
    if (dark > 0.01) {
      const tint = G.minute() / 60 > 12 && G.minute() / 60 < 20.5 ? [26 * (1 - dark) + 6 * dark, 14 * (1 - dark) + 10 * dark, 26 * (1 - dark) + 30 * dark] : [6, 10, 30];
      shadeCtx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${dark})`;
      shadeCtx.fillRect(0, 0, sw, shh);
      shadeCtx.globalCompositeOperation = 'destination-out';
      shadeCtx.setTransform(0.5, 0, 0, 0.5, -scx / 2, -scy / 2);
      for (const l of collectLights(cx, cy)) { if (l.cone) cone(shadeCtx, l.x, l.y, l.ang, l.len, l.half, l.a); else if (l.r > 0) radial(shadeCtx, l.x, l.y, l.r, l.a); }
      shadeCtx.setTransform(1, 0, 0, 1, 0, 0);
      shadeCtx.globalCompositeOperation = 'source-over';
    }
    if (!G.demo) {
      // 시야 안개
      const fw = fogCv.width, fh = fogCv.height, fx0 = Math.floor(cx / TS) - 1, fy0 = Math.floor(cy / TS) - 1;
      const d = fogImg.data, fogMax = 0.7;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const wx = fx0 + x, wy = fy0 + y, i = (y * fw + x) * 4;
        const v = Wd.inb(wx, wy) ? G.visA[Wd.idx(wx, wy)] : 0;
        d[i] = 4; d[i + 1] = 6; d[i + 2] = 12; d[i + 3] = (1 - v) * fogMax * 255;
      }
      fogCtx.putImageData(fogImg, 0, 0);
      shadeCtx.imageSmoothingEnabled = true;
      shadeCtx.setTransform(0.5, 0, 0, 0.5, -scx / 2, -scy / 2);
      shadeCtx.drawImage(fogCv, 0, 0, fw, fh, fx0 * TS, fy0 * TS, fw * TS, fh * TS);
      shadeCtx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shadeCv, 0, 0, sw, shh, scx, scy, sw * 2, shh * 2);

    // 발광체
    if (dark > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const l of collectLights(cx, cy)) if (l.warm && l.r > 0) { const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.7); g.addColorStop(0, `rgba(255,150,60,${0.22 * l.a * dark})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
      ctx.globalCompositeOperation = 'source-over';
      for (const z of G.zombies) {
        if (z.dead || z.type !== 'runner' || z.alpha < 0.3 || z.dir === 3) continue;
        if (z.x < cx || z.x > cx + W || z.y < cy || z.y > cy + H + 20) continue;
        const set = Art.chars.runner[z.v], fr = z.moving ? Math.floor(z.anim) % 4 : 0, by = (fr & 1) ? 1 : 0;
        const ex = Math.round(z.x - set.ax), ey = Math.round(z.y - set.ay) + 4 + by;
        ctx.globalAlpha = z.alpha * dark;
        if (z.dir === 0) { px(ex + 6, ey, 1, 1, '#ff4030'); px(ex + 9, ey, 1, 1, '#ff4030'); }
        else px(ex + (z.dir === 1 ? 5 : 10), ey, 1, 1, '#ff4030');
        ctx.globalAlpha = 1;
      }
    }
    if (G.muzzle > 0) { ctx.save(); ctx.translate(Math.round(G.muzzleX + Math.cos(G.muzzleA) * 4), Math.round(G.muzzleY + Math.sin(G.muzzleA) * 4)); ctx.rotate(G.muzzleA); ctx.drawImage(Art.struct.muzzle, -5, -5); ctx.restore(); }

    // 월드 UI
    if (p && !G.demo && !p.dead) {
      const it = G.interact;
      if (it && it.act !== 'none' && !p.action) ctx.drawImage(Art.struct.marker, Math.round(it.x - 4), Math.round(it.y - 16 + Math.sin(t * 5) * 1.5));
      const bar = (y, v, c) => { px(p.x - 7, y, 14, 3, '#101014'); px(p.x - 6, y + 1, Math.max(0, Math.round(12 * v)), 1, c); };
      if (p.action && p.action.type === 'search') bar(p.y - 26, p.action.t / p.action.dur, '#f0e070');
      if (p.reload > 0 && p.reloadMax) bar(p.y - 26, 1 - p.reload / p.reloadMax, '#e0b040');
      if (p.stamina < 99) bar(p.y + 3, p.stamina / 100, p.stamina < 25 ? '#e05a4a' : '#7ad06a');
      if (Input.usingMouse && Input.mouse) {
        const h = p.held(), def = h ? ITEMS[h.id] : null;
        if (def && (def.gun || def.throw)) {
          const mx = Math.round(Input.mouse.wx), my = Math.round(Input.mouse.wy);
          ctx.globalAlpha = 0.85; px(mx - 4, my, 3, 1, '#f0f0e0'); px(mx + 2, my, 3, 1, '#f0f0e0'); px(mx, my - 4, 1, 3, '#f0f0e0'); px(mx, my + 2, 1, 3, '#f0f0e0'); ctx.globalAlpha = 1;
        }
      }
    }
    // 화면 효과
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p && !G.demo) {
      const low = p.hp < 30 ? (0.25 + Math.sin(t * 5) * 0.1) * (1 - p.hp / 30) : 0;
      const v = Math.max(G.hurtFlash * 0.8, low);
      if (v > 0.01) { ctx.globalAlpha = Math.min(0.85, v); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(vigCv, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#ff2020'; ctx.globalAlpha = Math.min(0.5, v * 0.6); ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      if (p.energy < 15 && !p.sleeping) { ctx.globalAlpha = (15 - p.energy) / 15 * 0.5; ctx.drawImage(vigCv, 0, 0); ctx.globalAlpha = 1; }
      if (p.sleeping) { ctx.fillStyle = 'rgba(2,3,8,0.72)'; ctx.fillRect(0, 0, W, H); }
      if (G.state === 'dead') { ctx.fillStyle = `rgba(40,0,0,${Math.min(0.75, G.deathT * 0.35)})`; ctx.fillRect(0, 0, W, H); }
    }
    ctx.globalAlpha = 0.35; ctx.drawImage(vigCv, 0, 0); ctx.globalAlpha = 1;
  }
  return { init, resize, draw, prewarm, screenToWorld, cam, get W() { return W; }, get H() { return H; }, get scale() { return scale; } };
})();
