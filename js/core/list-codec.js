/* List fields of block forms as text: one line per item, ` | ` between fields (side column:
   `kind | …` with the kind's own fields). A literal | is written \|, a line break inside a value \n.
   Parsing keeps extra properties of the item at the same position (color, snap, …), so a form edit
   never drops data the form does not show. DOM-free. */
(function (ADG) {
  const NUMERIC = ['ratio', 'step', 'n', 'highlight'];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  const esc = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, '\\n');
  function unesc(s) {
    return s.replace(/\\(\\|\||n)/g, (m, c) => (c === 'n' ? '\n' : c));
  }
  /** Split on | that is not escaped. */
  function cells(line) {
    const out = [];
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\' && i + 1 < line.length) { cur += line[i] + line[i + 1]; i++; continue; }
      if (line[i] === '|') { out.push(cur); cur = ''; continue; }
      cur += line[i];
    }
    out.push(cur);
    return out.map((c) => unesc(c.trim()));
  }
  const value = (key, s) => (NUMERIC.indexOf(key) >= 0 && s !== '' && Number.isFinite(Number(s)) ? Number(s) : s);

  /** Items → text, one line per item. */
  function toLines(items, field) {
    return (Array.isArray(items) ? items : []).map((it) => {
      if (!isObj(it)) return esc(it);
      const keys = field.variants ? [it.kind].concat(field.variants[it.kind] || []) : field.fields;
      const parts = keys.map((k, i) => esc(field.variants && i === 0 ? it.kind : it[k]));
      while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
      return parts.join(' | ');
    }).join('\n');
  }

  /** Text → items; extra properties of the item at the same position are kept (color, snap, …). */
  function fromLines(text, field, old) {
    old = Array.isArray(old) ? old : [];
    return String(text).split('\n').filter((l) => l.trim() !== '').map((line, i) => {
      const c = cells(line);
      if (!field.variants && field.fields.length === 1 && !isObj(old[i])) return c.join(' | '); // plain strings (legend, cols)
      let item;
      if (field.variants) {
        const kind = Object.prototype.hasOwnProperty.call(field.variants, c[0]) ? c[0] : 'note';
        const base = isObj(old[i]) && old[i].kind === kind ? Object.assign({}, old[i]) : {};
        item = Object.assign(base, { kind });
        field.variants[kind].forEach((k, j) => { const v = c[j + 1]; if (v === undefined || v === '') delete item[k]; else item[k] = value(k, v); });
        if (!field.variants[c[0]] && c[0]) item.text = c.join(' | '); // unknown kind: keep the text as a note
      } else {
        item = isObj(old[i]) ? Object.assign({}, old[i]) : {};
        field.fields.forEach((k, j) => { const v = c[j]; if (v === undefined || v === '') delete item[k]; else item[k] = value(k, v); });
      }
      return item;
    });
  }

  ADG.listCodec = { toLines, fromLines };
})(window.ADG = window.ADG || {});
