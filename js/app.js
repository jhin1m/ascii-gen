/* Minimal bootstrap: draws one demo grid exercising every primitive so the core can be
   checked by eye across themes/borders. Replaced by the template-driven app in later phases. */
(function (ADG) {
  const W = 80, H = 24;
  const ACTORS = { lead: 'a1', advisor: 'a2', router: 'a3' };
  const state = { theme: 'midnight', border: 'ascii', emoji: false };

  function buildDemo() {
    const g = ADG.grid.createGrid(W, H, { border: state.border, actors: ACTORS });
    const J = g.J;

    g.center(0, W, 0, 'ASCII DASHBOARD · {lead:LEAD} WORKS · {advisor:ADVISOR} ON CALL', 'fg', true);
    g.divider(1, 1, W - 2, 'dot');
    g.center(0, W, 1, '{fgb:=/##/=}');
    g.center(0, W, 2, '{a1:[#]} lead high    {a1:[#]} workers medium    {a1:[#]} router forks', 'fg');
    g.center(0, W, 3, '{a2b:> /advisor on}      Advisor set to {a2b:on call}', 'dim');

    // three box kinds, joined by arrows
    g.box(1, 5, 24, 7, 'a1', 'solid', 'solid');
    g.center(2, 22, 6, '{a1b:LEAD · main session}');
    g.center(2, 22, 7, 'effort {bar:1:6:a1} {a2b:high}');
    g.center(2, 22, 8, 'plans + decides', 'dim');
    g.meter(3, 10, 20, 0.6, 'a1');

    g.arrowR(25, 26, 8, 'mut');
    g.box(27, 5, 26, 7, 'a3', 'dbl', 'double');
    g.put(39, 5, J.ddown, 'a3'); g.put(39, 11, J.dup, 'a3');
    g.mtext(29, 6, '{router:ROUTER} · fork layer');
    [['which file', 0.84], ['which tool', 0.46], ['retry/stop', 0.54]].forEach((r, i) => {
      const y = 7 + i;
      if (i === 0) { g.fillBg(28, y, 24, 'hlrow'); g.put(28, y, '>', 'a3', true); }
      g.text(29, y, r[0], 'fg', true);
      g.bar(40, y, 8, r[1], 'a1');
      g.text(48, y, r[1].toFixed(2), 'a2', true);
    });
    g.hline(29, 10, 22, 'dot', true);

    g.arrowL(53, 54, 8, 'mut', true);
    g.box(55, 5, 24, 7, 'a2', 'dash', 'dash');
    g.text(57, 7, '$ running', 'a2');
    g.bar(57, 8, 20, 0.45, 'a2');
    g.center(56, 22, 9, '{a2:[>>]} {m:[..]} {a3b:[ok]}');
    g.mtext(57, 10, 'clip: {a1:a-very-long-worker-name}', 'fg', false, null, 20);

    // vertical arrows into the log box
    g.arrowDown(13, 12, 13, 'mut');
    g.arrowDown(39, 12, 13, 'mut', true);
    g.vline(66, 12, 2, 'mut', true);

    // log tail with highlighted last row + blinking cursor
    g.box(1, 14, W - 2, 7, 'mut', 'dash', 'tail -f session.log');
    const LOG = [
      ['00:01', 'lead', 'fork: route 3 questions'],
      ['00:02', 'router', 'which file  explorer.md  0.84 {a3b:sharp ->}'],
      ['00:04', 'advisor', 'Tiếng Việt có dấu · thẳng cột » ok'],
      ['00:06', 'lead', state.emoji ? 'deploy 🚀 done' : 'delegate · 3 workers · effort medium']
    ];
    LOG.forEach((l, i) => {
      const y = 15 + i, last = i === LOG.length - 1;
      if (last) g.fillBg(2, y, W - 4, 'logrow');
      g.text(3, y, l[0], 'mut');
      g.text(9, y, ADG.text.clip(l[1], 9), ACTORS[l[1]], true);
      const n = g.mtext(19, y, l[2]);
      if (last) g.put(19 + n, y, '_', 'fg', true, null, 'blink');
    });
    g.text(3, 19, ADG.text.clip('a log line far too long for its column is clipped here', 40), 'dim');

    // prompt + status bar
    g.put(1, 22, '>', 'a2', true);
    g.put(3, 22, '█', 'fg', false, null, 'blink');
    g.mtext(1, 23, 'step [{a2b:fork}]   effort [{a1b:high}]   workers [{a2b:0/3}]   router [{a3b:1,683}]', 'dim');
    g.put(W - 2, 23, '/', 'dim');
    return g;
  }

  function render() {
    const pal = ADG.theme.palette(state.theme);
    const g = buildDemo();
    const issues = ADG.grid.selfCheck(g);
    const screen = document.getElementById('screen');
    screen.style.background = pal.bg;
    screen.style.color = pal.fg;
    screen.style.boxShadow = '0 0 0 1px ' + pal.line;
    document.getElementById('preview').innerHTML = ADG.htmlOut.renderHTML(g, pal, { blink: true });
    const status = document.getElementById('check-status');
    status.textContent = issues.length ? 'Tự kiểm tra: ' + issues.length + ' cảnh báo (xem console)' : 'Tự kiểm tra: OK · ' + W + '×' + H;
    status.className = 'check-status ' + (issues.length ? 'warn' : 'ok');
  }

  function init() {
    const sel = document.getElementById('theme-select');
    Object.keys(ADG.theme.THEMES).forEach((id) => sel.add(new Option(ADG.theme.THEME_LABELS[id], id)));
    sel.value = state.theme;
    sel.addEventListener('change', () => { state.theme = sel.value; render(); });
    const border = document.getElementById('border-select');
    border.addEventListener('change', () => { state.border = border.value; render(); });
    const emoji = document.getElementById('emoji-toggle');
    emoji.addEventListener('change', () => { state.emoji = emoji.checked; render(); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.ADG = window.ADG || {});
