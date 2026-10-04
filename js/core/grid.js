/* Character grid: every block draws into one W×H buffer of cells, so columns always line up.
   A cell is { ch, fg, bg, b, k } where fg/bg are palette KEYS (never hex), b = bold, k = effect. */
(function (ADG) {
  const T = ADG.text, M = ADG.markup;

  const BOX = {
    ascii: {
      solid: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
      dash: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', gap: true },
      dbl: { tl: '+', tr: '+', bl: '+', br: '+', h: '=', v: '|' }
    },
    unicode: {
      solid: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      dash: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '╌', v: '╎' },
      dbl: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
    }
  };
  // Junctions for connecting lines onto box borders (down = ┬ on a top/bottom edge, d* = double edge).
  const JUNCTIONS = {
    ascii: { down: '+', up: '+', ddown: '+', dup: '+', dright: '+', tl: '+', tr: '+', bl: '+', br: '+', h: '-', dh: '-', v: '|', dv: ':', eq: '=' },
    unicode: { down: '┬', up: '┴', ddown: '╤', dup: '╧', dright: '╟', tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', dh: '╌', v: '│', dv: '╎', eq: '═' }
  };

  function blankCell() { return { ch: ' ', fg: 'fg', bg: null, b: false, k: '' }; }

  /**
   * @param {number} W columns  @param {number} H rows
   * @param {{border?: 'ascii'|'unicode', actors?: Object<string,string>}} [opts]
   */
  function createGrid(W, H, opts) {
    opts = opts || {};
    // layout ratios produce fractional sizes/coords; every primitive works on whole cells
    W = Math.max(0, Math.floor(W) || 0); H = Math.max(0, Math.floor(H) || 0);
    const border = opts.border === 'unicode' ? 'unicode' : 'ascii';
    const actors = opts.actors || {};
    const B = BOX[border], J = JUNCTIONS[border];
    const cells = [];
    for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(blankCell()); cells.push(r); }
    const g = { W, H, cells, J, border, actors, issues: [] };
    const F = Math.floor;

    /** Write one cell. Out of bounds is ignored; bg is kept when not given; unsafe glyphs become '?'. */
    g.put = (x, y, ch, fg, b, bg, k) => {
      x = Math.floor(x); y = Math.floor(y);
      if (!(x >= 0 && y >= 0 && x < W && y < H)) return;
      if (T.isBadCell(ch)) { g.issues.push({ x, y, ch: String(ch), reason: 'wide-or-invalid' }); ch = '?'; }
      const c = cells[y][x];
      c.ch = ch; c.fg = fg || 'fg'; c.b = !!b; c.k = k || '';
      if (bg) c.bg = bg;
    };

    /** Plain text; returns cells written. */
    g.text = (x, y, s, fg, b, bg) => {
      const a = T.toCells(s);
      a.forEach((ch, i) => g.put(x + i, y, ch, fg, b, bg));
      return a.length;
    };

    /**
     * Markup text. With `maxW`, overflowing text is cut so that it ends in '…' on cell maxW-1
     * (a bar that would cross that cell is dropped whole). Returns cells used.
     */
    g.mtext = (x, y, s, dfg, db, bg, maxW) => {
      x = F(x); y = F(y);
      const segs = M.parse(s, actors);
      const total = M.segLen(segs);
      const cut = maxW != null && total > maxW;
      const lim = cut ? Math.max(0, F(maxW)) : Infinity;
      const room = cut ? lim - 1 : Infinity; // keep the last cell for '…'
      let n = 0, lastFg = dfg || 'fg', lastB = db;
      for (const seg of segs) {
        if (n >= room) break;
        if (seg.bar) {
          if (n + seg.w > room) break;
          g.bar(x + n, y, seg.w, seg.r, seg.fg);
          n += seg.w; lastFg = 'mut'; lastB = false;
          continue;
        }
        const fg = seg.fg || dfg || 'fg', b = seg.b !== undefined ? seg.b : db;
        for (const ch of T.toCells(seg.t)) {
          if (n >= room) break;
          g.put(x + n, y, ch, fg, b, bg);
          n++; lastFg = fg; lastB = b;
        }
      }
      if (!cut) return n;
      if (lim > 0) g.put(x + lim - 1, y, '…', lastFg, lastB, bg);
      return lim;
    };

    /** Markup centered inside [x, x+w); clipped when wider than w. */
    g.center = (x, w, y, s, dfg, db) => {
      x = F(x); w = F(w);
      const len = M.mlen(s, actors);
      return g.mtext(x + Math.max(0, Math.floor((w - len) / 2)), y, s, dfg, db, null, w);
    };

    /** Markup right-aligned so its last cell lands on x2. */
    g.right = (x2, y, s, dfg, db) => g.mtext(x2 - M.mlen(s, actors) + 1, y, s, dfg, db);

    g.fillBg = (x, y, w, bg) => {
      x = F(x); y = F(y); w = F(w);
      if (y < 0 || y >= H) return;
      for (let i = Math.max(0, x); i < x + w && i < W; i++) cells[y][i].bg = bg;
    };

    g.hline = (x, y, len, fg, dashed) => {
      for (let i = 0; i < len; i++) g.put(x + i, y, dashed ? (border === 'unicode' ? J.dh : i % 2 ? ' ' : '-') : J.h, fg);
    };
    /** Vertical line; `ch` overrides the glyph (e.g. ':' for a dotted rail in either border style). */
    g.vline = (x, y, len, fg, dashed, ch) => { for (let i = 0; i < len; i++) g.put(x, y + i, ch || (dashed ? J.dv : J.v), fg); };
    g.divider = (x, y, len, fg) => { for (let i = 0; i < len; i++) g.put(x + i, y, J.eq, fg); };

    /** Line from x1 to x2 with the head on x2 (x2 > x1). */
    g.arrowR = (x1, x2, y, fg, dashed) => { g.hline(x1, y, x2 - x1, fg, dashed); g.put(x2, y, '>', fg); };
    /** Head on x1, line to x2 (x2 > x1). */
    g.arrowL = (x1, x2, y, fg, dashed) => { g.put(x1, y, '<', fg); g.hline(x1 + 1, y, x2 - x1, fg, dashed); };
    /** Vertical line from y1 down to the head on y2. */
    g.arrowDown = (x, y1, y2, fg, dashed) => { g.vline(x, y1, y2 - y1, fg, dashed); g.put(x, y2, 'v', fg); };
    g.arrowBoth = (x1, x2, y, fg, dashed) => {
      g.hline(x1 + 1, y, x2 - x1 - 1, fg, dashed); g.put(x1, y, '<', fg); g.put(x2, y, '>', fg);
    };

    /** Box of kind solid|dash|dbl with an optional markup label on the top edge: `+- label ---+`. */
    g.box = (x, y, w, h, fg, kind, label) => {
      x = F(x); y = F(y); w = F(w); h = F(h);
      if (w < 2 || h < 2) return;
      const c = B[kind] || B.solid;
      for (let i = 1; i < w - 1; i++) {
        const ch = c.gap && i % 2 === 0 ? ' ' : c.h;
        g.put(x + i, y, ch, fg); g.put(x + i, y + h - 1, ch, fg);
      }
      for (let j = 1; j < h - 1; j++) { g.put(x, y + j, c.v, fg); g.put(x + w - 1, y + j, c.v, fg); }
      g.put(x, y, c.tl, fg); g.put(x + w - 1, y, c.tr, fg);
      g.put(x, y + h - 1, c.bl, fg); g.put(x + w - 1, y + h - 1, c.br, fg);
      if (label && w > 6) {
        g.put(x + 2, y, ' ', fg);
        const n = g.mtext(x + 3, y, label, 'fg', true, null, w - 6);
        g.put(x + 3 + n, y, ' ', fg);
      }
    };

    /** `[####..:.]` progress bar, total width w (brackets included), ratio r in 0..1. */
    g.bar = (x, y, w, r, fg) => {
      w = F(w);
      if (!(w >= 2)) return;
      const n = w - 2, f = Math.round(n * Math.max(0, Math.min(1, Number(r) || 0)));
      g.put(x, y, '[', 'mut');
      for (let i = 0; i < n; i++) {
        if (i < f) g.put(x + 1 + i, y, '#', fg || 'a1', true);
        else g.put(x + 1 + i, y, i % 4 === 3 ? ':' : '.', 'mut');
      }
      g.put(x + w - 1, y, ']', 'mut');
    };

    /** `@#####.....` meter: head always shown, filled part bold in fg. */
    g.meter = (x, y, w, r, fg) => {
      w = F(w);
      const f = Math.max(1, Math.round(w * Math.max(0, Math.min(1, Number(r) || 0))));
      for (let i = 0; i < w; i++) {
        if (i === 0) g.put(x, y, '@', fg, true);
        else if (i < f) g.put(x + i, y, '#', fg, true);
        else g.put(x + i, y, '.', 'dot');
      }
    };

    /**
     * Copy another grid onto this one at (x, y), clipped to bounds. Its self-check issues move
     * along (offset), so a glyph replaced inside a block grid is still reported on the page grid.
     */
    g.blit = (src, x, y) => {
      x = F(x); y = F(y);
      for (let sy = 0; sy < src.H; sy++) {
        const ty = y + sy;
        if (ty < 0 || ty >= H) continue;
        for (let sx = 0; sx < src.W; sx++) {
          const tx = x + sx;
          if (tx >= 0 && tx < W) cells[ty][tx] = Object.assign({}, src.cells[sy][sx]);
        }
      }
      src.issues.forEach((i) => g.issues.push(Object.assign({}, i, { x: i.x + x, y: i.y + y })));
    };

    /** Rows as plain strings (what a text export / self-check sees). */
    g.toLines = () => cells.map((row) => row.map((c) => c.ch).join(''));

    return g;
  }

  /**
   * Verify every row is exactly W single-column cells. Warns once with the list and returns it;
   * an empty array means the grid is safe to render in any monospace output.
   */
  function selfCheck(g) {
    const out = g.issues.map((i) => ({ row: i.y, col: i.x, ch: i.ch, reason: i.reason }));
    g.cells.forEach((row, y) => {
      if (row.length !== g.W) out.push({ row: y, reason: 'row-length', got: row.length });
      row.forEach((c, x) => { if (T.isBadCell(c.ch)) out.push({ row: y, col: x, ch: c.ch, reason: 'wide-or-invalid' }); });
    });
    g.toLines().forEach((line, y) => {
      const n = Array.from(line).length;
      if (n !== g.W) out.push({ row: y, reason: 'line-width', got: n });
    });
    if (out.length) console.warn('[ascii-gen] self-check: ' + out.length + ' issue(s)', out);
    return out;
  }

  ADG.grid = { createGrid, selfCheck, BOX, JUNCTIONS };
})(window.ADG = window.ADG || {});
