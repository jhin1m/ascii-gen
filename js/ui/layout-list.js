/* "Bố cục": the layout rows. Each row: its blocks (click = edit below, tag auto / sửa tay ↺ /
   preset), width ratios when a row has several blocks, show/hide, move up/down, remove. New rows
   take a block type from the registry. */
(function (ADG) {
  const { h } = ADG.dom;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const keyOf = (it) => (typeof it === 'string' ? it : it && it.block);
  const rowList = (row) => (Array.isArray(row) ? row : [row]);
  const TAG_CLASS = { auto: 'tag-auto', preset: 'tag-preset', 'sửa tay ↺': 'tag-manual' };

  /** Unused block key for a type ('side-column' → 'side'). */
  function newKey(type, blocks) {
    const base = type === 'side-column' ? 'side' : type;
    let k = base, n = 2;
    while (Object.prototype.hasOwnProperty.call(blocks, k)) k = base + n++;
    return k;
  }

  function mount(root, api) {
    let addType = 'header';

    function draw(s) {
      const layout = Array.isArray(s.layout) ? s.layout : [], blocks = isObj(s.blocks) ? s.blocks : {};
      const setLayout = (l, extra) => api.set(Object.assign({ layout: l }, extra || {}));
      const sel = api.selected();
      const rows = layout.map((row, i) => {
        const items = rowList(row);
        const visible = items.some((it) => !(isObj(blocks[keyOf(it)]) && blocks[keyOf(it)].hidden));
        const chips = items.map((it, j) => {
          const key = keyOf(it), b = api.blockOf(key);
          const tag = b ? ADG.schemaForm.tagOf(b.type, b.cfg) : 'không rõ';
          const ratio = items.length > 1 ? h('input', { type: 'number', class: 'num ratio', min: 0.1, max: 10, step: 0.05, 'aria-label': 'Tỉ lệ cột ' + key,
            'data-focus': 'ratio-' + i + '-' + j, value: String(typeof it === 'object' && it.w ? it.w : 1),
            onchange: (e) => {
              const w = Number(e.target.value);
              if (!(w > 0 && w <= 10)) return api.toast('Tỉ lệ phải trong (0, 10].', 'error');
              const r = items.map((x, k) => (k === j ? { block: key, w } : x));
              setLayout(layout.map((x, k) => (k === i ? r : x)));
            } }) : null;
          return h('span', { class: 'chip' + (key === sel ? ' chip-on' : '') },
            h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(key === sel), onclick: () => api.select(key) },
              h('span', null, b ? b.def.label : key), tag ? h('span', { class: 'tag ' + (TAG_CLASS[tag] || '') }, tag) : null),
            ratio);
        });
        return h('div', { class: 'layout-row' + (visible ? '' : ' off') },
          h('span', { class: 'mono mut small row-n' }, String(i + 1)),
          h('div', { class: 'chips' }, chips),
          h('input', { type: 'checkbox', 'aria-label': 'Hiện hàng ' + (i + 1), checked: visible, 'data-focus': 'row-vis-' + i, onchange: (e) => {
            const next = Object.assign({}, blocks);
            items.forEach((it) => { const k = keyOf(it); if (isObj(next[k])) next[k] = Object.assign({}, next[k], { hidden: !e.target.checked }); });
            api.set({ blocks: next });
          } }),
          h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Đưa hàng ' + (i + 1) + ' lên', disabled: i === 0, onclick: () => {
            const l = layout.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; setLayout(l);
          } }, '↑'),
          h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Đưa hàng ' + (i + 1) + ' xuống', disabled: i === layout.length - 1, onclick: () => {
            const l = layout.slice(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; setLayout(l);
          } }, '↓'),
          h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Xoá hàng ' + (i + 1), onclick: () => {
            const l = layout.filter((_, k) => k !== i), next = Object.assign({}, blocks);
            const used = new Set([].concat(...l.map((r) => rowList(r).map(keyOf))));
            items.forEach((it) => { if (!used.has(keyOf(it))) delete next[keyOf(it)]; });
            setLayout(l, { blocks: next });
          } }, '×'));
      });
      const types = ADG.blocks.types().filter((t) => t !== 'table');
      const add = h('div', { class: 'opt-row' },
        h('select', { 'aria-label': 'Loại khối cho hàng mới', 'data-focus': 'add-type', onchange: (e) => { addType = e.target.value; } },
          types.map((t) => h('option', { value: t, selected: t === addType }, ADG.blocks.get(t).label))),
        h('button', { class: 'btn btn-sm', type: 'button', disabled: layout.length >= 40, onclick: () => {
          const key = newKey(addType, blocks), cfg = {};
          if (key !== addType) cfg.type = addType;
          if (ADG.generators.hasGenerator(addType)) cfg.auto = true;
          if (addType === 'flow') cfg.preset = 'fan';
          api.set({ layout: layout.concat([[key]]), blocks: Object.assign({}, blocks, { [key]: cfg }) });
          api.select(key);
        } }, '+ Thêm hàng'));
      ADG.dom.byId('layout-title').textContent = 'Bố cục · ' + layout.length + ' hàng';
      ADG.dom.replace(root, rows, add,
        h('p', { class: 'mut small legend' }, h('span', { class: 'tag tag-auto' }, 'auto'), ' tự sinh từ nguồn dữ liệu · ',
          h('span', { class: 'tag tag-manual' }, 'sửa tay ↺'), ' bấm khối rồi ↺ để sinh lại · ', h('span', { class: 'tag tag-preset' }, 'preset'), ' sơ đồ flow'));
    }

    draw(api.get());
    return (s, changed) => { if (changed.layout || changed.blocks || changed.selected) draw(s); };
  }

  ADG.layoutList = { mount, newKey };
})(window.ADG = window.ADG || {});
