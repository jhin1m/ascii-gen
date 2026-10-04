/* Table block: boxed title line (right-aligned counter), column headers, rows of
   name / [####....] bar / value / route, one highlighted row, optional divider + note.
   Column widths follow the content; the bar takes what is left (narrow → names/routes shrink first). */
(function (ADG) {
  const U = ADG.blocks.util, T = ADG.text, M = ADG.markup;

  function render(cfg, w, ctx) {
    const rows = U.arr(cfg.rows, 30).map(U.obj), cols = U.arr(cfg.cols, 3).map((c) => U.str(typeof c === 'object' ? c.text : c));
    const note = U.str(cfg.note), title = U.str(cfg.title), right = U.str(cfg.right);
    const color = U.slot(cfg.color, 'a3');
    const box = ['solid', 'dash', 'dbl'].indexOf(cfg.box) >= 0 ? cfg.box : 'dbl';
    const hi = Math.floor(U.num(cfg.highlight, -1));
    const hasHead = cols.some(Boolean);
    const h = 2 + (title || right ? 1 : 0) + (hasHead ? 1 : 0) + rows.length + (note ? 2 : 0);
    const g = ctx.grid(w, h);
    g.box(0, 0, w, h, color, box);

    const names = rows.map((r) => U.str(r.name)), routes = rows.map((r) => U.str(r.route));
    let nameW = U.widest(names.concat(cols[0] || ''), 4, 16);
    let routeW = Math.max(4, Math.min(18, routes.concat(cols[2] || '').reduce((m, s) => Math.max(m, M.mlen(s, ctx.slots)), 0)));
    const layout = () => {
      const routeX = w - 2 - routeW, valX = routeX - 6, barX = 2 + nameW + 3;
      return { routeX, valX, barX, barW: valX - 1 - barX };
    };
    let L = layout();
    while (L.barW < 6 && (routeW > 4 || nameW > 4)) {
      if (routeW >= nameW) routeW--; else nameW--;
      L = layout();
    }

    let y = 1;
    if (title || right) {
      const rw = right ? M.mlen(right, ctx.slots) : 0;
      const showRight = right && rw + 4 < w - 4;
      g.mtext(2, y, title, 'fg', false, null, Math.max(1, w - 4 - (showRight ? rw + 1 : 0)));
      if (showRight) g.right(w - 3, y, right, color, true);
      y++;
    }
    if (hasHead) {
      g.text(2, y, T.clip(cols[0] || '', nameW), 'mut');
      if (L.barW >= 3) g.text(L.barX, y, T.clip(cols[1] || '', L.barW), 'mut');
      g.text(L.routeX, y, T.clip(cols[2] || '', routeW), 'mut');
      y++;
    }
    rows.forEach((r, i) => {
      if (i === hi) { g.fillBg(1, y, w - 2, 'hlrow'); g.put(1, y, '>', color, true); }
      g.text(2, y, T.clip(names[i], nameW), 'fg', true);
      if (L.barW >= 3) g.bar(L.barX, y, L.barW, U.ratio(r.ratio), U.slot(r.color, 'a1'));
      const val = r.value != null ? U.str(r.value) : U.ratio(r.ratio).toFixed(2);
      if (L.valX > 2 + nameW) g.text(L.valX, y, T.clip(val, 5), 'a2', true);
      g.mtext(L.routeX, y, routes[i], 'fg', true, null, routeW);
      y++;
    });
    if (note) {
      g.hline(2, y, w - 4, 'dot', true);
      g.mtext(2, y + 1, note, 'fg', false, null, w - 4);
    }
    return { grid: g, anchors: typeof cfg.id === 'string' && cfg.id ? [{ id: cfg.id, x: 0, y: 0, w, h }] : [] };
  }

  ADG.blocks.register('table', {
    label: 'Bảng',
    provides: true,
    schema: [
      { key: 'title', label: 'Tiêu đề (markup)', type: 'text' },
      { key: 'right', label: 'Bộ đếm bên phải (markup)', type: 'text' },
      { key: 'cols', label: 'Tên cột: tên | thanh | tuyến', type: 'list', fields: ['text'] },
      { key: 'rows', label: 'Dòng: tên | tỉ lệ 0..1 | tuyến (markup) | giá trị', type: 'list', fields: ['name', 'ratio', 'route', 'value'] },
      { key: 'highlight', label: 'Dòng nổi bật (0 = đầu, -1 = không)', type: 'number', min: -1, max: 20 },
      { key: 'note', label: 'Ghi chú cuối (markup)', type: 'text' },
      { key: 'color', label: 'Màu khung', type: 'color-slot' },
      { key: 'box', label: 'Kiểu khung', type: 'select', options: ['dbl', 'solid', 'dash'] }
    ],
    render
  });
})(window.ADG = window.ADG || {});
