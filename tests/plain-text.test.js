/* Plain-text export: trimmed trailing spaces, columns preserved. */
module.exports = ({ ADG, test, assert }) => {
  const { createGrid } = ADG.grid;

  test('trailing spaces are trimmed, leading spaces kept', () => {
    const g = createGrid(10, 2);
    g.text(2, 0, 'ab', 'fg');
    g.text(0, 1, 'x', 'fg');
    assert.eq(ADG.plainText.toPlainText(g), '  ab\nx');
  });

  test('trailing blank rows are dropped, inner blank rows kept', () => {
    const g = createGrid(6, 5);
    g.text(0, 0, 'top', 'fg');
    g.text(0, 2, 'mid', 'fg');
    assert.eq(ADG.plainText.toPlainText(g), 'top\n\nmid');
  });

  test('empty grid gives an empty string', () => {
    assert.eq(ADG.plainText.toPlainText(createGrid(4, 3)), '');
  });

  test('box edges keep their columns (right border is not trimmed)', () => {
    const g = createGrid(8, 3);
    g.box(0, 0, 8, 3, 'fg', 'solid');
    assert.deq(ADG.plainText.toPlainText(g).split('\n'), ['+------+', '|      |', '+------+']);
  });
};
