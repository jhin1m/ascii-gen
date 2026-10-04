module.exports = ({ ADG, test, assert }) => {
  const { THEMES, COLOR_KEYS, mix, palette } = ADG.theme;
  const HEX = /^#[0-9a-f]{6}$/;

  test('7 themes with all base keys', () => {
    assert.deq(Object.keys(THEMES), ['midnight', 'dracula', 'gruvbox', 'solarized', 'phosphor', 'amber', 'paper']);
    Object.keys(THEMES).forEach((id) => ADG.theme.BASE_KEYS.forEach((k) => assert.ok(HEX.test(THEMES[id][k]), id + '.' + k)));
  });

  test('mix endpoints and midpoint', () => {
    assert.eq(mix('#ffffff', '#000000', 1), '#ffffff');
    assert.eq(mix('#ffffff', '#000000', 0), '#000000');
    assert.eq(mix('#ffffff', '#000000', 0.5), '#808080');
  });

  test('palette fills every color key for every theme', () => {
    Object.keys(THEMES).forEach((id) => {
      const p = palette(id);
      COLOR_KEYS.forEach((k) => assert.ok(HEX.test(p[k]), id + '.' + k));
    });
  });

  test('derived colors match the mockup formula', () => {
    const t = THEMES.midnight, p = palette('midnight');
    assert.eq(p.dim, mix(t.fg, t.bg, 0.62));
    assert.eq(p.hlrow, mix(t.a4, t.bg, 0.15));
  });

  test('base override recolors derived colors; derived override wins', () => {
    const p = palette('midnight', { bg: '#000000', a4: '#ffffff' });
    assert.eq(p.bg, '#000000');
    assert.eq(p.hlrow, mix('#ffffff', '#000000', 0.15));
    assert.eq(palette('midnight', { hlrow: '#123456' }).hlrow, '#123456');
  });

  test('unknown theme falls back to midnight; invalid hex ignored', () => {
    assert.eq(palette('nope').bg, THEMES.midnight.bg);
    assert.eq(palette('dracula', { fg: 'red' }).fg, THEMES.dracula.fg);
    assert.eq(palette('dracula').bg, THEMES.dracula.bg);
  });
};
