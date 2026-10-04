module.exports = ({ ADG, test, assert }) => {
  const G = ADG.gif;

  /** Reference GIF LZW decoder (independent of the encoder). */
  function unlzw(data, minSize, count) {
    const clear = 1 << minSize, eoi = clear + 1, out = [];
    let size = minSize + 1, dict = [], prev = null, pos = 0, acc = 0, bits = 0;
    const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = []; size = minSize + 1; prev = null; };
    reset();
    for (;;) {
      while (bits < size) { if (pos >= data.length) return out; acc |= data[pos++] << bits; bits += 8; }
      const code = acc & ((1 << size) - 1); acc >>>= size; bits -= size;
      if (code === clear) { reset(); continue; }
      if (code === eoi) break;
      let entry;
      if (code < dict.length) entry = dict[code];
      else if (code === dict.length && prev) entry = prev.concat([prev[0]]);
      else throw new Error('bad code ' + code + ' at ' + out.length);
      out.push(...entry);
      if (prev && dict.length < 4096) dict.push(prev.concat([entry[0]]));
      if (dict.length === (1 << size) && size < 12) size++;
      prev = entry;
      if (out.length > count) break;
    }
    return out;
  }

  /** Concatenate the sub-blocks of the image data that starts at `i`; returns { data, end }. */
  function subBlocks(buf, i) {
    const parts = [];
    while (buf[i] !== 0) { parts.push(...buf.slice(i + 1, i + 1 + buf[i])); i += 1 + buf[i]; }
    return { data: Uint8Array.from(parts), end: i + 1 };
  }

  test('LZW round trip: short, long runs, noise beyond 4096 codes', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const cases = [[0], [1, 2, 3, 1, 2, 3, 1, 2, 3], new Array(5000).fill(9), Array.from({ length: 30000 }, () => Math.floor(rnd() * 256)), Array.from({ length: 20000 }, (_, i) => (i >> 5) % 7)];
    cases.forEach((src, k) => {
      const back = unlzw(G.lzw(Uint8Array.from(src), 8), 8, src.length);
      assert.eq(back.length, src.length, 'case ' + k + ' length');
      assert.ok(back.every((v, i) => v === src[i]), 'case ' + k + ' content');
    });
  });

  test('GIF file: header, global table, NETSCAPE loop, frames, trailer', () => {
    const pal = []; for (let i = 0; i < 256; i++) pal.push(i, 255 - i, 0);
    const enc = G.createEncoder(4, 3, pal, { loop: 0 });
    const f1 = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    enc.addFrame(f1, 10);
    enc.addFrame(f1, 10); // identical → merged into a 20 cs frame
    const f2 = f1.slice(); f2[6] = 99;
    enc.addFrame(f2, 7);
    const b = enc.finish();
    assert.eq(String.fromCharCode(...b.slice(0, 6)), 'GIF89a');
    assert.deq([b[6], b[7], b[8], b[9], b[10]], [4, 0, 3, 0, 0xF7]);
    assert.deq([b[16], b[17], b[18]], [1, 254, 0], 'palette entry 1');
    let i = 13 + 768;
    assert.eq(String.fromCharCode(...b.slice(i + 3, i + 14)), 'NETSCAPE2.0');
    assert.deq([b[i + 16], b[i + 17]], [0, 0], 'loop forever');
    i += 19;
    const frames = [];
    while (b[i] === 0x21 && b[i + 1] === 0xF9) {
      const delay = b[i + 4] | (b[i + 5] << 8), disposal = (b[i + 3] >> 2) & 7;
      i += 8;
      assert.eq(b[i], 0x2C);
      const box = { x: b[i + 1], y: b[i + 3], w: b[i + 5], h: b[i + 7] };
      i += 10;
      const min = b[i], sb = subBlocks(b, i + 1);
      frames.push({ delay, disposal, box, px: unlzw(sb.data, min, box.w * box.h) });
      i = sb.end;
    }
    assert.eq(b[i], 0x3B, 'trailer');
    assert.eq(i, b.length - 1);
    assert.eq(frames.length, 2);
    assert.deq(frames[0], { delay: 20, disposal: 1, box: { x: 0, y: 0, w: 4, h: 3 }, px: Array.from(f1) });
    assert.deq(frames[1], { delay: 7, disposal: 1, box: { x: 2, y: 1, w: 1, h: 1 }, px: [99] }, 'only the changed pixel');
  });

  test('play once omits the loop extension; frame size is checked', () => {
    const enc = G.createEncoder(2, 2, [], { loop: -1 });
    enc.addFrame(new Uint8Array(4), 5);
    const b = enc.finish();
    assert.eq(b[13 + 768], 0x21); assert.eq(b[13 + 769], 0xF9, 'first block is the frame, not NETSCAPE');
    let threw = false;
    try { G.createEncoder(2, 2, []).addFrame(new Uint8Array(3), 5); } catch (e) { threw = true; }
    assert.ok(threw);
  });

  test('palette: ≤ 256 colors, every theme color exact, unknown colors map to the nearest', () => {
    Object.keys(ADG.theme.THEMES).forEach((id) => {
      const pal = ADG.theme.palette(id), P = ADG.gifPalette.build(pal);
      assert.ok(P.colors.length <= 256 && P.rgb.length === P.colors.length * 3, id);
      ADG.theme.COLOR_KEYS.forEach((k) => {
        const c = parseInt(pal[k].slice(1), 16);
        assert.eq(P.colors[P.index(c)], c, id + ' ' + k);
      });
      const fg = parseInt(pal.fg.slice(1), 16);
      assert.eq(P.colors[P.index(fg ^ 0x010101)], fg, id + ' near fg');
    });
    const P = ADG.gifPalette.build(ADG.theme.palette('midnight'));
    const data = Uint8ClampedArray.from([0x1b, 0x1e, 0x2b, 255, 0x1b, 0x1e, 0x2b, 255, 0xe6, 0xe8, 0xf0, 255]);
    const idx = ADG.gifPalette.quantize(data, P);
    assert.deq([P.colors[idx[0]], P.colors[idx[2]]], [0x1b1e2b, 0xe6e8f0]);
  });

  test('animation plan: frame count and step timing', () => {
    const P = ADG.animFrames.plan(7, 1200, 15);
    assert.deq([P.count, P.durationMs, P.fps], [126, 8400, 15]);
    const f = ADG.animFrames.at(20, P, 7); // 1333 ms → step 1, t ≈ 0.11
    assert.eq(f.step, 1);
    assert.ok(Math.abs(f.t - 0.111) < 0.01);
    assert.eq(ADG.animFrames.at(1, P, 7).blink, true);
    assert.eq(ADG.animFrames.at(8, P, 7).blink, false); // 533 ms: second half of the blink
  });
};
