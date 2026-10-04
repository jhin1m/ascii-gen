/* Themes hold 9 base colors; every other color is mixed from them so a theme switch
   (or a single color override) recolors highlights, dots and chrome consistently. */
(function (ADG) {
  const THEMES = {
    midnight: { bg: '#1b1e2b', fg: '#e6e8f0', mut: '#6c7189', a1: '#f27eb5', a2: '#ecd67a', a3: '#7dd8d0', a4: '#8fd694', a5: '#a99cf5', a6: '#f2a272' },
    dracula: { bg: '#282a36', fg: '#f8f8f2', mut: '#6d7cb0', a1: '#ff79c6', a2: '#f1fa8c', a3: '#8be9fd', a4: '#50fa7b', a5: '#bd93f9', a6: '#ffb86c' },
    gruvbox: { bg: '#282828', fg: '#ebdbb2', mut: '#928374', a1: '#d3869b', a2: '#fabd2f', a3: '#8ec07c', a4: '#b8bb26', a5: '#83a598', a6: '#fe8019' },
    solarized: { bg: '#002b36', fg: '#eee8d5', mut: '#6f8b93', a1: '#e05a9c', a2: '#d3a400', a3: '#2aa198', a4: '#9cb300', a5: '#8a8fe0', a6: '#e0662a' },
    phosphor: { bg: '#07110a', fg: '#b9ffc8', mut: '#3f7d4f', a1: '#62ff8a', a2: '#d2ff70', a3: '#4fffd0', a4: '#2cff63', a5: '#9effb3', a6: '#c4ff9a' },
    amber: { bg: '#140c03', fg: '#ffd89e', mut: '#8f5d1f', a1: '#ffb000', a2: '#ffd04d', a3: '#ff9a1f', a4: '#ffe28a', a5: '#e8a24a', a6: '#ff7a1a' },
    paper: { bg: '#f5f1e6', fg: '#26251f', mut: '#7a7466', a1: '#b8336a', a2: '#9a6f00', a3: '#1c7a80', a4: '#3b833b', a5: '#5a4fc0', a6: '#b8561c' }
  };
  const THEME_LABELS = {
    midnight: 'Midnight', dracula: 'Dracula', gruvbox: 'Gruvbox', solarized: 'Solarized Dark',
    phosphor: 'Phosphor Green', amber: 'Amber CRT', paper: 'Light Paper'
  };
  const BASE_KEYS = ['bg', 'fg', 'mut', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
  // derived key -> [source key, weight of source when mixed with bg]
  const DERIVED = {
    dim: ['fg', 0.62], dot: ['mut', 0.62], hlrow: ['a4', 0.15], hlstep: ['a2', 0.3],
    hlcur: ['a2', 0.28], logrow: ['fg', 0.07], chrome: ['fg', 0.06], line: ['fg', 0.12]
  };
  const COLOR_KEYS = BASE_KEYS.concat(Object.keys(DERIVED));
  const HEX = /^#[0-9a-f]{6}$/i;

  function hexToRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); }

  /** Linear blend: t = 1 → a, t = 0 → b. */
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }

  function pickValid(src, keys) {
    const out = {};
    if (!src) return out;
    keys.forEach((k) => { if (typeof src[k] === 'string' && HEX.test(src[k])) out[k] = src[k].toLowerCase(); });
    return out;
  }

  /**
   * Full palette for a theme name (or base-color object). Base overrides apply before
   * mixing so derived colors follow them; derived overrides apply last. Invalid hex is ignored.
   */
  function palette(theme, overrides) {
    const base = typeof theme === 'object' && theme ? theme : THEMES[theme] || THEMES.midnight;
    const p = Object.assign({}, THEMES.midnight, pickValid(base, BASE_KEYS), pickValid(overrides, BASE_KEYS));
    Object.keys(DERIVED).forEach((k) => { p[k] = mix(p[DERIVED[k][0]], p.bg, DERIVED[k][1]); });
    return Object.assign(p, pickValid(overrides, Object.keys(DERIVED)));
  }

  ADG.theme = { THEMES, THEME_LABELS, BASE_KEYS, COLOR_KEYS, mix, palette };
})(window.ADG = window.ADG || {});
