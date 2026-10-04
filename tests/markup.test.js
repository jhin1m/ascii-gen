module.exports = ({ ADG, test, assert }) => {
  const { parse, mlen } = ADG.markup;
  const ACTORS = { lead: 'a1', crab: 'a3' };

  test('plain text is one segment', () => {
    assert.deq(parse('hello'), [{ t: 'hello' }]);
  });

  test('color, bold-color, muted alias, dim', () => {
    assert.deq(parse('{a1:x}{a2b:y}{m:z}{dim:w}'), [
      { t: 'x', fg: 'a1' }, { t: 'y', fg: 'a2', b: true }, { t: 'z', fg: 'mut' }, { t: 'w', fg: 'dim' }
    ]);
    assert.deq(parse('{fgb:=/##/=}'), [{ t: '=/##/=', fg: 'fg', b: true }]);
  });

  test('actor tag resolves to actor slot + bold (even if id ends in b)', () => {
    assert.deq(parse('{lead:ok} {crab:c}', ACTORS), [
      { t: 'ok', fg: 'a1', b: true }, { t: ' ' }, { t: 'c', fg: 'a3', b: true }
    ]);
  });

  test('inline bar with defaults and clamping', () => {
    assert.deq(parse('{bar:0.8:6:a2}'), [{ bar: true, r: 0.8, w: 6, fg: 'a2' }]);
    assert.deq(parse('{bar:9}'), [{ bar: true, r: 1, w: 8, fg: 'a1' }]);
    assert.deq(parse('{bar:x:1:nope}'), [{ bar: true, r: 0, w: 8, fg: 'a1' }]);
  });

  test('mixed markup in one line keeps order', () => {
    const segs = parse('effort {bar:1:6:a1} {a2b:high} · **ctx**');
    assert.deq(segs.map((s) => (s.bar ? 'BAR' : s.t)), ['effort ', 'BAR', ' ', 'high', ' · ', 'ctx']);
    assert.eq(segs[5].b, true);
  });

  test('{{ escapes a literal brace; unknown tags stay literal', () => {
    assert.deq(parse('{{a1:x}'), [{ t: '{a1:x}' }]);
    assert.deq(parse('{nope:x} y'), [{ t: '{nope:x} y' }]);
  });

  test('mlen counts cells, not markup', () => {
    assert.eq(mlen('{a1:abc} {bar:0.5:6:a1} **d**'), 12);
    assert.eq(mlen('{lead:Việt}', ACTORS), 4);
    assert.eq(mlen('Việt'.normalize('NFD')), 4);
  });

  test('clip uses … and counts code points', () => {
    const { clip } = ADG.text;
    assert.eq(clip('researcher', 6), 'resea…');
    assert.eq(clip('lead', 6), 'lead');
    assert.eq(clip('abc', 0), '');
    assert.eq(clip('Tiếng'.normalize('NFD'), 4), 'Tiế…');
  });

  test('sanitize: NFC, wide → ?, zero-width dropped', () => {
    const { sanitize, isWide } = ADG.text;
    assert.eq(sanitize('a‍b🚀中'), 'ab??');
    assert.eq(sanitize('Việt'.normalize('NFD')), 'Việt');
    assert.eq(isWide('★'), false);
    assert.eq(isWide('✅'), true);
  });

  test('safe glyphs used by blocks are single-cell', () => {
    const { isBadCell } = ADG.text;
    '·»…█@#:.<>^v|+-=┌┐└┘─│╌╎╔╗╚╝═║┬┴╤╧╟'.split('').forEach((ch) => assert.eq(isBadCell(ch), false, ch));
  });
  test('bar width is capped; actor with an invalid slot falls back to fg', () => {
    assert.eq(parse('{bar:1:20000000:a1}')[0].w, 256);
    assert.deq(parse('{x:y}', { x: '#ff0000' }), [{ t: 'y', fg: 'fg', b: true }]);
  });

  test('format / bidi / separator chars cannot shift a row', () => {
    const { sanitize, toCells, isBadCell } = ADG.text;
    assert.eq(sanitize('a\u00ADb\u202Ec\u2066d'), 'abcd');
    assert.eq(sanitize('a\u2028b'), 'a?b');
    assert.eq(isBadCell('\uD800'), true);
    assert.eq(toCells('x\uDB40\uDC41y').join(''), 'xy');
  });
};
