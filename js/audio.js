'use strict';
/* ===== 효과음: Web Audio API로 실시간 합성 ===== */
const SFX = (function () {
  let ctx = null, master, comp, sfxBus, ambBus, musBus, revIn, noiseBuf, brownBuf, shaper;
  let vol = 0.8, musicOn = true, voices = 0;
  const L = { x: 0, y: 0 };
  const amb = { wind: null, windF: null, drone: null, nextChirp: 0, nextBird: 0, nextMoan: 0, nextChord: 0, chord: 0, droneOscs: [] };

  function mkNoise(sec, brown) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function mkIR(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * (i < 200 ? i / 200 : 1); }
    return b;
  }
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = vol;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? 0.5 : 0; musBus.connect(master);
    const rev = ctx.createConvolver(); rev.buffer = mkIR(2.2);
    revIn = ctx.createGain(); revIn.gain.value = 0.5; revIn.connect(rev); rev.connect(master);
    noiseBuf = mkNoise(2, false); brownBuf = mkNoise(4, true);
    shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4); }
    shaper.curve = curve;
    return true;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ── 합성 부품 ──
  function out(v, pan, rev) {
    const g = ctx.createGain(); g.gain.value = v;
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(sfxBus);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(revIn); }
    return g;
  }
  function env(g, t, a, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(type, f0, f1, t, dur, peak, dest, a) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); env(g, t, a || 0.004, dur, peak);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function nz(t, dur, peak, dest, type, f0, f1, q, a, buf) {
    const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 0.8;
    const g = ctx.createGain(); env(g, t, a || 0.003, dur, peak);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function voice(t, d, f0, f1, dur, peak, formants, wob, dist) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = wob[0];
    const lg = ctx.createGain(); lg.gain.value = wob[1]; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); env(g, t, Math.min(0.15, dur * 0.25), dur, peak);
    let src = o;
    if (dist) { const pre = ctx.createGain(); pre.gain.value = dist; o.connect(pre); const sh = ctx.createWaveShaper(); sh.curve = shaper.curve; pre.connect(sh); src = sh; }
    for (const [fq, q, gn] of formants) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
      const fg = ctx.createGain(); fg.gain.value = gn;
      src.connect(bp); bp.connect(fg); fg.connect(g);
    }
    g.connect(d);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    nz(t, dur * 0.9, peak * 0.25, d, 'bandpass', formants[0][0] * 1.3, formants[0][0], 1.5, 0.1);
  }
  const R = (a, b) => a + Math.random() * (b - a);

  const S = {
    step(t, d, o) {
      const hard = o.hard;
      nz(t, 0.07, hard ? 0.18 : 0.22, d, 'lowpass', hard ? 1300 : R(450, 700), hard ? 600 : 300, 1);
      if (hard) nz(t, 0.025, 0.07, d, 'bandpass', 2600, 2600, 2);
    },
    swing(t, d) { nz(t, 0.17, 0.32, d, 'bandpass', 500, 2600, 1.6, 0.04); },
    hitBlunt(t, d) { osc('sine', 150, 48, t, 0.15, 0.75, d); nz(t, 0.08, 0.45, d, 'lowpass', 1100, 300, 1); },
    hitBlade(t, d) { nz(t, 0.09, 0.45, d, 'bandpass', 2000, 1200, 2); osc('triangle', 320, 110, t, 0.09, 0.3, d); nz(t + 0.02, 0.14, 0.3, d, 'lowpass', 700, 250, 3); },
    hitMetal(t, d) { osc('square', 190, 60, t, 0.1, 0.3, d); osc('sine', 1250, 1180, t, 0.3, 0.12, d); nz(t, 0.06, 0.35, d, 'lowpass', 1400, 400, 1); },
    hitFire(t, d) { nz(t, 0.25, 0.35, d, 'lowpass', 500, 2500, 1, 0.02); osc('sine', 130, 60, t, 0.12, 0.4, d); },
    pistol(t, d) { nz(t, 0.06, 1.0, d, 'bandpass', 2600, 1800, 0.7, 0.001); nz(t, 0.28, 0.85, d, 'lowpass', 1500, 250, 0.7, 0.001); osc('sine', 125, 34, t, 0.26, 0.9, d, 0.001); },
    shotgun(t, d) { nz(t, 0.08, 1.0, d, 'bandpass', 2000, 1200, 0.6, 0.001); nz(t, 0.5, 1.0, d, 'lowpass', 1300, 150, 0.6, 0.001); osc('sine', 95, 28, t, 0.42, 1.0, d, 0.001); nz(t + 0.42, 0.03, 0.25, d, 'bandpass', 3200, 3200, 3); nz(t + 0.55, 0.04, 0.3, d, 'bandpass', 2400, 2400, 3); },
    rifle(t, d) { nz(t, 0.05, 1.0, d, 'bandpass', 3600, 2200, 0.8, 0.001); nz(t, 0.4, 0.9, d, 'lowpass', 1800, 200, 0.6, 0.001); osc('sine', 105, 30, t, 0.36, 0.9, d, 0.001); },
    empty(t, d) { osc('square', 1800, 1700, t, 0.018, 0.2, d); },
    reload(t, d) { nz(t, 0.03, 0.3, d, 'bandpass', 2600, 2600, 3); nz(t + 0.12, 0.14, 0.18, d, 'bandpass', 900, 1600, 2); nz(t + 0.32, 0.03, 0.35, d, 'bandpass', 3000, 3000, 3); },
    bow(t, d) { osc('triangle', 190, 150, t, 0.28, 0.42, d); nz(t, 0.05, 0.25, d, 'highpass', 3000, 3000, 1); nz(t + 0.02, 0.2, 0.15, d, 'bandpass', 900, 2200, 1.5, 0.05); },
    arrowHit(t, d) { osc('sine', 230, 90, t, 0.09, 0.45, d); nz(t, 0.05, 0.3, d, 'lowpass', 1600, 500, 1); },
    groan(t, d, o) { const f = R(80, 118) * (o.pitch || 1), dur = R(0.7, 1.4); voice(t, d, f, f * R(0.72, 0.9), dur, 0.3, [[R(520, 700), 4, 1], [R(1050, 1300), 6, 0.45]], [R(4, 7), R(4, 9)], 0); },
    screech(t, d) { const dur = R(0.4, 0.65); voice(t, d, R(250, 300), R(330, 420), dur, 0.22, [[1400, 2.5, 1], [2600, 4, 0.4]], [11, 14], 3); },
    roar(t, d) { const dur = R(1.0, 1.5); voice(t, d, R(52, 60), R(38, 44), dur, 0.45, [[380, 3, 1], [800, 4, 0.5]], [5, 4], 4); },
    gurgle(t, d) { const dur = R(0.7, 1.0); voice(t, d, R(95, 110), R(80, 90), dur, 0.25, [[480, 5, 1], [950, 6, 0.4]], [17, 18], 1.5); },
    zAttack(t, d, o) { voice(t, d, R(150, 175) * (o.pitch || 1), R(105, 120) * (o.pitch || 1), 0.3, 0.35, [[900, 2.5, 1], [1800, 4, 0.5]], [20, 12], 3); },
    zDie(t, d, o) { voice(t, d, R(110, 130) * (o.pitch || 1), 44, 0.75, 0.35, [[520, 3.5, 1], [1000, 5, 0.4]], [6, 10], 1.5); nz(t + 0.05, 0.25, 0.35, d, 'lowpass', 800, 200, 2); },
    bite(t, d) { nz(t, 0.08, 0.5, d, 'bandpass', 1500, 900, 1.5); nz(t + 0.03, 0.1, 0.3, d, 'highpass', 3000, 2000, 1); },
    hurt(t, d) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(250, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.2); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 2.2; const g = ctx.createGain(); env(g, t, 0.01, 0.22, 0.5); o.connect(bp); bp.connect(g); g.connect(d); o.start(t); o.stop(t + 0.3); osc('sine', 90, 50, t, 0.12, 0.5, d); },
    pickup(t, d) { osc('square', 660, 660, t, 0.05, 0.1, d); osc('square', 990, 990, t + 0.05, 0.07, 0.1, d); },
    eat(t, d) { for (let k = 0; k < 3; k++) nz(t + k * 0.13, 0.05, 0.35, d, 'bandpass', R(2000, 3200), 1500, 1.2); },
    drink(t, d) { for (let k = 0; k < 3; k++) osc('sine', R(240, 280), R(480, 560), t + k * 0.17, 0.08, 0.35, d, 0.01); },
    doorOpen(t, d) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(220, t + 0.2); o.frequency.linearRampToValueAtTime(170, t + 0.4); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 9; const g = ctx.createGain(); env(g, t, 0.05, 0.42, 0.35); o.connect(bp); bp.connect(g); g.connect(d); o.start(t); o.stop(t + 0.5); },
    doorClose(t, d) { osc('sine', 95, 48, t, 0.13, 0.6, d); nz(t, 0.1, 0.4, d, 'lowpass', 500, 200, 1); },
    doorBang(t, d) { osc('sine', 72, 38, t, 0.2, 0.85, d); nz(t, 0.16, 0.55, d, 'lowpass', 650, 180, 1); nz(t + 0.01, 0.07, 0.25, d, 'bandpass', 1900, 1500, 2); },
    glass(t, d) { nz(t, 0.14, 0.5, d, 'highpass', 4200, 3000, 1); for (let k = 0; k < 6; k++) osc('sine', R(2400, 6200), R(2300, 6000), t + R(0, 0.12), R(0.15, 0.45), R(0.05, 0.1), d); },
    chop(t, d) { nz(t, 0.08, 0.6, d, 'bandpass', 720, 500, 2); osc('sine', 250, 140, t, 0.09, 0.45, d); },
    treeFall(t, d) { nz(t, 1.0, 0.45, d, 'lowpass', 300, 1200, 1, 0.3); osc('sine', 70, 35, t + 0.8, 0.35, 0.8, d); nz(t + 0.8, 0.4, 0.5, d, 'lowpass', 900, 200, 1); },
    craft(t, d) { for (let k = 0; k < 2; k++) { osc('sine', 1400, 1380, t + k * 0.18, 0.08, 0.22, d); osc('sine', 2150, 2100, t + k * 0.18, 0.05, 0.12, d); nz(t + k * 0.18, 0.03, 0.25, d, 'bandpass', 2500, 2500, 2); } },
    ui(t, d) { osc('square', 880, 880, t, 0.03, 0.06, d); },
    uiBack(t, d) { osc('square', 620, 620, t, 0.035, 0.06, d); },
    cast(t, d) { nz(t, 0.3, 0.3, d, 'bandpass', 700, 2600, 1.4, 0.06); for (let k = 0; k < 4; k++) nz(t + 0.3 + k * 0.05, 0.015, 0.12, d, 'bandpass', 3500, 3500, 4); },
    plop(t, d) { osc('sine', 720, 170, t, 0.13, 0.35, d); nz(t, 0.09, 0.2, d, 'lowpass', 1600, 500, 1); },
    splash(t, d) { nz(t, 0.25, 0.45, d, 'lowpass', 2400, 500, 1, 0.01); osc('sine', 400, 150, t, 0.1, 0.2, d); },
    catch(t, d) { [523, 659, 784, 1047].forEach((f, k) => osc('square', f, f, t + k * 0.08, 0.09, 0.09, d)); },
    fail(t, d) { osc('square', 300, 190, t, 0.25, 0.08, d); },
    ignite(t, d) { nz(t, 0.7, 0.5, d, 'lowpass', 300, 3200, 1, 0.08); nz(t, 0.12, 0.4, d, 'highpass', 4000, 3000, 1); },
    pop(t, d) { nz(t, 0.035, 0.85, d, 'bandpass', 1600, 1200, 0.8, 0.001); osc('sine', 320, 80, t, 0.05, 0.5, d, 0.001); },
    crackle(t, d) { nz(t, R(0.008, 0.02), R(0.05, 0.25), d, 'bandpass', R(2000, 4500), 2000, 1); },
    heart(t, d) { osc('sine', 58, 40, t, 0.14, 0.7, d); osc('sine', 52, 38, t + 0.24, 0.12, 0.5, d); },
    throw(t, d) { nz(t, 0.14, 0.22, d, 'bandpass', 600, 1800, 1.5, 0.03); },
    sleep(t, d) { [440, 370, 330, 277].forEach((f, k) => osc('triangle', f, f, t + k * 0.3, 0.5, 0.08, d, 0.05)); },
    death(t, d) { voice(t, d, 220, 55, 2.2, 0.3, [[700, 3, 1]], [3, 6], 1); osc('sine', 80, 30, t, 2, 0.4, d, 0.2); },
    eatBad(t, d) { voice(t, d, 160, 90, 0.5, 0.2, [[600, 3, 1]], [9, 8], 2); },
    bush(t, d) { nz(t, 0.25, 0.25, d, 'bandpass', 2200, 1200, 0.8, 0.03); },
  };
  const REV = { pistol: 0.55, shotgun: 0.6, rifle: 0.7, groan: 0.25, roar: 0.3, screech: 0.3, doorBang: 0.3, glass: 0.3, pop: 0.5, treeFall: 0.35 };
  const LOW = new Set(['step', 'crackle', 'ui', 'uiBack', 'bush']);

  function play(name, x, y, v, opts) {
    if (!ctx || !S[name]) return;
    let vv = v == null ? 1 : v, pan = 0;
    if (x != null) {
      const dx = x - L.x, dy = y - L.y, dd = Math.hypot(dx, dy) / TS;
      const maxD = (opts && opts.range) || 24;
      if (dd > maxD) return;
      vv *= Math.pow(1 - dd / maxD, 1.5);
      pan = clamp(dx / (TS * 12), -0.85, 0.85);
    }
    if (vv < 0.012) return;
    if (voices > 26 && LOW.has(name)) return;
    if (voices > 44) return;
    voices++; setTimeout(() => { voices--; }, 700);
    try { S[name](ctx.currentTime + 0.004, out(vv, pan, REV[name] || 0.12), opts || {}); } catch (e) { /* 무시 */ }
  }

  // ── 환경음 ──
  function startAmbient() {
    if (!ctx || amb.wind) return;
    const s = ctx.createBufferSource(); s.buffer = brownBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.16;
    s.connect(f); f.connect(g); g.connect(ambBus); s.start();
    amb.wind = g; amb.windF = f;
    // 저음 드론(배경 음악)
    const dg = ctx.createGain(); dg.gain.value = 0.0; dg.connect(musBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2; lp.connect(dg);
    const oscs = [];
    for (let k = 0; k < 3; k++) { const o = ctx.createOscillator(); o.type = k === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = 55; o.detune.value = (k - 1) * 7; const og = ctx.createGain(); og.gain.value = k === 2 ? 0.5 : 0.22; o.connect(og); og.connect(lp); o.start(); oscs.push(o); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    amb.drone = dg; amb.droneOscs = oscs;
    dg.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 6);
  }
  const CHORDS = [[55, 82.4, 110], [43.65, 65.4, 87.3], [49, 73.4, 98], [41.2, 61.7, 82.4]];
  function ambient(dt, st) {
    if (!ctx || !amb.wind) return;
    const now = ctx.currentTime;
    amb.windF.frequency.setTargetAtTime(330 + 260 * (0.5 + 0.5 * Math.sin(now * 0.13)) + (st.indoor ? -150 : 0), now, 0.8);
    amb.wind.gain.setTargetAtTime(st.indoor ? 0.07 : 0.16, now, 0.6);
    if (now > amb.nextChord) {
      amb.nextChord = now + 14; amb.chord = (amb.chord + 1) % CHORDS.length;
      const ch = CHORDS[amb.chord];
      amb.droneOscs.forEach((o, k) => o.frequency.setTargetAtTime(ch[k], now, 2.5));
    }
    if (st.night) {
      if (now > amb.nextChirp) {
        amb.nextChirp = now + R(0.25, 0.9);
        const d = out(R(0.015, 0.035), R(-0.8, 0.8), 0.1);
        const f = R(4000, 4600);
        for (let k = 0; k < 3; k++) osc('sine', f, f, now + k * 0.045, 0.025, 0.5, d);
      }
    } else if (!st.indoor && now > amb.nextBird) {
      amb.nextBird = now + R(3, 9);
      const d = out(R(0.02, 0.05), R(-0.8, 0.8), 0.2);
      const n = Math.floor(R(2, 4)), base = R(2400, 3400);
      for (let k = 0; k < n; k++) osc('sine', base, base * R(1.2, 1.5), now + k * 0.16, 0.1, 0.4, d, 0.01);
    }
    if (now > amb.nextMoan) {
      amb.nextMoan = now + R(14, 35);
      const d = out(0.05, R(-0.9, 0.9), 0.8);
      S.groan(now, d, { pitch: 0.8 });
    }
  }
  return {
    init, resume, play, ambient, startAmbient, L,
    setVolume(v) { vol = v; if (master) master.gain.value = v; },
    getVolume() { return vol; },
    setMusic(on) { musicOn = on; if (musBus) musBus.gain.value = on ? 0.5 : 0; },
    getMusic() { return musicOn; },
    get ready() { return !!ctx; },
  };
})();
