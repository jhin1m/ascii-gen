/* "Nguồn dữ liệu": actors (name + color slot, add/remove) and steps (rename, reorder, add/remove).
   Actor ids never change once created, so blocks that refer to an actor by id (DSL nodes, timeline
   rows, {@id} tokens) follow a rename automatically. */
(function (ADG) {
  const { h } = ADG.dom;
  const SLOTS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'fg', 'mut'];
  const MAX_ACTORS = 20, MAX_STEPS = 20;

  /** Unused actor id derived from a name (letters/digits/_/- only). */
  function newId(name, taken) {
    const base = (String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'actor').slice(0, 20);
    let id = base, n = 2;
    const reserved = ['bar', 'm', 'step', 'stepn'].concat(ADG.theme.COLOR_KEYS);
    while (taken.indexOf(id) >= 0 || reserved.indexOf(id) >= 0 || /b$/.test(id) && ADG.theme.COLOR_KEYS.indexOf(id.slice(0, -1)) >= 0) id = base + n++;
    return id;
  }

  function actorsView(s, api) {
    const pal = ADG.store.palette(s);
    const actors = Array.isArray(s.actors) ? s.actors : [];
    const set = (i, patch) => api.set({ actors: actors.map((a, j) => (j === i ? Object.assign({}, a, patch) : a)) });
    const rows = actors.map((a, i) => h('div', { class: 'actor-row' },
      h('span', { class: 'dot', style: 'background:' + (pal[a.color] || pal.fg), 'aria-hidden': 'true' }),
      h('input', { type: 'text', class: 'grow', maxlength: 24, value: a.name, 'aria-label': 'Tên actor ' + a.id, 'data-focus': 'actor-name-' + a.id,
        onchange: (e) => set(i, { name: e.target.value.trim().slice(0, 24) || a.id }) }),
      h('select', { 'aria-label': 'Màu actor ' + a.id, 'data-focus': 'actor-color-' + a.id, onchange: (e) => set(i, { color: e.target.value }) },
        SLOTS.map((k) => h('option', { value: k, selected: a.color === k }, k))),
      h('span', { class: 'mono mut small', title: 'id cố định (dùng trong DSL, timeline, {@' + a.id + '})' }, a.id),
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Xoá actor ' + a.name, disabled: actors.length <= 1,
        onclick: () => api.set({ actors: actors.filter((_, j) => j !== i) }) }, '×')));
    const add = h('button', { class: 'btn btn-sm', type: 'button', disabled: actors.length >= MAX_ACTORS, onclick: () => {
      const id = newId('actor', actors.map((a) => a.id));
      api.set({ actors: actors.concat([{ id, name: id, color: SLOTS[actors.length % 6] }]) });
    } }, '+ Actor');
    return [h('div', { class: 'sub-head' }, h('span', { class: 'opt-label' }, 'Actors'), add), h('div', { class: 'stack' }, rows)];
  }

  function stepsView(s, api) {
    const steps = Array.isArray(s.steps) ? s.steps : [];
    const put = (list, step) => api.set({ steps: list, step: Math.max(0, Math.min(list.length - 1, step)) });
    const move = (i, d) => {
      const list = steps.slice(), j = i + d;
      [list[i], list[j]] = [list[j], list[i]];
      put(list, s.step === i ? j : s.step === j ? i : s.step);
    };
    const rows = steps.map((name, i) => h('div', { class: 'step-row' + (i === s.step ? ' current' : '') },
      h('span', { class: 'mono mut small' }, String(i + 1)),
      h('input', { type: 'text', class: 'grow', maxlength: 24, value: name, 'aria-label': 'Tên bước ' + (i + 1), 'data-focus': 'step-' + i,
        onchange: (e) => api.set({ steps: steps.map((x, j) => (j === i ? e.target.value.trim().slice(0, 24) || x : x)) }) }),
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Đưa bước ' + name + ' lên', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Đưa bước ' + name + ' xuống', disabled: i === steps.length - 1, onclick: () => move(i, 1) }, '↓'),
      h('button', { class: 'btn btn-icon btn-sm', type: 'button', 'aria-label': 'Xoá bước ' + name, disabled: steps.length <= 1,
        onclick: () => put(steps.filter((_, j) => j !== i), s.step > i ? s.step - 1 : s.step) }, '×')));
    const add = h('button', { class: 'btn btn-sm', type: 'button', disabled: steps.length >= MAX_STEPS,
      onclick: () => api.set({ steps: steps.concat(['step ' + (steps.length + 1)]) }) }, '+ Bước');
    return [h('div', { class: 'sub-head' }, h('span', { class: 'opt-label' }, 'Các bước'), add), h('div', { class: 'stack' }, rows)];
  }

  const KEYS = ['actors', 'steps', 'step', 'theme', 'colors'];

  function mount(root, api) {
    const draw = (s) => ADG.dom.replace(root,
      actorsView(s, api),
      stepsView(s, api),
      h('p', { class: 'mut small' }, 'Đổi tên ở đây → header, node, timeline, log, meters, status tự cập nhật (khối dùng id actor hoặc {@id}).'));
    draw(api.get());
    return (s, changed) => { if (KEYS.some((k) => changed[k])) draw(s); };
  }

  ADG.dataSourceForm = { mount, newId };
})(window.ADG = window.ADG || {});
