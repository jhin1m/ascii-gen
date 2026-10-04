/* "Flow · node graph": preset cards, the DSL textarea, node details and diagnostics.
   The DSL is checked while typing; an invalid graph shows its error inline and the preview keeps
   the last valid picture (the state is only updated with a DSL that parses and can be drawn).
   Also lists side-column links the layout skipped and duplicate node ids. */
(function (ADG) {
  const { h } = ADG.dom;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const REASONS = {
    missing: 'không có node id "%s"',
    unreachable: 'không vẽ được tới "%s" (khác hàng bố cục, bị node khác che, hoặc thiếu chỗ)',
    'out-of-rows': 'mốc không cùng hàng chữ với node "%s"'
  };

  /** Parse + analyse; → { graph, plan } or { error: 'text' }. */
  function check(dsl) {
    const g = ADG.flowDsl.parse(dsl);
    if (g.error) return { error: 'Dòng ' + g.error.line + ', cột ' + g.error.col + ': ' + g.error.msg };
    const plan = ADG.flowGraph.analyze(g);
    if (plan.error) return { error: plan.error.msg };
    return { graph: g, plan };
  }

  function stats(r) {
    if (r.error) return '';
    const tables = r.graph.nodes.filter((n) => n.kind === 'table').length;
    return (r.plan.mode === 'hub' ? '1 hub · ' + (r.plan.spokes.length + r.plan.extra.length) + ' spoke' : r.plan.tiers.length + ' tầng')
      + ' · ' + r.graph.nodes.length + ' node' + (tables ? ' · ' + tables + ' bảng' : '');
  }

  function mount(root, api) {
    let key = null, pick = null, els = null, shown = null; // shown = DSL last written into the textarea
    const block = () => (key ? api.get().blocks[key] : null);
    const actorIds = () => (api.get().actors || []).map((a) => a.id);
    const dslOf = (b) => String(b.dsl || '').trim() || ADG.flowPresets.presetDsl(b.preset || 'fan', actorIds());
    const put = (patch) => api.setBlock(key, Object.assign({}, block(), patch));

    const commit = ADG.dom.debounce(() => {
      const text = els.dsl.value, r = check(text);
      els.err.textContent = r.error || '';
      els.err.hidden = !r.error;
      if (!r.error && text !== block().dsl) put({ dsl: text });
    }, 350);

    function skeleton() {
      els = {
        stats: h('span', { class: 'mut mono small' }),
        cards: h('div', { class: 'preset-cards' }),
        dsl: h('textarea', { rows: 4, spellcheck: 'false', class: 'mono', 'aria-label': 'DSL sơ đồ, mỗi dòng một chuỗi', 'aria-describedby': 'flow-err', oninput: () => commit() }),
        err: h('p', { id: 'flow-err', class: 'error-text', role: 'alert', hidden: true }),
        caption: h('input', { type: 'text', 'aria-label': 'Chú thích trước nhánh đầu tiên', onchange: (e) => put({ caption: e.target.value }) }),
        warn: h('ul', { class: 'warn-list' }),
        node: h('div', { class: 'stack' })
      };
      const help = h('div', { class: 'dsl-help mono small' }, [['a -> b', 'nối'], ['[a, b, c]', 'song song'], ['a <-> [..]', 'hub'], ['a ..> b', 'nét đứt'], ['x@table', 'dạng bảng'], [': nhãn', 'chữ trên mũi tên']]
        .map(([c, t]) => h('span', null, h('code', null, c), ' ' + t)));
      ADG.dom.replace(root,
        h('div', { class: 'sub-head' }, h('span', { class: 'opt-label' }, 'Preset'), els.stats), els.cards,
        h('label', { class: 'field-col' }, 'Gõ nhanh · mỗi dòng một chuỗi (tên = id actor hoặc tên node tự do)', els.dsl), els.err, help,
        h('label', { class: 'field-col' }, 'Chú thích nhánh đầu (markup)', els.caption),
        els.warn,
        h('details', { class: 'node-detail' }, h('summary', null, 'Chi tiết node'), els.node));
    }

    function cards(b) {
      const cur = dslOf(b);
      ADG.dom.replace(els.cards, ADG.flowPresets.ids().map((id) => {
        const dsl = ADG.flowPresets.presetDsl(id, actorIds());
        return h('button', { type: 'button', class: 'preset-card', 'aria-pressed': String(cur === dsl), onclick: () => {
          commit.cancel();
          put({ dsl, preset: id });
        } }, h('pre', { class: 'mono', 'aria-hidden': 'true' }, ADG.flowPresets.art(id)), h('span', null, ADG.flowPresets.label(id)));
      }));
    }

    function nodeForm(b, r) {
      if (r.error) { ADG.dom.replace(els.node, h('p', { class: 'mut small' }, 'Sửa lỗi DSL để chỉnh node.')); return; }
      const keys = r.graph.nodes.map((n) => n.key);
      if (keys.indexOf(pick) < 0) pick = keys[0];
      const node = r.graph.nodes.find((n) => n.key === pick), nodes = isObj(b.nodes) ? b.nodes : {};
      const data = isObj(nodes[pick]) ? nodes[pick] : {};
      const save = (patch) => put({ nodes: Object.assign({}, nodes, { [pick]: Object.assign({}, data, patch) }) });
      const select = h('select', { 'aria-label': 'Node', 'data-focus': 'node-pick', onchange: (e) => { pick = e.target.value; nodeForm(block(), r); } },
        keys.map((k) => h('option', { value: k, selected: k === pick }, k)));
      const idInput = h('label', { class: 'field-col' }, 'Id mốc (cột bên nối tới id này)',
        h('input', { type: 'text', 'data-focus': 'node-id', value: data.id || '', placeholder: pick, onchange: (e) => save({ id: e.target.value.trim() || undefined }) }));
      let body;
      if (node.kind === 'table') {
        body = ADG.schemaForm.form(ADG.blocks.get('table'), data, 'node-' + pick + '-', (k, v) => save({ [k]: v }));
      } else {
        body = h('div', { class: 'form' },
          h('label', { class: 'field-col' }, 'Nội dung · mỗi dòng một dòng (markup, trống = mặc định)',
            h('textarea', { rows: 3, class: 'mono', spellcheck: 'false', 'data-focus': 'node-lines', value: Array.isArray(data.lines) ? data.lines.join('\n') : '',
              onchange: (e) => save({ lines: e.target.value.trim() ? e.target.value.split('\n').slice(0, 10) : undefined }) })),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-focus': 'node-footer', checked: isObj(data.footer),
            onchange: (e) => save({ footer: e.target.checked ? {} : undefined }) }), ' Footer trạng thái ($ idle → running → done)'),
          h('label', { class: 'field-col' }, 'Kiểu khung', h('select', { 'data-focus': 'node-box', onchange: (e) => save({ box: e.target.value }) },
            ['solid', 'dash', 'dbl'].map((k) => h('option', { value: k, selected: (data.box || 'solid') === k }, k)))));
      }
      ADG.dom.replace(els.node, h('label', { class: 'field-col' }, 'Node', select), idInput, body);
    }

    function warnings(b, r) {
      const out = [];
      if (!r.error) {
        const nodes = isObj(b.nodes) ? b.nodes : {}, seen = {};
        r.graph.nodes.forEach((n) => {
          const id = (isObj(nodes[n.key]) && nodes[n.key].id) || n.key;
          if (seen[id]) out.push('Id node trùng: "' + id + '" (' + seen[id] + ', ' + n.key + ') — mũi tên chỉ tới node đầu.');
          else seen[id] = n.key;
        });
      }
      (api.lastRender().skipped || []).forEach((s) => out.push('Mũi tên "' + s.from + '" bị bỏ: ' + (REASONS[s.reason] || s.reason).replace('%s', s.to) + '.'));
      ADG.dom.replace(els.warn, out.map((t) => h('li', null, t)));
    }

    function draw() {
      const k = api.flowKey();
      if (!k) { key = null; els = null; ADG.dom.replace(root, h('p', { class: 'mut' }, 'Chưa có khối Sơ đồ luồng. Thêm hàng loại "Sơ đồ luồng" ở Bố cục.')); return; }
      if (k !== key || !els) { key = k; shown = null; skeleton(); }
      const b = block(), dsl = dslOf(b), r = check(dsl);
      // only a change from elsewhere (preset, JSON, template) replaces what the user is typing
      if (dsl !== shown) { if (els.dsl.value !== dsl) { els.dsl.value = dsl; els.err.hidden = true; } shown = dsl; }
      if (document.activeElement !== els.caption) els.caption.value = b.caption || '';
      els.stats.textContent = stats(r);
      cards(b);
      if (!els.node.contains(document.activeElement)) nodeForm(b, r);
      warnings(b, r);
    }

    draw();
    return (s, changed) => { if (changed.blocks || changed.layout || changed.actors || changed.render) draw(); };
  }

  ADG.flowEditor = { mount, check };
})(window.ADG = window.ADG || {});
