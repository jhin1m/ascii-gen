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

  /**
   * Text → items. Properties the form does not show (color, snap, …) come from the old item whose
   * line is unchanged, or — when the number of lines is unchanged — from the item at the same
   * position (an edited line). Inserting or deleting lines never moves them to another item.
   */
  function fromLines(text, field, old) {
    old = Array.isArray(old) ? old : [];
    const lines = String(text).split('\n').filter((l) => l.trim() !== '');
    const oldLines = old.map((it) => toLines([it], field)), used = new Set();
    const source = (line, i) => {
      let j = oldLines.findIndex((l, k) => l === line && !used.has(k));
      if (j < 0 && lines.length === old.length && !used.has(i)) j = i;
      if (j < 0) return null;
      used.add(j);
      return isObj(old[j]) ? old[j] : null;
    };
    const plain = !field.variants && field.fields.length === 1 && !old.some(isObj); // plain strings (legend, cols)
    return lines.map((line, i) => {
      const c = cells(line);
      if (plain) return c.join(' | ');
      const prev = source(line, i);
      let item;
      if (field.variants) {
        const kind = Object.prototype.hasOwnProperty.call(field.variants, c[0]) ? c[0] : 'note';
        item = Object.assign(prev && prev.kind === kind ? Object.assign({}, prev) : {}, { kind });
        field.variants[kind].forEach((k, j) => { const v = c[j + 1]; if (v === undefined || v === '') delete item[k]; else item[k] = value(k, v); });
        if (!field.variants[c[0]] && c[0]) item.text = c.join(' | '); // unknown kind: keep the text as a note
      } else {
        item = prev ? Object.assign({}, prev) : {};
        field.fields.forEach((k, j) => { const v = c[j]; if (v === undefined || v === '') delete item[k]; else item[k] = value(k, v); });
      }
      return item;
    });
  }

  ADG.listCodec = { toLines, fromLines };
})(window.ADG = window.ADG || {});
