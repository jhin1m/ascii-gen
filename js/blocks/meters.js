/* Meters block ("who sees what"): per item an actor name + `@####....` meter, a note underneath. */
(function (ADG) {
  const U = ADG.blocks.util;

  ADG.blocks.register('meters', {
    label: 'Đồng hồ',
    stretch: true,
    schema: [
      { key: 'title', label: 'Nhãn khung', type: 'text' },
      { key: 'items', label: 'Mục: actor | tỉ lệ 0..1 | ghi chú', type: 'list', fields: ['actor', 'ratio', 'note'] }
    ],
    render(cfg, w, ctx) {
      const items = U.arr(cfg.items, 12).map(U.obj);
      const h = Math.max(2 + items.length * 2, ctx.minHeight || 0);
      const g = ctx.grid(w, h);
      g.box(0, 0, w, h, 'mut', 'dash', U.str(cfg.title));
      const names = items.map((it) => (it.label != null ? U.str(it.label) : ctx.N(it.actor)));
      const nameW = U.widest(names, 1, 8);
      const mx = 2 + nameW + 1, mw = Math.max(0, w - 2 - mx);
      items.forEach((it, i) => {
        const y = 1 + i * 2, slot = U.slot(it.color, ctx.slot(it.actor) || 'fg');
        if (y + 1 >= h - 1) return;
        g.text(2, y, ADG.text.clip(names[i], nameW), slot, true);
        if (mw > 0) g.meter(mx, y, mw, U.ratio(it.ratio), slot);
        g.mtext(mx, y + 1, U.str(it.note), 'dim', false, null, Math.max(1, w - 2 - mx));
      });
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
