/* Fixed GIF palette from the theme: every palette color and window-chrome color, each blended
   with the screen background (and the shadow with the backdrop) in 8 steps so anti-aliased text
   edges and glow find a close match. Pixels map to indices through a Map (exact colors) with a
   nearest-color fallback that is cached. DOM-free. */
(function (ADG) {
  const STEPS = 8;
  // window chrome colors drawn by output/canvas-chrome.js (see output/window-chrome.js SPECS)
  const CHROME = ['#ff5f57', '#febc2e', '#28c840', '#e95420', '#ffffff', '#000000', '#121110', '#34312d', '#1f1d1b', '#8b8273', '#6f685d', '#6dff8e'];

  const hexInt = (hex) => parseInt(String(hex).slice(1, 7), 16);
  const mixInt = (a, b, t) => {
    const r = Math.round(((a >> 16) & 255) * t + ((b >> 16) & 255) * (1 - t));
    const g = Math.round(((a >> 8) & 255) * t + ((b >> 8) & 255) * (1 - t));
    return (r << 16) | (g << 8) | Math.round((a & 255) * t + (b & 255) * (1 - t));
  };

  /** Backdrop behind framed windows in GIF/video (no transparency there): a darker theme background. */
  const backdrop = (pal) => ADG.theme.mix(pal.bg, '#000000', 0.55);

  /**
   * @param {object} pal theme palette (ADG.theme.palette)
   * @returns {{ colors: number[], rgb: number[], index: (rgbInt) => number }}
   */
  function build(pal) {
    const bg = hexInt(pal.bg), back = hexInt(backdrop(pal));
    const list = [], seen = new Set();
    const add = (c) => { if (list.length < 256 && !seen.has(c)) { seen.add(c); list.push(c); } };
    const base = Array.from(new Set(ADG.theme.COLOR_KEYS.map((k) => hexInt(pal[k])).concat(CHROME.map(hexInt), [back])));
    base.forEach(add); // exact colors first: they must never be dropped
    for (let s = 1; s < STEPS; s++) {
      const t = 1 - s / STEPS;
      base.forEach((c) => { add(mixInt(c, bg, t)); add(mixInt(c, back, t)); });
    }
    const cache = new Map();
    list.forEach((c, i) => cache.set(c, i));
    function nearest(c) {
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      let best = 0, bd = Infinity;
      for (let i = 0; i < list.length; i++) {
        const q = list[i], dr = r - ((q >> 16) & 255), dg = g - ((q >> 8) & 255), db = b - (q & 255);
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; // rough perceptual weights
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    const rgb = [];
    list.forEach((c) => rgb.push((c >> 16) & 255, (c >> 8) & 255, c & 255));
    return {
      colors: list,
      rgb,
      /** Palette index of a 0xRRGGBB color (exact or nearest; results are cached). */
      index(c) {
        let i = cache.get(c);
        if (i === undefined) { i = nearest(c); if (cache.size < 1 << 16) cache.set(c, i); }
        return i;
      }
    };
  }

  /**
   * RGBA pixels (canvas ImageData.data) → palette indices. Alpha is ignored (frames are opaque).
   * @param {Uint8ClampedArray} data @param {{index: Function}} P @param {Uint8Array} [out]
   */
  function quantize(data, P, out) {
    const n = data.length >> 2;
    out = out || new Uint8Array(n);
    let last = -1, lastIdx = 0;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const c = (data[j] << 16) | (data[j + 1] << 8) | data[j + 2];
      if (c !== last) { last = c; lastIdx = P.index(c); } // runs of one color are the common case
      out[i] = lastIdx;
    }
    return out;
  }

  ADG.gifPalette = { build, quantize, backdrop, CHROME };
})(window.ADG = window.ADG || {});
