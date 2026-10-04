/* Share link: JSON → deflate-raw (CompressionStream) → base64url, stored in the URL hash as #c=...
   Base64url is pure JS (no btoa) and the stream classes are looked up lazily, so this file loads in
   Node and can be tested with injected `deps` ({ TextEncoder, TextDecoder, CompressionStream, DecompressionStream }). */
(function (ADG) {
  // Public URL of the deployed page (GitHub Pages). Empty = current page, which only works locally.
  const SHARE_BASE = 'https://jhin1m.github.io/ascii-gen/';
  const WARN_URL_LEN = 8 * 1024;
  const MAX_JSON = 1024 * 1024; // decompressed cap: guards against decompression bombs
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const REV = {};
  for (let i = 0; i < ALPHA.length; i++) REV[ALPHA[i]] = i;

  function b64urlEncode(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += ALPHA[(n >> 18) & 63] + ALPHA[(n >> 12) & 63];
      if (i + 1 < bytes.length) out += ALPHA[(n >> 6) & 63];
      if (i + 2 < bytes.length) out += ALPHA[n & 63];
    }
    return out;
  }

  function b64urlDecode(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str) || str.length % 4 === 1) throw new Error('Link bị hỏng (sai ký tự).');
    const out = new Uint8Array(Math.floor(str.length * 3 / 4));
    let o = 0;
    for (let i = 0; i < str.length; i += 4) {
      const c = [0, 1, 2, 3].map((j) => (i + j < str.length ? REV[str[i + j]] : 0));
      const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
      const left = str.length - i;
      out[o++] = (n >> 16) & 255;
      if (left > 2) out[o++] = (n >> 8) & 255;
      if (left > 3) out[o++] = n & 255;
    }
    return out;
  }

  function dep(name, deps) {
    const c = (deps && deps[name]) || (typeof globalThis !== 'undefined' ? globalThis[name] : undefined);
    if (!c) throw new Error('Trình duyệt chưa hỗ trợ nén dữ liệu (' + name + ').');
    return c;
  }

  /** Push bytes through a (De)CompressionStream; `cap` limits the output size. */
  async function pipe(bytes, Stream, cap) {
    const ts = new Stream('deflate-raw');
    const w = ts.writable.getWriter();
    w.write(bytes).catch(() => {}); // failures surface on the reader side
    w.close().catch(() => {});
    const r = ts.readable.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      total += value.length;
      if (cap && total > cap) { r.cancel().catch(() => {}); throw new Error('Dữ liệu giải nén quá lớn.'); }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let o = 0;
    chunks.forEach((c) => { out.set(c, o); o += c.length; });
    return out;
  }

  /** @returns {Promise<string>} base64url token for any JSON-able value */
  async function encode(obj, deps) {
    const bytes = new (dep('TextEncoder', deps))().encode(JSON.stringify(obj));
    return b64urlEncode(await pipe(bytes, dep('CompressionStream', deps)));
  }

  /** @returns {Promise<any>} the value encoded by encode(); throws a Vietnamese Error on bad input */
  async function decode(token, deps) {
    let raw;
    try {
      const bytes = await pipe(b64urlDecode(String(token)), dep('DecompressionStream', deps), MAX_JSON);
      raw = new (dep('TextDecoder', deps))('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      if (/nén|giải nén|hỏng/.test(e.message)) throw e;
      throw new Error('Link bị hỏng hoặc không đọc được.');
    }
    try { return JSON.parse(raw); } catch (e) { throw new Error('Link bị hỏng (không phải JSON).'); }
  }

  /**
   * Page URL the link points at: the public page when `base` (default SHARE_BASE) is set, else the
   * current page. file:// has no usable origin, so the full current URL is used.
   */
  function baseUrl(loc, base) {
    base = base === undefined ? SHARE_BASE : base;
    if (base) return base.replace(/#.*$/, '');
    if (loc.protocol === 'file:') return String(loc.href).replace(/#.*$/, '');
    return loc.origin + loc.pathname;
  }

  const buildUrl = (token, loc, base) => baseUrl(loc, base) + '#c=' + token;

  /** Token from a location.hash value ('#c=...'), or null when there is none. */
  function readHash(hash) {
    const m = /^#c=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
    return m ? m[1] : null;
  }

  function warnings(url, loc, base) {
    base = base === undefined ? SHARE_BASE : base;
    const out = [];
    if (url.length > WARN_URL_LEN) out.push('Link dài ' + (url.length / 1024).toFixed(1) + ' KB (> 8 KB): một số ứng dụng có thể cắt cụt link.');
    if (!base && loc.protocol === 'file:') out.push('Đang mở từ file:// nên link chỉ mở được trên máy này (cần đưa trang lên web và điền SHARE_BASE).');
    return out;
  }

  /** @returns {Promise<{url: string, length: number, warnings: string[]}>} */
  async function createLink(payload, loc, deps) {
    const url = buildUrl(await encode(payload, deps), loc);
    return { url, length: url.length, warnings: warnings(url, loc) };
  }

  ADG.share = { SHARE_BASE, WARN_URL_LEN, b64urlEncode, b64urlDecode, encode, decode, baseUrl, buildUrl, readHash, warnings, createLink };
})(window.ADG = window.ADG || {});
