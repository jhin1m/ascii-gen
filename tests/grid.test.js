module.exports = ({ ADG, test, assert, warnings }) => {
  const { createGrid, selfCheck } = ADG.grid;
  const row = (g, y) => g.toLines()[y];
  const ACTORS = { lead: 'a1' };

  test('blank grid is W×H spaces and passes self-check', () => {
    const g = createGrid(10, 3);
    assert.deq(g.toLines(), ['          ', '          ', '          ']);
    assert.eq(selfCheck(g).length, 0);
  });

  test('put ignores out-of-bounds and keeps bg when not given', () => {
    const g = createGrid(4, 2);
    g.put(-1, 0, 'x'); g.put(4, 0, 'x'); g.put(0, 2, 'x');
    assert.eq(row(g, 0), '    ');
    g.fillBg(0, 0, 4, 'hlrow');
    g.put(1, 0, 'a', 'a1', true);
    assert.deq(g.cells[0][1], { ch: 'a', fg: 'a1', bg: 'hlrow', b: true, k: '' });
    g.put(1, 0, 'b', 'a2', false, 'logrow');
    assert.eq(g.cells[0][1].bg, 'logrow');
  });

  test('text / center / right place cells exactly', () => {
    const g = createGrid(12, 3);
    assert.eq(g.text(1, 0, 'abc', 'a1'), 3);
    g.center(0, 12, 1, 'mid');
    g.right(11, 2, 'end');
    assert.deq(g.toLines(), [' abc        ', '    mid     ', '         end']);
    assert.eq(g.cells[0][1].fg, 'a1');
  });

  test('center clips markup wider than its box with …', () => {
    const g = createGrid(8, 1);
    g.center(1, 6, 0, '{a1:abcdefghij}');
    assert.eq(row(g, 0), ' abcde… ');
    assert.eq(g.cells[0][6].fg, 'a1');
  });

  test('mtext colors, bold and inline bar', () => {
    const g = createGrid(20, 1, { actors: ACTORS });
    const n = g.mtext(0, 0, '{lead:ld} {bar:0.5:6:a2} **b**');
    assert.eq(n, 11);
    assert.eq(row(g, 0), 'ld [##.:] b         ');
    assert.deq([g.cells[0][0].fg, g.cells[0][0].b], ['a1', true]);
    assert.deq([g.cells[0][4].fg, g.cells[0][4].ch], ['a2', '#']);
    assert.deq([g.cells[0][3].fg, g.cells[0][10].b], ['mut', true]);
  });

  test('mtext maxW stops before a bar that does not fit', () => {
    const g = createGrid(10, 1);
    assert.eq(g.mtext(0, 0, 'ab {bar:1:8:a1}', 'fg', false, null, 6), 6);
    assert.eq(row(g, 0), 'ab   …    ');
  });

  test('lines and arrows (ascii)', () => {
    const g = createGrid(8, 6);
    g.hline(0, 0, 8, 'mut');
    g.hline(0, 1, 8, 'mut', true);
    g.arrowR(0, 3, 2, 'mut'); g.arrowL(4, 7, 2, 'mut');
    g.arrowBoth(0, 4, 3, 'mut');
    g.divider(5, 3, 3, 'dot');
    g.arrowDown(7, 4, 5, 'mut', true);
    assert.deq(g.toLines(), ['--------', '- - - - ', '---><---', '<--->===', '       :', '       v']);
  });

  test('vline solid and dashed', () => {
    const g = createGrid(2, 2);
    g.vline(0, 0, 2, 'mut'); g.vline(1, 0, 2, 'mut', true);
    assert.deq(g.toLines(), ['|:', '|:']);
    const u = createGrid(2, 1, { border: 'unicode' });
    u.vline(0, 0, 1, 'mut'); u.vline(1, 0, 1, 'mut', true);
    assert.eq(row(u, 0), '│╎');
  });

  const BOXES = {
    ascii: {
      solid: ['+------+', '|      |', '+------+'],
      dash: ['+- - - +', '|      |', '+- - - +'],
      dbl: ['+======+', '|      |', '+======+']
    },
    unicode: {
      solid: ['┌──────┐', '│      │', '└──────┘'],
      dash: ['┌╌╌╌╌╌╌┐', '╎      ╎', '└╌╌╌╌╌╌┘'],
      dbl: ['╔══════╗', '║      ║', '╚══════╝']
    }
  };
  Object.keys(BOXES).forEach((border) => Object.keys(BOXES[border]).forEach((kind) => {
    test('box ' + kind + ' × ' + border, () => {
      const g = createGrid(8, 3, { border });
      g.box(0, 0, 8, 3, 'a1', kind);
      assert.deq(g.toLines(), BOXES[border][kind]);
      assert.eq(g.cells[0][0].fg, 'a1');
    });
  }));

  test('box label sits on the top edge and is clipped', () => {
    const g = createGrid(16, 2);
    g.box(0, 0, 16, 2, 'mut', 'dash', 'session timeline');
    assert.eq(row(g, 0), '+- session t…  +');
    assert.eq(g.cells[0][3].b, true);
  });

  test('junction set follows border style', () => {
    assert.eq(createGrid(1, 1).J.down, '+');
    assert.eq(createGrid(1, 1, { border: 'unicode' }).J.down, '┬');
    assert.eq(createGrid(1, 1, { border: 'unicode' }).J.ddown, '╤');
  });

  test('bar and meter glyphs', () => {
    const g = createGrid(12, 2);
    g.bar(0, 0, 12, 0.5, 'a1');
    g.meter(0, 1, 10, 0.3, 'a2');
    assert.deq(g.toLines(), ['[#####..:..]', '@##.......  ']);
    assert.eq(g.cells[0][1].fg, 'a1');
    assert.eq(g.cells[0][10].fg, 'mut');
    assert.eq(g.cells[1][5].fg, 'dot');
  });

  test('bar clamps ratio and survives NaN', () => {
    const g = createGrid(6, 2);
    g.bar(0, 0, 6, 5, 'a1'); g.bar(0, 1, 6, NaN, 'a1');
    assert.deq(g.toLines(), ['[####]', '[...:]']);
  });

  test('Vietnamese NFD input lands one cell per letter', () => {
    const g = createGrid(12, 1);
    const n = g.text(0, 0, 'Tiếng Việt'.normalize('NFD'));
    assert.eq(n, 10);
    assert.eq(row(g, 0), 'Tiếng Việt  ');
    assert.eq(selfCheck(g).length, 0);
  });

  test('emoji / CJK become ? and are reported, columns stay aligned', () => {
    const g = createGrid(8, 1);
    warnings.length = 0;
    g.text(0, 0, 'a🚀b中c');
    assert.eq(row(g, 0), 'a?b?c   ');
    const issues = selfCheck(g);
    assert.eq(issues.length, 2);
    assert.eq(issues[0].ch, '🚀');
    assert.eq(warnings.length, 1);
  });

  test('self-check flags a row of the wrong width', () => {
    const g = createGrid(3, 1);
    g.cells[0].push({ ch: ' ', fg: 'fg', bg: null, b: false, k: '' });
    const reasons = selfCheck(g).map((i) => i.reason);
    assert.ok(reasons.indexOf('row-length') >= 0);
    assert.ok(reasons.indexOf('line-width') >= 0);
  });
  test('fractional sizes and coords snap to whole cells (no throw)', () => {
    const g = createGrid(8.7, 2.2);
    assert.deq([g.W, g.H, g.cells[0].length], [8, 2, 8]);
    g.mtext(0.5, 0.5, 'abcdefghij', 'fg', false, null, 5.5);
    g.center(0.5, 7.9, 1, 'xyz');
    g.fillBg(0, 1.5, 3.3, 'hlrow');
    g.box(0.2, 0.2, 2.6, 2.6, 'mut');
    assert.eq(selfCheck(g).length, 0);
    assert.eq(g.cells[1][2].bg, 'hlrow');
  });

  test('clipping never eats a bar bracket', () => {
    const g = createGrid(8, 1);
    g.mtext(0, 0, 'ab{bar:1:4:a1}xyz', 'fg', false, null, 6);
    assert.eq(row(g, 0), 'ab   …  ');
  });

  test('bar narrower than 2 draws nothing; 2 draws []', () => {
    const g = createGrid(4, 2);
    g.bar(0, 0, 0, 1, 'a1'); g.bar(0, 0, 1, 1, 'a1');
    g.bar(0, 1, 2, 1, 'a1');
    assert.deq(g.toLines(), ['    ', '[]  ']);
  });

  test('vline accepts a custom glyph in either border style', () => {
    const u = createGrid(1, 2, { border: 'unicode' });
    u.vline(0, 0, 2, 'dot', true, ':');
    assert.deq(u.toLines(), [':', ':']);
  });

  test('blit copies clipped cells and carries self-check issues', () => {
    const block = createGrid(4, 1);
    block.text(0, 0, 'a🚀cd', 'a1');
    const page = createGrid(5, 2);
    page.blit(block, 2, 1);
    assert.deq(page.toLines(), ['     ', '  a?c']);
    assert.eq(page.cells[1][2].fg, 'a1');
    block.cells[0][0].ch = 'z';
    assert.eq(page.cells[1][2].ch, 'a');
    warnings.length = 0;
    const issues = selfCheck(page);
    assert.deq([issues.length, issues[0].row, issues[0].col], [1, 1, 3]);
  });
};
