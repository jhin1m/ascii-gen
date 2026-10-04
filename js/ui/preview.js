/* Live preview: frame → HTML grid inside the HTML window chrome, scaled to fit the stage width
   (transform: scale + wrapper height), plus the toolbar (window style, columns) and the
   self-check badge. The DOM is only written when the frame's HTML changes. On a scaled-down
   preview a click toggles 1:1 zoom (horizontal scroll). */
(function (ADG) {
  const { h, byId } = ADG.dom;
  const COLS = [80, 96, 120];
  let last = '', zoom = false, lastSize = '';

  /** @returns {{ out, issues, ms }} for the frame (step, t, playing). */
  function render(s, step, t, playing) {
    const t0 = performance.now();
    const out = ADG.frame.renderFrame(ADG.store.toConfig(s), step, t, { playing });
    const pal = ADG.store.palette(s);
    const grid = '<div class="adg-pre">' + ADG.htmlOut.renderHTML(out.grid, pal, { blink: s.blink }) + '</div>';
    const html = ADG.htmlChrome.frameHTML(grid, pal, { win: s.win, chrome: s.chrome, template: s.template, cols: out.cols, rows: out.rows, credit: s.credit, scanline: s.scanline });
    const win = byId('preview-window');
    const size = s.font + '|' + s.size + '|' + s.lineHeight + '|' + s.glow;
    let refit = false;
    if (size !== lastSize) {
      refit = true;
      win.style.setProperty('--adg-font', '"' + s.font + '", ui-monospace, Menlo, Consolas, monospace');
      win.style.setProperty('--adg-size', s.size + 'px');
      win.style.setProperty('--adg-lh', String(s.lineHeight));
      win.classList.toggle('glow', !!s.glow);
      lastSize = size;
    }
    let issues = null;
    if (html !== last) {
      win.innerHTML = html;
      last = html;
      refit = true;
      issues = ADG.grid.selfCheck(out.grid);
      badge(issues, out);
    }
    if (refit) fit();
    return { out, issues, ms: performance.now() - t0 };
  }

  function badge(issues, out) {
    const el = byId('check-status');
    el.textContent = issues.length ? '⚠ self-check · ' + issues.length + ' cảnh báo (xem console)' : '✓ self-check · ' + out.rows + '/' + out.rows + ' dòng đúng ' + out.cols + ' cột';
    el.className = 'check-status ' + (issues.length ? 'warn' : 'ok');
    byId('rows-label').textContent = '× ' + out.rows + ' dòng';
  }

  /** Scale the window to the stage width (never up). */
  function fit() {
    const wrap = byId('preview-wrap'), sc = byId('preview-scale');
    sc.style.transform = '';
    const natW = sc.offsetWidth, natH = sc.offsetHeight, room = wrap.clientWidth;
    const k = zoom || !natW ? 1 : Math.min(1, room / natW);
    sc.style.transform = k < 1 ? 'scale(' + k + ')' : '';
    wrap.style.height = Math.ceil(natH * k) + 'px';
    wrap.classList.toggle('zoomable', k < 1 || zoom);
    wrap.classList.toggle('zoomed', zoom);
    const note = byId('preview-note');
    note.hidden = !(k < 1 || zoom);
    note.textContent = zoom ? 'Đang xem 1:1 · bấm vào hình để thu nhỏ lại' : 'Đã thu nhỏ còn ' + Math.round(k * 100) + '% cho vừa bề ngang · bấm vào hình để xem 1:1';
  }

  function toolbar(s, api) {
    const winBtn = (id, label) => h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(id === 'none' ? !s.chrome : s.chrome && s.win === id),
      onclick: () => api.set(id === 'none' ? { chrome: false } : { chrome: true, win: id }) }, label);
    ADG.dom.replace(byId('win-seg'), ADG.windowChrome.WINDOWS.map((w) => winBtn(w, ADG.windowChrome.LABELS[w])), winBtn('none', 'Không'));
    const custom = COLS.indexOf(s.cols) < 0;
    ADG.dom.replace(byId('cols-seg'), COLS.map((c) => h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(s.cols === c), onclick: () => api.set({ cols: c }) }, String(c))),
      h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(custom), onclick: () => { const el = byId('cols-custom'); el.hidden = false; el.focus(); } }, 'Tuỳ'));
    const el = byId('cols-custom');
    if (custom) el.hidden = false;
    if (document.activeElement !== el) el.value = String(s.cols);
  }

  function mount(api) {
    const el = byId('cols-custom');
    el.addEventListener('change', () => {
      const v = Math.round(Number(el.value));
      if (v >= 40 && v <= 200) api.set({ cols: v });
      else { api.toast('Số cột phải từ 40 đến 200.', 'error'); el.value = String(api.get().cols); }
    });
    byId('preview-wrap').addEventListener('click', () => {
      if (!byId('preview-wrap').classList.contains('zoomable')) return;
      zoom = !zoom; fit();
    });
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => fit());
      ro.observe(byId('preview-wrap')); ro.observe(byId('preview-window')); // stage width, and late web-font metrics
    }
    else window.addEventListener('resize', fit);
    toolbar(api.get(), api);
    return (s, changed) => { if (changed.cols || changed.win || changed.chrome) toolbar(s, api); };
  }

  /** Forget the last HTML so the next render rewrites the DOM (e.g. after a font load). */
  const invalidate = () => { last = ''; };

  ADG.preview = { mount, render, fit, invalidate };
})(window.ADG = window.ADG || {});
