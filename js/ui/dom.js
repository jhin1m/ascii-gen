/* Tiny DOM helpers shared by the editor panels (no framework): element builder, debounce,
   and a "replace children" that keeps focus inside a re-rendered form when possible. */
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

  /** Replace the children of `root`; the element with the same data-focus key gets focus back. */
  function replace(root, ...kids) {
    const active = document.activeElement;
    const key = active && root.contains(active) ? active.getAttribute('data-focus') : null;
    const sel = key && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    root.textContent = '';
    add(root, kids);
    if (!key) return;
    const again = root.querySelector('[data-focus="' + CSS.escape(key) + '"]');
    if (!again) return;
    again.focus();
    if (sel) try { again.setSelectionRange(sel[0], sel[1]); } catch (e) { /* inputs like number/color have no selection */ }
  }

  function debounce(fn, ms) {
    let t = 0;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  const byId = (id) => document.getElementById(id);

  ADG.dom = { h, replace, debounce, byId };
})(window.ADG = window.ADG || {});
