/* Window chrome spec shared by the HTML preview and the canvas export. DOM-free data only.
   Every length is in em relative to the dashboard font size (e): multiply by `e` px to get pixels.
   Geometry follows the approved mockup (Terminal.dc.html): macOS / Windows Terminal / Ubuntu / Retro CRT. */
(function (ADG) {
  // padding between the screen edge and the character grid (grid sits inside the screen)
  const PAD = { l: 1.5, r: 1.5, t: 1.3, b: 1.4 };
  // transparent room around a framed window so its drop shadow is not clipped
  const MARGIN = 1.6;
  const SHADOW = { color: 'rgba(0,0,0,.35)', blur: 3.2, y: 1.6 };
  const WINDOWS = ['macos', 'windows', 'ubuntu', 'crt'];
  const LABELS = { macos: 'macOS', windows: 'Windows', ubuntu: 'Ubuntu', crt: 'Retro CRT' };

  const SPECS = {
    none: { key: 'none', radius: 0.4, bar: 0 },
    macos: {
      key: 'macos', radius: 0.7, bar: 2.6, titleSize: 0.9, creditSize: 0.72, padX: 1,
      dot: { d: 0.95, gap: 0.55, colors: ['#ff5f57', '#febc2e', '#28c840'] }
    },
    windows: {
      key: 'windows', radius: 0.5, bar: 2.8, creditSize: 0.72, barMix: 0.3, gap: 0.4,
      tab: { x: 0.6, h: 1.98, padX: 0.81, gap: 0.63, radius: 0.45, font: 0.9, iconFont: 0.63, iconW: 0.945, iconH: 0.756, iconR: 0.126 },
      plus: { font: 0.95, pad: 0.475 },
      cap: { w: 3.6, icon: 0.85, stroke: 1 / 12 }, capGap: 1
    },
    ubuntu: {
      key: 'ubuntu', radius: 0.9, bar: 2.6, titleSize: 0.95, creditSize: 0.72, padX: 1, close: '#e95420',
      btn: { w: 2, h: 1.8, r: 0.4, icon: 0.8 },
      circle: { d: 1.5, gap: 0.55, icon: 0.6 }
    },
    crt: {
      key: 'crt', radius: 1.6, bar: 0, bezel: 0.35, bezelColor: '#121110', foot: 3.2, footPad: 0.6,
      frame: { x: 2.6, t: 2.6, radius: 2, from: '#34312d', to: '#1f1d1b' },
      brand: { size: 0.8, spacing: 0.35, color: '#8b8273' },
      power: { size: 0.65, spacing: 0.2, color: '#6f685d', led: 0.9, ledColor: '#6dff8e', gap: 0.6 },
      inset: { blur: 4.5, color: 'rgba(0,0,0,.55)' }
    }
  };

  /** Spec for a window style; `chrome` false (or an unknown style) gives the bare rounded screen. */
  function spec(win, chrome) {
    if (!chrome) return SPECS.none;
    return SPECS[win] && win !== 'none' ? SPECS[win] : SPECS.macos;
  }

  /** Text shown in the title bars. */
  function titles(template, cols, rows, credit) {
    const name = String(template || 'dashboard');
    return {
      mac: '~/' + name + ' - zsh - ' + cols + 'x' + rows,
      ubuntu: 'you@host: ~/' + name,
      tab: 'zsh',
      brand: 'ADG·' + cols,
      credit: credit == null ? 'made by @you' : String(credit)
    };
  }

  /**
   * Pixel geometry for a grid of gridW × gridH px at font size e px:
   * { w, h, margin, outer|null, screen:{x,y,w,h}, content:{x,y,w,h} (grid origin), barH, footH }.
   * `content` is the padded area that scanlines cover; `grid` is where cell (0,0) starts.
   */
  function layout(sp, gridW, gridH, e) {
    const margin = sp.key === 'none' ? 0 : MARGIN * e;
    const fx = sp.frame ? sp.frame.x * e : 0, ft = sp.frame ? sp.frame.t * e : 0;
    const barH = sp.bar * e, footH = (sp.foot || 0) * e;
    const sw = (PAD.l + PAD.r) * e + gridW;
    const sh = barH + (PAD.t + PAD.b) * e + gridH;
    const screen = { x: margin + fx, y: margin + ft, w: sw, h: sh };
    const outer = sp.frame ? { x: margin, y: margin, w: sw + 2 * fx, h: ft + sh + footH } : null;
    const box = outer || screen;
    return {
      w: box.w + 2 * margin, h: box.h + 2 * margin, margin, outer, screen, barH, footH,
      content: { x: screen.x, y: screen.y + barH, w: sw, h: sh - barH },
      grid: { x: screen.x + PAD.l * e, y: screen.y + barH + PAD.t * e }
    };
  }

  ADG.windowChrome = { PAD, MARGIN, SHADOW, WINDOWS, LABELS, SPECS, spec, titles, layout };
})(window.ADG = window.ADG || {});
