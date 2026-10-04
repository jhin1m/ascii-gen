module.exports = ({ ADG, test, assert }) => {
  const pipeline = () => ADG.templates['agent-pipeline'].get();
  const frame = (cfg, step, t, playing) => ADG.frame.renderFrame(cfg, step == null ? cfg.current : step, t || 0, { playing: !!playing });
  const text = (r) => r.grid.toLines().join('\n');
  const words = (s) => s.replace(/[\d,.]+/g, '#').replace(/[^A-Za-z\s#]/g, ' ').replace(/\s+/g, ' ');

  test('random: mulberry32 / rng are deterministic, streams independent per path', () => {
    const a = ADG.random.rng(7, 'x'), b = ADG.random.rng(7, 'x'), c = ADG.random.rng(7, 'y'), d = ADG.random.rng(8, 'x');
    const sa = [a(), a(), a()], sb = [b(), b(), b()];
    assert.deq(sa, sb);
    assert.ok(sa[0] !== c() && sa[0] !== d(), 'path and seed change the stream');
    assert.ok(sa.every((v) => v >= 0 && v < 1));
  });

  test('random: renumber keeps tags, bars, separators and digit counts', () => {
    const r = ADG.random.rng(3, 'n');
    const out = ADG.random.renumber('{a3b:1,683} forks {bar:0.5:6:a1} 643k', r);
    assert.ok(/^\{a3b:[1-9],\d{3}\} forks \{bar:0\.5:6:a1\} [1-9]\d\dk$/.test(out), out);
  });

  test('same seed → same grid; another seed → other numbers, same words', () => {
    const cfg = pipeline();
    const s0 = text(frame(cfg)), again = text(frame(pipeline()));
    assert.eq(s0, again);
    cfg.seed = 42;
    const s42 = text(frame(cfg)), s42b = text(frame(Object.assign(pipeline(), { seed: 42 })));
    assert.eq(s42, s42b, 'deterministic');
    assert.ok(s42 !== s0, 'seed changes the picture');
    const tables = (s) => s.split('\n').filter((l) => /which file/.test(l)).join();
    assert.ok(tables(s42) !== tables(s0), 'router table bar/value changed');
    assert.eq(words(s42).replace(/ /g, '').length > 0, true);
    // the words of hand-written blocks are kept (pulse marks and bars are not words)
    ['AGENT PIPELINE', 'session timeline', 'tail -f session.log', 'who sees what', 'which tool', 'never writes code'].forEach((w) => assert.ok(s42.indexOf(w) >= 0, w));
  });

  test('renaming an actor updates header, nodes, table, timeline, log, meters, status', () => {
    const cfg = pipeline();
    cfg.actors.find((a) => a.id === 'lead').name = 'chief';
    cfg.actors.find((a) => a.id === 'router').name = 'switch';
    const r = frame(cfg), s = text(r);
    assert.ok(!/\blead\b|LEAD|\brouter\b|ROUTER/.test(s), 'no old name left:\n' + s.split('\n').filter((l) => /\blead\b|LEAD|\brouter\b|ROUTER/.test(l)).join('\n'));
    ['CHIEF WORKS', 'CHIEF · main session', 'SWITCH · fork layer', 'split -> chief', 'switch ['].forEach((w) => assert.ok(s.indexOf(w) >= 0, w));
    assert.eq(ADG.grid.selfCheck(r.grid).length, 0);
  });

  test('auto blocks are generated from actors + steps; hand-written blocks are kept', () => {
    const cfg = pipeline();
    cfg.blocks.timeline.auto = true;
    cfg.blocks.log.auto = true;
    cfg.blocks.meters.lines = 'kept';
    const { cfg: out } = ADG.frame.prepare(cfg, 1);
    assert.deq(out.blocks.timeline.rows.map((r) => r.actor), ['advisor', 'lead', 'router', 'worker', 'explorer', 'researcher']);
    assert.ok(out.blocks.log.lines.length >= 7 && out.blocks.log.lines.every((l) => typeof l.msg === 'string'));
    assert.deq(out.blocks.meters.items, pipeline().blocks.meters.items, 'manual meters untouched');
    assert.eq(out.blocks.meters.lines, 'kept');
    // adding an actor + a step reaches the auto blocks
    cfg.actors.push({ id: 'tester', name: 'tester', color: 'a4' });
    cfg.steps.push('audit');
    const more = ADG.frame.prepare(cfg, 1).cfg;
    assert.ok(more.blocks.timeline.rows.some((r) => r.actor === 'tester'));
    assert.ok(more.blocks.log.lines.some((l) => l.step === 7));
  });

  test('every generator renders cleanly for each template-less config (no flow, 1 step, 0 actors)', () => {
    const blocks = { header: { auto: true, title: 'X' }, timeline: { auto: true }, log: { auto: true }, meters: { auto: true }, status: { auto: true }, side: { type: 'side-column', auto: true } };
    const layout = [['header'], ['side'], ['timeline'], [{ block: 'log', w: 2 }, 'meters'], ['status']];
    [[[], []], [[{ id: 'a', name: 'a', color: 'a1' }], ['only']], [[{ id: 'a', name: 'a', color: 'a1' }, { id: 'b', name: 'b', color: 'a2' }], ['x', 'y', 'z']]].forEach(([actors, steps]) => {
      const r = frame({ grid: { cols: 80 }, actors, steps, current: 0, layout, blocks }, 0);
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0, actors.length + ' actors');
    });
  });

  test('activity: flow tiers split the steps; actors outside the flow are on call', () => {
    const A = ADG.generators.activity(pipeline());
    assert.deq(A.byActor.lead, [0, 5, 6]);
    assert.deq(A.byActor.router, [1, 2]);
    assert.deq(A.byActor.worker, [3, 4]);
    assert.ok(A.oncall.advisor);
    const hub = pipeline();
    hub.blocks.flow.dsl = ADG.flowPresets.presetDsl('hub');
    const H = ADG.generators.activity(hub);
    assert.deq(H.byActor.lead, [0, 6]);
    assert.ok(['router', 'worker', 'explorer', 'researcher'].every((id) => H.byActor[id].length));
  });

  test('flow footers follow the activity: idle → running → done', () => {
    const footer = (step, t, playing) => text(frame(pipeline(), step, t, playing)).split('\n').filter((l) => /\$ (idle|running|done)/.test(l)).join('|');
    assert.ok(/\$ idle/.test(footer(1)) && !/running/.test(footer(1)), 'fork: workers idle (as the reference)');
    assert.ok(/\$ running/.test(footer(3)), 'work: running');
    assert.ok(/\$ done/.test(footer(6)) && !/idle/.test(footer(6)), 'ship: done');
  });

  test('playing: timeline reveals up to the cursor, paused shows everything', () => {
    const paused = text(frame(pipeline(), 0, 0, false)), early = text(frame(pipeline(), 0, 0, true));
    const hashes = (s) => (s.match(/#/g) || []).length;
    assert.ok(hashes(early) < hashes(paused), 'fewer activity marks while playing at the start');
    const late = text(frame(pipeline(), 6, 0.99, true));
    assert.ok(hashes(late) > hashes(early));
  });

  test('timeAt: steps advance with time, loop wraps, non-loop ends', () => {
    const T = ADG.frame.timeAt;
    assert.deq(T(0, 1000, 7, 0, true), { step: 0, t: 0, done: false });
    assert.deq(T(2500, 1000, 7, 0, true), { step: 2, t: 0.5, done: false });
    assert.deq(T(7500, 1000, 7, 0, true), { step: 0, t: 0.5, done: false });
    assert.deq(T(1000, 1000, 7, 6, false), { step: 6, t: 1, done: true });
    assert.deq(T(500, 1000, 7, 3, false), { step: 3, t: 0.5, done: false });
  });

  test('render 96 cols < 8 ms per frame (average of 40 frames)', () => {
    const cfg = pipeline();
    frame(cfg, 0, 0, true); // warm up
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 40; i++) frame(cfg, i % 7, (i % 10) / 10, true);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 40;
    assert.ok(ms < 8, ms.toFixed(2) + ' ms');
  });
};
