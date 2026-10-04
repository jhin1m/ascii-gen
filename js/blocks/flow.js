/* Flow block (interim fan layout until the Flow DSL lands): top node → table → caption →
   fan-out to N nodes → fan-in → bottom node, plus an optional back-edge loop from the table's
   right side up to the top node. Every part is optional; coordinates are derived from the width.
   Node: { id, lines: [markup], color, box, footer: { status, ratio, badge } } — line 0 is bold.
   Narrow widths: fan nodes share the width evenly and their text is clipped with …. */
(function (ADG) {
  const U = ADG.blocks.util;
  const KINDS = ['solid', 'dash', 'dbl'];
  const LEFT = 3; // room for arrows coming in from a side column

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const kindOf = (v, d) => (KINDS.indexOf(v) >= 0 ? v : d);
  const colorOf = (n, ctx) => U.slot(n.color, ctx.slot(n.id) || 'fg');
  const nodeHeight = (n) => 2 + U.lines(n.lines).length + (isObj(n.footer) ? 4 : 0);
  /** Width that fits the node's widest line plus padding, at least `w`, at most `max`. */
  const fitWidth = (n, w, max, ctx) => Math.min(max, Math.max(w, U.lines(n.lines).reduce((m, l) => Math.max(m, ADG.markup.mlen(l, ctx.slots)), 0) + 4));

  /** Boxed node; the footer sits on the bottom rows so equal-height siblings line up. Returns its anchor. */
  function drawNode(g, x, y, w, h, n, ctx) {
    const color = colorOf(n, ctx);
    g.box(x, y, w, h, color, kindOf(n.box, 'solid'));
    // one blank cell inside each border, like the reference
    U.lines(n.lines).forEach((l, i) => g.center(x + 2, w - 4, y + 1 + i, l, 'fg', i === 0));
    if (isObj(n.footer)) {
      const f = n.footer, fy = y + h - 5;
      g.hline(x + 2, fy, w - 4, 'dot', true);
      g.mtext(x + 2, fy + 1, '$ ' + (U.str(f.status) || 'idle'), 'mut', false, null, w - 4);
      g.bar(x + 2, fy + 2, w - 4, U.ratio(f.ratio), color);
      g.center(x + 2, w - 4, fy + 3, U.str(f.badge));
    }
    return { id: U.str(n.id), x, y, w, h };
  }

  /** Vertical plan: y of every part, from the parts present. */
  function plan(p) {
    const P = {};
    let y = 0, prev = false;
    if (p.top) { P.top = y; y += p.topH; prev = true; }
    if (p.tbl) { if (prev) { P.toTable = y; y += 2; } P.table = y; y += p.tbl.grid.H; prev = true; }
    if (p.n) {
      if (prev) { P.colon = y; y += 1; }
      if (p.caption) { P.caption = y; y += 1; }
      if (prev) { P.fanOut = y; y += 2; }
      P.fan = y; y += p.fanH; prev = true;
    }
    if (p.bottom) {
      if (p.n) { P.fanIn = y; y += 3; } else if (prev) { P.toBottom = y; y += 2; }
      P.bottom = y; y += p.botH;
    }
    P.h = Math.max(1, y);
    return P;
  }

  function render(cfg, w, ctx) {
    const top = isObj(cfg.top) ? cfg.top : null, bottom = isObj(cfg.bottom) ? cfg.bottom : null;
    const tcfg = isObj(cfg.table) ? cfg.table : null;
    const fan = U.arr(cfg.fan, 8).filter(isObj), n = fan.length;
    const loop = top && tcfg && isObj(cfg.loop) ? cfg.loop : null;
    const cx = LEFT, cw = Math.max(8, w - LEFT - (loop ? 3 : 1)), mid = cx + Math.floor(cw / 2);
    const tbl = tcfg ? ADG.blocks.get('table').render(tcfg, cw, ctx) : null;
    const tkind = tcfg ? kindOf(tcfg.box, 'dbl') : null, tcolor = U.slot(tcfg && tcfg.color, 'a3');
    const topW = top ? fitWidth(top, Math.max(20, Math.round(cw * 0.8)), cw, ctx) : 0;
    const botW = bottom ? fitWidth(bottom, Math.max(20, Math.round(cw * 0.63)), cw, ctx) : 0;
    const fanW = n ? Math.floor((cw - (n - 1)) / n) : 0;
    const fanH = fan.reduce((m, f) => Math.max(m, nodeHeight(f)), 0);
    const fanX0 = cx + Math.floor((cw - (n * fanW + n - 1)) / 2);
    const centers = fan.map((_, i) => fanX0 + i * (fanW + 1) + Math.floor(fanW / 2));
    const topH = top ? nodeHeight(top) : 0, botH = bottom ? nodeHeight(bottom) : 0;
    const P = plan({ top, tbl, n, fanH, bottom, topH, botH, caption: U.str(cfg.caption) });

    const g = ctx.grid(w, P.h), J = g.J, anchors = [];
    const D = (kind, dir) => (kind === 'dbl' ? J['d' + dir] : J[dir]);
    const topX = mid - Math.floor(topW / 2);
    if (top) anchors.push(drawNode(g, topX, P.top, topW, topH, top, ctx));
    if (tbl) {
      g.blit(tbl.grid, cx, P.table);
      U.arr(tbl.anchors).forEach((a) => anchors.push(Object.assign({}, a, { x: a.x + cx, y: a.y + P.table })));
    }
    // connectors leave a bottom border with ┬ and enter a top border with ┴
    if (top && (tbl || n || bottom)) g.put(mid, P.top + topH - 1, D(kindOf(top.box, 'solid'), 'down'), colorOf(top, ctx));
    if (tbl) {
      if (top) { g.vline(mid, P.toTable, 2, 'mut'); g.put(mid, P.table, D(tkind, 'up'), tcolor); }
      if (n || bottom) g.put(mid, P.table + tbl.grid.H - 1, D(tkind, 'down'), tcolor);
    }
    if (P.colon != null) g.put(mid, P.colon, ':', 'mut');
    if (P.caption != null) g.center(cx, cw, P.caption, U.str(cfg.caption));
    if (n) {
      const c0 = centers[0], cl = centers[n - 1];
      if (P.fanOut != null) {
        if (n > 1) {
          g.hline(c0 + 1, P.fanOut, cl - c0 - 1, 'dot', true);
          g.put(c0, P.fanOut, J.tl, 'mut'); g.put(cl, P.fanOut, J.tr, 'mut'); g.put(mid, P.fanOut, J.up, 'mut');
        } else g.put(c0, P.fanOut, J.v, 'mut');
        centers.forEach((c) => g.put(c, P.fanOut + 1, 'v', 'mut'));
      }
      fan.forEach((f, i) => anchors.push(drawNode(g, fanX0 + i * (fanW + 1), P.fan, fanW, fanH, f, ctx)));
      if (bottom) {
        centers.forEach((c) => g.put(c, P.fanIn, J.v, 'mut'));
        if (n > 1) {
          g.hline(c0 + 1, P.fanIn + 1, cl - c0 - 1, 'dot', true);
          g.put(c0, P.fanIn + 1, J.bl, 'mut'); g.put(cl, P.fanIn + 1, J.br, 'mut'); g.put(mid, P.fanIn + 1, J.down, 'mut');
        } else g.put(c0, P.fanIn + 1, J.v, 'mut');
        g.put(mid, P.fanIn + 2, 'v', 'mut');
      }
    } else if (bottom && P.toBottom != null) {
      g.put(mid, P.toBottom, J.v, 'mut'); g.put(mid, P.toBottom + 1, 'v', 'mut');
    }
    if (bottom) anchors.push(drawNode(g, mid - Math.floor(botW / 2), P.bottom, botW, botH, bottom, ctx));

    if (loop) {
      // back edge: table right border → right gutter → up → arrow head into the top node
      const tx = topX + topW, ty = P.top + Math.floor(topH / 2);
      const tR = cx + cw - 1, tyy = P.table + Math.floor(tbl.grid.H / 2), lx = w - 1;
      g.put(tx, ty, '<', 'mut'); g.hline(tx + 1, ty, lx - tx - 1, 'mut'); g.put(lx, ty, J.tr, 'mut');
      g.vline(lx, ty + 1, tyy - ty - 1, 'mut');
      g.put(lx, tyy, J.br, 'mut'); g.hline(tR + 1, tyy, lx - tR - 1, 'mut');
      g.put(tR, tyy, tkind === 'dbl' ? J.dright : J.right, tcolor);
      const label = U.str(loop.label), room = lx - tx - 1;
      if (label && tyy - ty > 1 && room > 0) {
        const lxs = tx + 1 + (room - ADG.markup.mlen(label, ctx.slots) >= 2 ? 1 : 0);
        g.mtext(lxs, ty + 1, label, 'a1', false, null, lx - lxs);
      }
    }
    return { grid: g, anchors: anchors.filter((a) => a.id && a.w >= 3) };
  }

  ADG.blocks.register('flow', {
    label: 'Sơ đồ luồng',
    provides: true,
    help: 'Bản tạm: sửa nút trong tab JSON. Bề ngang hẹp → các nút chia đều, chữ bị cắt bằng …',
    schema: [{ key: 'caption', label: 'Chú thích trước nhánh (markup)', type: 'text' }],
    drawNode, nodeHeight, render
  });
})(window.ADG = window.ADG || {});
