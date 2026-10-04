/* "JSON" tab: the whole config (same payload as the .json file / share link). Typing is parsed
   400 ms after the last key; an error shows its line and the page keeps the last valid config;
   a valid config is applied at once. The text is refreshed from the state only while the user is
   not editing it. */
(function (ADG) {
  const { h } = ADG.dom;

  /** "Dòng L, cột C" from a JSON.parse error message that carries a position, else ''. */
  function where(text, e) {
    const m = /position (\d+)/.exec(e && e.message) || /column (\d+)/.exec(e && e.message);
    if (!m || !/position/.test(m[0])) return '';
    const before = text.slice(0, Number(m[1])).split('\n');
    return 'Dòng ' + before.length + ', cột ' + (before[before.length - 1].length + 1) + ': ';
  }

  function mount(root, api) {
    let dirty = false;
    const text = () => JSON.stringify(ADG.configFile.wrap(api.get()), null, 2);
    const area = h('textarea', { class: 'mono json-area', rows: 30, spellcheck: 'false', 'aria-label': 'Toàn bộ config', 'aria-describedby': 'json-status',
      oninput: () => { dirty = true; parse(); }, onblur: () => { if (!dirty) area.value = text(); } });
    const status = h('p', { id: 'json-status', class: 'json-status', role: 'status' });
    const show = (ok, msg) => { status.textContent = msg; status.className = 'json-status ' + (ok ? 'ok' : 'error'); };

    const parse = ADG.dom.debounce(() => {
      let obj;
      try { obj = JSON.parse(area.value); } catch (e) { show(false, '✗ ' + where(area.value, e) + 'JSON không hợp lệ (' + e.message + ')'); return; }
      try {
        const patch = ADG.configFile.validate(obj);
        const t0 = performance.now();
        api.set(patch);
        dirty = false;
        api.afterRender(() => show(true, '✓ JSON hợp lệ · render ' + (performance.now() - t0).toFixed(0) + ' ms'));
      } catch (e) { show(false, '✗ ' + e.message); }
    }, 400);

    ADG.dom.replace(root,
      h('label', { class: 'field-col' }, 'Toàn bộ config', area), status,
      h('div', { class: 'opt-row' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { parse.cancel(); dirty = false; area.value = text(); show(true, '✓ Đã định dạng lại từ cấu hình hiện tại'); } }, 'Định dạng lại'),
        h('span', { class: 'mut small' }, 'Thiếu khoá nào thì giữ giá trị hiện tại; khoá lạ bị bỏ qua.')));
    area.value = text();
    show(true, '✓ JSON hợp lệ');
    return () => { if (!dirty && document.activeElement !== area && !root.hidden && root.offsetParent !== null) area.value = text(); };
  }

  ADG.jsonTab = { mount, where };
})(window.ADG = window.ADG || {});
