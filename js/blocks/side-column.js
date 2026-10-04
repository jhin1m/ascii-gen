/* Side column: a tall box with a title, a dotted `:` rail and a list of items:
     milestone { title, q, a, link, snap }  `<>` title / question / `» answer`, 3 rows
     note { text }   markup lines         kv { k, v }   key left, value right
     pulse { bits }  `+` ticks with `|` above/below for each '1'   gap { n }  blank rows
   A milestone with `link` (a node id) exports a link: the layout draws a dashed arrow from the
   box edge to that node. With snap (default when linked) it moves down to the node's middle row,
   using anchors of blocks rendered earlier in the same row. Stretches to the row height. */
(function (ADG) {
  const U = ADG.blocks.util, T = ADG.text;
  const KINDS = { milestone: ['title', 'q', 'a', 'link'], note: ['text'], kv: ['k', 'v'], pulse: ['bits'], gap: ['n'] };

  function itemHeight(it) {
    switch (it.kind) {
      case 'milestone': case 'pulse': return 3;
      case 'note': return Math.max(1, U.lines(it.text).length);
      case 'kv': return 1;
      case 'gap': return U.clamp(Math.floor(U.num(it.n, 1)), 0, 40);
      default: return 0;
    }
  }

  /** y of every item (block-relative), honouring snap targets; returns { ys, end }. */
  function place(items, ctx) {
    const ys = [];
    let y = 3, prev = null;
    items.forEach((it) => {
      if (prev && !(prev.kind === 'kv' && it.kind === 'kv') && prev.kind !== 'gap' && it.kind !== 'gap') y++;
      const a = it.kind === 'milestone' && it.link && it.snap !== false && ctx.anchors.find((t) => t.id === it.link);
      if (a) y = Math.max(y, a.y + Math.floor(a.h / 2));
      ys.push(y);
      y += itemHeight(it);
      prev = it;
    });
    return { ys, end: y };
  }

  ADG.blocks.register('side-column', {
    label: 'Cột bên',
    stretch: true,
    schema: [
      { key: 'title', label: 'Tiêu đề (markup)', type: 'text' },
      { key: 'sub', label: 'Dòng phụ', type: 'text' },
      { key: 'color', label: 'Màu khung', type: 'color-slot' },
      { key: 'items', label: 'Mục: loại | ...', type: 'list', variants: KINDS }
    ],
    render(cfg, w, ctx) {
      const items = U.arr(cfg.items, 40).filter((it) => it && Object.prototype.hasOwnProperty.call(KINDS, it.kind));
      const color = U.slot(cfg.color, 'a2');
      const { ys, end } = place(items, ctx);
      const h = Math.max(end + 1, ctx.minHeight || 0, 4);
      const g = ctx.grid(w, h);
      const tw = Math.max(1, w - 6); // text from x=4, one blank cell before the right border
      g.box(0, 0, w, h, color);
      g.vline(2, 3, h - 4, 'dot', false, ':');
      g.center(2, w - 4, 1, U.str(cfg.title), color, true);
      g.center(2, w - 4, 2, U.str(cfg.sub), 'dim');
      const links = [];
      items.forEach((it, i) => {
        const y = ys[i];
        if (y >= h - 1) return;
        if (it.kind === 'milestone') {
          g.text(1, y, '<>', color, true);
          g.mtext(4, y, U.str(it.title), 'fg', true, null, tw);
          g.mtext(4, y + 1, U.str(it.q), 'fg', false, null, tw);
          if (U.str(it.a)) g.mtext(4, y + 2, '» ' + U.str(it.a), color, false, null, tw);
          if (it.link) links.push({ x: w, y, to: String(it.link) });
        } else if (it.kind === 'note') {
          U.lines(it.text).forEach((l, j) => g.mtext(4, y + j, l, 'fg', false, null, tw));
        } else if (it.kind === 'kv') {
          const v = U.str(it.v), vw = Math.min(ADG.markup.mlen(v, ctx.slots), tw);
          g.mtext(4, y, U.str(it.k), 'fg', false, null, Math.max(1, tw - vw - 1));
          g.mtext(4 + tw - vw, y, v, color, true, null, vw);
        } else if (it.kind === 'pulse') {
          T.toCells(U.str(it.bits)).slice(0, 60).forEach((b, k) => {
            const px = 4 + 2 * k;
            if (px >= w - 1) return;
            g.put(px, y + 1, '+', color, true);
            if (b === '1') { g.put(px, y, '|', color); g.put(px, y + 2, '|', color); }
          });
        }
      });
      return { grid: g, links };
    }
  });
})(window.ADG = window.ADG || {});
