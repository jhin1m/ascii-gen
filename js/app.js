/* Bootstrap: renders the Agent pipeline template through the layout engine with a few top-bar
   controls (theme, border, columns, step). The full editor replaces these in a later phase. */
(function (ADG) {
  const TEMPLATE = 'agent-pipeline';
  const state = { theme: 'midnight', border: 'ascii', cols: 96, step: 1 };

  function render() {
    const pal = ADG.theme.palette(state.theme);
    const config = ADG.templates[TEMPLATE].get();
    config.border = state.border;
    config.grid.cols = state.cols;
    config.current = state.step;
    const out = ADG.layout.compose(config);
    const issues = ADG.grid.selfCheck(out.grid);
    const screen = document.getElementById('screen');
    screen.style.background = pal.bg;
    screen.style.color = pal.fg;
    screen.style.boxShadow = '0 0 0 1px ' + pal.line;
    document.getElementById('preview').innerHTML = ADG.htmlOut.renderHTML(out.grid, pal, { blink: true });
    const status = document.getElementById('check-status');
    status.textContent = issues.length
      ? 'Tự kiểm tra: ' + issues.length + ' cảnh báo (xem console)'
      : 'Tự kiểm tra: OK · ' + out.cols + '×' + out.rows;
    status.className = 'check-status ' + (issues.length ? 'warn' : 'ok');
  }

  /** Wire a <select> to a state key; `parse` converts the option value. */
  function bind(id, key, parse) {
    const el = document.getElementById(id);
    el.value = String(state[key]);
    el.addEventListener('change', () => { state[key] = parse ? parse(el.value) : el.value; render(); });
    return el;
  }

  function init() {
    const theme = document.getElementById('theme-select');
    Object.keys(ADG.theme.THEMES).forEach((id) => theme.add(new Option(ADG.theme.THEME_LABELS[id], id)));
    const step = document.getElementById('step-select');
    ADG.templates[TEMPLATE].get().steps.forEach((s, i) => step.add(new Option((i + 1) + ' · ' + s, String(i))));
    bind('theme-select', 'theme');
    bind('border-select', 'border');
    bind('cols-select', 'cols', Number);
    bind('step-select', 'step', Number);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.ADG = window.ADG || {});
