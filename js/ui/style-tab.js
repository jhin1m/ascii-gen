/* "Giao diện" tab: theme cards, the 9 base colors (overrides on top of the theme), font, size,
   line height, border style and effects (scanline, glow, blink). */
(function (ADG) {
  const { h } = ADG.dom;
  const LABELS = { bg: 'Nền', fg: 'Chữ', mut: 'Chữ phụ', a1: 'Nhấn 1', a2: 'Nhấn 2', a3: 'Nhấn 3', a4: 'Nhấn 4', a5: 'Nhấn 5', a6: 'Nhấn 6' };
  const KEYS = ['theme', 'colors', 'font', 'size', 'lineHeight', 'border', 'scanline', 'glow', 'blink'];

  function themes(s, api) {
    return h('div', { class: 'theme-grid' }, Object.keys(ADG.theme.THEMES).map((id) => {
      const t = ADG.theme.THEMES[id];
      return h('button', { type: 'button', class: 'theme-card', 'aria-pressed': String(s.theme === id), 'data-focus': 'theme-' + id,
        onclick: () => api.set({ theme: id, colors: {} }) },
        h('span', { class: 'swatch', style: 'background:' + t.bg, 'aria-hidden': 'true' },
          ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((k) => h('i', { style: 'background:' + t[k] }))),
        h('span', null, ADG.theme.THEME_LABELS[id]));
    }));
  }

  function colors(s, api) {
    const pal = ADG.store.palette(s), over = s.colors || {};
    return h('div', { class: 'color-grid' }, ADG.theme.BASE_KEYS.map((k) => h('label', { class: 'color-field' + (over[k] ? ' changed' : '') },
      h('input', { type: 'color', value: pal[k], 'data-focus': 'color-' + k, onchange: (e) => api.set({ colors: Object.assign({}, over, { [k]: e.target.value }) }) }),
      LABELS[k])));
  }

  function range(label, value, min, max, step, fmt, onset, focus) {
    return h('label', { class: 'field-col' }, label + ' · ' + fmt(value),
      h('input', { type: 'range', min, max, step, value: String(value), 'data-focus': focus, onchange: (e) => onset(Number(e.target.value)) }));
  }

  function mount(root, api) {
    const draw = (s) => ADG.dom.replace(root,
      h('section', { class: 'sect-flat' }, h('h2', null, 'Theme'), themes(s, api)),
      h('section', { class: 'sect-flat' },
        h('div', { class: 'sub-head' }, h('h2', null, 'Màu · chỉnh từng màu'),
          h('button', { type: 'button', class: 'btn btn-sm', disabled: !Object.keys(s.colors || {}).length, onclick: () => api.set({ colors: {} }) }, 'Đặt lại màu')),
        colors(s, api)),
      h('section', { class: 'sect-flat form' },
        h('label', { class: 'field-col' }, 'Font', h('select', { 'data-focus': 'font', onchange: (e) => api.set({ font: e.target.value }) },
          ADG.canvasOut.FONTS.map((f) => h('option', { value: f, selected: s.font === f }, f)))),
        range('Cỡ chữ', s.size, 9, 16, 0.5, (v) => v + 'px', (v) => api.set({ size: v }), 'size'),
        range('Giãn dòng', s.lineHeight, 1.1, 1.8, 0.05, (v) => v.toFixed(2), (v) => api.set({ lineHeight: v }), 'lh')),
      h('section', { class: 'sect-flat' }, h('h2', null, 'Kiểu viền'),
        h('div', { class: 'seg' }, [['ascii', 'ASCII  +-|'], ['unicode', 'Unicode  ┌─│']].map(([id, label]) =>
          h('button', { type: 'button', class: 'btn mono', 'aria-pressed': String(s.border === id), 'data-focus': 'border-' + id, onclick: () => api.set({ border: id }) }, label)))),
      h('section', { class: 'sect-flat' }, h('h2', null, 'Hiệu ứng'),
        [['scanline', 'Scanline CRT'], ['glow', 'Glow chữ'], ['blink', 'Con trỏ nhấp nháy']].map(([k, label]) =>
          h('label', { class: 'check row-check' }, label, h('input', { type: 'checkbox', checked: !!s[k], 'data-focus': 'fx-' + k, onchange: (e) => api.set({ [k]: e.target.checked }) })))));
    draw(api.get());
    return (s, changed) => { if (KEYS.some((k) => changed[k])) draw(s); };
  }

  ADG.styleTab = { mount };
})(window.ADG = window.ADG || {});
