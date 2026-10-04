/* Block forms generated from each block's `schema` (blocks/registry.js). `list` fields are edited
   as pipe-delimited lines (core/list-codec.js). Edits commit on change. Editing an auto block turns auto off
   and keeps what was generated (plus the edit); ↺ turns auto back on. */
(function (ADG) {
  const { h } = ADG.dom;
  const { toLines, fromLines } = ADG.listCodec;

  function slotOptions(cur) {
    return [h('option', { value: '', selected: !cur }, '(mặc định)')].concat(ADG.theme.COLOR_KEYS.map((k) => h('option', { value: k, selected: cur === k }, k)));
  }

  /** One field → labelled control. onChange(key, value). */
  function control(f, cfg, idp, onChange) {
    const v = cfg[f.key], id = idp + f.key, focus = idp + f.key;
    const commit = (val) => onChange(f.key, val);
    let input;
    switch (f.type) {
      case 'bool':
        return h('label', { class: 'check' }, h('input', { type: 'checkbox', id, 'data-focus': focus, checked: v !== false, onchange: (e) => commit(e.target.checked) }), ' ' + f.label);
      case 'number':
        input = h('input', { type: 'number', id, 'data-focus': focus, value: v == null ? '' : String(v), min: f.min, max: f.max, step: 'any',
          onchange: (e) => commit(e.target.value === '' ? undefined : Number(e.target.value)) });
        break;
      case 'select':
        input = h('select', { id, 'data-focus': focus, onchange: (e) => commit(e.target.value) }, (f.options || []).map((o) => h('option', { value: o, selected: v === o }, o)));
        break;
      case 'color-slot':
        input = h('select', { id, 'data-focus': focus, onchange: (e) => commit(e.target.value || undefined) }, slotOptions(v));
        break;
      case 'list':
        input = h('textarea', { id, 'data-focus': focus, rows: Math.min(10, Math.max(3, (Array.isArray(v) ? v.length : 0) + 1)), spellcheck: 'false', class: 'mono',
          value: toLines(v, f), onchange: (e) => commit(fromLines(e.target.value, f, v)) });
        break;
      case 'textarea':
        input = h('textarea', { id, 'data-focus': focus, rows: 3, spellcheck: 'false', class: 'mono', value: v == null ? '' : String(v), onchange: (e) => commit(e.target.value) });
        break;
      default:
        input = h('input', { type: 'text', id, 'data-focus': focus, value: v == null ? '' : String(v), onchange: (e) => commit(e.target.value) });
    }
    return h('label', { class: 'field-col', for: id }, f.label, input);
  }

  /** Form for every schema field of `def`, filled from cfg. onChange(key, value). */
  function form(def, cfg, idp, onChange) {
    return h('div', { class: 'form' }, (def.schema || []).map((f) => control(f, cfg || {}, idp, onChange)));
  }

  /** Tag shown next to a block: auto / sửa tay ↺ / preset (flow) / '' (nothing to generate). */
  function tagOf(type, cfg) {
    if (type === 'flow') return 'preset';
    if (!ADG.generators.hasGenerator(type)) return '';
    return cfg && cfg.auto === true ? 'auto' : 'sửa tay ↺';
  }

  /**
   * Editor of the selected block. api: { get, blockOf(key) → { key, type, def, cfg }, generated(key),
   * editBlock(key, fields), setBlock(key, cfg), regenerate(key) }.
   */
  function mountBlockForm(root, api, key) {
    const b = key && api.blockOf(key);
    if (!b) { ADG.dom.replace(root, h('p', { class: 'mut' }, 'Chọn một khối trong Bố cục để sửa.')); return; }
    const tag = tagOf(b.type, b.cfg), auto = tag === 'auto';
    const shown = auto ? api.generated(key) : b.cfg;
    const head = h('div', { class: 'form-head' },
      h('strong', null, b.def.label + ' '), h('span', { class: 'mono mut' }, key + (b.type !== key ? ' · ' + b.type : '')),
      tag === 'sửa tay ↺' ? h('button', { class: 'btn btn-sm', type: 'button', title: 'Sinh lại nội dung từ actors + steps', onclick: () => api.regenerate(key) }, '↺ Tự sinh lại') : null,
      auto ? h('span', { class: 'tag tag-auto' }, 'auto') : null);
    const note = auto ? h('p', { class: 'mut small' }, 'Đang tự sinh từ nguồn dữ liệu. Sửa bất kỳ ô nào → chuyển sang sửa tay (giữ nội dung).') : null;
    const body = b.type === 'flow'
      ? h('p', { class: 'mut small' }, 'Sơ đồ được chỉnh ở mục Flow bên dưới.')
      : form(b.def, shown, 'bf-' + key + '-', (k, v) => api.editBlock(key, { [k]: v }));
    const common = h('div', { class: 'opt-row' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-focus': 'bf-hidden-' + key, checked: !b.cfg.hidden, onchange: (e) => api.setBlock(key, Object.assign({}, b.cfg, { hidden: !e.target.checked })) }), ' Hiển thị'));
    ADG.dom.replace(root, head, note, common, body);
  }

  ADG.schemaForm = { form, tagOf, mountBlockForm };
})(window.ADG = window.ADG || {});
