module.exports = ({ ADG, test, assert }) => {
  test('QA matrix: 4 templates × 7 themes × 2 borders × 80/96/120 × every step → 0 issues', () => {
    const r = ADG.qa.matrix({ log: false });
    assert.ok(r.runs >= 4 * 7 * 2 * 3 * 2 * 3, 'runs ' + r.runs);
    assert.deq(r.failures, []);
  });
};
