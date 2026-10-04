/* Seeded randomness. Every random choice is keyed by (seed, path) so changing one field never
   reshuffles another, and the same seed always gives the same picture.
   jitter(config, seed) varies the NUMBERS of hand-written blocks (bar ratios, meter ratios, pulse
   bits, timeline gaps, digits in counters) and never their words; seed 0 leaves them untouched. */
(function (ADG) {
  /** mulberry32 PRNG → function returning floats in [0, 1). */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** FNV-1a string hash (32 bit). */
  function hash(s) {
    let h = 0x811c9dc5;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  /** Generator for (seed, path): independent streams per field. */
  function rng(seed, path) {
    const r = mulberry32((hash(path) ^ Math.imul((Number(seed) | 0) + 1, 0x9E3779B1)) | 0);
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)); // inclusive
    r.pick = (list) => list[Math.floor(r() * list.length)];
    return r;
  }

  /** Same digit count and separators, new digits (a leading digit is never 0 unless alone). */
  function digits(num, r) {
    let first = true;
    return num.replace(/\d/g, () => {
      const d = first && num.replace(/\D/g, '').length > 1 ? r.int(1, 9) : r.int(0, 9);
      first = false;
      return String(d);
    });
  }

  /**
   * New digits for the plain counters in markup text (`6`, `643k`, `1,683`). Tag names (`{a3b:`),
   * inline bars, and numbers that belong to a ratio, time, percentage or decimal (`0/3`, `09:30`,
   * `100%`, `0.5 s`) stay as they are: new digits there would make impossible values.
   */
  function renumber(s, r) {
    s = String(s == null ? '' : s);
    return s.replace(/\{bar:[^}]*\}|\{[A-Za-z0-9_@^-]+:?|\d+(?:[,.]\d+)*/g, (m, at) => {
      if (!/^\d/.test(m) || /\./.test(m)) return m;
      const before = s[at - 1] || '', after = s[at + m.length] || '';
      return /[/:]/.test(before) || /[/:%.]/.test(after) ? m : digits(m, r);
    });
  }

  /** Inline bars `{bar:r:w:slot}` get a new ratio. */
  function rebar(s, r) {
    return String(s == null ? '' : s).replace(/\{bar:([^:}]*)((?::[^}]*)?)\}/g, (m, ratio, rest) => '{bar:' + r.range(0.2, 1).toFixed(2) + rest + '}');
  }

  /** Activity gaps move: some active cells go idle, some idle neighbours turn active; '<>' stays. */
  function repattern(p, r) {
    const a = Array.from(String(p == null ? '' : p));
    const act = (c) => c !== '.' && c !== ' ' && c !== '<' && c !== '>';
    const glyph = a.find(act);
    if (!glyph) return a.join('');
    return a.map((c, i) => {
      if (act(c)) return r() < 0.14 ? '.' : c;
      if (c === '.' && (act(a[i - 1] || '') || act(a[i + 1] || ''))) return r() < 0.3 ? (act(a[i - 1] || '') ? a[i - 1] : a[i + 1]) : c;
      return c;
    }).join('');
  }

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const ratio = (v, r) => (Number(v) >= 1 ? 1 : +r.range(0.12, 0.95).toFixed(2));

  function jitterTable(t, r) {
    if (!isObj(t)) return;
    if (Array.isArray(t.rows)) t.rows.forEach((row) => { if (isObj(row) && row.ratio != null) row.ratio = +r.range(0.2, 0.98).toFixed(2); });
    if (typeof t.right === 'string') t.right = renumber(t.right, r);
  }

  function jitterNode(n, r) {
    if (!isObj(n)) return;
    if (Array.isArray(n.lines)) n.lines = n.lines.map((l) => rebar(l, r));
    if (isObj(n.footer) && typeof n.footer.ratio === 'number') n.footer.ratio = +r.range(0, 1).toFixed(2);
    jitterTable(n, r);
  }

  /** Per block type: mutate the numbers of a (cloned) block config in place. */
  const JITTER = {
    table: jitterTable,
    meters(b, r) { if (Array.isArray(b.items)) b.items.forEach((it) => { if (isObj(it)) it.ratio = ratio(it.ratio, r); }); },
    timeline(b, r) { if (Array.isArray(b.rows)) b.rows.forEach((row) => { if (isObj(row)) row.pattern = repattern(row.pattern, r); }); },
    status(b, r) { if (Array.isArray(b.items)) b.items.forEach((it) => { if (isObj(it) && typeof it.v === 'string') it.v = renumber(it.v, r); }); },
    'side-column'(b, r) {
      if (!Array.isArray(b.items)) return;
      b.items.forEach((it) => {
        if (!isObj(it)) return;
        if (it.kind === 'pulse') it.bits = Array.from(String(it.bits || '')).map(() => (r() > 0.35 ? '1' : '0')).join('');
        if (it.kind === 'kv' && typeof it.v === 'string') it.v = renumber(it.v, r);
      });
    },
    flow(b, r) { if (isObj(b.nodes)) Object.keys(b.nodes).sort().forEach((k) => jitterNode(b.nodes[k], rng(r.seed, 'node:' + k))); }
  };

  /**
   * Vary the numbers of every hand-written block (auto blocks are generated from the seed already).
   * Mutates and returns `config`; seed 0 (or invalid) is a no-op.
   */
  function jitter(config, seed) {
    seed = Math.floor(Number(seed)) || 0;
    if (!seed || !isObj(config) || !isObj(config.blocks)) return config;
    Object.keys(config.blocks).forEach((key) => {
      const b = config.blocks[key];
      if (!isObj(b) || b.auto === true) return;
      const type = typeof b.type === 'string' ? b.type : key;
      if (!Object.prototype.hasOwnProperty.call(JITTER, type)) return;
      const r = rng(seed, 'block:' + key);
      r.seed = seed;
      JITTER[type](b, r);
    });
    return config;
  }

  ADG.random = { mulberry32, hash, rng, renumber, rebar, repattern, jitter };
})(window.ADG = window.ADG || {});
