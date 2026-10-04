/* Steps breadcrumb: `+ plan  >   / fork   >  3 delegate ...`. Done steps get a `+`, the current
   step a highlighted ` / name ` cell run, later steps their number. Steps come from ctx.steps. */
(function (ADG) {
  const U = ADG.blocks.util, T = ADG.text;

  ADG.blocks.register('steps', {
    label: 'Các bước',
    schema: [{ key: 'sep', label: 'Dấu ngăn', type: 'text' }],
    render(cfg, w, ctx) {
      const g = ctx.grid(w, 1);
      const mark = T.clip(U.str(cfg.sep) || '>', 1);
      const parts = ctx.steps.map((s, i) => (i < ctx.step ? { t: '+ ' + s, k: 'done' }
        : i === ctx.step ? { t: ' / ' + s + ' ', k: 'cur' } : { t: (i + 1) + ' ' + s, k: 'todo' }));
      const textW = parts.reduce((a, p) => a + T.toCells(p.t).length, 0);
      const seps = ['  ' + mark + '  ', ' ' + mark + ' ', mark];
      const sepW = (s) => T.toCells(s).length;
      const sep = seps.find((s) => textW + sepW(s) * (parts.length - 1) <= w) || mark;
      let x = Math.max(0, Math.floor((w - textW - sepW(sep) * (parts.length - 1)) / 2));
      parts.forEach((p, i) => {
        if (i > 0) x += g.text(x, 0, sep, 'mut');
        if (p.k === 'done') { g.put(x, 0, '+', 'a3', true); g.text(x + 1, 0, p.t.slice(1), 'a3'); }
        else if (p.k === 'cur') g.text(x, 0, p.t, 'a2', true, 'hlstep');
        else { g.text(x, 0, p.t, 'dim'); g.text(x, 0, String(i + 1), 'mut'); }
        x += T.toCells(p.t).length;
      });
      // too narrow even with the tightest separator: mark the cut on the last cell
      if (x > w && w > 0) g.put(w - 1, 0, '…', 'mut');
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
