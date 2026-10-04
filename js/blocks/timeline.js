/* Timeline: one row per actor, an activity pattern resampled to the track width, step ticks on an
   axis, step labels under it and a highlighted cursor column through the current step.
   Paused: the whole pattern, cursor mid-step. Playing: the cursor moves through the step with
   ctx.t and activity after it is not drawn yet (idle dots).
   Pattern: one glyph per time slice ('.' idle, any other glyph = activity in the actor color);
   the token '<>' always keeps its 2 cells. */
(function (ADG) {
  const U = ADG.blocks.util, T = ADG.text;

  function tokens(pattern) {
    const a = T.toCells(pattern), out = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '<' && a[i + 1] === '>') { out.push('<>'); i++; } else out.push(a[i]);
    }
    return out;
  }

  /** Resample a pattern to `n` cells. Idle ('.' or ' ') stays '.', activity covers at least one cell. */
  function resample(pattern, n) {
    n = Math.max(0, Math.floor(n));
    const toks = tokens(U.str(pattern)).slice(0, 1000);
    const S = toks.reduce((s, t) => s + t.length, 0);
    const out = new Array(n).fill('.');
    if (!S || !n) return out.join('');
    const pairs = [];
    let s = 0;
    toks.forEach((t) => {
      const a = Math.floor((s * n) / S), b = Math.max(a + 1, Math.floor(((s + t.length) * n) / S));
      if (t === '<>') pairs.push(a);
      else if (t !== '.' && t !== ' ') for (let c = a; c < b && c < n; c++) out[c] = t;
      s += t.length;
    });
    // drawn last so neighbouring activity never splits the pair
    if (n >= 2) pairs.forEach((a) => { const c = Math.min(a, n - 2); out[c] = '<'; out[c + 1] = '>'; });
    return out.join('');
  }

  /** Step boundaries as fractions 0..1 (length steps+1): config value when valid, else even split. */
  function bounds(b, steps) {
    const ok = Array.isArray(b) && b.length === steps + 1 && b.every((v, i) => Number.isFinite(v) && v >= 0 && v <= 1 && (i === 0 || v >= b[i - 1]));
    return ok ? b.slice() : Array.from({ length: steps + 1 }, (_, i) => (steps ? i / steps : 0));
  }

  ADG.blocks.register('timeline', {
    label: 'Dòng thời gian',
    schema: [
      { key: 'title', label: 'Nhãn khung', type: 'text' },
      { key: 'rows', label: 'Hàng: actor | mẫu (. nghỉ, # hoạt động, <> mốc)', type: 'list', fields: ['actor', 'pattern'] },
      { key: 'cursor', label: 'Con trỏ bước hiện tại', type: 'bool' }
    ],
    resample,
    render(cfg, w, ctx) {
      const rows = U.arr(cfg.rows, 20).map(U.obj);
      const h = rows.length + 4;
      const g = ctx.grid(w, h);
      g.box(0, 0, w, h, 'mut', 'dash', U.str(cfg.title));
      const names = rows.map((r) => ctx.N(r.actor));
      const nameW = U.widest(names, 4, 10);
      const TX = 2 + nameW + 1, TW = w - 2 - TX;
      const steps = ctx.steps, B = bounds(cfg.bounds, steps.length);
      const col = (f) => TX + Math.round(f * (TW - 1));
      const live = cfg.cursor !== false && ctx.step >= 0 && ctx.step < steps.length && TW > 0;
      const at = live ? (ctx.playing ? B[ctx.step] + ctx.t * (B[ctx.step + 1] - B[ctx.step]) : (B[ctx.step] + B[ctx.step + 1]) / 2) : 0;
      const cur = live ? col(at) : -1;
      const upto = live && ctx.playing ? cur : Infinity; // reveal limit while playing
      rows.forEach((r, i) => {
        const y = 1 + i, slot = ctx.slot(r.actor) || U.slot(r.color, 'fg');
        g.text(2, y, T.clip(names[i], nameW), slot, true);
        if (TW <= 0) return;
        Array.from(resample(r.pattern, TW)).forEach((ch, c) => {
          if (TX + c > upto) ch = '.';
          g.put(TX + c, y, ch, ch === '.' ? 'dot' : slot, ch !== '.');
        });
        if (cur >= 0) g.put(cur, y, '|', 'fg', true, 'hlcur');
      });
      if (TW > 0) {
        const ay = 1 + rows.length;
        g.hline(TX, ay, TW, 'dot');
        B.forEach((f) => g.put(col(f), ay, g.J.up, 'mut'));
        if (cur >= 0) g.put(cur, ay, '^', 'a2', true);
        steps.forEach((s, i) => {
          const a = col(B[i]), b = col(B[i + 1]), lab = T.clip(s, Math.max(1, b - a - 1));
          const x = Math.floor((a + b - T.toCells(lab).length) / 2) + 1;
          g.text(x, ay + 1, lab, i === ctx.step ? 'fg' : 'dim', i === ctx.step);
        });
      }
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
