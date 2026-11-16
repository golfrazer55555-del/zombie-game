'use strict';
/* ===== 시작/메인 루프/화면 전환 ===== */
const Main = (function () {
  let last = 0;
  function setupDemo() {
    G.demo = true; G.paused = false;
    G.setup(defaultSettings(), RND.int(1, 1e9));
    const W = G.world;
    G.player = new Player(W.start.x, W.start.y, 0);
    G.player.dead = true;
    G.spawnInitial();
    G.visA.fill(1);
    G.time = 1440 + 18.6 * 60;
    G.darkness = darknessAt(G.minute());
    const ys = [];
    for (let j = 0; j < 4; j++) ys.push(W.town.y0 + 1 + j * 21);
    G.demoCam = { x: (W.town.x0 + 6) * TS, y: (ys[1] + 1) * TS, ys, k: 1 };
    G.state = 'demo';
    Render.cam.init = false;
    Render.prewarm();
  }
  function demoUpdate(dt) {
    const W = G.world, c = G.demoCam;
    c.x += dt * 16;
    if (c.x > (W.town.x1 - 6) * TS) { c.k = (c.k + 1) % c.ys.length; c.x = (W.town.x0 + 6) * TS; c.y = (c.ys[c.k] + 1) * TS; Render.cam.init = false; }
    G.realT += dt;
    G.time += dt * 0.4;
    G.darkness = darknessAt(G.minute());
    G.player.x = c.x; G.player.y = c.y;
    for (const z of G.zombies) if (Math.abs(z.x - c.x) < 700 && Math.abs(z.y - c.y) < 450) G.updateZombie(z, dt);
    G.updateParts(dt);
  }
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000 || 0.016));
    last = now;
    Input.update();
    try {
      if (G.state === 'demo') demoUpdate(dt);
      else if (!G.paused) G.update(dt);
      if (G.state === 'play' || G.state === 'dead') UI.update(dt);
      if (G.state === 'play' && !G.paused && G.player) SFX.ambient(dt, { night: G.isNight(), indoor: !!G.world.bldAt(Math.floor(G.player.x / TS), Math.floor(G.player.y / TS)) });
      Render.draw(dt);
    } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  }
  function afterStart() {
    Render.cam.init = false;
    Render.prewarm();
    UI.startGameUI();
    SFX.init(); SFX.resume(); SFX.startAmbient();
  }
  function startNew(settings) {
    UI.showScreen('loading');
    setTimeout(() => {
      G.demo = false; G.paused = false;
      try { G.newGame(settings); } catch (e) { console.error(e); setupDemo(); UI.showScreen('title'); UI.toast('세계를 만들지 못했습니다. 다시 시도해 주세요.', 'bad'); return; }
      afterStart();
    }, 50);
  }
  function continueGame() {
    UI.showScreen('loading', '저장된 세계를 불러오는 중');
    setTimeout(() => {
      G.demo = false; G.paused = false;
      if (!G.loadGame()) { setupDemo(); UI.showScreen('title'); return; }
      afterStart();
    }, 50);
  }
  function toTitle() {
    UI.stopGameUI();
    setupDemo();
    UI.showScreen('title');
  }
  function boot(hot) {
    Art.buildChars(); Art.buildNature(); Art.buildStructs(); Art.buildIcons(); Art.buildUiIcons();
    const cv = document.getElementById('game');
    Render.init(cv);
    UI.init();
    Input.init(cv);
    window.addEventListener('resize', () => Render.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => { Render.resize(); UI.resizeU(); }, 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
    window.addEventListener('pagehide', () => G.save());
    document.addEventListener('gesturestart', e => e.preventDefault());
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) { Input.touchMode = true; UI.setTouch(true); }
    if (hot && hot.save) {
      try { G.demo = false; G.loadData(hot.save); afterStart(); } catch (e) { console.error(e); setupDemo(); UI.showScreen('title'); }
    } else { setupDemo(); UI.showScreen('title'); }
    requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
  }
  return { boot, startNew, continueGame, toTitle };
})();

// 설치형 앱(PWA): 웹 서버에서 열었을 때만 서비스 워커 등록
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.claude && /\/(index\.html)?$/.test(location.pathname)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* 무시 */ }); });
}
(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try { hot.snapshot(() => (G.state === 'play' && G.player && !G.player.dead ? { save: G.serialize() } : {})); } catch (e) { /* 무시 */ }
  }
  const go = (data) => Main.boot(data || {});
  if (hot && typeof hot.ready === 'function') hot.ready(go);
  else go(hot && hot.data ? hot.data : {});
})();
