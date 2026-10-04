module.exports = ({ ADG, test, assert, warnings }) => {
  const { compose } = ADG.layout;
  const pipeline = () => ADG.templates['agent-pipeline'].get();
  const ctxFor = (cfg) => ADG.layout.makeCtx(cfg || { actors: [], steps: [] });
  const renderFlow = (cfg, w) => ADG.blocks.get('flow').render(cfg, w, ctxFor());
  const linesOf = (r) => r.grid.toLines();
  const widthsOk = (r, w) => r.grid.W === w && linesOf(r).every((l) => Array.from(l).length === w);
  const inside = (r, w) => r.anchors.every((a) => a.x >= 3 && a.x + a.w <= w && a.y >= 0 && a.y + a.h <= r.grid.H);

  ['ascii', 'unicode'].forEach((border) => [80, 96, 120].forEach((cols) => {
    test('pipeline flow ' + cols + ' cols × ' + border + ': self-check 0, every node anchored, side links drawn', () => {
      const cfg = pipeline();
      cfg.border = border; cfg.grid.cols = cols;
      const before = warnings.length;
      const r = compose(cfg);
      assert.eq(warnings.length, before, 'no warnings (self-check, link path)');
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0);
      assert.deq(['lead', 'router', 'worker', 'explorer', 'researcher', 'review'].filter((id) => !r.anchors.some((a) => a.id === id)), []);
      const text = r.grid.toLines().join('\n');
      assert.ok(/<- /.test(text) || /<[-─╌ ]/.test(text), 'back edge head');
      assert.ok(text.indexOf('split') > 0, 'back edge label');
      // all themes resolve every color key used by the flow cells
      Object.keys(ADG.theme.THEMES).forEach((t) => {
        const pal = ADG.theme.palette(t);
        r.grid.cells.forEach((row) => row.forEach((c) => assert.ok(pal[c.fg] !== undefined, t + ' fg ' + c.fg)));
      });
    });
  }));

  test('hub preset: center double border, spokes around it, table below, anchors', () => {
    const cfg = { dsl: ADG.flowPresets.presetDsl('hub', {}) };
    [80, 96, 120].forEach((w) => ['ascii', 'unicode'].forEach((border) => {
      const r = ADG.blocks.get('flow').render(cfg, w, ADG.layout.makeCtx({ border, actors: [], steps: [] }));
      assert.ok(widthsOk(r, w));
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0);
      assert.deq(r.anchors.map((a) => a.id).sort(), ['explorer', 'health', 'lead', 'researcher', 'router', 'worker']);
      assert.ok(inside(r, w));
      const A = Object.fromEntries(r.anchors.map((a) => [a.id, a]));
      assert.ok(A.router.y + A.router.h <= A.lead.y && A.worker.x + A.worker.w < A.lead.x && A.lead.x + A.lead.w < A.explorer.x, 'spoke positions');
      assert.ok(A.researcher.y >= A.lead.y + A.lead.h && A.health.y >= A.researcher.y + A.researcher.h, 'bottom + tail');
      const l = linesOf(r), midRow = A.lead.y + Math.floor(A.lead.h / 2);
      assert.ok(/<[-─]+>/.test(l[midRow]) || l[midRow].indexOf('<->') > 0, 'both-way arrows');
      assert.ok(/^[╔+][═=]/.test(Array.from(l[A.lead.y]).slice(A.lead.x, A.lead.x + 2).join('')), 'center is double');
    }));
  });

  test('hub: 5th+ spokes go to a table below, each still anchored', () => {
    const r = renderFlow({ dsl: 'h <-> [a, b, c, d, e, f]' }, 96);
    assert.ok(widthsOk(r, 96));
    assert.deq(r.anchors.map((a) => a.id).sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'h']);
    const A = Object.fromEntries(r.anchors.map((a) => [a.id, a]));
    assert.ok(A.e.y > A.d.y && A.f.y === A.e.y + 1, 'rows of the extra table');
    assert.ok(linesOf(r)[A.e.y].indexOf('e') > 0);
  });

  test('tiers: chain, fan-in to a table, parallel columns, wrapped tier; widths exact 40..120', () => {
    const dsls = [
      'a -> b -> c -> d',
      'a -> [b, c] -> d@table',
      'a -> b\nc -> d',
      'a -> [b, c, d, e, f, g]',
      'a ..> b : label here',
      '[a, b, c] -> t@table : x',
      'a -> b@table -> c ..> a\nb ..> a : back'
    ];
    dsls.forEach((dsl) => [40, 54, 80, 96, 120].forEach((w) => {
      const before = warnings.length;
      const r = renderFlow({ dsl }, w);
      assert.ok(r.anchors, dsl + ' @' + w + ' should be drawable');
      assert.ok(widthsOk(r, w), dsl + ' @' + w);
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0, dsl + ' @' + w);
      assert.eq(warnings.length, before);
      assert.eq(r.anchors.length, ADG.flowDsl.parse(dsl).nodes.length, 'every node anchored');
      assert.ok(inside(r, w), dsl + ' anchors inside @' + w);
    }));
    const wrap = renderFlow({ dsl: dsls[3] }, 96);
    assert.eq(wrap.anchors.length, 7);
    assert.ok(wrap.anchors[5].y > wrap.anchors[1].y, 'tier wraps onto a second row after 4');
    assert.eq(wrap.anchors[1].y, wrap.anchors[4].y);
  });

  test('node data: default box in the actor color, id override, footer, per-instance data', () => {
    const cfg = { actors: [{ id: 'lead', name: 'lead', color: 'a1' }], steps: [] };
    const flow = { dsl: 'lead -> x -> lead', nodes: { 'lead#2': { id: 'end', lines: ['Done'], footer: { status: 'ok', ratio: 1, badge: 'B' } } } };
    const r = ADG.blocks.get('flow').render(flow, 60, ADG.layout.makeCtx(cfg));
    assert.deq(r.anchors.map((a) => a.id), ['lead', 'x', 'end']);
    const l = linesOf(r);
    assert.ok(l.some((s) => s.indexOf('$ ok') > 0), 'footer of the second instance');
    const a = r.anchors[0];
    assert.eq(r.grid.cells[a.y][a.x].fg, 'a1', 'actor color on the border');
  });

  test('invalid or unsupported DSL becomes one error line of exact width; empty DSL uses the preset', () => {
    [['a ->', /line 1, col 5/], ['a -> b -> c\na -> c', /unsupported/], ['h <-> [a, b]\na -> b', /unsupported/]].forEach(([dsl, re]) => {
      const r = renderFlow({ dsl }, 70);
      assert.eq(r.grid.H, 1);
      assert.ok(widthsOk(r, 70));
      assert.ok(re.test(linesOf(r)[0]), linesOf(r)[0]);
      assert.ok(!r.anchors);
    });
    const hub = renderFlow({ preset: 'hub' }, 96);
    assert.ok(hub.anchors.some((a) => a.id === 'lead'));
    assert.eq(hub.anchors.length, 6);
    assert.eq(renderFlow({}, 96).anchors.length, 6, 'fan by default');
    assert.eq(renderFlow({ dsl: 'h <-> [a, b]' }, 20).grid.H, 1, 'hub too narrow → error line');
  });

  test('actor rename: titles follow the actor, anchors and node data stay', () => {
    const run = (name) => {
      const cfg = pipeline();
      cfg.actors.find((x) => x.id === 'lead').name = name;
      cfg.actors.find((x) => x.id === 'router').name = 'Điều phối';
      const before = warnings.length;
      const r = compose(cfg);
      assert.eq(warnings.length, before, 'no link warnings');
      return { r, text: r.grid.toLines().join('\n') };
    };
    const a = run('lead'), b = run('Trưởng nhóm');
    assert.eq((b.text.match(/>\|/g) || []).length, 3, 'side arrows to lead, worker, review still drawn');
    assert.deq(b.r.anchors.map((x) => x.id), a.r.anchors.map((x) => x.id), 'anchor ids stable');
    ['lead', 'review', 'worker'].forEach((id) => assert.ok(b.r.anchors.some((x) => x.id === id), id));
    assert.ok(b.text.indexOf('LEAD · main session') > 0, 'custom node data kept');
    // a default-data node (no cfg.nodes entry) shows the renamed actor
    const r = ADG.blocks.get('flow').render({ dsl: 'lead -> router' }, 60, ADG.layout.makeCtx({ actors: [{ id: 'lead', name: 'Trưởng nhóm', color: 'a1' }, { id: 'router', name: 'Điều phối', color: 'a3' }], steps: [] }));
    const t = r.grid.toLines().join('\n');
    assert.ok(t.indexOf('Trưởng nhóm') > 0 && t.indexOf('Điều phối') > 0, t);
    assert.deq(r.anchors.map((x) => x.id), ['lead', 'router']);
  });

  test('free node named like a prototype property renders with its own data', () => {
    const r = renderFlow({ dsl: 'constructor -> toString', nodes: { constructor: { id: 'c1', lines: ['CTOR'] } } }, 60);
    assert.deq(r.anchors.map((a) => a.id), ['c1', 'toString']);
    assert.ok(linesOf(r).join('').indexOf('CTOR') > 0);
  });

  test('hub preset in the pipeline template: unreachable side links are skipped, 0 warnings', () => {
    ['ascii', 'unicode'].forEach((border) => [80, 96, 120].forEach((cols) => {
      const cfg = pipeline();
      cfg.border = border; cfg.grid.cols = cols;
      cfg.blocks.flow.dsl = ADG.flowPresets.presetDsl('hub');
      cfg.blocks.flow.nodes = {};
      const before = warnings.length;
      const r = compose(cfg);
      assert.eq(warnings.length, before, 'warnings @' + cols);
      assert.eq(ADG.grid.selfCheck(r.grid).length, 0);
      const by = Object.fromEntries(r.skipped.map((k) => [k.to, k.reason]));
      assert.deq(by, { lead: 'unreachable', worker: 'out-of-rows', review: 'missing' }, 'skipped @' + cols);
    }));
  });

  test('hostile node data does not break the flow', () => {
    const r = renderFlow({ dsl: 'a -> b@table -> [c, d]', nodes: { a: { lines: 'x', color: '__proto__', box: 'zzz', footer: [] }, b: { rows: 'nope', cols: 5, color: 'constructor' }, c: null, d: 7 } }, 80);
    assert.ok(widthsOk(r, 80));
    r.grid.cells.forEach((row) => row.forEach((c) => assert.ok(ADG.theme.COLOR_KEYS.indexOf(c.fg) >= 0, c.fg)));
  });
};
