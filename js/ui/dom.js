/* Tiny DOM helpers shared by the editor panels (no framework): element builder, debounce,
   a "replace children" that keeps focus inside a re-rendered form, and a redraw guard that
   never rebuilds a section while the user is typing in it. */
(function (ADG) {
  /**
   * h('button', { class: 'btn', onclick: fn, 'aria-pressed': 'true' }, 'text', childEl, [more])
   * Attributes: on* → listener, `value`/`checked`/`disabled`/`hidden`/`selected` → property, others → setAttribute.
   */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (['value', 'checked', 'disabled', 'hidden', 'selected', 'open'].indexOf(k) >= 0) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    add(el, kids);
    return el;
  }

  function add(el, kids) {
    kids.forEach((k) => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) add(el, k);
      else el.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
    });
  }

  const FOCUSABLE = 'button, input, select, textarea, summary, [tabindex]';
  /** True when the focus is in a text field inside `root` (the user may be mid-edit). */
  function typing(root) {
    const a = document.activeElement;
    return !!a && root.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|number|search|)$/.test(a.type)));
  }

  /**
   * Replace the children of `root`. Focus comes back to the control with the same data-focus key,
   * else to the control at the same position, so keyboard users never drop to <body>.
   */
  function replace(root, ...kids) {
    const active = document.activeElement;
    const inside = active && active !== root && root.contains(active);
    const key = inside ? active.getAttribute('data-focus') : null;
    const pos = inside ? Array.prototype.indexOf.call(root.querySelectorAll(FOCUSABLE), active) : -1;
    const sel = key && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    root.textContent = '';
    add(root, kids);
    if (!inside) return;
    const again = (key && root.querySelector('[data-focus="' + CSS.escape(key) + '"]')) || root.querySelectorAll(FOCUSABLE)[pos];
    if (!again) return;
    again.focus();
    if (sel) try { again.setSelectionRange(sel[0], sel[1]); } catch (e) { /* inputs like number/color have no selection */ }
  }

  // Pointer state shared by every deferred redraw: a section rebuilt between mousedown and click
  // would swallow the click. Reset on everything that can eat the pointerup (context menu, blur).
  let down = false;
  const idleQueue = [];
  const release = () => { down = false; setTimeout(() => idleQueue.splice(0).forEach((fn) => fn()), 0); };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => { down = true; }, true);
    ['pointerup', 'pointercancel', 'contextmenu'].forEach((t) => document.addEventListener(t, release, true));
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
  }
  /** Run fn after the current event, and only once no pointer is held down. */
  function whenIdle(fn) {
    if (down) idleQueue.push(fn); else setTimeout(() => (down ? idleQueue.push(fn) : fn()), 0);
  }

  /**
   * Redraw guard for a form section: while a text field inside it has focus the redraw waits
   * (the user may be typing), and runs once the focus leaves the section.
   * @returns {() => void} call to request a redraw
   */
  function section(root, draw) {
    let stale = false;
    root.addEventListener('focusout', () => whenIdle(() => {
      if (stale && !typing(root)) { stale = false; draw(); }
    }));
    return () => {
      if (typing(root)) { stale = true; return; }
      stale = false;
      draw();
    };
  }

  function debounce(fn, ms) {
    let t = 0;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = 0; fn(...a); }, ms); };
    d.cancel = () => clearTimeout(t);
    /** Run a pending call now (e.g. before its target goes away). */
    d.flush = (...a) => { if (!t) return; clearTimeout(t); t = 0; fn(...a); };
    return d;
  }

  const byId = (id) => document.getElementById(id);

  ADG.dom = { h, replace, section, typing, whenIdle, debounce, byId };
})(window.ADG = window.ADG || {});
