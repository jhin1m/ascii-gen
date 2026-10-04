/* Block registry. A block is { type, label, schema, stretch, provides, render(cfg, width, ctx) }:
   render draws into its own grid (ctx.grid(w, h)) and returns { grid, anchors?, links? }.
     stretch  — re-rendered with ctx.minHeight = row height so its frame fills the row
     provides — rendered first in its row; exports anchors { id, x, y, w, h } for consumers
     links    — [{ x, y, to }] arrows the layout draws from (x, y) to the left edge of anchor `to`
   Schema fields drive the editor form (phase 5); `list` fields are edited as pipe-delimited lines. */
(function (ADG) {
  const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'bool', 'list', 'color-slot'];
  const defs = Object.create(null);

  function register(type, def) {
    if (!def || typeof def.render !== 'function') throw new Error('block "' + type + '" needs render()');
    (def.schema || []).forEach((f) => {
      if (FIELD_TYPES.indexOf(f.type) < 0) throw new Error('block "' + type + '" field "' + f.key + '": unknown type ' + f.type);
    });
    defs[type] = Object.assign({ type, label: type, schema: [], stretch: false, provides: false }, def);
    return defs[type];
  }

  function get(type) { return typeof type === 'string' && defs[type] ? defs[type] : null; }
  function types() { return Object.keys(defs); }

  // Config comes from user JSON / share links: every block reads it through these guards.
  // List caps keep a tiny shared link from building a page of millions of cells.
  const util = {
    /** Array guard; `max` caps the length (default 100). */
    arr: (v, max) => (Array.isArray(v) ? v.slice(0, max || 100).filter((x) => x != null) : []),
    /** Object guard: anything else becomes {}. */
    obj: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
    /** Palette key guard: only known color keys reach the cells. */
    slot: (v, d) => (typeof v === 'string' && ADG.theme.COLOR_KEYS.indexOf(v) >= 0 ? v : d),
    str: (v) => (v == null ? '' : String(v)),
    num: (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d),
    ratio: (v) => Math.max(0, Math.min(1, Number(v) || 0)),
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    /** Longest cell width among strings, clamped to [lo, hi]. */
    widest: (list, lo, hi) => util.clamp(list.reduce((m, s) => Math.max(m, ADG.text.toCells(s).length), 0), lo, hi),
    /** Markup string → lines (accepts an array or '\n'-separated text). */
    lines: (v, max) => (Array.isArray(v) ? v.map(util.str) : util.str(v) === '' ? [] : util.str(v).split('\n')).slice(0, max || 10)
  };

  ADG.blocks = { register, get, types, util, FIELD_TYPES };
})(window.ADG = window.ADG || {});
