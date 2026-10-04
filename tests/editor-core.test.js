module.exports = ({ ADG, test, assert, sandbox }) => {
  const C = ADG.listCodec;

  test('store: batched notifications with the changed keys; unchanged values are not reported', () => {
    const queue = [];
    const s = ADG.store.create({ a: 1, b: 2 }, (fn) => queue.push(fn));
    const seen = [];
    s.subscribe((st, ch) => seen.push([st.a, st.b, Object.keys(ch).sort().join()]));
    s.set({ a: 1 });
    assert.eq(queue.length, 0, 'no-op set does not schedule');
    s.set({ a: 5 }); s.set({ b: 7 });
    assert.eq(queue.length, 1, 'one flush per batch');
    queue.shift()();
    assert.deq(seen, [[5, 7, 'a,b']]);
  });

  test('store.toConfig maps the state to a layout config', () => {
    const st = Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content('agent-pipeline'), { cols: 80, seed: 9 });
    const c = ADG.store.toConfig(st);
    assert.eq(c.grid.cols, 80); assert.eq(c.seed, 9); assert.eq(c.current, 1);
    assert.eq(ADG.frame.renderFrame(c, 1).cols, 80);
  });

  test('list codec: round trip with pipes, line breaks, numbers and kept extra fields', () => {
    const field = { fields: ['name', 'ratio', 'route'] };
    const items = [{ name: 'a|b', ratio: 0.5, route: 'x', color: 'a2' }, { name: 'two\nlines', ratio: 1 }];
    const text = C.toLines(items, field);
    assert.eq(text, 'a\\|b | 0.5 | x\ntwo\\nlines | 1');
    assert.deq(C.fromLines(text, field, items), items);
    // single-field lists stay plain strings
    assert.deq(C.fromLines('lead high\n\nworkers', { fields: ['text'] }, ['x']), ['lead high', 'workers']);
  });

  test('list codec: deleting or inserting a line never moves hidden fields to another item', () => {
    const field = { fields: ['actor', 'pattern'] };
    const rows = [{ actor: 'lead', pattern: '##', color: 'a1' }, { actor: 'worker', pattern: '..##', color: 'a4' }];
    assert.deq(C.fromLines('worker | ..##', field, rows), [{ actor: 'worker', pattern: '..##', color: 'a4' }]);
    assert.deq(C.fromLines('new | #\nlead | ##\nworker | ..##', field, rows)[0], { actor: 'new', pattern: '#' });
    assert.deq(C.fromLines('lead | ###\nworker | ..##', field, rows)[0], { actor: 'lead', pattern: '###', color: 'a1' }, 'edited line keeps its own');
  });

  test('list codec: side-column variants by kind', () => {
    const f = ADG.blocks.get('side-column').schema.find((x) => x.key === 'items');
    const items = [{ kind: 'milestone', title: 't', q: 'q?', a: 'a', link: 'lead', snap: false }, { kind: 'kv', k: 'calls', v: '6' }, { kind: 'gap', n: 2 }];
    const text = C.toLines(items, f);
    assert.eq(text.split('\n')[0], 'milestone | t | q? | a | lead');
    assert.deq(C.fromLines(text, f, items), items, 'snap kept');
  });

  test('config file: content fields validated (actors, steps, layout, blocks, colors)', () => {
    const tpl = ADG.templateList.content('ci-cd-build');
    const ok = ADG.configFile.validate(Object.assign({ version: 1 }, tpl, { colors: { bg: '#000000' }, speed: 800, loop: false, blink: false }));
    assert.eq(ok.template, 'ci-cd-build');
    assert.eq(ok.actors.length, 7);
    const bad = (patch) => { try { ADG.configFile.validate(Object.assign({ version: 1 }, patch)); return null; } catch (e) { return e.message; } };
    assert.ok(/actors/.test(bad({ actors: [{ id: 'a', name: 'a', color: 'a1' }, { id: 'a', name: 'b', color: 'a2' }] })), 'duplicate ids');
    assert.ok(/actors/.test(bad({ actors: [{ id: 'bad id', name: 'x', color: 'a1' }] })));
    assert.ok(/layout/.test(bad({ layout: [[{ block: 'x', w: -1 }]] })));
    assert.ok(/blocks/.test(bad({ blocks: { x: 'str' } })));
    assert.ok(/colors/.test(bad({ colors: { bg: 'red' } })));
    assert.ok(/template/.test(bad({ template: 'nope' })));
    // a full state survives wrap → validate
    const st = Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content('server-monitor'));
    const wrapped = JSON.parse(JSON.stringify(ADG.configFile.wrap(st)));
    const back = ADG.configFile.validate(wrapped);
    delete wrapped.version;
    assert.deq(back, wrapped);
  });

  test('storage: blocked or throwing localStorage never breaks load/save', () => {
    const g = sandbox, had = Object.getOwnPropertyDescriptor(g, 'localStorage'); // the vm global the sources see
    Object.defineProperty(g, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      assert.eq(ADG.storage.load(), null);
      assert.eq(ADG.storage.saveNow({ cols: 80 }), false);
    } finally {
      if (had) Object.defineProperty(g, 'localStorage', had); else delete g.localStorage;
    }
    const mem = {};
    Object.defineProperty(g, 'localStorage', { configurable: true, value: { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } } });
    try {
      assert.eq(ADG.storage.saveNow(Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content('blank'), { cols: 120 })), true);
      assert.eq(ADG.storage.load().cols, 120);
      mem[ADG.storage.KEY] = '{broken';
      assert.eq(ADG.storage.load(), null, 'corrupt save ignored');
    } finally { delete g.localStorage; }
  });

  test('templates: every template × 2 borders × 80/96/120 × every step, playing or not: 0 self-check issues, no skipped links', () => {
    ADG.templateList.ids().forEach((id) => ['ascii', 'unicode'].forEach((border) => [80, 96, 120].forEach((cols) => {
      const st = Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content(id), { border, cols });
      const cfg = ADG.store.toConfig(st);
      cfg.steps.forEach((_, step) => [false, true].forEach((playing) => {
        const r = ADG.frame.renderFrame(cfg, step, 0.5, { playing });
        assert.eq(ADG.grid.selfCheck(r.grid).length, 0, id + ' ' + border + ' ' + cols + ' step ' + step);
        assert.deq(r.skipped, [], id + ' skipped links');
      }));
    })));
  });

  test('flow presets fit other actor ids; default ids keep the original DSL', () => {
    assert.eq(ADG.flowPresets.presetDsl('fan'), 'lead -> router@table -> [worker, explorer, researcher] -> lead\nrouter ..> lead : split');
    assert.eq(ADG.flowPresets.presetDsl('hub', ['api', 'db']), 'api <-> [db, n3, n4, n5]\napi -> health@table');
    assert.eq(ADG.flowPresets.presetDsl('nope'), '');
  });

};
