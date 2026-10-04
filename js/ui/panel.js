/* Editor panel: tabs (Khối / Giao diện / JSON), the collapse button, and the sections of the
   Khối tab. Desktop and mobile share this markup: on narrow screens (≤ 720px) the CSS stacks the
   panel under the preview and the <details> sections act as an accordion (closed at start).
   mount() returns one update(state, changed) that forwards to every section. */
(function (ADG) {
  const { byId } = ADG.dom;
  const TABS = ['blocks', 'style', 'json'];

  function tabs(onShow) {
    const btns = TABS.map((t) => byId('tab-btn-' + t));
    const show = (t) => {
      TABS.forEach((x, i) => {
        btns[i].setAttribute('aria-selected', String(x === t));
        btns[i].tabIndex = x === t ? 0 : -1;
        byId('tab-' + x).hidden = x !== t;
      });
      onShow(t);
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => show(TABS[i]));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const j = (i + d + TABS.length) % TABS.length;
        show(TABS[j]); btns[j].focus();
      });
    });
    show('blocks');
  }

  function collapse() {
    const btn = byId('panel-toggle');
    btn.addEventListener('click', () => {
      const hide = !document.body.classList.contains('panel-hidden');
      document.body.classList.toggle('panel-hidden', hide);
      btn.setAttribute('aria-expanded', String(!hide));
      ADG.preview.fit();
    });
  }

  /** @returns {(state, changed) => void} */
  function mount(api) {
    const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
    if (narrow) document.querySelectorAll('#panel details.sect').forEach((d) => { d.open = false; });
    const blockForm = () => {
      const key = api.selected(), b = key && api.blockOf(key);
      byId('block-title').textContent = b ? 'Khối · ' + b.def.label : 'Khối';
      ADG.schemaForm.mountBlockForm(byId('block-form'), api, key);
    };
    const ups = [
      ADG.dataSourceForm.mount(byId('data-source'), api),
      ADG.layoutList.mount(byId('layout-list'), api),
      ADG.flowEditor.mount(byId('flow-editor'), api),
      ADG.styleTab.mount(byId('tab-style'), api)
    ];
    const json = ADG.jsonTab.mount(byId('tab-json'), api);
    blockForm();
    tabs((t) => { if (t === 'json') json(); });
    collapse();
    return (s, changed) => {
      ups.forEach((u) => u(s, changed));
      if (changed.blocks || changed.selected || changed.layout || (changed.step && api.selected())) blockForm();
      if (!changed.render) json();
    };
  }

  /** Open a section and bring it into view (selecting a block from the layout list). */
  function reveal(id) {
    const d = byId(id);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  ADG.panel = { mount, reveal };
})(window.ADG = window.ADG || {});
