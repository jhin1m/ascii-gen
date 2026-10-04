/* Flow block: draws the graph written in cfg.dsl (see core/flow-dsl.js); an empty dsl uses the
   preset named by cfg.preset. The graph is analysed by core/flow-graph.js and laid out as tiers
   (fan-out / fan-in / back edge in the right gutter) or as a hub with spokes. A graph that cannot
   be drawn faithfully becomes one error line instead of a wrong picture.
   A DSL name that is an actor id takes its title and color from that actor (renaming needs no
   rewrite); any other name is a free node titled with the name.
   Node data lives in cfg.nodes[key] (key = the name, `name#2` for a repeated name):
   { id?, lines:[markup], color, box, footer:{status,ratio,badge} }; for `@table` nodes it is a
   table block config. `id` renames the exported anchor. Missing data → a box titled with the name.
   cfg.caption labels the first fan-out (an edge label `: text` on the DSL wins). Every node
   exports an anchor { id, x, y, w, h }; one with another node to its left also has reach:false,
   so the layout reports side-column links to it as skipped. Narrow widths: columns share the
   width, text is clipped. */
(function (ADG) {
  const U = ADG.blocks.util;
  const KINDS = ['solid', 'dash', 'dbl'];
  const LEFT = 3; // room for arrows coming in from a side column
  const WRAP = ADG.flowGraph.WRAP;

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const kindOf = (v, d) => (KINDS.indexOf(v) >= 0 ? v : d);
  const own = (o, k) => (isObj(o) && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
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

  /** A node named like an actor id shows that actor's current name and color; any other name is a free node. */
  function identity(node, ctx) {
    const slot = ctx.slot(node.name);
    return slot ? { title: ctx.N(node.name), slot } : { title: node.name, slot: null };
  }

  /** Anchors with another node to their left in the same rows cannot take a side-column arrow. */
  function markReach(anchors) {
    anchors.forEach((a) => {
      if (anchors.some((b) => b !== a && b.x + b.w <= a.x && b.y < a.y + a.h && a.y < b.y + b.h)) a.reach = false;
    });
    return anchors;
  }

  /**
   * Sized, drawable node: { id, w, h, bk (box kind), color, table, draw(g, x, y, rowH) }.
   * `w` is the wanted width and `max` the widest allowed; tables always take `max`.
   */
  function build(node, cfg, ctx, w, max, defBox) {
    const d = U.obj(own(cfg.nodes, node.key)), who = identity(node, ctx), slot = who.slot;
    const id = U.str(d.id) || node.key;
    if (node.kind === 'table') {
      const tc = Object.assign({ title: who.title, color: slot || undefined }, d, { id });
      const t = ADG.blocks.get('table').render(tc, max, ctx);
      return { id, w: max, h: t.grid.H, table: true, bk: kindOf(tc.box, 'dbl'), color: U.slot(tc.color, 'a3'), draw: (g, x, y) => g.blit(t.grid, x, y) };
    }
    const n = { id, lines: d.lines != null ? d.lines : [who.title], color: U.slot(d.color, slot || 'fg'), box: kindOf(d.box, defBox || 'solid'), footer: d.footer };
    const bw = fitWidth(n, w, max, ctx);
    return { id, w: bw, h: nodeHeight(n), bk: n.box, color: colorOf(n, ctx), draw: (g, x, y, h) => drawNode(g, x, y, bw, Math.max(h, nodeHeight(n)), n, ctx) };
  }

  const junction = (J, kind, dir) => (kind === 'dbl' ? J['d' + dir] : J[dir]);
  const idOf = (node, cfg) => U.str(U.obj(own(cfg.nodes, node.key)).id) || node.key;

  /** Tiers: stacked rows of nodes joined by fan-out / fan-in connectors, back edge in the right gutter. */
  function renderTiers(P, nodes, cfg, w, ctx) {
    const back = P.back, cx = LEFT, cw = Math.max(8, w - LEFT - (back ? 3 : 1)), mid = cx + Math.floor(cw / 2);
    const pm = Object.create(null), draws = [], late = []; // late: connectors, drawn after the nodes so junctions stay on the borders
    let y = 0, prev = null, capUsed = false;
    const place = (b, key, x, yy, h) => { pm[key] = { b, x, y: yy, h }; };

    P.tiers.forEach((keys, i) => {
      const link = i > 0 ? P.links[i - 1] : null, cols = Math.min(keys.length, WRAP);
      const colW = Math.floor((cw - (cols - 1)) / cols);
      for (let r = 0; r * WRAP < keys.length; r++) {
        const ck = keys.slice(r * WRAP, (r + 1) * WRAP), k = ck.length;
        const bs = ck.map((key) => (keys.length === 1
          ? build(nodes[key], cfg, ctx, Math.max(20, Math.round(cw * (i === 0 ? 0.8 : 0.63))), cw)
          : build(nodes[key], cfg, ctx, colW, colW)));
        const x0 = k === 1 ? mid - Math.floor(bs[0].w / 2) : cx + Math.floor((cw - (k * colW + k - 1)) / 2);
        const xs = bs.map((b, j) => (keys.length === 1 ? x0 : x0 + j * (colW + 1)));
        const centers = bs.map((b, j) => xs[j] + Math.floor(b.w / 2));
        // connector above this row
        const cap = link && r === 0 && link.type === 'fanout' ? link.label || (!capUsed && U.str(cfg.caption)) : '';
        if (cap) capUsed = true;
        const vl = link && link.style === 'dashed' ? 'dv' : 'v';
        let ch = 0;
        if (r > 0) ch = 3; else if (link) ch = link.type === 'fanout' ? (cap ? 4 : 3) : link.type === 'fanin' ? 3 : 2;
        const cy = y, rowY = y + ch, rowH = Math.max.apply(null, bs.map((b) => b.h));
        const lbl = link && r === 0 && link.type !== 'fanout' ? link.label : '';
        const pv = prev, first = bs[0], single = keys.length === 1;
        if (ch) late.push((g) => {
          const J = g.J, V = J[vl], bus = cy + ch - 2, c0 = centers[0], cl = centers[k - 1];
          const upBus = () => {
            if (k > 1) {
              g.hline(c0 + 1, bus, cl - c0 - 1, 'dot', true);
              g.put(c0, bus, J.tl, 'mut'); g.put(cl, bus, J.tr, 'mut'); g.put(mid, bus, J.up, 'mut');
            } else g.put(c0, bus, J.v, 'mut');
            centers.forEach((c) => g.put(c, bus + 1, 'v', 'mut'));
          };
          if (r > 0) { g.put(mid, cy, ':', 'mut'); upBus(); return; }
          if (link.type === 'one' || link.type === 'par') {
            const targetTable = single && first.table;
            centers.forEach((c) => { g.put(c, cy, V, 'mut'); g.put(c, cy + 1, targetTable ? V : 'v', 'mut'); });
            if (targetTable) g.put(centers[0], rowY, junction(J, first.bk, 'up'), first.color);
          } else if (link.type === 'fanout') {
            g.put(mid, cy, cap ? ':' : V, 'mut');
            if (cap) g.center(cx, cw, cy + 1, cap);
            upBus();
          } else { // fanin
            const pc = pv.centers, p0 = pc[0], pl = pc[pc.length - 1];
            pc.forEach((c) => g.put(c, cy, J.v, 'mut'));
            g.hline(p0 + 1, cy + 1, pl - p0 - 1, 'dot', true);
            g.put(p0, cy + 1, J.bl, 'mut'); g.put(pl, cy + 1, J.br, 'mut'); g.put(mid, cy + 1, J.down, 'mut');
            g.put(mid, cy + 2, first.table ? V : 'v', 'mut');
            if (first.table) g.put(mid, rowY, junction(J, first.bk, 'up'), first.color);
          }
          // a lone source leaves its bottom border with a junction
          if (pv && pv.single && link.type !== 'fanin') g.put(pv.centers[0], pv.bottom, junction(J, pv.b.bk, 'down'), pv.b.color);
          if (lbl) g.mtext(mid + 2, cy + ch - 1, lbl, 'a1', false, null, Math.max(1, cx + cw - mid - 2));
        });
        bs.forEach((b, j) => { place(b, ck[j], xs[j], rowY, rowH); draws.push((g) => b.draw(g, xs[j], rowY, rowH)); });
        prev = { centers, single, b: bs[0], bottom: rowY + bs[0].h - 1 };
        y = rowY + rowH;
      }
    });
    const h = Math.max(1, y), g = ctx.grid(w, h), J = g.J;
    draws.concat(late).forEach((d) => d(g));
    if (back) {
      // back edge: source right border → right gutter → up → arrow head into the target node
      const S = pm[back.from], D = pm[back.to], dash = back.style === 'dashed';
      const dy = D.y + Math.floor(D.h / 2), sy = S.y + Math.floor(S.h / 2), lx = w - 1;
      const dx = D.x + D.b.w, sr = S.x + S.b.w - 1;
      g.put(dx, dy, '<', 'mut'); g.hline(dx + 1, dy, lx - dx - 1, 'mut', dash); g.put(lx, dy, J.tr, 'mut');
      g.vline(lx, dy + 1, sy - dy - 1, 'mut', dash);
      g.put(lx, sy, J.br, 'mut'); g.hline(sr + 1, sy, lx - sr - 1, 'mut', dash);
      g.put(sr, sy, junction(J, S.b.bk, 'right'), S.b.color);
      const label = U.str(back.label), room = lx - dx - 1;
      if (label && sy - dy > 1 && room > 0) {
        const lxs = dx + 1 + (room - ADG.markup.mlen(label, ctx.slots) >= 2 ? 1 : 0);
        g.mtext(lxs, dy + 1, label, 'a1', false, null, lx - lxs);
      }
    }
    return { grid: g, anchors: markReach(Object.keys(pm).map((k) => ({ id: pm[k].b.id, x: pm[k].x, y: pm[k].y, w: pm[k].b.w, h: pm[k].b.table ? pm[k].b.h : pm[k].h }))) };
  }

  /** Hub: center (double border), spokes top / left / right / bottom, extra spokes in a table, tails below. */
  function renderHub(P, nodes, cfg, w, ctx) {
    const cx = LEFT, cw = Math.max(8, w - LEFT - 1), mid = cx + Math.floor(cw / 2);
    const cwid = U.clamp(Math.round(cw * 0.28), 15, 24), gap = cw >= 56 ? 4 : 3;
    const cb = build(nodes[P.center], cfg, ctx, cwid, cwid + 6, 'dbl');
    const centerX = mid - Math.floor(cb.w / 2);
    const sw = Math.min(24, centerX - cx - gap, cx + cw - (centerX + cb.w) - gap);
    if (sw < 8) return { error: 'flow too narrow for a hub (' + w + ' columns)' };
    const sp = P.spokes.map((k) => build(nodes[k], cfg, ctx, sw, sw));
    const vw = Math.min(cw, sw + 6);
    const vert = (j) => build(nodes[P.spokes[j]], cfg, ctx, vw, vw);
    const [top, left, right, bottom] = [0, 1, 2, 3].map((j) => (j < sp.length ? (j === 0 || j === 3 ? vert(j) : sp[j]) : null));
    const anchors = [], draws = [], late = [];
    let y = 0;
    const at = (b, x, yy, h) => { anchors.push({ id: b.id, x, y: yy, w: b.w, h: b.table ? b.h : h }); draws.push((g) => b.draw(g, x, yy, h)); };
    const vlink = (yy) => { late.push((g) => { g.put(mid, yy, '^', 'mut'); g.put(mid, yy + 1, g.J.v, 'mut'); g.put(mid, yy + 2, 'v', 'mut'); }); };
    if (top) { at(top, mid - Math.floor(top.w / 2), y, top.h); y += top.h; vlink(y); y += 3; }
    const H = Math.max(cb.h, left ? left.h : 0, right ? right.h : 0), ay = y + Math.floor(H / 2);
    at(cb, centerX, y, H);
    if (left) { const lx = centerX - gap - left.w; at(left, lx, y, H); late.push((g) => g.arrowBoth(lx + left.w, centerX - 1, ay, 'mut')); }
    if (right) { const rx = centerX + cb.w + gap; at(right, rx, y, H); late.push((g) => g.arrowBoth(centerX + cb.w, rx - 1, ay, 'mut')); }
    y += H;
    if (bottom) { vlink(y); y += 3; at(bottom, mid - Math.floor(bottom.w / 2), y, bottom.h); y += bottom.h; }
    // below the hub: the 5th+ spokes as one table, then each `hub -> node`, joined by ':'
    const below = [];
    if (P.extra.length) {
      const names = P.extra.map((k) => nodes[k].name), t = ADG.blocks.get('table').render({ title: P.extra.length + ' more spokes', rows: names.map((name) => ({ name, ratio: 0, value: '' })) }, cw, ctx);
      below.push({ w: cw, h: t.grid.H, table: true, bk: 'dbl', color: 'a3', draw: (g, x, yy) => g.blit(t.grid, x, yy), rows: P.extra.map((k, j) => ({ id: idOf(nodes[k], cfg), y: 2 + j })) });
    }
    P.tails.forEach((k, j) => {
      const b = build(nodes[k], cfg, ctx, Math.max(20, Math.round(cw * 0.8)), cw);
      b.label = P.tailEdges[j].label;
      below.push(b);
    });
    below.forEach((b) => {
      const sy = y, ty = y + 1, bx = mid - Math.floor(b.w / 2);
      late.push((g) => {
        g.put(mid, sy, ':', 'mut'); g.put(mid, ty, junction(g.J, b.bk, 'up'), b.color);
        if (b.label) g.mtext(mid + 2, sy, b.label, 'a1', false, null, Math.max(1, cx + cw - mid - 2));
      });
      at(b, bx, ty, b.h);
      (b.rows || []).forEach((r) => anchors.push({ id: r.id, x: bx + 1, y: ty + r.y, w: b.w - 2, h: 1, reach: false }));
      y = ty + b.h;
    });
    const g = ctx.grid(w, Math.max(1, y));
    draws.concat(late).forEach((d) => d(g));
    return { grid: g, anchors: markReach(anchors) };
  }

  function errorGrid(w, msg, ctx) {
    const g = ctx.grid(w, 1);
    g.text(0, 0, ADG.text.clip('[!] flow: ' + msg, w), 'a1', true);
    return { grid: g };
  }

  function render(cfg, w, ctx) {
    let dsl = U.str(cfg.dsl).trim();
    if (!dsl) dsl = ADG.flowPresets.presetDsl(typeof cfg.preset === 'string' ? cfg.preset : 'fan');
    const parsed = ADG.flowDsl.parse(dsl);
    if (parsed.error) return errorGrid(w, 'line ' + parsed.error.line + ', col ' + parsed.error.col + ': ' + parsed.error.msg, ctx);
    const plan = ADG.flowGraph.analyze(parsed);
    if (plan.error) return errorGrid(w, plan.error.msg, ctx);
    const nodes = Object.create(null);
    parsed.nodes.forEach((n) => { nodes[n.key] = n; });
    const res = plan.mode === 'hub' ? renderHub(plan, nodes, cfg, w, ctx) : renderTiers(plan, nodes, cfg, w, ctx);
    if (res.error) return errorGrid(w, res.error, ctx);
    return { grid: res.grid, anchors: res.anchors.filter((a) => a.id && a.w >= 3) };
  }

  ADG.blocks.register('flow', {
    label: 'Sơ đồ luồng',
    provides: true,
    help: 'Viết sơ đồ bằng DSL: a -> b, [a, b], a <-> [b, c], a ..> b, x@table, : nhãn. Dữ liệu từng nút nằm trong nodes.',
    schema: [
      { key: 'preset', label: 'Mẫu khi DSL trống', type: 'select', options: ['fan', 'hub'] },
      { key: 'dsl', label: 'DSL (mỗi dòng một chuỗi)', type: 'textarea' },
      { key: 'caption', label: 'Chú thích trước nhánh đầu tiên (markup)', type: 'text' }
    ],
    drawNode, nodeHeight, render
  });
})(window.ADG = window.ADG || {});
