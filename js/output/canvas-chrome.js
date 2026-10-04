/* Draws the window frame (shadow, bezel, title bar, CRT foot) onto a 2D context from the shared
   spec in window-chrome.js. The character grid is painted by canvas-renderer.js on top of it.
   All sizes are px at scale 1; the caller applies ctx.scale(). */
(function (ADG) {
  const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const sans = (px, w) => (w || 400) + ' ' + px + 'px ' + SANS;
  const mono = (px, font, w) => (w || 400) + ' ' + px + 'px "' + font + '", ui-monospace, Menlo, Consolas, monospace';

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function topRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function text(ctx, s, x, y, font, color, align) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  /** Text with CSS-like letter-spacing (added after every glyph, so right alignment includes it). */
  function spaced(ctx, s, x, y, font, color, ls, align) {
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const chars = Array.from(s);
    const widths = chars.map((c) => ctx.measureText(c).width + ls);
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = align === 'right' ? x - total : x;
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i]; });
    return total;
  }

  /** Small line icon centered on (cx, cy); `s` = icon box size. */
  function glyph(ctx, kind, cx, cy, s, color, lw) {
    const q = s * 5 / 12, r = q * 0.9;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    if (kind === 'minus') { ctx.moveTo(cx - q, cy); ctx.lineTo(cx + q, cy); }
    else if (kind === 'plus') { ctx.moveTo(cx - q, cy); ctx.lineTo(cx + q, cy); ctx.moveTo(cx, cy - q); ctx.lineTo(cx, cy + q); }
    else if (kind === 'square') ctx.rect(cx - r, cy - r, 2 * r, 2 * r);
    else { ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); }
    ctx.stroke();
    ctx.restore();
  }

  function circle(ctx, cx, cy, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }

  function barBase(ctx, L, fill, pal, border) {
    const s = L.screen;
    ctx.fillStyle = fill; ctx.fillRect(s.x, s.y, s.w, L.barH);
    if (border) { ctx.fillStyle = pal.line; ctx.fillRect(s.x, s.y + L.barH - 1, s.w, 1); }
  }

  function macBar(ctx, sp, L, pal, o) {
    const e = o.e, s = L.screen, cy = s.y + L.barH / 2;
    barBase(ctx, L, pal.chrome, pal, true);
    const d = sp.dot.d * e;
    sp.dot.colors.forEach((c, i) => circle(ctx, s.x + sp.padX * e + d / 2 + i * (d + sp.dot.gap * e), cy, d / 2, c));
    text(ctx, o.titles.mac, s.x + s.w / 2, cy, mono(sp.titleSize * e, o.font), pal.dim, 'center');
    text(ctx, o.titles.credit, s.x + s.w - sp.padX * e, cy, sans(sp.creditSize * e), pal.mut, 'right');
  }

  function windowsBar(ctx, sp, L, pal, o) {
    const e = o.e, s = L.screen, t = sp.tab, cy = s.y + L.barH / 2;
    barBase(ctx, L, ADG.theme.mix('#000000', pal.bg, sp.barMix), pal, false);
    const tabH = t.h * e, tabY = s.y + L.barH - tabH, tabFont = sans(t.font * e);
    ctx.font = tabFont;
    const zshW = ctx.measureText(o.titles.tab).width, xW = ctx.measureText('×').width;
    const iconW = t.iconW * e, tabW = 2 * t.padX * e + iconW + 2 * t.gap * e + zshW + xW;
    let x = s.x + t.x * e;
    ctx.fillStyle = pal.bg; topRoundRect(ctx, x, tabY, tabW, tabH, t.radius * e); ctx.fill();
    const tcy = tabY + tabH / 2;
    let ix = x + t.padX * e;
    ctx.fillStyle = pal.line; roundRect(ctx, ix, tcy - t.iconH * e / 2, iconW, t.iconH * e, t.iconR * e); ctx.fill();
    text(ctx, '>_', ix + iconW / 2, tcy, mono(t.iconFont * e, o.font, 700), pal.a2, 'center');
    ix += iconW + t.gap * e;
    text(ctx, o.titles.tab, ix, tcy, tabFont, pal.fg);
    text(ctx, '×', ix + zshW + t.gap * e, tcy, tabFont, pal.mut);
    x += tabW + sp.gap * e;
    ['+', '⌄'].forEach((g) => {
      const f = sans(sp.plus.font * e);
      ctx.font = f;
      const w = ctx.measureText(g).width;
      text(ctx, g, x + sp.plus.pad * e, cy, f, pal.dim);
      x += w + 2 * sp.plus.pad * e + sp.gap * e;
    });
    const capW = sp.cap.w * e, capsX = s.x + s.w - 3 * capW;
    ['minus', 'square', 'cross'].forEach((k, i) =>
      glyph(ctx, k, capsX + capW * (i + 0.5), cy, sp.cap.icon * e, pal.dim, Math.max(1, sp.cap.stroke * sp.cap.icon * e * 12)));
    text(ctx, o.titles.credit, capsX - sp.capGap * e, cy, sans(sp.creditSize * e), pal.mut, 'right');
  }

  function ubuntuBar(ctx, sp, L, pal, o) {
    const e = o.e, s = L.screen, cy = s.y + L.barH / 2;
    barBase(ctx, L, pal.chrome, pal, true);
    const b = sp.btn;
    ctx.fillStyle = pal.line; roundRect(ctx, s.x + sp.padX * e, cy - b.h * e / 2, b.w * e, b.h * e, b.r * e); ctx.fill();
    glyph(ctx, 'plus', s.x + sp.padX * e + b.w * e / 2, cy, b.icon * e, pal.fg, 1.4 * b.icon * e / 12);
    text(ctx, o.titles.ubuntu, s.x + s.w / 2, cy, sans(sp.titleSize * e, 700), pal.fg, 'center');
    const c = sp.circle, d = c.d * e;
    [['minus', pal.line, pal.fg], ['square', pal.line, pal.fg], ['cross', sp.close, '#ffffff']].forEach((it, i) => {
      const cx = s.x + s.w - sp.padX * e - d / 2 - (2 - i) * (d + c.gap * e);
      circle(ctx, cx, cy, d / 2, it[1]);
      glyph(ctx, it[0], cx, cy, c.icon * e, it[2], 1.5 * c.icon * e / 12);
    });
  }

  function crtFoot(ctx, sp, L, pal, o) {
    const e = o.e, s = L.screen, y = s.y + s.h + L.footH / 2, pad = sp.footPad * e;
    spaced(ctx, o.titles.brand, s.x + pad, y, mono(sp.brand.size * e, o.font, 700), sp.brand.color, sp.brand.spacing * sp.brand.size * e, 'left');
    const p = sp.power, pf = p.size * e, led = p.led * pf;
    const ledX = s.x + s.w - pad - led / 2;
    ctx.save();
    ctx.shadowColor = p.ledColor; ctx.shadowBlur = 0.8 * pf * o.scale;
    circle(ctx, ledX, y, led / 2, p.ledColor);
    ctx.restore();
    spaced(ctx, 'POWER', ledX - led / 2 - p.gap * pf, y, mono(pf, o.font, 700), p.color, p.spacing * pf, 'right');
  }

  /** Inset shadow inside the screen (CRT glass): even-odd fill of a big frame with a blurred shadow. */
  function insetShadow(ctx, s, r, sp, o) {
    ctx.save();
    roundRect(ctx, s.x, s.y, s.w, s.h, r); ctx.clip();
    ctx.shadowColor = sp.inset.color; ctx.shadowBlur = sp.inset.blur * o.e * o.scale;
    const big = 4 * o.e * sp.inset.blur;
    ctx.beginPath();
    ctx.rect(s.x - big, s.y - big, s.w + 2 * big, s.h + 2 * big);
    roundRect(ctx, s.x, s.y, s.w, s.h, r);
    ctx.fillStyle = '#000'; ctx.fill('evenodd');
    ctx.restore();
  }

  /**
   * Paint everything of the window except the grid: shadow, screen background, bar / bezel / foot.
   * @param {object} L layout from windowChrome.layout  @param {object} o { e, scale, font, titles }
   */
  function paintFrame(ctx, sp, L, pal, o) {
    const e = o.e, s = L.screen, WC = ADG.windowChrome, r = sp.radius * e;
    const shape = L.outer || s, shapeR = (sp.frame ? sp.frame.radius : sp.radius) * e;
    if (L.margin > 0) {
      ctx.save();
      ctx.shadowColor = WC.SHADOW.color; ctx.shadowBlur = WC.SHADOW.blur * e * o.scale; ctx.shadowOffsetY = WC.SHADOW.y * e * o.scale;
      ctx.fillStyle = sp.frame ? sp.frame.from : pal.bg;
      roundRect(ctx, shape.x, shape.y, shape.w, shape.h, shapeR); ctx.fill();
      ctx.restore();
    }
    if (sp.frame) {
      const g = ctx.createLinearGradient(0, shape.y, 0, shape.y + shape.h);
      g.addColorStop(0, sp.frame.from); g.addColorStop(1, sp.frame.to);
      ctx.fillStyle = g; roundRect(ctx, shape.x, shape.y, shape.w, shape.h, shapeR); ctx.fill();
      ctx.fillStyle = sp.bezelColor;
      const b = sp.bezel * e;
      roundRect(ctx, s.x - b, s.y - b, s.w + 2 * b, s.h + 2 * b, r + b); ctx.fill();
    } else {
      ctx.fillStyle = pal.line; // 1px ring outside the screen
      roundRect(ctx, s.x - 1, s.y - 1, s.w + 2, s.h + 2, r + 1); ctx.fill();
    }
    ctx.fillStyle = pal.bg; roundRect(ctx, s.x, s.y, s.w, s.h, r); ctx.fill();
    if (sp.key === 'crt') { insetShadow(ctx, s, r, sp, o); crtFoot(ctx, sp, L, pal, o); return; }
    const bar = { macos: macBar, windows: windowsBar, ubuntu: ubuntuBar }[sp.key];
    if (!bar) return;
    ctx.save();
    roundRect(ctx, s.x, s.y, s.w, s.h, r); ctx.clip();
    bar(ctx, sp, L, pal, o);
    ctx.restore();
  }

  ADG.canvasChrome = { paintFrame, roundRect };
})(window.ADG = window.ADG || {});
