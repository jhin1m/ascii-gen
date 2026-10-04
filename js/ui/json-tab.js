/* "JSON" tab: the whole config (same payload as the .json file / share link). Typing is parsed
   400 ms after the last key; an error shows its line and the page keeps the last valid config.
   Only the keys the user changed in the text (against the text shown when editing began) are
   applied, so edits made elsewhere meanwhile, or the player's step, are not reverted. Leaving the
   tab drops an unfinished edit; the text is refreshed from the state while it is not edited. */
(function (ADG) {
  const { h } = ADG.dom;

  /** "Dòng L, cột C: " from a JSON.parse error (V8 "position N", Firefox/Safari "line L column C"), else ''. */
  function where(text, e) {
    const msg = String(e && e.message);
    const lc = /line (\d+) column (\d+)/.exec(msg);
    if (lc) return 'Dòng ' + lc[1] + ', cột ' + lc[2] + ': ';
    const m = /position (\d+)/.exec(msg);
    if (!m) return '';
    const before = text.slice(0, Number(m[1])).split('\n');
    return 'Dòng ' + before.length + ', cột ' + (before[before.length - 1].length + 1) + ': ';
  }

  /** Keys of `obj` whose value differs from `base` (JSON comparison). */
  function changedKeys(obj, base) {
    return Object.keys(obj).filter((k) => JSON.stringify(obj[k]) !== JSON.stringify(base ? base[k] : undefined));
  }

  function mount(root, api) {
    let dirty = false, shown = '';
    const text = () => JSON.stringify(ADG.configFile.wrap(api.get()), null, 2);
    const write = () => { shown = text(); area.value = shown; };
    const area = h('textarea', { class: 'mono json-area', rows: 30, spellcheck: 'false', 'aria-label': 'Toàn bộ config', 'aria-describedby': 'json-status',
      oninput: () => { dirty = true; parse(); } });
    const status = h('p', { id: 'json-status', class: 'json-status', role: 'status' });
    const show = (ok, msg) => { status.textContent = msg; status.className = 'json-status ' + (ok ? 'ok' : 'error'); };

    const parse = ADG.dom.debounce(() => {
      let obj;
      try { obj = JSON.parse(area.value); } catch (e) { show(false, '✗ ' + where(area.value, e) + 'JSON không hợp lệ (' + e.message + ')'); return; }
      try {
        const patch = ADG.configFile.validate(obj);
        let base = null;
        try { base = JSON.parse(shown); } catch (e) { /* nothing shown yet: apply everything */ }
        const keys = changedKeys(patch, base);
        const t0 = performance.now();
        const apply = {};
        keys.forEach((k) => { apply[k] = patch[k]; });
        shown = area.value; // the edited text is the new baseline
        dirty = false;
        api.set(apply);
        api.afterRender(() => show(true, '✓ JSON hợp lệ' + (keys.length ? ' · đã áp ' + keys.join(', ') + ' · render ' + (performance.now() - t0).toFixed(0) + ' ms' : '')));
      } catch (e) { show(false, '✗ ' + e.message); }
    }, 400);

    ADG.dom.replace(root,
      h('label', { class: 'field-col' }, 'Toàn bộ config', area), status,
      h('div', { class: 'opt-row' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { parse.cancel(); dirty = false; write(); show(true, '✓ Đã định dạng lại từ cấu hình hiện tại'); } }, 'Định dạng lại'),
        h('span', { class: 'mut small' }, 'Thiếu khoá nào thì giữ giá trị hiện tại; khoá lạ bị bỏ qua.')));
    write();
    show(true, '✓ JSON hợp lệ');

    /** Refresh the text from the state (force: the tab was just shown). */
    const update = (force) => {
      if (dirty || document.activeElement === area) return;
      if (force || (!root.hidden && root.offsetParent !== null)) write();
    };
    /** Leaving the tab: an unfinished (e.g. invalid) edit is dropped so it can never revert later edits. */
    update.reset = () => {
      if (!dirty) return;
      parse.cancel(); dirty = false; write();
      show(true, '✓ Bản sửa JSON chưa hợp lệ đã được bỏ');
    };
    return update;
  }

  ADG.jsonTab = { mount, where, changedKeys };
})(window.ADG = window.ADG || {});
