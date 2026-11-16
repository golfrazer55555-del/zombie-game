'use strict';
/* ===== 입력: 키보드/마우스/터치 ===== */
const Input = (function () {
  const keys = new Set();
  const I = {
    move: { x: 0, y: 0 }, sprint: false, attack: false, attackPressed: false, interactPressed: false, reloadPressed: false, lightPressed: false, anyPressed: false,
    usingMouse: false, mouse: null, aimStick: null, joy: null, touchAttack: false, sprintToggle: false, touchMode: false,
  };
  let mouseDown = false, mouseClient = null;
  const pend = { attack: false, interact: false, reload: false, light: false, any: false };
  const GAME_KEYS = new Set([' ', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }

  I.init = function (canvas) {
    window.addEventListener('keydown', e => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (GAME_KEYS.has(k) && G.state === 'play') e.preventDefault();
      if (!e.repeat) {
        pend.any = true;
        if (G.state === 'play' && !UI.blocking()) {
          if (k === 'e') pend.interact = true;
          if (k === 'r') pend.reload = true;
          if (k === 'f') pend.light = true;
          if (k === ' ') pend.attack = true;
        }
        UI.onKey(e, k);
      }
      keys.add(k);
      if (I.touchMode && !['shift', 'control', 'alt', 'meta'].includes(k)) { I.touchMode = false; UI.setTouch(false); }
    });
    window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });
    window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      I.usingMouse = true; mouseClient = { x: e.clientX, y: e.clientY };
      if (I.touchMode) { I.touchMode = false; UI.setTouch(false); }
      SFX.resume();
      if (e.button === 0) { mouseDown = true; pend.attack = true; }
      if (e.button === 2) pend.interact = true;
      pend.any = true;
    });
    window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) mouseDown = false; });
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouseClient = { x: e.clientX, y: e.clientY }; if (e.target === canvas) I.usingMouse = true; } });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { if (G.state === 'play') { e.preventDefault(); UI.cycleHotbar(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
    window.addEventListener('touchstart', () => { if (!I.touchMode) { I.touchMode = true; I.usingMouse = false; UI.setTouch(true); } }, { passive: true });
  };
  I.press = function (what) { pend[what] = true; pend.any = true; };
  I.update = function () {
    let mx = 0, my = 0;
    if (!UI.blocking()) {
      if (keys.has('w') || keys.has('arrowup')) my -= 1;
      if (keys.has('s') || keys.has('arrowdown')) my += 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
    }
    if (I.joy) { mx += I.joy.x; my += I.joy.y; }
    I.move.x = mx; I.move.y = my;
    I.sprint = keys.has('shift') || I.sprintToggle;
    I.attack = (mouseDown || I.touchAttack || keys.has(' ')) && !UI.blocking();
    I.attackPressed = pend.attack; I.interactPressed = pend.interact; I.reloadPressed = pend.reload; I.lightPressed = pend.light; I.anyPressed = pend.any;
    pend.attack = pend.interact = pend.reload = pend.light = pend.any = false;
    I.mouse = (I.usingMouse && mouseClient && !I.touchMode) ? Render.screenToWorld(mouseClient.x, mouseClient.y) : null;
  };
  I.releaseAll = function () { mouseDown = false; I.touchAttack = false; I.joy = null; I.aimStick = null; keys.clear(); };
  return I;
})();
