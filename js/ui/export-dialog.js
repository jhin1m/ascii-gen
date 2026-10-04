/* Export dialog (PNG / plain text / .json / share link) + toast. All DOM wiring lives here; the
   actual work is done by ADG.canvasOut, ADG.png, ADG.plainText, ADG.configFile and ADG.share.
   app.js supplies the state through init({ getState, setState, build, template }); template is the
   template id or a function returning it (used in file names and window titles). */
(function (ADG) {
  const $ = (id) => document.getElementById(id);
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  let api = null, scale = 2, lastFocus = null, seq = 0, toastTimer = 0, busy = false;

  /** Short status message; kind = 'ok' | 'error'; optional action { label, run } adds a button (e.g. undo). */
  function toast(msg, kind, action) {
    const el = $('toast');
    el.textContent = msg;
    if (action) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm toast-action'; b.textContent = action.label;
      b.addEventListener('click', () => { el.hidden = true; action.run(); });
      el.appendChild(b);
    }
    el.className = 'toast ' + (kind === 'error' ? 'error' : 'ok');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' || action ? 6000 : 3000);
  }

  const isOpen = () => !$('export-overlay').hidden;
  const tpl = () => (typeof api.template === 'function' ? api.template() : api.template);

  function pngOpts() {
    const s = api.getState();
    return { scale, chrome: s.chrome, win: s.win, font: s.font, size: s.size, lineHeight: s.lineHeight, glow: s.glow, scanline: s.scanline, credit: s.credit, template: tpl() };
  }

  function syncControls() {
    const s = api.getState();
    $('opt-chrome').checked = s.chrome;
    $('opt-win').value = s.win; $('opt-win').disabled = !s.chrome;
    $('opt-font').value = s.font;
    $('opt-size').value = s.size;
    $('opt-credit').value = s.credit;
    $('opt-glow').checked = s.glow;
    $('opt-scanline').checked = s.scanline;
    document.querySelectorAll('#png-scales [data-scale]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === scale)));
  }

  async function refreshSize(token) {
    const out = $('png-size');
    out.textContent = 'Kích thước dự kiến: …';
    const { grid } = api.build();
    const opts = pngOpts();
    await ADG.canvasOut.ensureFont(opts);
    if (token !== seq) return;
    const m = ADG.canvasOut.measure(grid, opts);
    out.textContent = 'Kích thước dự kiến: ' + ADG.png.sizeLabel(m.width, m.height) + ' · ' + ADG.png.fileName(tpl(), scale)
      + (m.limit ? '\n⚠ ' + m.limit : '');
    out.classList.toggle('warn', !!m.limit);
    $('png-download').disabled = !!m.limit;
    document.querySelectorAll('#png-scales [data-scale]').forEach((b) => {
      const bad = ADG.canvasOut.measure(grid, Object.assign({}, opts, { scale: Number(b.dataset.scale) })).limit;
      b.disabled = !!bad && Number(b.dataset.scale) !== scale; // the active scale stays enabled so the selection is visible; title explains the limit
      b.title = bad || '';
    });
  }

  async function refreshShare(token) {
    const url = $('share-url'), warn = $('share-warn'), btn = $('share-copy');
    url.value = ''; btn.disabled = true; // never offer a stale link while the new one is built
    try {
      const link = await ADG.share.createLink(ADG.configFile.wrap(api.getState()), window.location);
      if (token !== seq) return;
      url.value = link.url;
      btn.textContent = 'Copy link · ' + (link.length / 1024).toFixed(1) + ' KB';
      btn.disabled = false;
      warn.innerHTML = '';
      link.warnings.forEach((w) => { const li = document.createElement('li'); li.textContent = w; warn.appendChild(li); });
    } catch (e) {
      if (token !== seq) return;
      url.value = ''; btn.disabled = true; btn.textContent = 'Copy link';
      warn.innerHTML = '';
      const li = document.createElement('li'); li.textContent = e.message; warn.appendChild(li);
    }
  }

  /** Re-read the state into every control and recompute size / text / link. */
  function refresh() {
    if (!api || !isOpen()) return;
    const token = ++seq;
    syncControls();
    $('text-preview').textContent = ADG.plainText.toPlainText(api.build().grid);
    ADG.exportMotion.refresh();
    refreshSize(token);
    refreshShare(token);
  }

  function patch(p) { api.setState(p); } // app.setState refreshes the dialog

  async function downloadPng() {
    if (busy || $('png-download').disabled) return;
    busy = true;
    const btn = $('png-download');
    btn.disabled = true; btn.textContent = 'Đang tạo ảnh…';
    try {
      const { grid, pal } = api.build();
      const name = await ADG.png.exportPng(grid, pal, pngOpts(), tpl());
      toast('Đã tải ' + name, 'ok');
    } catch (e) {
      toast('Không xuất được PNG: ' + e.message, 'error');
    } finally {
      busy = false; btn.disabled = !!ADG.canvasOut.measure(api.build().grid, pngOpts()).limit; btn.textContent = 'Tải PNG';
    }
  }

  async function copyText(text, okMsg) {
    const ok = await ADG.plainText.copy(text);
    toast(ok ? okMsg : 'Không copy được, hãy chọn và copy thủ công.', ok ? 'ok' : 'error');
  }

  async function openJson(file) {
    try {
      const patchObj = ADG.configFile.parse(await ADG.configFile.readFile(file));
      patch(patchObj);
      toast('Đã mở cấu hình từ ' + file.name, 'ok');
    } catch (e) {
      toast('Không mở được file: ' + e.message, 'error');
    }
  }

  function trap(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const items = Array.from($('export-dialog').querySelectorAll(FOCUSABLE)).filter((el) => !el.hidden && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === $('export-dialog'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    lastFocus = document.activeElement;
    $('export-overlay').hidden = false;
    document.body.classList.add('modal-open');
    refresh();
    $('export-dialog').focus();
  }

  function close() {
    $('export-overlay').hidden = true;
    document.body.classList.remove('modal-open');
    ADG.exportMotion.cancel(); // a running GIF/video export stops with the dialog
    seq++;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function init(options) {
    api = options;
    const win = $('opt-win'), font = $('opt-font');
    ADG.windowChrome.WINDOWS.forEach((w) => win.add(new Option(ADG.windowChrome.LABELS[w], w)));
    ADG.canvasOut.FONTS.forEach((f) => font.add(new Option(f, f)));
    ADG.exportMotion.init({ getState: () => api.getState(), build: () => api.build(), template: tpl, toast });
    $('export-open').addEventListener('click', open);
    $('export-close').addEventListener('click', close);
    $('export-overlay').addEventListener('mousedown', (e) => { if (e.target === $('export-overlay')) close(); });
    $('export-overlay').addEventListener('keydown', trap);
    $('png-scales').addEventListener('click', (e) => {
      const b = e.target.closest('[data-scale]');
      if (b) { scale = Number(b.dataset.scale); refresh(); }
    });
    $('opt-chrome').addEventListener('change', (e) => patch({ chrome: e.target.checked }));
    win.addEventListener('change', () => patch({ win: win.value }));
    font.addEventListener('change', () => patch({ font: font.value }));
    $('opt-size').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v >= 6 && v <= 48) patch({ size: v }); else { toast('Cỡ chữ phải từ 6 đến 48.', 'error'); syncControls(); }
    });
    $('opt-credit').addEventListener('change', (e) => patch({ credit: e.target.value.slice(0, 60) }));
    $('opt-glow').addEventListener('change', (e) => patch({ glow: e.target.checked }));
    $('opt-scanline').addEventListener('change', (e) => patch({ scanline: e.target.checked }));
    $('png-download').addEventListener('click', downloadPng);
    $('text-copy').addEventListener('click', () => copyText(ADG.plainText.toPlainText(api.build().grid), 'Đã copy plain text'));
    $('json-download').addEventListener('click', () => toast('Đã tải ' + ADG.configFile.download(api.getState(), tpl()), 'ok'));
    $('json-open').addEventListener('click', () => $('json-file').click());
    $('json-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) openJson(f);
    });
    $('share-url').addEventListener('focus', (e) => e.target.select());
    $('share-copy').addEventListener('click', () => copyText($('share-url').value, 'Đã copy link'));
  }

  ADG.exportDialog = { init, open, close, refresh, toast };
})(window.ADG = window.ADG || {});
