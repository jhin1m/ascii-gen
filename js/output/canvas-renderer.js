/* Grid → <canvas> for PNG/GIF/video export. Cell width is MEASURED from the loaded font
   (measureText('M')), never assumed, so output lines up with the HTML preview. Sizes are in CSS px
   at the dashboard font size and multiplied by an explicit `scale` (devicePixelRatio is ignored). */
(function (ADG) {
  const MAX_SIDE = 16384; // common browser canvas limit per side
const MAX_AREA = 16777216; // Safari/iOS limit on total pixels (4096 × 4096)
  const FONTS = ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'VT323'];
  const DEFAULTS = { scale: 2, chrome: true, win: 'macos', font: 'JetBrains Mono', size: 12.5, lineHeight: 1.5, glow: false, scanline: false, template: 'dashboard' };
  let scratch = null;

  const clamp = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const fontStr = (font, size, weight) => (weight || 400) + ' ' + size + 'px "' + font + '", ui-monospace, Menlo, Consolas, monospace';

  function normalize(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    o.scale = Math.round(clamp(o.scale, 1, 4, DEFAULTS.scale));
    o.size = clamp(o.size, 6, 48, DEFAULTS.size);
    o.lineHeight = clamp(o.lineHeight, 1, 3, DEFAULTS.lineHeight);
    o.font = FONTS.indexOf(o.font) >= 0 ? o.font : DEFAULTS.font;
    o.chrome = o.chrome !== false;
    return o;
  }

  function scratchCtx() {
    if (!scratch) scratch = document.createElement('canvas').getContext('2d');
    return scratch;
  }

  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  const luminance = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };

  /** Wait until the font (regular + bold) is usable; resolves even if loading fails (fallback font). */
  async function ensureFont(opts) {
    const o = normalize(opts);
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([document.fonts.load(fontStr(o.font, o.size, 400), 'M'), document.fonts.load(fontStr(o.font, o.size, 700), 'M')]);
    } catch (e) { console.warn('[ascii-gen] font load failed, using fallback', e); }
  }

  /** Why a width × height canvas cannot be created, as a Vietnamese message; null when it is fine. */
  function checkSize(width, height) {
    if (width > MAX_SIDE || height > MAX_SIDE) return 'Ảnh quá lớn (' + width + '×' + height + ' px, mỗi cạnh tối đa ' + MAX_SIDE + '). Giảm tỉ lệ, cỡ chữ hoặc số cột.';
    if (width * height > MAX_AREA) return 'Ảnh quá lớn (' + width + '×' + height + ' px ≈ ' + (width * height / 1e6).toFixed(1) + ' MP, tối đa ' + (MAX_AREA / 1e6).toFixed(1) + ' MP). Giảm tỉ lệ, cỡ chữ hoặc số cột.';
    return null;
  }

  /** Cell metrics + canvas size for a grid; needs the font loaded (see ensureFont) to be exact. */
  function measure(grid, opts, ctx) {
    const o = normalize(opts);
    ctx = ctx || scratchCtx();
    ctx.font = fontStr(o.font, o.size, 400);
    const m = ctx.measureText('M');
    const cw = m.width > 0 ? m.width : o.size * 0.6;
    const asc = m.fontBoundingBoxAscent || o.size * 0.8, desc = m.fontBoundingBoxDescent || o.size * 0.2;
    const rowH = o.lineHeight * o.size;
    const WC = ADG.windowChrome, sp = WC.spec(o.win, o.chrome);
    const L = WC.layout(sp, grid.W * cw, grid.H * rowH, o.size);
    const width = Math.ceil(L.w * o.scale), height = Math.ceil(L.h * o.scale);
    return { o, sp, L, cw, rowH, asc, desc, width, height, limit: checkSize(width, height) };
  }

  function paintCells(ctx, grid, pal, M) {
    const { o, cw, rowH, asc, desc, L } = M, sc = o.scale;
    const snap = (v) => Math.round(v * sc) / sc; // shared snapped edges: no seams between bg runs
    const gx = L.grid.x, gy = L.grid.y;
    grid.cells.forEach((row, y) => {
      let x = 0;
      while (x < row.length) { // background runs
        const bg = row[x].bg && pal[row[x].bg];
        let n = 1;
        while (x + n < row.length && row[x + n].bg === row[x].bg) n++;
        if (bg) {
          const x1 = snap(gx + x * cw), x2 = snap(gx + (x + n) * cw), y1 = snap(gy + y * rowH), y2 = snap(gy + (y + 1) * rowH);
          ctx.fillStyle = bg; ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        }
        x += n;
      }
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const blur = 0.55 * o.size * sc;
    let curFont = '', curColor = '';
    grid.cells.forEach((row, y) => {
      const base = gy + y * rowH + (rowH - (asc + desc)) / 2 + asc;
      row.forEach((c, x) => {
        if (c.ch === ' ') return;
        const f = fontStr(o.font, o.size, c.b ? 700 : 400);
        if (f !== curFont) { ctx.font = f; curFont = f; }
        const color = pal[c.fg] || pal.fg;
        if (color !== curColor) {
          ctx.fillStyle = color; curColor = color;
          if (o.glow) { ctx.shadowColor = hexA(color, 0.55); ctx.shadowBlur = blur; }
        }
        ctx.fillText(c.ch, gx + x * cw, base);
      });
    });
    if (o.glow) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
  }

  function paintScanlines(ctx, pal, M) {
    const c = M.L.content, sc = M.o.scale;
    ctx.fillStyle = 'rgba(0,0,0,' + (luminance(pal.bg) > 0.5 ? 0.06 : 0.22) + ')';
    for (let y = 0; y < c.h; y += 3) {
      const y1 = Math.round((c.y + y) * sc) / sc;
      ctx.fillRect(c.x, y1, c.w, 1);
    }
  }

  /**
   * Draw synchronously (font should already be loaded). Reuses `canvas` when given and the size
   * matches (animation frames); otherwise creates one.
   * @returns {HTMLCanvasElement}
   */
  function draw(grid, pal, opts, canvas) {
    const M = measure(grid, opts);
    if (M.limit) throw new Error(M.limit);
    canvas = canvas || document.createElement('canvas');
    if (canvas.width !== M.width) canvas.width = M.width;
    if (canvas.height !== M.height) canvas.height = M.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không tạo được ảnh cỡ ' + M.width + '×' + M.height + ' px. Giảm tỉ lệ hoặc số cột.');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(M.o.scale, M.o.scale);
    const WC = ADG.windowChrome;
    const info = { e: M.o.size, scale: M.o.scale, font: M.o.font, titles: WC.titles(M.o.template, grid.W, grid.H, M.o.credit) };
    ADG.canvasChrome.paintFrame(ctx, M.sp, M.L, pal, info);
    ctx.save();
    ADG.canvasChrome.roundRect(ctx, M.L.screen.x, M.L.screen.y, M.L.screen.w, M.L.screen.h, M.sp.radius * M.o.size);
    ctx.clip();
    paintCells(ctx, grid, pal, M);
    if (M.o.scanline) paintScanlines(ctx, pal, M);
    ctx.restore();
    return canvas;
  }

  /** Wait for the font, then draw. @returns {Promise<HTMLCanvasElement>} */
  async function renderCanvas(grid, pal, opts) {
    await ensureFont(opts);
    return draw(grid, pal, opts);
  }

  ADG.canvasOut = { MAX_SIDE, MAX_AREA, checkSize, FONTS, DEFAULTS, normalize, ensureFont, measure, draw, renderCanvas };
})(window.ADG = window.ADG || {});
