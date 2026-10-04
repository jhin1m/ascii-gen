/* Header block: centered title, `=====/##/=====` divider with an emblem, `[#] label` legend and a
   dimmed command line. Each part is optional; the block is as tall as the parts it shows. */
(function (ADG) {
  const U = ADG.blocks.util, M = ADG.markup;

  ADG.blocks.register('header', {
    label: 'Tiêu đề',
    schema: [
      { key: 'title', label: 'Tiêu đề (markup)', type: 'text' },
      { key: 'divider', label: 'Đường kẻ', type: 'bool' },
      { key: 'emblem', label: 'Biểu tượng giữa đường kẻ', type: 'text' },
      { key: 'legend', label: 'Chú thích: mỗi dòng 1 mục (markup)', type: 'list', fields: ['text'] },
      { key: 'legendColor', label: 'Màu [#]', type: 'color-slot' },
      { key: 'command', label: 'Dòng lệnh (markup)', type: 'text' }
    ],
    render(cfg, w, ctx) {
      const title = U.str(cfg.title), command = U.str(cfg.command), emblem = U.str(cfg.emblem);
      const divider = cfg.divider !== false;
      const slot = U.slot(cfg.legendColor, 'a1');
      const items = U.arr(cfg.legend, 12).map((it) => '{' + slot + ':[#]} ' + U.str(typeof it === 'object' ? it.text : it));
      // widest separator that still fits; otherwise the centered line clips with …
      let legend = '';
      for (const sep of ['    ', '  ', ' ']) {
        legend = items.join(sep);
        if (M.mlen(legend, ctx.slots) <= w) break;
      }
      const parts = [title && 'title', divider && 'divider', items.length && 'legend', command && 'command'].filter(Boolean);
      const g = ctx.grid(w, parts.length);
      parts.forEach((p, y) => {
        if (p === 'title') g.center(0, w, y, title, 'fg', true);
        else if (p === 'divider') {
          g.divider(0, y, w, 'dot');
          if (emblem) {
            const e = ADG.text.clip(emblem, w);
            g.text(Math.floor((w - ADG.text.toCells(e).length) / 2), y, e, 'fg', true);
          }
        } else if (p === 'legend') g.center(0, w, y, legend, 'fg');
        else g.center(0, w, y, command, 'dim');
      });
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
