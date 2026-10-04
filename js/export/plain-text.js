/* Plain-text export: grid rows joined by \n, trailing spaces trimmed so the result pastes cleanly
   into a Markdown code block. */
(function (ADG) {
  /** @param {object} grid from ADG.grid.createGrid */
  function toPlainText(grid) {
    const lines = grid.toLines().map((l) => l.replace(/\s+$/, ''));
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /** Copy text to the clipboard (Clipboard API, then execCommand). @returns {Promise<boolean>} */
  async function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* denied or insecure context: fall through to the legacy path */ }
    return legacyCopy(text);
  }

  ADG.plainText = { toPlainText, copy };
})(window.ADG = window.ADG || {});
