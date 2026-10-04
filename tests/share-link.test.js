/* Share link (pure parts) + config file validation. Compression itself needs async streams, which the
   sync harness cannot await; it is verified in the browser / a scratch script instead. */
module.exports = ({ ADG, test, assert }) => {
  const S = ADG.share, C = ADG.configFile;

  test('base64url matches Node for every length 0..40 and random bytes', () => {
    for (let n = 0; n <= 40; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11 + 250) % 256);
      const enc = S.b64urlEncode(b);
      assert.eq(enc, Buffer.from(b).toString('base64url'), 'encode len ' + n);
      assert.deq(Array.from(S.b64urlDecode(enc)), Array.from(b), 'decode len ' + n);
    }
  });

  test('base64url uses the url-safe alphabet and no padding', () => {
    const enc = S.b64urlEncode(Uint8Array.from([251, 255, 254, 63]));
    assert.ok(!/[+/=]/.test(enc) && /[-_]/.test(enc), enc);
  });

  test('base64url decode rejects bad input', () => {
    let threw = 0;
    ['a+b', 'ab=', 'abcde', 'a b '].forEach((s) => { try { S.b64urlDecode(s); } catch (e) { threw++; } });
    assert.eq(threw, 4);
  });

  test('readHash only accepts #c=<token>', () => {
    assert.eq(S.readHash('#c=abc_-1'), 'abc_-1');
    assert.eq(S.readHash(''), null);
    assert.eq(S.readHash('#other'), null);
    assert.eq(S.readHash('#c='), null);
  });

  test('buildUrl uses origin+path on http and the full URL on file://', () => {
    const web = { protocol: 'https:', origin: 'https://x.io', pathname: '/app/', href: 'https://x.io/app/#c=old' };
    const file = { protocol: 'file:', origin: 'null', pathname: '/a/index.html', href: 'file:///a/index.html#c=old' };
    assert.eq(S.buildUrl('T', web, ''), 'https://x.io/app/#c=T');
    assert.eq(S.buildUrl('T', file, ''), 'file:///a/index.html#c=T');
    // the deployed page: every link (also from file:// or localhost) opens the public site
    assert.ok(/^https:\/\//.test(S.SHARE_BASE), 'SHARE_BASE is the public page');
    assert.eq(S.buildUrl('T', file), S.SHARE_BASE + '#c=T');
  });

  test('warnings: file:// without SHARE_BASE and URLs over 8 KB', () => {
    const file = { protocol: 'file:' }, web = { protocol: 'https:' };
    assert.eq(S.warnings('file:///a#c=x', file, '').length, 1);
    assert.eq(S.warnings('file:///a#c=x', file).length, 0, 'no warning once SHARE_BASE is set');
    assert.eq(S.warnings('https://x#c=x', web).length, 0);
    assert.eq(S.warnings('https://x#c=' + 'a'.repeat(S.WARN_URL_LEN), web).length, 1);
  });

  test('config wrap adds version and keeps known keys only', () => {
    const w = C.wrap({ theme: 'dracula', cols: 80, junk: 1 });
    assert.deq(w, { version: 1, theme: 'dracula', cols: 80 });
  });

  test('config validate: round trip of a full state is identical', () => {
    const state = { theme: 'paper', border: 'unicode', cols: 120, step: 3, win: 'crt', chrome: false, glow: true, scanline: true, font: 'VT323', size: 14, lineHeight: 1.4, credit: 'by me' };
    assert.deq(C.validate(JSON.parse(JSON.stringify(C.wrap(state)))), state);
  });

  test('config validate: partial and unknown keys are tolerated', () => {
    assert.deq(C.validate({ version: 1, theme: 'gruvbox', future: { a: 1 } }), { theme: 'gruvbox' });
  });

  test('config validate rejects bad shape, version and values', () => {
    const bad = [null, [], 'x', {}, { version: 0 }, { version: 2 }, { version: 1, theme: 'nope' }, { version: 1, cols: 10 }, { version: 1, cols: 96.5 }, { version: 1, chrome: 'yes' }, { version: 1, size: NaN }];
    bad.forEach((b) => {
      let threw = false;
      try { C.validate(b); } catch (e) { threw = true; }
      assert.ok(threw, 'should reject ' + JSON.stringify(b));
    });
  });

  test('config parse reports invalid JSON', () => {
    let msg = '';
    try { C.parse('{oops'); } catch (e) { msg = e.message; }
    assert.ok(/JSON/.test(msg), msg);
  });

  test('canvas size guard: per-side and total-area limits', () => {
    const O = ADG.canvasOut;
    assert.eq(O.checkSize(2393, 4257), null, '10 MP is fine');
    assert.eq(O.checkSize(4096, 4096), null, 'exactly the area limit');
    assert.ok(/MP/.test(O.checkSize(4097, 4096)), 'area');
    assert.ok(/cạnh/.test(O.checkSize(16385, 10)), 'side');
    assert.ok(/cạnh/.test(O.checkSize(10, 20000)), 'side tall');
  });

  test('window chrome layout: no-chrome has no margin; framed windows add shadow room', () => {
    const WC = ADG.windowChrome;
    const none = WC.layout(WC.spec('macos', false), 100, 200, 10);
    assert.eq(none.margin, 0);
    assert.eq(none.w, 100 + (WC.PAD.l + WC.PAD.r) * 10);
    const mac = WC.layout(WC.spec('macos', true), 100, 200, 10);
    assert.eq(mac.h, none.h + mac.barH + 2 * mac.margin);
    const crt = WC.layout(WC.spec('crt', true), 100, 200, 10);
    assert.ok(crt.outer && crt.outer.w > crt.screen.w && crt.footH > 0);
  });
};
