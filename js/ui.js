'use strict';
/* ===== UI: HUD, 가방, 제작, 보관함, 지도, 메뉴, 터치 조작 ===== */
const UI = (function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const prefs = { shake: true, vol: 0.8, music: true };
  try { Object.assign(prefs, JSON.parse(Store.get(PREF_KEY) || '{}')); } catch (e) { /* 무시 */ }
  const savePrefs = () => Store.set(PREF_KEY, JSON.stringify(prefs));
  let panel = null, screen = null, prevScreen = null;
  let invDirty = true, hudT = 0, lastSel = -1, lastPrompt = '', lastLabel = '';
  let invSel = null, craftCat = 'all', craftSel = null, craftFire = null, contObj = null;
  let mapCv = null, mapCtx = null, mapImg = null, mapDirty = false;
  let newSet = null, drag = null, touchOn = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDays = d => `${Math.floor(d)}일 ${Math.floor((d % 1) * 24)}시간`;
  const timeStr = () => { const m = G.minute(); return fmt2(m / 60) + ':' + fmt2(m % 60); };

  /* ───── 크기 단위 ───── */
  function resizeU() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    const target = clamp(Math.min(vw, vh) / 520, 1, 2.4);
    const k = Math.max(1, Math.round(target * dpr));
    const u = k / dpr;
    document.documentElement.style.setProperty('--u', u + 'px');
    document.documentElement.classList.toggle('portrait', vh > vw * 1.1);
  }

  /* ───── 초기화 ───── */
  function init() {
    const app = $('#app');
    app.insertAdjacentHTML('beforeend', `
      <div id="hud" hidden>
        <div id="hud-tl" class="hud-box">
          ${['hp', 'hunger', 'thirst', 'sleep'].map(k => `<div class="stat" data-k="${k}"><img src="${Art.ui[k]}" alt=""><div class="bar ${k}"><i></i></div></div>`).join('')}
          <div id="chips"></div>
        </div>
        <div id="hud-tr">
          <div id="clock" class="hud-box"><img id="clock-ic" src="${Art.ui.sun}" alt=""><span id="clock-day"></span><span id="clock-time"></span></div>
          <canvas id="minimap" width="96" height="96"></canvas>
          <div id="hud-btns">
            <button class="hbtn" id="b-inv" title="가방 (I)"><img src="${Art.btn.bag}" alt="가방"><span class="key">I</span></button>
            <button class="hbtn" id="b-craft" title="제작 (C)"><img src="${Art.btn.craft}" alt="제작"><span class="key">C</span></button>
            <button class="hbtn" id="b-map" title="지도 (M)"><img src="${Art.btn.map}" alt="지도"><span class="key">M</span></button>
            <button class="hbtn" id="b-pause" title="일시정지 (Esc)"><img src="${Art.btn.pause}" alt="일시정지"><span class="key">Esc</span></button>
          </div>
        </div>
        <div id="hud-bottom">
          <div id="prompt" hidden></div>
          <div id="held-info"></div>
          <div id="hotbar"></div>
        </div>
        <div id="toasts"></div>
      </div>
      <div id="touch" hidden>
        <div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div>
        <div id="tbtns">
          <button id="t-attack" class="tbtn big"><img src="${Art.btn.fist}" alt=""><span>공격</span></button>
          <button id="t-interact" class="tbtn mid"><img src="${Art.btn.hand}" alt=""><span>상호작용</span></button>
          <button id="t-run" class="tbtn small"><img src="${Art.btn.run}" alt=""><span>달리기</span></button>
          <button id="t-reload" class="tbtn small" hidden><img src="${Art.btn.reload}" alt=""><span>장전</span></button>
          <button id="t-light" class="tbtn small" hidden><img src="${Art.btn.light}" alt=""><span>손전등</span></button>
        </div>
      </div>
      <div id="panel" class="panel" hidden></div>
      <div id="fishbar" hidden><div class="lbl">초록 구간에서 누르세요!</div><div class="track"><div class="zone"></div><div class="cursor"></div></div></div>
      <div id="sleep-ui" hidden><div class="zz">잠자는 중...</div><div id="sleep-time"></div><button id="b-wake" class="btn">일어나기</button></div>
      <div id="screen" class="screen" hidden></div>
      <div id="confirm" class="screen" hidden></div>
      <div id="drag-ghost" hidden></div>`);
    $('#b-inv').onclick = () => toggle('inv');
    $('#b-craft').onclick = () => toggle('craft');
    $('#b-map').onclick = () => toggle('map');
    $('#b-pause').onclick = () => pause();
    $('#b-wake').onclick = () => G.wake();
    $('#panel').addEventListener('click', onPanelClick);
    $('#panel').addEventListener('pointerdown', onPanelDown);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    $('#hotbar').addEventListener('pointerdown', e => { const s = e.target.closest('.slot'); if (!s) return; e.preventDefault(); selectHot(+s.dataset.i); });
    $('#screen').addEventListener('click', onScreenClick);
    $('#screen').addEventListener('input', onScreenInput);
    $('#confirm').addEventListener('click', onConfirmClick);
    bindTouch();
    mapCv = document.createElement('canvas');
    resizeU();
    window.addEventListener('resize', resizeU);
    SFX.setVolume(prefs.vol); SFX.setMusic(prefs.music);
  }

  /* ───── 화면(타이틀 등) ───── */
  function showScreen(name, data) {
    const s = $('#screen');
    prevScreen = screen; screen = name;
    if (!name) { s.hidden = true; s.innerHTML = ''; return; }
    s.hidden = false;
    s.className = 'screen scr-' + name;
    if (name === 'title') {
      const has = G.hasSave(), best = +(Store.get(BEST_KEY) || 0);
      s.innerHTML = `<div class="title-wrap">
        <div class="logo"><canvas id="logo1"></canvas><canvas id="logo2"></canvas></div>
        <p class="tag">레벨업은 없다. 뒤지고, 낚고, 만들고, 버텨라.</p>
        <div class="menu">
          ${has ? '<button class="btn primary" data-act="continue">이어하기</button>' : ''}
          <button class="btn ${has ? '' : 'primary'}" data-act="new">새 게임</button>
          <button class="btn" data-act="help">조작법·도움말</button>
          <button class="btn" data-act="settings">설정</button>
        </div>
        <p class="best">${best ? '최고 기록 · ' + fmtDays(best) + ' 생존' : '컴퓨터와 모바일 모두 지원'}</p>
      </div>`;
      drawLogo();
    } else if (name === 'new') {
      if (!newSet) { newSet = defaultSettings(); try { const last = JSON.parse(Store.get(PREF_KEY + '_ng') || 'null'); if (last) Object.assign(newSet, last); } catch (e) { /* 무시 */ } newSet.seed = ''; }
      renderNew();
    } else if (name === 'pause') {
      s.innerHTML = `<div class="menu-box"><h2>일시정지</h2><p class="muted">${G.day()}일차 · ${timeStr()}</p>
        <button class="btn primary" data-act="resume">계속하기</button>
        <button class="btn" data-act="save">저장하기</button>
        <button class="btn" data-act="help">조작법·도움말</button>
        <button class="btn" data-act="settings">설정</button>
        <button class="btn" data-act="quit">저장하고 타이틀로</button></div>`;
    } else if (name === 'settings') {
      s.innerHTML = `<div class="menu-box"><h2>설정</h2>
        <div class="opt"><label for="vol">효과음 볼륨</label><input id="vol" type="range" min="0" max="100" value="${Math.round(prefs.vol * 100)}"></div>
        <div class="opt"><label>배경음</label><div class="seg">${seg('music', prefs.music)}</div></div>
        <div class="opt"><label>화면 흔들림</label><div class="seg">${seg('shake', prefs.shake)}</div></div>
        ${fsOk() ? `<button class="btn" data-act="fullscreen">${document.fullscreenElement ? '전체 화면 끄기' : '전체 화면'}</button>` : ''}
        <button class="btn" data-act="back">뒤로</button></div>`;
    } else if (name === 'help') {
      s.innerHTML = `<div class="help"><h2>조작법</h2>
        <div class="cols"><div><h3>컴퓨터</h3><dl>
          <dt>WASD · 방향키</dt><dd>이동</dd><dt>Shift</dt><dd>달리기 (발소리가 커진다)</dd><dt>마우스</dt><dd>조준</dd>
          <dt>왼쪽 클릭 · Space</dt><dd>공격 / 들고 있는 물건 사용</dd><dt>E · 오른쪽 클릭</dt><dd>줍기, 열기, 문, 잠자기</dd>
          <dt>R</dt><dd>재장전</dd><dt>F</dt><dd>손전등 켜기/끄기</dd><dt>1~6 · 휠</dt><dd>핫바 선택</dd>
          <dt>I · Tab</dt><dd>가방</dd><dt>C</dt><dd>제작</dd><dt>M</dt><dd>지도</dd><dt>Esc</dt><dd>창 닫기 / 일시정지</dd></dl></div>
        <div><h3>모바일</h3><dl>
          <dt>왼쪽 화면 끌기</dt><dd>이동</dd><dt>공격 버튼</dt><dd>누르면 가까운 좀비를 자동 조준, 누른 채 끌면 그 방향으로 조준</dd>
          <dt>손 버튼</dt><dd>상호작용 (버튼에 할 일이 표시됨)</dd><dt>달리기</dt><dd>켜고 끄는 버튼</dd><dt>아래 핫바</dt><dd>눌러서 들 물건 선택</dd></dl></div></div>
        <h2>생존 수칙</h2><ul>
          <li>소리는 좀비를 부른다. 총소리는 아주 멀리 퍼지고, 달릴 때 발소리도 들린다. 빈 병이나 폭죽을 던지면 좀비를 다른 곳으로 꾀어낼 수 있다.</li>
          <li>밤에는 시야가 좁아진다. 손전등은 앞을 밝혀 주지만 좀비 눈에도 잘 띈다.</li>
          <li>호수 물을 그냥 마시면 병에 걸리기 쉽다. 빈 병에 물을 담아 모닥불에서 끓이자.</li>
          <li>물리면 피가 날 수 있다. 천 조각 2개로 붕대를 만들어 지혈하자.</li>
          <li>낚싯대를 들고 물을 바라보며 사용한다. 찌가 흔들리면 누르고, 막대가 초록 구간에 오면 한 번 더 누른다.</li>
          <li>닫힌 문은 좀비가 부수는 데 시간이 걸린다. 깨진 창문과 부서진 문틀엔 바리케이드를 설치하고, 망치로 수리하자.</li>
          <li>피로가 쌓이면 침대나 침낭에서 자자. 근처에 좀비가 있으면 잠들 수 없다.</li>
          <li>도끼로 나무를 베면 통나무가, 덤불에선 나뭇가지와 산딸기가 나온다. 씨앗을 심으면 하루 반 뒤에 수확한다.</li>
          <li>레벨업과 업그레이드는 없다. 찾은 물건과 만든 도구만으로 살아남아야 한다.</li>
        </ul><button class="btn" data-act="back">뒤로</button></div>`;
    } else if (name === 'loading') {
      s.innerHTML = `<div class="menu-box loading"><h2>세계를 만드는 중...</h2><p class="muted">${esc(data || '마을과 숲, 호수를 배치하고 있습니다')}</p></div>`;
    } else if (name === 'over') {
      const st = data.stats;
      s.innerHTML = `<div class="over"><h1>사망</h1><p class="days">${fmtDays(data.days)} 생존</p><p class="cause">사인: ${esc(data.cause || '알 수 없음')}</p>
        <div class="stats"><div><b>${st.kills}</b><span>처치한 좀비</span></div><div><b>${st.fish}</b><span>낚은 물고기</span></div><div><b>${st.crafted}</b><span>만든 물건</span></div><div><b>${st.meals}</b><span>먹고 마신 횟수</span></div></div>
        <p class="best">최고 기록 · ${fmtDays(data.best)}</p>
        <div class="row"><button class="btn primary" data-act="retry">같은 설정으로 다시</button><button class="btn" data-act="title">타이틀로</button></div></div>`;
    }
  }
  function fsOk() { return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen); }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else { const r = document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (r && r.catch) r.catch(() => toast('이 화면에서는 전체 화면을 쓸 수 없습니다.', 'warn')); }
    } catch (e) { /* 무시 */ }
  }
  function seg(k, on) { return `<button class="${on ? 'on' : ''}" data-pref="${k}" data-v="1">켜기</button><button class="${!on ? 'on' : ''}" data-pref="${k}" data-v="0">끄기</button>`; }
  function presetIdx() { for (let i = 0; i < PRESETS.length; i++) { const v = PRESETS[i].v; if (Object.keys(v).every(k => newSet[k] === v[k])) return i; } return -1; }
  function renderNew() {
    const s = $('#screen'), pi = presetIdx();
    s.innerHTML = `<div class="ng"><h2>새 게임</h2>
      <p class="muted">난이도는 시작할 때 정한 그대로 끝까지 유지됩니다.</p>
      <div class="presets">${PRESETS.map((p, i) => `<button class="chip ${pi === i ? 'on' : ''}" data-preset="${i}">${p.name}</button>`).join('')}<span class="chip ghost ${pi < 0 ? 'on' : ''}">사용자 지정</span></div>
      <div class="opts">${OPTIONS.map(o => `<div class="opt"><label>${o.label}</label><div class="seg">${o.vals.map((v, j) => `<button class="${newSet[o.k] === j ? 'on' : ''}" data-opt="${o.k}" data-v="${j}">${v}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="opt look"><label>생존자</label><div class="looks">${LOOKS.map((l, i) => `<button class="lookbtn ${newSet.look === i ? 'on' : ''}" data-look="${i}"><canvas data-lookcv="${i}" width="16" height="20"></canvas><span>${l.name}</span></button>`).join('')}</div></div>
      <div class="opt"><label for="seed-in">세계 시드</label><input id="seed-in" type="text" maxlength="24" placeholder="비우면 무작위" value="${esc(newSet.seed || '')}" autocomplete="off"></div>
      <div class="row"><button class="btn" data-act="back">뒤로</button><button class="btn primary" data-act="start">시작하기</button></div></div>`;
    $$('canvas[data-lookcv]', s).forEach(c => { const set = Art.playerSet(+c.dataset.lookcv, false); c.getContext('2d').drawImage(set.f[0][0], 0, 0); });
  }
  function onScreenInput(e) {
    if (e.target.id === 'vol') { prefs.vol = e.target.value / 100; SFX.setVolume(prefs.vol); savePrefs(); }
    if (e.target.id === 'seed-in' && newSet) newSet.seed = e.target.value;
  }
  function onScreenClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    SFX.init(); SFX.resume();
    SFX.play('ui', null, null, 0.6);
    if (b.dataset.preset != null) { Object.assign(newSet, PRESETS[+b.dataset.preset].v); renderNew(); return; }
    if (b.dataset.opt) { newSet[b.dataset.opt] = +b.dataset.v; renderNew(); return; }
    if (b.dataset.look != null) { newSet.look = +b.dataset.look; renderNew(); return; }
    if (b.dataset.pref) { prefs[b.dataset.pref] = b.dataset.v === '1'; savePrefs(); SFX.setMusic(prefs.music); showScreen('settings'); return; }
    const act = b.dataset.act;
    if (!act) return;
    if (act === 'new') { if (G.hasSave()) confirmBox('새 게임을 시작하면 지금 저장된 진행이 사라집니다.', '새로 시작', () => showScreen('new')); else showScreen('new'); }
    else if (act === 'continue') Main.continueGame();
    else if (act === 'help' || act === 'settings') { const back = screen; showScreen(act); $('#screen').dataset.back = back; }
    else if (act === 'back') { const back = $('#screen').dataset.back || (G.state === 'play' ? 'pause' : 'title'); showScreen(screen === 'new' ? 'title' : back); }
    else if (act === 'start') { const sd = (($('#seed-in') || {}).value || '').trim(); newSet.seed = sd; const keep = Object.assign({}, newSet); delete keep.seed; Store.set(PREF_KEY + '_ng', JSON.stringify(keep)); Main.startNew(Object.assign({}, newSet)); }
    else if (act === 'resume') resume();
    else if (act === 'fullscreen') { toggleFullscreen(); setTimeout(() => { if (screen === 'settings') showScreen('settings'); }, 300); }
    else if (act === 'save') { const ok = G.save(); resume(); toast(ok ? '저장했습니다.' : '저장할 수 없습니다 (브라우저 저장소가 막혀 있음).', ok ? 'good' : 'warn'); }
    else if (act === 'quit') { G.save(); Main.toTitle(); }
    else if (act === 'retry') Main.startNew(Object.assign({}, G.settings, { seed: '' }));
    else if (act === 'title') Main.toTitle();
  }
  function confirmBox(msg, okLabel, onOk) {
    const c = $('#confirm');
    c.hidden = false;
    c.innerHTML = `<div class="menu-box"><p>${esc(msg)}</p><div class="row"><button class="btn" data-c="no">취소</button><button class="btn primary" data-c="ok">${esc(okLabel)}</button></div></div>`;
    c._ok = onOk;
  }
  function onConfirmClick(e) { const b = e.target.closest('button'); if (!b) return; const c = $('#confirm'); c.hidden = true; if (b.dataset.c === 'ok' && c._ok) c._ok(); }

  /* 로고: 픽셀 폰트로 그린 뒤 픽셀 단위로 가공 */
  function drawLogo() {
    const mk = (id, text, size, grad, drip) => {
      const cv = $('#' + id); if (!cv) return;
      const t = document.createElement('canvas'), c = t.getContext('2d');
      c.font = `700 ${size}px Galmuri11, sans-serif`;
      const w = Math.ceil(c.measureText(text).width) + 6, h = size + 8;
      t.width = w; t.height = h;
      c.font = `700 ${size}px Galmuri11, sans-serif`; c.textBaseline = 'top'; c.fillStyle = '#fff';
      c.fillText(text, 3, 2);
      const src = c.getImageData(0, 0, w, h).data;
      const g = new PG(w, h + (drip ? 5 : 1));
      const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 110;
      let top = h, bot = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) g.set(x + 1, y + 1, '#3a0808');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { const k = (y - top) / Math.max(1, bot - top); g.set(x, y, mix(grad[0], grad[1], k)); if (!on(x, y - 1)) g.set(x, y, grad[2]); }
      if (drip) { const r = makeRng(7); for (let x = 0; x < w; x++) if (on(x, bot) && r() < 0.28) { const L = r.int(1, 4); for (let k = 1; k <= L; k++) g.set(x, bot + k, k === L ? '#c02020' : '#901414'); } }
      g.outline('#0c0a08');
      cv.width = g.w; cv.height = g.h;
      cv.getContext('2d').drawImage(g.canvas(), 0, 0);
      cv.style.setProperty('--w', g.w); cv.style.setProperty('--h', g.h);
    };
    const go = () => { mk('logo1', '좀비', 12, ['#d6e2b0', '#6f8f3a', '#f0f6d8'], true); mk('logo2', '생존 일지', 12, ['#ece4cc', '#b8a888', '#ffffff'], false); };
    if (document.fonts && document.fonts.load) document.fonts.load('700 12px Galmuri11').then(go, go); else go();
  }

  /* ───── HUD ───── */
  function hotbarHTML() {
    const p = G.player;
    let h = '';
    for (let i = 0; i < 6; i++) h += slotHTML(p.inv[i], `data-i="${i}"`, `<span class="hk">${i + 1}</span>`, i === p.sel ? 'sel' : '');
    return h;
  }
  function slotHTML(it, attrs, extra, cls) {
    if (!it) return `<div class="slot empty ${cls || ''}" ${attrs}>${extra || ''}</div>`;
    const def = ITEMS[it.id];
    let bar = '';
    if (def.gun) bar = `<b class="ammo">${it.d || 0}/${def.gun.mag}</b>`;
    else if (it.d != null && def.dur) bar = `<i class="dur" style="--v:${clamp(it.d / def.dur, 0, 1).toFixed(2)}"></i>`;
    return `<div class="slot ${cls || ''}" ${attrs} title="${esc(def.name)}"><img src="${Art.icon[it.id].url}" alt="${esc(def.name)}" draggable="false">${it.n > 1 ? `<b class="n">${it.n}</b>` : ''}${bar}${extra || ''}</div>`;
  }
  function selectHot(i) {
    const p = G.player; if (!p) return;
    if (p.sel !== i) { p.sel = i; p.swing = null; SFX.play('ui', null, null, 0.4); }
    invDirty = true;
  }
  function cycleHotbar(d) { const p = G.player; if (!p) return; selectHot((p.sel + d + 6) % 6); }
  function updateHUD() {
    const p = G.player;
    if (!p) return;
    const set = (k, v) => { const b = $(`.bar.${k} i`); if (b) b.style.setProperty('--v', clamp(v / 100, 0, 1).toFixed(3)); const st = $(`.stat[data-k="${k}"]`); if (st) st.classList.toggle('low', v < 25); };
    set('hp', p.hp); set('hunger', p.hunger); set('thirst', p.thirst); set('sleep', p.energy);
    const chips = [];
    if (p.bleed > 0) chips.push(['bleed', '출혈']);
    if (p.sick > 0) chips.push(['sick', '병']);
    if (p.grab > 0) chips.push(['bleed', '붙잡힘']);
    if (p.energy < 20) chips.push(['sleep', '피곤함']);
    if (p.hunger < 20) chips.push(['hunger', '배고픔']);
    if (p.thirst < 20) chips.push(['thirst', '목마름']);
    if (p.armor() > 0) chips.push(['armor', '방어 ' + Math.round(p.armor() * 100) + '%']);
    const ch = chips.map(c => `<span class="chip-s ${c[0]}"><img src="${Art.ui[c[0]]}" alt="">${c[1]}</span>`).join('');
    const ce = $('#chips'); if (ce._h !== ch) { ce.innerHTML = ch; ce._h = ch; }
    $('#clock-day').textContent = `${G.day()}일차`;
    $('#clock-time').textContent = timeStr();
    const night = G.darkness > 0.5;
    const ic = night ? Art.ui.moon : Art.ui.sun;
    const ci = $('#clock-ic'); if (ci._s !== ic) { ci.src = ic; ci._s = ic; }
    // 들고 있는 물건
    const it = p.held();
    let info = '';
    if (it) {
      const def = ITEMS[it.id];
      info = esc(def.name);
      if (def.gun) info += ` <b>${it.d || 0}/${def.gun.mag}</b> <span class="muted">(${p.count(def.gun.ammo)})</span>`;
      else if (it.id === 'flashlight' || it.id === 'torch') info += ` <span class="muted">${Math.round(it.d)}%</span>`;
      else if (def.dur) info += ` <span class="muted">${Math.max(0, Math.round(it.d / def.dur * 100))}%</span>`;
      if (p.reload > 0) info += ' <span class="warn">장전 중...</span>';
    } else info = '<span class="muted">맨손</span>';
    const hi = $('#held-info'); if (hi._h !== info) { hi.innerHTML = info; hi._h = info; }
    // 상호작용 안내
    const ia = G.interact;
    let pr = '';
    if (ia && !p.action) pr = ia.act === 'none' ? esc(ia.label) : (touchOn ? '' : '<kbd>E</kbd> ') + esc(ia.label);
    if (p.action && p.action.type === 'search') pr = '뒤지는 중...';
    if (p.action && p.action.type === 'fish') pr = p.action.state === 'wait' ? '입질을 기다리는 중... (사용 버튼: 줄 감기)' : p.action.state === 'bite' ? '입질이다! 지금 누르세요!' : '';
    const pe = $('#prompt');
    if (pr !== lastPrompt) { pe.innerHTML = pr; pe.hidden = !pr; lastPrompt = pr; }
    // 터치 버튼
    if (touchOn) {
      const lab = G.primaryLabel();
      const ab = $('#t-attack');
      const src = it ? Art.icon[it.id].url : Art.btn.fist;
      if (ab._s !== src) { ab.querySelector('img').src = src; ab._s = src; }
      if (lastLabel !== lab) { ab.querySelector('span').textContent = lab; lastLabel = lab; }
      const ib = $('#t-interact');
      const il = ia && ia.act !== 'none' ? ia.label.split(' · ')[0] : '상호작용';
      if (ib._l !== il) { ib.querySelector('span').textContent = il; ib._l = il; }
      ib.classList.toggle('dim', !ia || ia.act === 'none');
      $('#t-run').classList.toggle('on', Input.sprintToggle);
      const rb = $('#t-reload'); rb.hidden = !(it && ITEMS[it.id].gun);
      const lb = $('#t-light'); lb.hidden = !p.inv.some(s => s && s.id === 'flashlight'); lb.classList.toggle('on', p.light);
    }
    if (p.sleeping) $('#sleep-time').textContent = `${G.day()}일차 ${timeStr()}`;
    drawMinimap();
  }
  function update(dt) {
    if (G.state !== 'play' && G.state !== 'dead') return;
    hudT -= dt;
    if (invDirty || lastSel !== G.player.sel) {
      $('#hotbar').innerHTML = hotbarHTML(); lastSel = G.player.sel;
      if (panel === 'inv' || panel === 'cont') renderPanel();
      if (panel === 'craft') renderPanel(true);
      invDirty = false;
    }
    if (hudT <= 0) { hudT = 0.1; updateHUD(); }
    if (panel === 'cont' && contObj) {
      const p = G.player, o = contObj;
      const ow = o.w || 1, oh = o.h || 1;
      const nx = clamp(p.x, o.x * TS, (o.x + ow) * TS), ny = clamp(p.y, o.y * TS, (o.y + oh) * TS);
      if (dist(p.x, p.y, nx, ny) > 34) close();
    }
    if (panel === 'craft' && craftFire && dist(G.player.x, G.player.y, craftFire.x * TS + 8, craftFire.y * TS + 8) > 48) { craftFire = null; renderPanel(true); }
    if (G.fishGame) { const fg = G.fishGame, pos = 0.5 + 0.5 * Math.sin(fg.t * fg.speed * Math.PI); $('#fishbar .cursor').style.left = (pos * 100) + '%'; }
    for (const t of $$('#toasts .toast')) { t._t -= dt; if (t._t <= 0 && !t.classList.contains('out')) { t.classList.add('out'); setTimeout(() => t.remove(), 400); } }
  }
  function toast(msg, kind) {
    const box = $('#toasts');
    if (!box) return;
    const last = box.lastElementChild;
    if (last && last._m === msg && !last.classList.contains('out')) { last._t = 3; last._c = (last._c || 1) + 1; last.querySelector('.c').textContent = 'x' + last._c; return; }
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = `<span>${esc(msg)}</span><span class="c"></span>`;
    d._t = kind === 'big' ? 4.2 : kind === 'hint' ? 6 : 3.2; d._m = msg;
    box.appendChild(d);
    while (box.children.length > 5) box.firstElementChild.remove();
  }

  /* ───── 미니맵/지도 ───── */
  function tileColor(x, y) {
    const W = G.world, i = W.idx(x, y), b = W.bld[i];
    if (b >= 0) { const c = C(W.buildings[b].roofCol); return [c[0], c[1], c[2]]; }
    if (W.wall[i] === WL.FENCE) return [120, 92, 60];
    const o = W.obj[i];
    if (o) { if (o.k === 'tree') return [36, 70, 36]; if (o.k === 'furn' && /car/.test(o.f)) return [140, 70, 64]; }
    switch (W.ter[i]) {
      case T.GRASS: return [70, 106, 54]; case T.DIRT: return [122, 92, 60]; case T.SAND: return [196, 176, 126]; case T.WATER: return [58, 108, 150]; case T.DEEP: return [40, 80, 126];
      case T.ROAD: return [54, 56, 62]; case T.WALK: return [126, 126, 128]; case T.LOT: return [76, 78, 82]; case T.SOIL: return [92, 62, 40]; case T.DOCK: return [140, 104, 66]; default: return [110, 110, 110];
    }
  }
  function onWorld() {
    const W = G.world;
    mapCv.width = W.W; mapCv.height = W.H; mapCtx = mapCv.getContext('2d');
    mapImg = mapCtx.createImageData(W.W, W.H);
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) { const i = (y * W.W + x) * 4; mapImg.data[i + 3] = 255; mapImg.data[i] = 8; mapImg.data[i + 1] = 9; mapImg.data[i + 2] = 12; if (W.explored[W.idx(x, y)]) mapPixel(x, y); }
    mapDirty = true;
    invDirty = true;
  }
  function mapPixel(x, y) {
    if (!mapImg) return;
    const c = tileColor(x, y), i = (y * G.world.W + x) * 4;
    mapImg.data[i] = c[0]; mapImg.data[i + 1] = c[1]; mapImg.data[i + 2] = c[2]; mapImg.data[i + 3] = 255;
    mapDirty = true;
  }
  function flushMap() { if (mapDirty && mapCtx) { mapCtx.putImageData(mapImg, 0, 0); mapDirty = false; } }
  function drawMinimap() {
    const cv = $('#minimap'); if (!cv || !mapCtx) return;
    flushMap();
    const c = cv.getContext('2d'), p = G.player;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#08090c'; c.fillRect(0, 0, 96, 96);
    const ptx = p.x / TS, pty = p.y / TS;
    c.drawImage(mapCv, Math.floor(ptx) - 24, Math.floor(pty) - 24, 48, 48, 0, 0, 96, 96);
    c.fillStyle = '#ffffff'; c.fillRect(46, 46, 4, 4);
    c.fillStyle = '#ffe070'; c.fillRect(Math.round(48 + Math.cos(p.face) * 5) - 1, Math.round(48 + Math.sin(p.face) * 5) - 1, 2, 2);
  }
  function renderMap() {
    const W = G.world, p = G.player;
    flushMap();
    const lm = W.landmarks.filter(l => W.explored[W.idx(l.x, l.y)]);
    return `<div class="panel-head"><h2>지도</h2><span class="sub">돌아다닌 곳만 표시됩니다</span><button class="x" data-close>닫기</button></div>
      <div class="map-wrap"><div class="map-box"><canvas id="bigmap" width="${W.W}" height="${W.H}"></canvas>
      ${lm.map(l => `<span class="lm" style="left:${(l.x + 0.5) / W.W * 100}%;top:${(l.y + 0.5) / W.H * 100}%">${esc(l.name)}</span>`).join('')}
      <span class="me" style="left:${p.x / TS / W.W * 100}%;top:${p.y / TS / W.H * 100}%"></span></div></div>`;
  }

  /* ───── 패널 ───── */
  function toggle(name) {
    if (G.state !== 'play' || screen) return;
    if (G.player.sleeping) return;
    if (panel === name) close(); else open(name);
  }
  function open(name, opt) {
    panel = name;
    if (name === 'craft') { craftFire = opt && opt.fire ? opt.fire : null; if (opt && opt.cat) craftCat = opt.cat; }
    const el = $('#panel');
    el.hidden = false; el.className = 'panel p-' + name;
    renderPanel();
    SFX.play('ui', null, null, 0.5);
    Input.releaseAll();
  }
  function close() {
    if (!panel) return;
    if (panel === 'cont' && contObj) { G.world.modified(contObj); contObj = null; }
    panel = null; craftFire = null;
    const el = $('#panel'); el.hidden = true; el.innerHTML = '';
    SFX.play('uiBack', null, null, 0.4);
  }
  function renderPanel(soft) {
    const el = $('#panel');
    if (!panel) return;
    const keepScroll = el.querySelector('.list') ? el.querySelector('.list').scrollTop : 0;
    if (panel === 'inv') el.innerHTML = renderInv();
    else if (panel === 'craft') el.innerHTML = renderCraft();
    else if (panel === 'cont') el.innerHTML = renderCont();
    else if (panel === 'map') {
      el.innerHTML = renderMap();
      const c = $('#bigmap').getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(mapCv, 0, 0);
    }
    const l = el.querySelector('.list'); if (l && soft) l.scrollTop = keepScroll;
  }
  // 가방
  function renderInv() {
    const p = G.player, size = p.invSize();
    const used = p.inv.filter(Boolean).length;
    let grid = '';
    for (let i = 0; i < size; i++) grid += slotHTML(p.inv[i], `data-i="${i}"`, i < 6 ? `<span class="hk">${i + 1}</span>` : '', (invSel && invSel.where === 'inv' && invSel.i === i ? 'picked ' : '') + (i === p.sel ? 'sel' : ''));
    const eq = (k, lab) => slotHTML(p.equip[k], `data-eq="${k}"`, '', invSel && invSel.where === 'eq' && invSel.slot === k ? 'picked' : '') + `<label>${lab}</label>`;
    let it = null;
    if (invSel) it = invSel.where === 'inv' ? p.inv[invSel.i] : p.equip[invSel.slot];
    return `<div class="panel-head"><h2>가방</h2><span class="sub">${used}/${size}칸 · 끌어서 옮기기</span><button class="x" data-close>닫기</button></div>
      <div class="inv-wrap"><div class="inv-left">
        <div class="equip"><div class="eq">${eq('bag', '가방')}</div><div class="eq">${eq('body', '옷')}</div>
          <div class="eq-stats"><span>방어 ${Math.round(p.armor() * 100)}%</span><span>체력 ${Math.round(p.hp)}</span><span>배고픔 ${Math.round(p.hunger)} · 갈증 ${Math.round(p.thirst)} · 피로 ${Math.round(100 - p.energy)}</span></div></div>
        <div class="grid">${grid}</div></div>
        <div class="detail">${it ? detailHTML(it) : '<p class="muted">물건을 누르면 자세한 정보와 사용 버튼이 나옵니다.</p><p class="muted">앞의 6칸은 핫바입니다. 핫바에서 고른 물건을 손에 듭니다.</p>'}</div></div>`;
  }
  function detailHTML(it) {
    const def = ITEMS[it.id], p = G.player;
    const L = [];
    if (def.melee && def.cat === 'melee') L.push(`공격력 ${def.melee.dmg} · 속도 ${(1 / def.melee.cd).toFixed(1)}회/초`);
    if (def.gun) L.push(`공격력 ${def.gun.dmg}${def.gun.pellets > 1 ? '×' + def.gun.pellets : ''} · 장탄 ${it.d || 0}/${def.gun.mag} · ${ITEMS[def.gun.ammo].name} ${p.count(def.gun.ammo)}개`);
    if (def.food) { const f = def.food, s = []; if (f.h) s.push(`배고픔 ${f.h > 0 ? '+' : ''}${f.h}`); if (f.t) s.push(`갈증 ${f.t > 0 ? '+' : ''}${f.t}`); if (f.e) s.push(`기운 +${f.e}`); if (f.sick) s.push(`<span class="bad">병 위험 ${Math.round(f.sick * 100)}%</span>`); L.push(s.join(' · ')); }
    if (def.wear) L.push(def.wear.slots ? `가방 칸 +${def.wear.slots}` : `받는 피해 -${Math.round(def.wear.armor * 100)}%`);
    if (it.d != null && def.dur && !def.gun) L.push(`${def.nodur ? '남은 양' : '내구도'} ${Math.max(0, Math.round(it.d))}/${def.dur}`);
    const acts = [];
    const where = invSel.where;
    if (where === 'eq') acts.push(['unequip', '벗기']);
    else {
      if (def.food) acts.push(['use', def.drink ? '마시기' : '먹기']);
      if (def.med) acts.push(['use', '사용']);
      if (def.battery) acts.push(['use', '손전등 충전']);
      if (it.id === 'tape') acts.push(['use', '무기 수리']);
      if (def.tool === 'sleepbag') acts.push(['use', '잠자기']);
      if (def.wear) acts.push(['equip', '착용']);
      if (it.id === 'flashlight') acts.push(['light', p.light ? '끄기' : '켜기']);
      if (invSel.i !== p.sel) acts.push(['hold', invSel.i < 6 ? '손에 들기' : '핫바로 옮겨 들기']);
      acts.push(['drop', '버리기']);
    }
    return `<div class="d-head"><img src="${Art.icon[it.id].url}" alt=""><div><h3>${esc(def.name)}${it.n > 1 ? ' <span class="muted">x' + it.n + '</span>' : ''}</h3><span class="cat">${CAT_NAME[def.cat] || ''}</span></div></div>
      <p>${esc(def.desc)}</p>${L.map(l => `<p class="stat-line">${l}</p>`).join('')}
      <div class="acts">${acts.map(a => `<button class="btn ${a[0] === 'drop' || a[0] === 'unequip' ? '' : 'primary'}" data-iact="${a[0]}">${a[1]}</button>`).join('')}</div>`;
  }
  function invAction(act) {
    const p = G.player;
    if (!invSel) return;
    if (act === 'unequip') {
      const k = invSel.slot, it = p.equip[k];
      if (!it) return;
      if (k === 'bag') {
        for (let i = 18; i < p.inv.length; i++) if (p.inv[i]) { toast('가방을 벗으려면 추가 칸(19번째 이후)을 비워야 합니다.', 'warn'); return; }
        let free = -1; for (let i = 0; i < 18; i++) if (!p.inv[i]) { free = i; break; }
        if (free < 0) { toast('가방을 내려놓을 빈칸이 없습니다.', 'warn'); return; }
        p.equip.bag = null; p.resize(); p.inv[free] = it;
      } else {
        let free = p.inv.indexOf(null);
        if (free < 0) { toast('빈칸이 없습니다.', 'warn'); return; }
        p.equip.body = null; p.inv[free] = it;
      }
      invSel = null; invChanged(); return;
    }
    const i = invSel.i, it = p.inv[i];
    if (!it) return;
    const def = ITEMS[it.id];
    if (act === 'use') {
      if (def.food) G.consume(i); else if (def.med) G.useMed(i); else if (def.battery) G.useBattery(i); else if (it.id === 'tape') G.repairWith(i); else if (def.tool === 'sleepbag') { close(); G.trySleep(); return; }
      p.cd = 0;
      if (!p.inv[i]) invSel = null;
    } else if (act === 'equip') {
      const k = def.wear.slot, old = p.equip[k];
      if (k === 'bag') {
        const nsz = 18 + def.wear.slots;
        for (let j = nsz; j < p.inv.length; j++) if (p.inv[j] && j !== i) { toast('더 작은 가방으로 바꾸려면 뒤쪽 칸을 비워야 합니다.', 'warn'); return; }
        p.inv[i] = old || null; p.equip.bag = it; p.resize();
      } else { p.inv[i] = old || null; p.equip.body = it; }
      SFX.play('pickup', null, null, 0.4);
      toast(`${josa(def.name, '을', '를')} 착용했다.`, 'good');
      invSel = null;
    } else if (act === 'hold') {
      if (i < 6) p.sel = i;
      else { const t = p.inv[p.sel]; p.inv[p.sel] = it; p.inv[i] = t; }
      invSel = { where: 'inv', i: p.sel };
    } else if (act === 'drop') {
      G.drop(p.x, p.y + 2, it); p.inv[i] = null; invSel = null;
      SFX.play('uiBack', null, null, 0.5);
    } else if (act === 'light') G.toggleLight();
    invChanged();
  }
  // 제작
  function renderCraft() {
    const p = G.player;
    const list = RECIPES.filter(r => craftCat === 'all' || r.cat === craftCat);
    const st = list.map(r => [r, G.recipeStatus(r)]);
    st.sort((a, b) => (b[1].ok ? 1 : 0) - (a[1].ok ? 1 : 0));
    if (craftSel == null || !list.includes(RECIPES[craftSel])) craftSel = st.length ? st[0][0].id : null;
    const sel = craftSel != null ? RECIPES[craftSel] : null;
    let detail = '<p class="muted">만들 물건을 고르세요.</p>';
    if (sel) {
      const s = G.recipeStatus(sel), def = ITEMS[sel.out];
      detail = `<div class="d-head"><img src="${Art.icon[sel.out].url}" alt=""><div><h3>${esc(def.name)}${sel.n > 1 ? ' <span class="muted">x' + sel.n + '</span>' : ''}</h3><span class="cat">${CAT_NAME[def.cat] || ''}</span></div></div>
        <p>${esc(def.desc)}</p>
        <div class="need">${s.need.map(e => `<div class="ing ${e.have >= e.n ? 'ok' : 'no'}"><img src="${Art.icon[e.id].url}" alt=""><span>${esc(ITEMS[e.id].name)}</span><b>${e.have}/${e.n}</b></div>`).join('')}
        ${s.tools.map(t => `<div class="ing ${t.ok ? 'ok' : 'no'}"><img src="${Art.icon[t.group[0]].url}" alt=""><span>도구: ${t.group.map(g => ITEMS[g].name).join(' / ')}</span><b>${t.ok ? '있음' : '없음'}</b></div>`).join('')}
        ${sel.fire ? `<div class="ing ${s.fire ? 'ok' : 'no'}"><img src="${Art.icon.campfire.url}" alt=""><span>불 붙은 모닥불 근처</span><b>${s.fire ? '가능' : '필요'}</b></div>` : ''}</div>
        <div class="acts"><button class="btn primary" data-craft="${sel.id}" ${s.ok ? '' : 'disabled'}>제작하기</button></div>`;
    }
    const fireBox = craftFire ? `<div class="firebox"><img src="${Art.icon.campfire.url}" alt=""><span>모닥불 · ${craftFire.fuel > 0 ? '남은 불 ' + Math.floor(craftFire.fuel / 60) + '시간 ' + Math.floor(craftFire.fuel % 60) + '분' : '꺼져 있음'}</span><button class="btn" data-fuel>땔감 넣기</button></div>` : '';
    return `<div class="panel-head"><h2>${craftFire ? '모닥불' : '제작'}</h2><button class="x" data-close>닫기</button></div>
      ${fireBox}
      <div class="tabs">${RECIPE_CATS.map(([k, n]) => `<button class="${craftCat === k ? 'on' : ''}" data-ccat="${k}">${n}</button>`).join('')}</div>
      <div class="craft-wrap"><div class="list">${st.map(([r, s]) => `<button class="rc ${s.ok ? 'ok' : ''} ${r.id === craftSel ? 'on' : ''}" data-rc="${r.id}"><img src="${Art.icon[r.out].url}" alt=""><span>${esc(ITEMS[r.out].name)}${r.n > 1 ? ' x' + r.n : ''}</span>${r.fire ? '<em>요리</em>' : ''}</button>`).join('') || '<p class="muted">없음</p>'}</div>
      <div class="detail">${detail}</div></div>`;
  }
  // 보관함
  function contCap(o) { return o.k === 'box' ? 20 : 12; }
  function renderCont() {
    const p = G.player, o = contObj;
    if (!o) return '';
    const name = o.k === 'box' ? '보관함' : (FURN[o.f] || {}).name || '보관함';
    const cont = o.cont || [];
    const cap = Math.max(contCap(o), cont.length);
    let cg = '';
    for (let i = 0; i < cap; i++) cg += slotHTML(cont[i], `data-ci="${i}"`, '', '');
    let ig = '';
    for (let i = 0; i < p.invSize(); i++) ig += slotHTML(p.inv[i], `data-pi="${i}"`, i < 6 ? `<span class="hk">${i + 1}</span>` : '', '');
    return `<div class="panel-head"><h2>${esc(name)}</h2><span class="sub">누르면 옮겨집니다</span><button class="btn primary" data-takeall ${cont.length ? '' : 'disabled'}>모두 가져가기</button><button class="x" data-close>닫기</button></div>
      <div class="cont-wrap"><div class="side"><h3>${esc(name)}${cont.length ? '' : ' <span class="muted">· 비어 있음</span>'}</h3><div class="grid">${cg}</div></div>
      <div class="side"><h3>내 가방</h3><div class="grid">${ig}</div></div></div>`;
  }
  function openContainer(o) {
    if (o.k === 'furn') G.world.container(o);
    if (!o.cont) o.cont = [];
    contObj = o;
    if (o.k === 'furn' && !o.cont.length) toast(`${josa((FURN[o.f] || {}).name || '보관함', '은', '는')} 비어 있다.`);
    open('cont');
  }
  function takeFrom(i) {
    const p = G.player, it = contObj.cont[i];
    if (!it) return;
    const left = stackOf(it.id) > 1 ? p.add(it.id, it.n, it.d) : p.addItem(it);
    if (left >= it.n) { toast('가방이 가득 찼다.', 'warn'); return; }
    if (left > 0) it.n = left; else contObj.cont.splice(i, 1);
    SFX.play('pickup', null, null, 0.4);
    G.world.modified(contObj);
    invChanged();
  }
  function putInto(i) {
    const p = G.player, it = p.inv[i];
    if (!it) return;
    const c = contObj.cont;
    const left = addToList(c, it.id, it.n, it.d, contCap(contObj));
    if (left >= it.n) { toast('보관함이 가득 찼다.', 'warn'); return; }
    if (left > 0) it.n = left; else p.inv[i] = null;
    SFX.play('uiBack', null, null, 0.4);
    G.world.modified(contObj);
    invChanged();
  }
  function onPanelClick(e) {
    const t = e.target;
    if (t.closest('[data-close]')) { close(); return; }
    if (drag && drag.moved) return;
    const p = G.player;
    if (panel === 'inv') {
      const ia = t.closest('[data-iact]'); if (ia) { invAction(ia.dataset.iact); return; }
      const eq = t.closest('[data-eq]'); if (eq) { invSel = p.equip[eq.dataset.eq] ? { where: 'eq', slot: eq.dataset.eq } : null; renderPanel(); return; }
    } else if (panel === 'craft') {
      const c = t.closest('[data-ccat]'); if (c) { craftCat = c.dataset.ccat; craftSel = null; renderPanel(); return; }
      const r = t.closest('[data-rc]'); if (r) { craftSel = +r.dataset.rc; renderPanel(true); return; }
      const cb = t.closest('[data-craft]'); if (cb && !cb.disabled) { G.craft(RECIPES[+cb.dataset.craft]); renderPanel(true); return; }
      if (t.closest('[data-fuel]') && craftFire) { G.addFuel(craftFire); renderPanel(true); return; }
    } else if (panel === 'cont') {
      if (t.closest('[data-takeall]')) { for (let i = contObj.cont.length - 1; i >= 0; i--) takeFrom(i); renderPanel(); return; }
      const ci = t.closest('[data-ci]'); if (ci) { takeFrom(+ci.dataset.ci); renderPanel(); return; }
      const pi = t.closest('[data-pi]'); if (pi) { putInto(+pi.dataset.pi); renderPanel(); return; }
    }
  }
  // 끌어서 옮기기 (가방)
  function onPanelDown(e) {
    if (panel !== 'inv') return;
    const s = e.target.closest('.slot[data-i]');
    if (!s) return;
    drag = { from: +s.dataset.i, x: e.clientX, y: e.clientY, moved: false };
  }
  function onDragMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      const it = G.player.inv[drag.from];
      if (!it) { drag = null; return; }
      drag.moved = true;
      const gh = $('#drag-ghost'); gh.hidden = false; gh.innerHTML = `<img src="${Art.icon[it.id].url}" alt="">`;
    }
    if (drag.moved) { const gh = $('#drag-ghost'); gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px'; }
  }
  function onDragUp(e) {
    if (!drag) return;
    const d = drag;
    $('#drag-ghost').hidden = true;
    if (!d.moved) {
      drag = null;
      const p = G.player;
      if (panel === 'inv' && p.inv[d.from]) { invSel = { where: 'inv', i: d.from }; renderPanel(); }
      else if (panel === 'inv') { invSel = null; renderPanel(); }
      return;
    }
    const tEl = document.elementFromPoint(e.clientX, e.clientY);
    const s = tEl && tEl.closest('.slot[data-i]');
    const p = G.player;
    if (s) {
      const to = +s.dataset.i;
      if (to !== d.from) {
        const a = p.inv[d.from], b = p.inv[to];
        if (b && a && b.id === a.id && stackOf(a.id) > 1) { const k = Math.min(a.n, stackOf(a.id) - b.n); b.n += k; a.n -= k; if (a.n <= 0) p.inv[d.from] = null; }
        else { p.inv[to] = a; p.inv[d.from] = b; }
        invSel = p.inv[to] ? { where: 'inv', i: to } : null;
        SFX.play('ui', null, null, 0.4);
        invChanged();
      }
    }
    setTimeout(() => { drag = null; }, 0);
  }

  /* ───── 키보드 ───── */
  function onKey(e, k) {
    if (!$('#confirm').hidden) { if (k === 'escape') $('#confirm').hidden = true; return; }
    if (screen) {
      if (k === 'escape') {
        if (screen === 'pause') resume();
        else if (screen === 'help' || screen === 'settings') { const back = $('#screen').dataset.back || 'title'; showScreen(back); }
        else if (screen === 'new') showScreen('title');
      }
      return;
    }
    if (G.state !== 'play') return;
    if (k === 'escape') { if (panel) close(); else if (G.player.sleeping) G.wake(); else pause(); return; }
    if (k === 'tab' || k === 'i') { e.preventDefault(); toggle('inv'); return; }
    if (k === 'c') { toggle('craft'); return; }
    if (k === 'm') { toggle('map'); return; }
    if (k >= '1' && k <= '6') { selectHot(+k - 1); return; }
  }
  function pause() {
    if (G.state !== 'play') return;
    close();
    G.paused = true;
    Input.releaseAll();
    showScreen('pause');
    G.save();
  }
  function resume() { G.paused = false; showScreen(null); }

  /* ───── 터치 조작 ───── */
  function setTouch(on) {
    touchOn = on;
    $('#touch').hidden = !on || G.state !== 'play';
    document.documentElement.classList.toggle('touch', on);
    lastPrompt = '#';
  }
  function bindTouch() {
    const zone = $('#joy-zone'), base = $('#joy-base'), knob = $('#joy-knob');
    let jid = null, jx = 0, jy = 0;
    zone.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || jid != null) return;
      e.preventDefault(); jid = e.pointerId;
      try { zone.setPointerCapture(jid); } catch (er) { /* 무시 */ }
      const r = zone.getBoundingClientRect();
      jx = e.clientX; jy = e.clientY;
      base.style.left = (jx - r.left) + 'px'; base.style.top = (jy - r.top) + 'px';
      base.classList.add('on'); Input.joy = { x: 0, y: 0 }; SFX.resume();
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - jx, dy = e.clientY - jy;
      const R = base.offsetWidth * 0.42, d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      Input.joy = { x: dx / R, y: dy / R };
    });
    const jend = e => { if (e.pointerId !== jid) return; jid = null; Input.joy = null; knob.style.transform = ''; base.classList.remove('on'); base.style.left = ''; base.style.top = ''; };
    zone.addEventListener('pointerup', jend); zone.addEventListener('pointercancel', jend);
    const ab = $('#t-attack');
    let aid = null, ax = 0, ay = 0;
    ab.addEventListener('pointerdown', e => { e.preventDefault(); aid = e.pointerId; try { ab.setPointerCapture(aid); } catch (er) { /* 무시 */ } ax = e.clientX; ay = e.clientY; Input.touchAttack = true; Input.press('attack'); ab.classList.add('on'); SFX.resume(); });
    ab.addEventListener('pointermove', e => { if (e.pointerId !== aid) return; const dx = e.clientX - ax, dy = e.clientY - ay; if (Math.hypot(dx, dy) > 14) Input.aimStick = Math.atan2(dy, dx); });
    const aend = e => { if (e.pointerId !== aid) return; aid = null; Input.touchAttack = false; Input.aimStick = null; ab.classList.remove('on'); };
    ab.addEventListener('pointerup', aend); ab.addEventListener('pointercancel', aend);
    const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
    tap('#t-interact', () => Input.press('interact'));
    tap('#t-reload', () => Input.press('reload'));
    tap('#t-light', () => Input.press('light'));
    tap('#t-run', () => { Input.sprintToggle = !Input.sprintToggle; });
    $('#touch').addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ───── 게임 상태 연동 ───── */
  function startGameUI() {
    showScreen(null);
    $('#hud').hidden = false;
    $('#touch').hidden = !touchOn;
    close();
    onWorld();
    invSel = null; lastPrompt = '#'; lastLabel = '';
  }
  function stopGameUI() {
    $('#hud').hidden = true; $('#touch').hidden = true; close();
    $('#sleep-ui').hidden = true; $('#fishbar').hidden = true; $('#toasts').innerHTML = '';
  }
  function invChanged() { invDirty = true; }
  function onHurt() { if (panel === 'cont' || panel === 'craft' || panel === 'inv') close(); }
  function fishStart(fg) { const fb = $('#fishbar'); fb.hidden = false; const z = $('#fishbar .zone'); z.style.left = (fg.zone * 100) + '%'; z.style.width = (fg.w * 100) + '%'; }
  function fishEnd() { $('#fishbar').hidden = true; }
  function sleep(on) { $('#sleep-ui').hidden = !on; if (on) close(); }
  function gameOver(info) { stopGameUI(); showScreen('over', info); }

  return {
    init, showScreen, update, toast, invChanged, openContainer, openCraft: (cat, fire) => open('craft', { cat, fire }), panelOpen: () => !!panel,
    blocking: () => !!screen || !$('#confirm').hidden || (G.player && G.player.sleeping), onHurt, fishStart, fishEnd, sleep, gameOver, mapPixel, onKey, cycleHotbar, setTouch,
    startGameUI, stopGameUI, prefs, get screen() { return screen; }, resizeU, isTouch: () => touchOn,
  };
})();
