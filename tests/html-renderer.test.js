module.exports = ({ ADG, test, assert }) => {
  const { createGrid } = ADG.grid;
  const { renderHTML } = ADG.htmlOut;
  const pal = ADG.theme.palette('midnight');

  test('one div per row, default style without spans', () => {
    const g = createGrid(3, 2);
    g.text(0, 0, 'abc');
    assert.eq(renderHTML(g, pal), '<div class="adg-row">abc</div><div class="adg-row">   </div>');
  });

  test('same-style cells merge; plain spaces join neighbouring span', () => {
    const g = createGrid(5, 1);
    g.text(0, 0, 'a', 'a1'); g.text(2, 0, 'b', 'a1');
    assert.eq(renderHTML(g, pal), '<div class="adg-row"><span style="color:' + pal.a1 + '">a b  </span></div>');
  });

  test('bg, bold and blink class; spaces with bg are not merged into plain spans', () => {
    const g = createGrid(4, 1);
    g.fillBg(1, 0, 2, 'hlrow');
    g.put(0, 0, 'x', 'a2', true);
    g.put(3, 0, '_', 'fg', true, null, 'blink');
    const html = renderHTML(g, pal);
    assert.ok(html.indexOf('<span style="color:' + pal.a2 + ';font-weight:700">x</span>') >= 0);
    assert.ok(html.indexOf('background:' + pal.hlrow + '">  </span>') >= 0);
    assert.ok(html.indexOf('class="adg-blink"') >= 0);
    assert.eq(renderHTML(g, pal, { blink: false }).indexOf('adg-blink'), -1);
  });

  test('escapes & < >', () => {
    const g = createGrid(5, 1);
    g.text(0, 0, '<a&b>');
    assert.eq(renderHTML(g, pal), '<div class="adg-row">&lt;a&amp;b&gt;</div>');
  });
};
