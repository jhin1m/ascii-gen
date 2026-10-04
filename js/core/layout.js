/* Rows × columns composer. config.layout is a list of rows; a row lists blocks as 'key' or
   { block: 'key', w: ratio }. Each block renders into its own grid at its share of the width,
   the row takes the tallest height, stretch blocks re-render at that height, then everything is
   blitted into one page grid. Blocks that provide anchors render first in a row so consumers
   (side column milestones) can snap to them; their links become dashed arrows in a final pass.
   The page height is computed, never configured. */
(function (ADG) {
  const MARGIN = 1, GAP_X = 1, GAP_Y = 1, PAD_TOP = 1;
  const MIN_COLS = 40, MAX_COLS = 240, MAX_ROWS = 400; // page rows: later layout rows are dropped

  const RESERVED = ['bar', 'm'].concat(ADG.theme.COLOR_KEYS);
  const isReserved = (id) => RESERVED.indexOf(id) >= 0 || (/b$/.test(id) && ADG.theme.COLOR_KEYS.indexOf(id.slice(0, -1)) >= 0);

  /** Split `total` cells by weights (missing/invalid weight = 1); the remainder goes to the last. */
  function split(total, weights) {
    const ws = weights.map((w) => (Number(w) > 0 ? Number(w) : 1));
    const sum = ws.reduce((a, b) => a + b, 0);
    const out = ws.map((w) => Math.floor((total * w) / sum));
    if (out.length) out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
    return out;
  }

  function clampCols(n) {
    n = Math.floor(Number(n)) || 96;
    return Math.max(MIN_COLS, Math.min(MAX_COLS, n));
  }

  /** Shared render context: actors (id → slot/name), steps, current step, grid factory. */
  function makeCtx(config) {
    const slots = {}, names = {};
    const U = ADG.blocks.util;
    U.arr(config.actors, 20).forEach((a) => {
      // an id equal to a markup tag (a1, dim, bar, …) would hijack that tag
      if (!a || typeof a.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(a.id) || isReserved(a.id)) return;
      slots[a.id] = U.slot(a.color, 'fg');
      // braces/asterisks would turn a name into markup when blocks embed it
      names[a.id] = ADG.text.sanitize(String(a.name == null ? a.id : a.name).replace(/[{}*]/g, '')).trim() || a.id;
    });
    const steps = U.arr(config.steps, 20).map((s) => ADG.text.sanitize(String(s)));
    const cur = Math.floor(Number(config.current));
    const border = config.border === 'unicode' ? 'unicode' : 'ascii';
    return {
      border, slots, steps,
      step: Number.isFinite(cur) ? Math.max(-1, Math.min(steps.length - 1, cur)) : 0,
      N: (id) => (Object.prototype.hasOwnProperty.call(names, id) ? names[id] : String(id == null ? '' : id)),
      slot: (id) => (Object.prototype.hasOwnProperty.call(slots, id) ? slots[id] : null),
      grid: (w, h) => ADG.grid.createGrid(w, h, { border, actors: slots }),
      minHeight: 0,
      anchors: []
    };
  }

  /** Layout row → visible, registered items. */
  function rowItems(row, blocks) {
    const list = Array.isArray(row) ? row.slice(0, 4) : [row];
    return list.map((it) => {
      const key = typeof it === 'string' ? it : it && it.block;
      if (typeof key !== 'string' || !key) return null;
      const cfg = ADG.blocks.util.obj(blocks && Object.prototype.hasOwnProperty.call(blocks, key) ? blocks[key] : null);
      if (cfg.hidden) return null;
      const def = ADG.blocks.get(typeof cfg.type === 'string' ? cfg.type : key);
      if (!def) { console.warn('[ascii-gen] layout: unknown block "' + key + '"'); return null; }
      return { key, def, cfg, w: typeof it === 'object' ? it.w : 1 };
    }).filter(Boolean);
  }

  /** Render one block; a throwing or malformed block becomes a one-line error instead of breaking the page. */
  function renderBlock(item, width, ctx) {
    try {
      const res = item.def.render(item.cfg, width, ctx);
      if (!res || !res.grid || !Array.isArray(res.grid.cells)) throw new Error('render() returned no grid');
      return res;
    } catch (e) {
      console.warn('[ascii-gen] block "' + item.key + '" failed:', e);
      const g = ctx.grid(width, 1);
      g.text(0, 0, ADG.text.clip('[!] ' + item.key + ': ' + (e && e.message), width), 'a1', true);
      return { grid: g };
    }
  }

  function renderRow(items, xs, widths, base) {
    const ctx = Object.assign({}, base, { anchors: [], minHeight: 0 });
    // providers first so consumers in the same row see their anchors (x absolute, y row-relative)
    const order = items.map((_, i) => i).sort((a, b) => (items[b].def.provides ? 1 : 0) - (items[a].def.provides ? 1 : 0));
    const res = [];
    order.forEach((i) => {
      res[i] = renderBlock(items[i], widths[i], ctx);
      ADG.blocks.util.arr(res[i].anchors).forEach((a) => ctx.anchors.push(Object.assign({}, a, { x: a.x + xs[i] })));
    });
    const h = Math.max.apply(null, res.map((r) => r.grid.H));
    items.forEach((it, i) => {
      if (it.def.stretch && res[i].grid.H < h) res[i] = renderBlock(it, widths[i], Object.assign({}, ctx, { minHeight: h }));
    });
    return { res, h };
  }

  /**
   * Draw a link arrow only when it can be read: target in the same layout row, not behind another
   * node, the link row inside the target's rows and every cell on the way blank.
   * Returns null when drawn, else why it was skipped: 'missing' (no such anchor), 'unreachable'
   * (other row, blocked, or no room) or 'out-of-rows' (the link row misses the target's rows).
   */
  function linkClear(grid, l, anchors) {
    const a = anchors.find((t) => t.id === l.to);
    if (!a) return 'missing';
    if (a.row !== l.row || a.reach === false || a.x - 1 <= l.x || l.y >= grid.H) return 'unreachable';
    if (l.y < a.y || l.y >= a.y + a.h) return 'out-of-rows';
    for (let x = l.x; x < a.x; x++) if (grid.cells[l.y][x].ch !== ' ') return 'unreachable';
    grid.arrowR(l.x, a.x - 1, l.y, 'mut', true);
    return null;
  }

  /**
   * @param {object} config dashboard config ({ grid:{cols}, border, actors, steps, current, layout, blocks })
   * @returns {{ grid: object, anchors: Array<{id,x,y,w,h}>, cols: number, rows: number, skipped: Array<{from,to,reason}> }}
   */
  function compose(config) {
    config = config || {};
    const cols = clampCols(config.grid && config.grid.cols);
    const ctx = makeCtx(config);
    const inner = cols - 2 * MARGIN;
    const placed = [], anchors = [], links = [];
    let y = PAD_TOP;
    ADG.blocks.util.arr(config.layout, 40).forEach((row, ri) => {
      const items = rowItems(row, config.blocks);
      if (!items.length || y >= MAX_ROWS) return;
      const widths = split(inner - GAP_X * (items.length - 1), items.map((it) => it.w));
      const xs = [];
      widths.reduce((x, w, i) => { xs[i] = x; return x + w + GAP_X; }, MARGIN);
      const { res, h } = renderRow(items, xs, widths, ctx);
      res.forEach((r, i) => {
        placed.push({ grid: r.grid, x: xs[i], y });
        ADG.blocks.util.arr(r.anchors).forEach((a) => anchors.push(Object.assign({}, a, { x: a.x + xs[i], y: a.y + y, row: ri })));
        ADG.blocks.util.arr(r.links).forEach((l) => links.push({ x: l.x + xs[i], y: l.y + y, to: l.to, row: ri, from: String(l.from || items[i].key) }));
      });
      y += h + GAP_Y;
    });
    const rows = Math.min(MAX_ROWS, Math.max(1, y - GAP_Y));
    const grid = ADG.grid.createGrid(cols, rows, { border: ctx.border, actors: ctx.slots });
    placed.forEach((p) => grid.blit(p.grid, p.x, p.y));
    // links that cannot be drawn are reported, not logged: the UI decides whether to tell the user
    const skipped = [];
    links.forEach((l) => { const reason = linkClear(grid, l, anchors); if (reason) skipped.push({ from: l.from, to: l.to, reason }); });
    return { grid, anchors: anchors.map((a) => ({ id: a.id, x: a.x, y: a.y, w: a.w, h: a.h })), cols, rows, skipped };
  }

  ADG.layout = { compose, split, makeCtx, clampCols, MARGIN, GAP_X, GAP_Y, PAD_TOP };
})(window.ADG = window.ADG || {});
