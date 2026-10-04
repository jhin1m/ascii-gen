/* Inline markup → segments.
     {a1:text}   color slot          {a1b:text}  color slot + bold
     {lead:text} actor color + bold  {m:text}    muted (alias of mut), {dim:..} dimmed
     {bar:0.8:6:a1} inline progress bar (ratio:width:slot)
     **text**    bold                {{          literal '{'
   Unknown tags stay as literal text so a typo is visible instead of silently lost. */
(function (ADG) {
  const RE = /\{\{|\{([A-Za-z0-9_-]+):([^}]*)\}|\*\*([^*]+)\*\*/g;
  const ALIAS = { m: 'mut' };
  const MAX_BAR = 256; // wider than any grid; caps work for hostile shared markup

  function colorKey(tag) {
    const k = ALIAS[tag] || tag;
    return ADG.theme.COLOR_KEYS.indexOf(k) >= 0 ? k : null;
  }

  /**
   * @param {string} s markup string
   * @param {Object<string,string>} [actors] actor id → color slot (e.g. { lead: 'a1' })
   * @returns {Array<{t:string, fg?:string, b?:boolean} | {bar:true, r:number, w:number, fg:string}>}
   *   `b` is set only when the markup forces bold; otherwise the caller's default applies.
   */
  function parse(s, actors) {
    s = String(s == null ? '' : s);
    actors = actors || {};
    const out = [];
    const pushText = (t) => {
      const prev = out[out.length - 1];
      if (prev && !prev.bar && prev.fg === undefined && prev.b === undefined) prev.t += t;
      else out.push({ t });
    };
    let last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(s)) !== null) {
      if (m.index > last) pushText(s.slice(last, m.index));
      last = RE.lastIndex;
      if (m[0] === '{{') { pushText('{'); continue; }
      if (m[3] !== undefined) { out.push({ t: m[3], b: true }); continue; }
      const tag = m[1], body = m[2];
      if (tag === 'bar') {
        const q = body.split(':');
        const r = parseFloat(q[0]);
        const w = parseInt(q[1], 10);
        out.push({ bar: true, r: Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0, w: w > 2 ? Math.min(w, MAX_BAR) : 8, fg: colorKey(q[2]) || 'a1' });
      } else if (Object.prototype.hasOwnProperty.call(actors, tag)) {
        out.push({ t: body, fg: colorKey(actors[tag]) || 'fg', b: true });
      } else if (colorKey(tag)) {
        out.push({ t: body, fg: colorKey(tag) });
      } else if (tag.length > 1 && tag.endsWith('b') && colorKey(tag.slice(0, -1))) {
        out.push({ t: body, fg: colorKey(tag.slice(0, -1)), b: true });
      } else {
        pushText(m[0]);
      }
    }
    if (last < s.length) pushText(s.slice(last));
    return out;
  }

  /** Cell width of parsed segments. */
  function segLen(segs) {
    return segs.reduce((a, g) => a + (g.bar ? g.w : ADG.text.toCells(g.t).length), 0);
  }

  /** Cell width of a markup string once rendered. */
  function mlen(s, actors) { return segLen(parse(s, actors)); }

  ADG.markup = { parse, segLen, mlen };
})(window.ADG = window.ADG || {});
