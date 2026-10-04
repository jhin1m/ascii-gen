module.exports = ({ ADG, test, assert }) => {
  const B = ADG.blocks;
  const ctxFor = (extra) => Object.assign(ADG.layout.makeCtx({
    actors: [{ id: 'lead', name: 'lead', color: 'a1' }, { id: 'advisor', name: 'advisor', color: 'a2' }],
    steps: ['plan', 'fork', 'delegate'], current: 1
  }), extra || {});
  const render = (type, cfg, w, extra) => B.get(type).render(cfg, w, ctxFor(extra));
  const lines = (r) => r.grid.toLines();
  const tpl = ADG.templates['agent-pipeline'].get().blocks;

  test('registry: register/get, unknown field type rejected, prototype keys are not blocks', () => {
    assert.ok(B.get('timeline'));
    assert.eq(B.get('toString'), null);
    let threw = false;
    try { B.register('bad', { schema: [{ key: 'x', type: 'colour' }], render() {} }); } catch (e) { threw = true; }
    assert.ok(threw);
    ['header', 'steps', 'side-column', 'flow', 'table', 'timeline', 'log', 'meters', 'status'].forEach((t) => assert.ok(B.get(t), t));
  });

  test('every block renders exactly its width at 24..120 cols, also with empty config', () => {
    const cfgs = { header: tpl.header, steps: {}, 'side-column': tpl.side, flow: tpl.flow, table: tpl.flow.table, timeline: tpl.timeline, log: tpl.log, meters: tpl.meters, status: tpl.status };
    Object.keys(cfgs).forEach((type) => [24, 40, 66, 120].forEach((w) => [cfgs[type], {}].forEach((cfg) => {
      const r = render(type, cfg, w);
      assert.eq(r.grid.W, w, type + '@' + w);
      assert.ok(r.grid.toLines().every((l) => Array.from(l).length === w), type + '@' + w + ' lines');
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0, type + '@' + w + ' self-check');
    })));
  });

  test('status: prompt, key [value] pairs, spinner turns with the step', () => {
    const r = render('status', { items: [{ k: 'step', v: '{a2b:fork}' }] }, 20);
    assert.deq(lines(r), ['> █                 ', 'step [fork]        /']);
    assert.eq(r.grid.cells[0][2].k, 'blink');
    assert.eq(lines(render('status', { prompt: false }, 5, { step: 2 }))[0], '    -');
  });

  test('header: title, divider with centered emblem, legend, command', () => {
    const l = lines(render('header', { title: 'T', emblem: '/##/', legend: ['a', 'b'], command: 'c' }, 20));
    assert.deq(l, ['         T          ', '========/##/========', '   [#] a    [#] b   ', '         c          ']);
    assert.eq(lines(render('header', { divider: false, title: 'x' }, 5)).length, 1);
  });

  test('steps: done +, current highlighted, todo numbered; separator tightens when narrow', () => {
    const r = render('steps', {}, 40);
    assert.eq(lines(r)[0], '   + plan  >   / fork   >  3 delegate   ');
    const cur = lines(r)[0].indexOf('/') - 1;
    assert.eq(r.grid.cells[0][cur].bg, 'hlstep');
    assert.eq(lines(render('steps', {}, 30))[0], '+ plan >  / fork  > 3 delegate');
    assert.eq(lines(render('steps', {}, 28))[0], ' + plan> / fork >3 delegate ');
    assert.eq(lines(render('steps', {}, 20))[0].slice(-1), '…');
  });

  test('meters: name + @### meter + note; stretches with minHeight', () => {
    const r = render('meters', { title: 'm', items: [{ actor: 'lead', ratio: 0.5, note: 'n' }] }, 20);
    assert.deq(lines(r).slice(1, 3), ['| lead @#####..... |', '|      n           |']);
    assert.eq(r.grid.cells[1][2].fg, 'a1');
    assert.eq(render('meters', {}, 20, { minHeight: 7 }).grid.H, 7);
  });

  test('log: only lines up to the current step, last one highlighted with a blinking cursor', () => {
    const cfg = { rows: 2, lines: [{ t: '00:01', actor: 'lead', msg: 'a', step: 0 }, { t: '00:02', actor: 'advisor', msg: 'b', step: 1 }, { t: '00:03', actor: 'lead', msg: 'c', step: 2 }] };
    const r = render('log', cfg, 30);
    assert.deq(lines(r).slice(1, 3), ['| 00:01 lead      a          |', '| 00:02 advisor   b_         |']);
    assert.eq(r.grid.cells[2][1].bg, 'logrow');
    assert.eq(r.grid.cells[2][19].k, 'blink');
    assert.eq(render('log', cfg, 30, { minHeight: 6 }).grid.H, 6, 'stretch');
  });

  test('table: header, highlighted row with marker, bar, value, route, note; anchor', () => {
    const r = render('table', tpl.flow.table, 59);
    const l = lines(r);
    assert.eq(l[3], '|>which file   [#################..:] 0.84  sharp -> code |');
    assert.eq(r.grid.cells[3][20].bg, 'hlrow');
    assert.eq(l[7].trim(), '| sharp: runs in code, lead never sees it                 |'.trim());
    assert.deq(r.anchors, [{ id: 'router', x: 0, y: 0, w: 59, h: 9 }]);
    const narrow = lines(render('table', tpl.flow.table, 30));
    assert.ok(narrow[3].indexOf('[') > 0, 'bar still shown at 30 cols');
  });

  test('timeline resample: length, activity kept, <> always 2 cells', () => {
    const rs = B.get('timeline').resample;
    assert.eq(rs('..##..', 12), '....####....');
    assert.eq(rs('..<>..', 12), '....<>......');
    assert.eq(rs('..<>..', 3), '.<>');
    assert.eq(rs('<>', 1), '.');
    assert.eq(rs('......<>', 6), '....<>');
    assert.eq(rs('|.|.|', 3), '|||');
    assert.eq(rs('', 4), '....');
    [33, 79, 120].forEach((n) => {
      const out = rs(tpl.timeline.rows[0].pattern, n);
      assert.eq(out.length, n);
      assert.eq(out.split('<>').length - 1, 3, 'three markers @' + n);
    });
  });

  test('timeline: cursor column on every row, ^ on the axis, current label bold', () => {
    const r = render('timeline', { rows: [{ actor: 'lead', pattern: '####' }] }, 40);
    const l = lines(r);
    const x = l[2].indexOf('^');
    assert.ok(x > 0);
    assert.eq(l[1][x], '|');
    assert.eq(r.grid.cells[1][x].bg, 'hlcur');
    const fork = l[3].indexOf('fork');
    assert.ok(r.grid.cells[3][fork].b && !r.grid.cells[3][l[3].indexOf('plan')].b);
  });

  test('side column: items, rail, snap to anchor and outgoing link', () => {
    const cfg = { title: 'S', items: [{ kind: 'milestone', title: 'm', q: 'q', a: 'a', link: 'n1' }, { kind: 'kv', k: 'k', v: '9' }, { kind: 'kv', k: 'j', v: '8' }, { kind: 'bogus' }] };
    const r = render('side-column', cfg, 16, { anchors: [{ id: 'n1', x: 30, y: 6, w: 10, h: 5 }] });
    const l = lines(r);
    assert.eq(l[8], '|<> m          |');
    assert.eq(l[10], '| : » a        |');
    assert.deq([l[12], l[13]], ['| : k        9 |', '| : j        8 |']);
    assert.deq(r.links, [{ x: 16, y: 8, to: 'n1' }]);
    assert.eq(lines(render('side-column', cfg, 16))[3], '|<> m          |', 'no anchor → no snap');
  });

  test('flow: anchors for every node, nodes inside the block, loop reaches the right edge', () => {
    [54, 65, 82].forEach((w) => {
      const r = render('flow', tpl.flow, w);
      assert.deq(r.anchors.map((a) => a.id), ['lead', 'router', 'worker', 'explorer', 'researcher', 'review']);
      r.anchors.forEach((a) => assert.ok(a.x >= 3 && a.x + a.w <= w, a.id + ' inside @' + w));
      const l = lines(r), lead = r.anchors[0];
      assert.eq(l[lead.y + 2][w - 1], '+', 'loop corner @' + w);
    });
  });
};
