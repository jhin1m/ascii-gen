/* GIF89a writer with its own LZW encoder (no dependency). One global 256-color table, NETSCAPE
   loop extension, and frame diffing: each frame only stores the bounding box of the pixels that
   changed since the previous frame (disposal "keep"), and a frame identical to the previous one
   just extends its delay. DOM-free: frames are palette-index arrays (Uint8Array, w × h). */
(function (ADG) {
  /** Growable byte buffer. */
  function bytes() {
    let buf = new Uint8Array(1 << 16), n = 0;
    const ensure = (k) => {
      if (n + k <= buf.length) return;
      let size = buf.length * 2;
      while (size < n + k) size *= 2;
      const next = new Uint8Array(size); next.set(buf.subarray(0, n)); buf = next;
    };
    return {
      byte(b) { ensure(1); buf[n++] = b & 255; },
      word(w) { ensure(2); buf[n++] = w & 255; buf[n++] = (w >> 8) & 255; },
      str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); },
      all(arr) { ensure(arr.length); buf.set(arr, n); n += arr.length; },
      get length() { return n; },
      out: () => buf.slice(0, n)
    };
  }

  /**
   * LZW-compress palette indices (GIF variant: clear code, EOI, variable code size up to 12 bits).
   * @returns {Uint8Array} the code stream (not yet split into sub-blocks)
   */
  function lzw(indices, minSize) {
    const clear = 1 << minSize, eoi = clear + 1;
    const out = bytes();
    let size = minSize + 1, next = eoi + 1, acc = 0, bits = 0;
    let dict = new Map();
    const emit = (code) => {
      acc |= code << bits; bits += size;
      while (bits >= 8) { out.byte(acc & 255); acc >>>= 8; bits -= 8; }
    };
    emit(clear);
    let prefix = indices.length ? indices[0] : -1;
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], key = (prefix << 8) | k;
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next < 4096) {
        dict.set(key, next++);
        if (next > (1 << size) && size < 12) size++;
      } else {
        emit(clear);
        dict = new Map(); size = minSize + 1; next = eoi + 1;
      }
      prefix = k;
    }
    if (prefix >= 0) emit(prefix);
    emit(eoi);
    if (bits > 0) out.byte(acc & 255);
    return out.out();
  }

  /** Smallest box holding every index that differs between a and b, or null when equal. */
  function diffBox(a, b, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (a[row + x] !== b[row + x]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function crop(px, w, box) {
    const out = new Uint8Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) out.set(px.subarray((box.y + y) * w + box.x, (box.y + y) * w + box.x + box.w), y * box.w);
    return out;
  }

  /**
   * @param {number} w @param {number} h
   * @param {number[]} palette flat [r,g,b, r,g,b, …], up to 256 colors (padded to 256)
   * @param {{ loop?: number }} [opts] loop: 0 = forever (default), n = repeat n times, -1 = play once
   */
  function createEncoder(w, h, palette, opts) {
    const out = bytes(), loop = opts && Number.isInteger(opts.loop) ? opts.loop : 0;
    out.str('GIF89a'); out.word(w); out.word(h);
    out.byte(0xF7); out.byte(0); out.byte(0); // global table of 256 entries, 8-bit color resolution
    for (let i = 0; i < 256 * 3; i++) out.byte(palette[i] || 0);
    if (loop >= 0) { out.byte(0x21); out.byte(0xFF); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.word(loop); out.byte(0); }
    let prev = null, pending = null, frames = 0;

    function write(f) {
      out.byte(0x21); out.byte(0xF9); out.byte(4); out.byte(0x04); // GCE: disposal 1 (keep), no transparency
      out.word(Math.max(2, Math.min(65535, Math.round(f.delay)))); out.byte(0); out.byte(0);
      out.byte(0x2C); out.word(f.box.x); out.word(f.box.y); out.word(f.box.w); out.word(f.box.h); out.byte(0);
      out.byte(8);
      const data = lzw(f.px, 8);
      for (let i = 0; i < data.length; i += 255) {
        const n = Math.min(255, data.length - i);
        out.byte(n); out.all(data.subarray(i, i + n));
      }
      out.byte(0);
      frames++;
    }

    return {
      /** Add a frame of w × h palette indices shown for `delay` centiseconds. */
      addFrame(px, delay) {
        if (!px || px.length !== w * h) throw new Error('frame size mismatch');
        const box = prev ? diffBox(prev, px, w, h) : { x: 0, y: 0, w, h };
        if (!box) { if (pending) pending.delay += delay; return; } // identical frame: hold the previous one longer
        if (pending) write(pending);
        pending = { box, px: box.w === w && box.h === h ? px.slice() : crop(px, w, box), delay };
        prev = px.slice();
      },
      /** @returns {Uint8Array} the complete .gif file */
      finish() {
        if (pending) { write(pending); pending = null; }
        out.byte(0x3B);
        return out.out();
      },
      get frames() { return frames + (pending ? 1 : 0); },
      get size() { return out.length; }
    };
  }

  ADG.gif = { lzw, diffBox, createEncoder };
})(window.ADG = window.ADG || {});
