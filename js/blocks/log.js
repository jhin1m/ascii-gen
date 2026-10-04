/* Log tail: `hh:mm actor message`, only lines whose step ≤ current step, newest at the bottom.
   The last line gets the log row background and a blinking `_`. Stretching shows more history.
   While playing, the current step's lines appear one by one as ctx.t advances. */
(function (ADG) {
  const U = ADG.blocks.util, T = ADG.text;

  ADG.blocks.register('log', {
    label: 'Nhật ký',
    stretch: true,
    schema: [
      { key: 'title', label: 'Nhãn khung', type: 'text' },
      { key: 'rows', label: 'Số dòng', type: 'number', min: 1, max: 20 },
      { key: 'lines', label: 'Dòng: giờ | actor | nội dung (markup) | bước', type: 'list', fields: ['t', 'actor', 'msg', 'step'] }
    ],
    render(cfg, w, ctx) {
      const rows = U.clamp(Math.floor(U.num(cfg.rows, 6)), 1, 20);
      const h = Math.max(rows + 2, ctx.minHeight || 0);
      const g = ctx.grid(w, h);
      g.box(0, 0, w, h, 'mut', 'dash', U.str(cfg.title));
      let all = U.arr(cfg.lines, 200).map(U.obj).filter((l) => {
        const s = U.num(l.step, null);
        return s === null || s <= ctx.step;
      });
      if (ctx.playing) {
        const now = all.filter((l) => U.num(l.step, null) === ctx.step);
        const shown = now.slice(0, Math.min(now.length, 1 + Math.floor(ctx.t * now.length)));
        all = all.filter((l) => now.indexOf(l) < 0 || shown.indexOf(l) >= 0);
      }
      const vis = all.slice(-(h - 2));
      const inner = w - 2, msgX = 18, msgW = w - 2 - msgX;
      vis.forEach((l, i) => {
        const y = 1 + i, last = i === vis.length - 1;
        if (last) g.fillBg(1, y, inner, 'logrow');
        g.text(2, y, T.clip(U.str(l.t), 5), 'mut');
        g.text(8, y, T.clip(ctx.N(l.actor), 9), ctx.slot(l.actor) || 'fg', true);
        if (msgW < 1) return;
        const n = g.mtext(msgX, y, U.str(l.msg), 'fg', false, null, last ? msgW - 1 : msgW);
        if (last) g.put(msgX + n, y, '_', 'fg', true, null, 'blink');
      });
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
