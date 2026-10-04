/* Grid → HTML string for the live preview: one <div> per row, adjacent same-style cells
   merged into one <span>. Plain spaces join the neighbouring span (they carry no color),
   which keeps the DOM small. Assign the result with a single innerHTML write. */
(function (ADG) {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ESC[c]);

  /**
   * @param {object} grid from ADG.grid.createGrid
   * @param {object} pal  from ADG.theme.palette
   * @param {{blink?: boolean}} [opts] blink=false renders blinking cells statically
   */
  function renderHTML(grid, pal, opts) {
    const blink = !opts || opts.blink !== false;
    return grid.cells.map((row) => {
      const segs = [];
      let cur = null;
      row.forEach((c) => {
        const k = c.k === 'blink' && blink ? 'adg-blink' : '';
        if (c.ch === ' ' && !c.bg && !k && cur && !cur.bg && !cur.k) { cur.t += ' '; return; }
        const key = c.fg + '|' + (c.bg || '') + '|' + (c.b ? 1 : 0) + '|' + k;
        if (cur && cur.key === key) { cur.t += c.ch; return; }
        cur = { key, t: c.ch, fg: c.fg, bg: c.bg && pal[c.bg] ? c.bg : null, b: c.b, k };
        segs.push(cur);
      });
      const html = segs.map((s) => {
        const text = escapeHtml(s.t);
        // default style inherits from the row container: no span needed
        if (s.fg === 'fg' && !s.bg && !s.b && !s.k) return text;
        const st = 'color:' + (pal[s.fg] || pal.fg) + (s.bg ? ';background:' + pal[s.bg] : '') + (s.b ? ';font-weight:700' : '');
        return '<span' + (s.k ? ' class="' + s.k + '"' : '') + ' style="' + st + '">' + text + '</span>';
      }).join('');
      return '<div class="adg-row">' + html + '</div>';
    }).join('');
  }

  ADG.htmlOut = { renderHTML, escapeHtml };
})(window.ADG = window.ADG || {});
