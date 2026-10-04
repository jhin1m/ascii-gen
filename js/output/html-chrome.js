/* Window chrome for the live preview as an HTML string, from the same em geometry as the canvas
   export (output/window-chrome.js), so the preview and the PNG show the same frame. Sizes are em
   of the dashboard font size (set on .win). Palette colors are inline; layout lives in style.css
   (.win*). DOM-free: returns markup around the grid HTML. */
(function (ADG) {
  const esc = (s) => ADG.htmlOut.escapeHtml(String(s == null ? '' : s)).replace(/"/g, '&quot;');
  const em = (v) => +Number(v).toFixed(3) + 'em';
  const ICON = { minus: '–', square: '□', cross: '×', plus: '+' };

  function macBar(sp, pal, T) {
    const d = sp.dot;
    const dots = d.colors.map((c) => '<i class="win-dot" style="width:' + em(d.d) + ';height:' + em(d.d) + ';background:' + c + '"></i>').join('');
    return '<div class="win-bar" style="height:' + em(sp.bar) + ';padding:0 ' + em(sp.padX) + ';background:' + pal.chrome + ';border-bottom:1px solid ' + pal.line + '">'
      + '<span class="win-dots" style="gap:' + em(d.gap) + '">' + dots + '</span>'
      + '<span class="win-title mono" style="font-size:' + em(sp.titleSize) + ';color:' + pal.dim + '">' + esc(T.mac) + '</span>'
      + '<span class="win-credit" style="font-size:' + em(sp.creditSize) + ';color:' + pal.mut + '">' + esc(T.credit) + '</span></div>';
  }

  function windowsBar(sp, pal, T) {
    const t = sp.tab, cap = sp.cap;
    const tab = '<span class="win-tab" style="height:' + em(t.h) + ';margin-left:' + em(t.x) + ';padding:0 ' + em(t.padX) + ';gap:' + em(t.gap) + ';border-radius:' + em(t.radius) + ' ' + em(t.radius) + ' 0 0;background:' + pal.bg + ';font-size:' + em(t.font) + '">'
      + '<b class="win-icon mono" style="width:' + em(t.iconW / t.font) + ';height:' + em(t.iconH / t.font) + ';border-radius:' + em(t.iconR / t.font) + ';font-size:' + em(t.iconFont / t.font) + ';background:' + pal.line + ';color:' + pal.a2 + '">&gt;_</b>'
      + '<span style="color:' + pal.fg + '">' + esc(T.tab) + '</span><span style="color:' + pal.mut + '">×</span></span>';
    const extra = ['+', '⌄'].map((g) => '<span style="font-size:' + em(sp.plus.font) + ';padding:0 ' + em(sp.plus.pad / sp.plus.font) + ';color:' + pal.dim + '">' + g + '</span>').join('');
    const caps = ['minus', 'square', 'cross'].map((k) => '<span class="win-cap" style="width:' + em(cap.w) + ';color:' + pal.dim + '">' + ICON[k] + '</span>').join('');
    return '<div class="win-bar win-bar-tabs" style="height:' + em(sp.bar) + ';gap:' + em(sp.gap) + ';background:' + ADG.theme.mix('#000000', pal.bg, sp.barMix) + '">'
      + tab + extra + '<span class="win-fill"></span>'
      + '<span class="win-credit" style="font-size:' + em(sp.creditSize) + ';margin-right:' + em(sp.capGap) + ';color:' + pal.mut + '">' + esc(T.credit) + '</span>' + caps + '</div>';
  }

  function ubuntuBar(sp, pal, T) {
    const b = sp.btn, c = sp.circle;
    const circles = [['minus', pal.line, pal.fg], ['square', pal.line, pal.fg], ['cross', sp.close, '#ffffff']].map((it) =>
      '<span class="win-circle" style="width:' + em(c.d) + ';height:' + em(c.d) + ';background:' + it[1] + ';color:' + it[2] + '">' + ICON[it[0]] + '</span>').join('');
    return '<div class="win-bar" style="height:' + em(sp.bar) + ';padding:0 ' + em(sp.padX) + ';background:' + pal.chrome + ';border-bottom:1px solid ' + pal.line + '">'
      + '<span class="win-btn" style="width:' + em(b.w) + ';height:' + em(b.h) + ';border-radius:' + em(b.r) + ';background:' + pal.line + ';color:' + pal.fg + '">+</span>'
      + '<span class="win-title" style="font-size:' + em(sp.titleSize) + ';font-weight:700;color:' + pal.fg + '">' + esc(T.ubuntu) + '</span>'
      + '<span class="win-dots" style="gap:' + em(c.gap) + '">' + circles + '</span></div>';
  }

  function crtFoot(sp, T) {
    const p = sp.power;
    return '<div class="win-foot mono" style="height:' + em(sp.foot) + ';padding:0 ' + em(sp.footPad) + '">'
      + '<span style="font-size:' + em(sp.brand.size) + ';letter-spacing:' + em(sp.brand.spacing) + ';color:' + sp.brand.color + ';font-weight:700">' + esc(T.brand) + '</span>'
      + '<span class="win-power" style="font-size:' + em(p.size) + ';letter-spacing:' + em(p.spacing) + ';gap:' + em(p.gap) + ';color:' + p.color + '">POWER'
      + '<i style="width:' + em(p.led) + ';height:' + em(p.led) + ';background:' + p.ledColor + ';box-shadow:0 0 ' + em(0.8) + ' ' + p.ledColor + '"></i></span></div>';
  }

  /**
   * Full window markup around `gridHtml`.
   * @param {{ win, chrome, template, cols, rows, credit, scanline }} o
   */
  function frameHTML(gridHtml, pal, o) {
    const WC = ADG.windowChrome, sp = WC.spec(o.win, o.chrome), P = WC.PAD;
    const T = WC.titles(o.template, o.cols, o.rows, o.credit);
    const bar = { macos: macBar, windows: windowsBar, ubuntu: ubuntuBar }[sp.key];
    const ring = sp.frame ? '0 0 0 ' + em(sp.bezel) + ' ' + sp.bezelColor + ',inset 0 0 ' + em(sp.inset.blur) + ' ' + sp.inset.color : '0 0 0 1px ' + pal.line;
    const content = '<div class="win-content" style="padding:' + em(P.t) + ' ' + em(P.r) + ' ' + em(P.b) + ' ' + em(P.l) + '">' + gridHtml
      + (o.scanline ? '<div class="win-scan" aria-hidden="true"></div>' : '') + '</div>';
    const screen = '<div class="win-screen" style="border-radius:' + em(sp.radius) + ';background:' + pal.bg + ';color:' + pal.fg + ';box-shadow:' + ring + '">'
      + (bar ? bar(sp, pal, T) : '') + content + '</div>';
    if (!sp.frame) return '<div class="win win-' + sp.key + (sp.key === 'none' ? '' : ' win-framed') + '">' + screen + '</div>';
    const f = sp.frame;
    return '<div class="win win-crt win-framed" style="padding:' + em(f.t) + ' ' + em(f.x) + ' 0;border-radius:' + em(f.radius) + ';background:linear-gradient(' + f.from + ',' + f.to + ')">'
      + screen + crtFoot(sp, T) + '</div>';
  }

  ADG.htmlChrome = { frameHTML };
})(window.ADG = window.ADG || {});
