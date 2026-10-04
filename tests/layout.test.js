module.exports = ({ ADG, test, assert, warnings }) => {
  const { split, clampCols } = ADG.layout;
  const compose = (cfg, frame) => ADG.layout.compose(ADG.generators.resolveTokens(cfg || {}), frame);
  const { selfCheck } = ADG.grid;
  const pipeline = () => ADG.templates['agent-pipeline'].get();
  const linesOk = (g) => g.toLines().every((l) => Array.from(l).length === g.W);

  test('split: widths sum to total, remainder goes to the last block', () => {
    assert.deq(split(93, [0.3, 0.7]), [27, 66]);
    assert.deq(split(10, [1, 1, 1]), [3, 3, 4]);
    assert.deq(split(10, [undefined, 'x']), [5, 5]);
    [[93, [0.62, 0.38]], [77, [0.3, 0.7]], [117, [1, 2, 3]]].forEach(([t, ws]) => assert.eq(split(t, ws).reduce((a, b) => a + b, 0), t));
  });

  test('cols are clamped and default to 96', () => {
    assert.eq(clampCols(undefined), 96);
    assert.eq(clampCols(5), 40);
    assert.eq(clampCols(9999), 240);
    assert.eq(compose({ grid: { cols: 'x' }, layout: [] }).cols, 96);
  });

  ['ascii', 'unicode'].forEach((border) => [80, 96, 120].forEach((cols) => [0, 3, 6].forEach((step) => {
    test('agent pipeline ' + cols + ' cols × ' + border + ' × step ' + step + ': exact width, self-check 0', () => {
      const cfg = pipeline();
      Object.assign(cfg, { border, current: step });
      cfg.grid.cols = cols;
      const before = warnings.length;
      const { grid, rows } = compose(cfg);
      assert.eq(grid.W, cols);
      assert.eq(grid.H, rows);
      assert.ok(linesOk(grid), 'every line is W cells');
      assert.deq(selfCheck(grid), []);
      assert.eq(warnings.length, before, 'no console warnings');
    });
  })));

  test('agent pipeline 96 cols is 96×70 (reference screenshot: 96×68)', () => {
    const { cols, rows } = compose(pipeline());
    assert.deq([cols, rows], [96, 70]);
  });

  test('anchors are absolute: each points at a box corner on the page grid', () => {
    const { grid, anchors } = compose(pipeline());
    assert.deq(anchors.map((a) => a.id), ['lead', 'router', 'worker', 'explorer', 'researcher', 'review']);
    anchors.forEach((a) => {
      assert.eq(grid.cells[a.y][a.x].ch, '+', a.id + ' top-left');
      assert.eq(grid.cells[a.y + a.h - 1][a.x + a.w - 1].ch, '+', a.id + ' bottom-right');
    });
  });

  test('side column milestones snap to their node and get an arrow up to its left edge', () => {
    const { grid, anchors } = compose(pipeline());
    const lines = grid.toLines();
    ['lead', 'worker', 'review'].forEach((id) => {
      const a = anchors.find((t) => t.id === id);
      const rows = lines.map((l, y) => y).filter((y) => y >= a.y && y < a.y + a.h && lines[y].slice(2, 4) === '<>');
      assert.eq(rows.length, 1, id + ' has one milestone beside it');
      assert.eq(lines[rows[0]][a.x - 1], '>', id + ' arrow head');
    });
  });

  test('stretch blocks re-render at the row height', () => {
    const cfg = pipeline();
    cfg.layout = [[{ block: 'side', w: 0.3 }, { block: 'flow', w: 0.7 }]];
    cfg.blocks.side.items = [];
    const { grid } = compose(cfg);
    const lines = grid.toLines();
    assert.eq(lines[1][1], '+', 'side box top');
    assert.eq(lines[grid.H - 1][1], '+', 'side box bottom on the last row of the row');
    assert.eq(lines[grid.H - 2][3], ':', 'rail extends');
  });

  test('hiding a block or removing a row recomputes the height', () => {
    const full = compose(pipeline()).rows;
    const a = pipeline(); a.blocks.timeline.hidden = true;
    assert.eq(compose(a).rows, full - 11, 'timeline (10 rows) + gap');
    const b = pipeline(); b.blocks.side.hidden = true;
    const r = compose(b);
    assert.ok(r.rows <= full && r.rows > full - 5, 'flow sets the row height');
    assert.ok(linesOk(r.grid));
    const c = pipeline(); c.blocks.flow.hidden = true;
    assert.ok(compose(c).rows < full, 'side column shrinks without snap targets');
  });

  test('reordering rows moves blocks', () => {
    const cfg = pipeline();
    cfg.layout = [['status'], ['header']];
    const lines = compose(cfg).grid.toLines();
    assert.eq(lines[1].trim(), '> █');
    assert.ok(lines[4].indexOf('AGENT PIPELINE') >= 0);
  });

  test('unknown blocks are skipped with a warning; a throwing block becomes an error line', () => {
    ADG.blocks.register('boom', { render() { throw new Error('kaput'); } });
    const before = warnings.length;
    const { grid } = compose({ grid: { cols: 40 }, layout: [['nope'], ['boom']], blocks: {} });
    assert.ok(warnings.length >= before + 2);
    assert.eq(grid.H, 2);
    assert.eq(grid.toLines()[1].trim(), '[!] boom: kaput');
  });

  test('empty or missing layout yields a blank 1-row grid', () => {
    assert.eq(compose({}).grid.H, 1);
    assert.eq(compose({ layout: 'x' }).grid.H, 1);
  });

  test('typo in a link id is reported as missing; the fan template skips nothing', () => {
    const cfg = pipeline();
    assert.deq(compose(cfg).skipped, []);
    cfg.blocks.side.items[0].link = 'leadd';
    assert.deq(compose(cfg).skipped, [{ from: 'before a plan', to: 'leadd', reason: 'missing' }]);
  });

  test('links to missing anchors draw nothing', () => {
    const cfg = pipeline();
    cfg.blocks.side.items[0].link = 'ghost';
    const { grid, anchors, skipped } = compose(cfg);
    assert.deq(skipped, [{ from: 'before a plan', to: 'ghost', reason: 'missing' }]);
    const lead = anchors.find((t) => t.id === 'lead');
    const y = grid.toLines().findIndex((l) => l.indexOf('<> before a plan') >= 0);
    assert.eq(y, 8 + 3, 'first item row (side column starts on row 8)');
    assert.eq(grid.toLines()[y].slice(28, lead.x).trim(), '');
  });

  const warnedLink = (fn) => {
    const before = warnings.length;
    const out = fn();
    return { out, warned: warnings.slice(before).some((w) => String(w[0]).indexOf('no clear path') >= 0) };
  };

  test('link to a node behind a sibling box is dropped, boxes stay intact', () => {
    const cfg = pipeline();
    cfg.blocks.side.items[8].link = 'researcher';
    const { out, warned } = warnedLink(() => compose(cfg));
    const worker = out.anchors.find((a) => a.id === 'worker');
    const l = out.grid.toLines();
    for (let y = worker.y + 1; y < worker.y + worker.h - 1; y++) assert.eq(l[y][worker.x + worker.w - 1], '|', 'worker right border row ' + y);
    assert.ok(!warned, 'skipped links are reported, not logged');
    assert.deq(out.skipped, [{ from: 'error again', to: 'researcher', reason: 'unreachable' }]);
  });

  test('link whose milestone cannot reach the node rows is dropped', () => {
    const cfg = pipeline();
    cfg.blocks.side.items = [{ kind: 'gap', n: 12 }, { kind: 'milestone', title: 'late', link: 'lead' }];
    const { out, warned } = warnedLink(() => compose(cfg));
    const y = out.grid.toLines().findIndex((t) => t.indexOf('<> late') >= 0);
    assert.ok(y > 0, 'milestone drawn');
    assert.ok(out.grid.toLines()[y].slice(28).indexOf('- -') < 0, 'no dashed arrow');
    assert.ok(!warned, 'skipped links are reported, not logged');
    assert.deq(out.skipped, [{ from: 'late', to: 'lead', reason: 'out-of-rows' }]);
  });

  test('link never crosses a block placed between source and target', () => {
    const cfg = pipeline();
    cfg.layout[2] = [{ block: 'side', w: 0.25 }, { block: 'meters', w: 0.25 }, { block: 'flow', w: 0.5 }];
    const { out } = warnedLink(() => compose(cfg));
    assert.ok(out.grid.toLines().some((t) => t.indexOf('who sees what') >= 0), 'meters title intact');
    assert.ok(linesOk(out.grid));
  });

  test('invalid colors and reserved actor ids never reach the cells', () => {
    const cfg = pipeline();
    cfg.actors.push({ id: 'a1', name: 'hijack', color: 'a3' }, { id: 'x', name: 'x', color: 'constructor' });
    cfg.blocks.header.legendColor = 'a1:x} {lead';
    cfg.blocks.side.color = 'red';
    cfg.blocks.flow.nodes.router.color = '__proto__';
    const { grid } = compose(cfg);
    const keys = ADG.theme.COLOR_KEYS;
    grid.cells.forEach((row) => row.forEach((c) => {
      assert.ok(keys.indexOf(c.fg) >= 0, 'fg ' + c.fg);
      assert.ok(c.bg === null || keys.indexOf(c.bg) >= 0, 'bg ' + c.bg);
    }));
    assert.eq(ADG.layout.makeCtx(cfg).slot('a1'), null);
    assert.eq(ADG.layout.makeCtx(cfg).slot('x'), 'fg');
  });

  test('huge lists are capped so a share link cannot explode the page', () => {
    const cfg = pipeline();
    const big = (n, f) => Array.from({ length: n }, f);
    cfg.blocks.timeline.rows = big(5000, () => ({ actor: 'lead', pattern: '#' }));
    cfg.blocks.flow.nodes.router.rows = big(3000, () => ({ name: 'r', ratio: 0.5 }));
    cfg.blocks.flow.nodes.lead.lines = big(500, () => 'x');
    cfg.layout = cfg.layout.concat(big(200, () => ['timeline']));
    const { rows, grid } = compose(cfg);
    assert.ok(rows <= 400, 'rows ' + rows);
    assert.ok(linesOk(grid));
  });
};

