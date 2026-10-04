/* Bootstrap: renders the Agent pipeline template through the layout engine with a few top-bar
   controls (theme, border, columns, step) plus the export dialog. The full editor/store replaces
   this in a later phase; the state keys below are what config files and share links carry. */
(function (ADG) {
  const TEMPLATE = 'agent-pipeline';
  const state = {
    theme: 'midnight', border: 'ascii', cols: 96, step: 1,
    // image export options (also drive the preview font via CSS variables)
    win: 'macos', chrome: true, glow: false, scanline: false,
    font: 'JetBrains Mono', size: 12.5, lineHeight: 1.5, credit: 'made by @you'
  };
  const $ = (id) => document.getElementById(id);

  /** Compose the current dashboard: { grid, pal, cols, rows }. */
  function build() {
    const pal = ADG.theme.palette(state.theme);
    const config = ADG.templates[TEMPLATE].get();
    config.border = state.border;
    config.grid.cols = state.cols;
    config.current = state.step;
    const out = ADG.layout.compose(config);
    return { grid: out.grid, pal, cols: out.cols, rows: out.rows };
  }

  function render() {
    const { grid, pal, cols, rows } = build();
    const issues = ADG.grid.selfCheck(grid);
    const root = document.documentElement.style;
    root.setProperty('--adg-font', '"' + state.font + '", ui-monospace, Menlo, Consolas, monospace');
    root.setProperty('--adg-size', state.size + 'px');
    root.setProperty('--adg-lh', String(state.lineHeight));
    const screen = $('screen');
    screen.style.background = pal.bg;
    screen.style.color = pal.fg;
    screen.style.boxShadow = '0 0 0 1px ' + pal.line;
    $('preview').innerHTML = ADG.htmlOut.renderHTML(grid, pal, { blink: true });
    const status = $('check-status');
    status.textContent = issues.length
      ? 'Tự kiểm tra: ' + issues.length + ' cảnh báo (xem console)'
      : 'Tự kiểm tra: OK · ' + cols + '×' + rows;
    status.className = 'check-status ' + (issues.length ? 'warn' : 'ok');
  }

  /** Push the state into the top-bar controls (a loaded config may hold e.g. cols=100, not in the list). */
  function syncControls() {
    const cols = $('cols-select');
    Array.prototype.filter.call(cols.options, (o) => o.dataset.custom).forEach((o) => o.remove());
    if (!Array.prototype.some.call(cols.options, (o) => o.value === String(state.cols))) {
      const o = new Option(String(state.cols), String(state.cols));
      o.dataset.custom = '1'; // loaded value outside the presets; replaced on the next change
      cols.add(o);
    }
    ['theme', 'border', 'cols', 'step'].forEach((k) => { $(k + '-select').value = String(state[k]); });
  }

  function setState(patch) {
    Object.assign(state, patch);
    syncControls();
    render();
    ADG.exportDialog.refresh();
  }

  /** Apply a config from the URL hash. Returns true when a hash was present (even if invalid). */
  let hashSeq = 0;
  async function loadFromHash() {
    const token = ADG.share.readHash(window.location.hash);
    if (!token) return false;
    const mine = ++hashSeq;
    // Drop the hash right away so a reload never re-applies it over later edits.
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* some file:// contexts forbid it */ }
    try {
      const patch = ADG.configFile.validate(await ADG.share.decode(token));
      if (mine !== hashSeq) return true; // a newer link was opened meanwhile
      setState(patch);
      ADG.exportDialog.toast('Đã mở cấu hình từ share link', 'ok');
    } catch (e) {
      if (mine === hashSeq) ADG.exportDialog.toast('Share link không hợp lệ: ' + e.message, 'error');
    }
    return true;
  }

  function init() {
    const theme = $('theme-select');
    Object.keys(ADG.theme.THEMES).forEach((id) => theme.add(new Option(ADG.theme.THEME_LABELS[id], id)));
    const step = $('step-select');
    ADG.templates[TEMPLATE].get().steps.forEach((s, i) => step.add(new Option((i + 1) + ' · ' + s, String(i))));
    [['theme-select', 'theme'], ['border-select', 'border'], ['cols-select', 'cols', Number], ['step-select', 'step', Number]].forEach(([id, key, parse]) => {
      $(id).addEventListener('change', (e) => setState({ [key]: parse ? parse(e.target.value) : e.target.value }));
    });
    ADG.exportDialog.init({ getState: () => state, setState, build, template: TEMPLATE });
    syncControls();
    render();
    loadFromHash(); // the hash wins over the defaults (and, later, over saved state)
    window.addEventListener('hashchange', loadFromHash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.ADG = window.ADG || {});
