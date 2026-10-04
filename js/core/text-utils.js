/* Text helpers shared by every grid writer: one code point = one cell, so anything
   that would not occupy exactly one monospace column must be caught here. */
(function (ADG) {
  // East Asian Wide/Fullwidth ranges (Hangul, CJK, fullwidth forms, supplementary ideographs).
  const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{20000}-\u{3FFFD}]/u;
  // Emoji rendered as pictures by default (always 2 columns). Text-style symbols like ★ stay allowed.
  const EMOJI = /\p{Emoji_Presentation}|[\u{1F000}-\u{1FAFF}]/u;
  // Code points that take no column: combining marks, variation selectors and every format char
  // (ZWJ, soft hyphen, bidi overrides/isolates, BOM, tag chars).
  const ZERO = /^[\p{M}\p{Cf}]$/u;
  // Controls, line/paragraph separators and lone surrogates would break a row.
  const CONTROL = /^[\p{Cc}\p{Zl}\p{Zp}\p{Cs}]$/u;

  function isWide(ch) { return WIDE.test(ch) || EMOJI.test(ch); }
  function isZeroWidth(ch) { return ZERO.test(ch); }

  /** True when `ch` cannot safely occupy exactly one grid cell. */
  function isBadCell(ch) {
    return typeof ch !== 'string' || Array.from(ch).length !== 1 || isWide(ch) || isZeroWidth(ch) || CONTROL.test(ch);
  }

  /** Split a string into cells: NFC first (Vietnamese NFD → precomposed), zero-width marks dropped. */
  function toCells(str) {
    return Array.from(String(str == null ? '' : str).normalize('NFC')).filter((ch) => !isZeroWidth(ch));
  }

  /** Clean user input for the grid: NFC, zero-width removed, wide/control chars → '?'. */
  function sanitize(str) {
    return toCells(str).map((ch) => (isBadCell(ch) ? '?' : ch)).join('');
  }

  /** Cut to at most `n` cells, marking the cut with '…'. */
  function clip(str, n) {
    const a = toCells(str);
    if (n <= 0) return '';
    return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('');
  }

  ADG.text = { isWide, isZeroWidth, isBadCell, toCells, sanitize, clip };
})(window.ADG = window.ADG || {});
