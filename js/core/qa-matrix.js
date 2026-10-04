/* Self-check matrix for visual QA, run by hand from the console: ADG.qa.matrix().
   Every template × theme × border × width × step (paused and playing) must render with 0
   self-check issues and no skipped links. Returns a summary; failures are listed. DOM-free. */
(function (ADG) {
  /** @returns {{ runs: number, failures: Array<{template, theme, border, cols, step, playing, issues, skipped}> }} */
  function matrix(opts) {
    opts = opts || {};
    const widths = opts.cols || [80, 96, 120], themes = opts.themes || Object.keys(ADG.theme.THEMES);
    const failures = [];
    let runs = 0;
    ADG.templateList.ids().forEach((template) => themes.forEach((theme) => ['ascii', 'unicode'].forEach((border) => widths.forEach((cols) => {
      const state = Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content(template), { theme, border, cols });
      const cfg = ADG.store.toConfig(state);
      ADG.theme.palette(theme); // the palette must build for every theme
      (cfg.steps || []).forEach((_, step) => [false, true].forEach((playing) => {
        runs++;
        const r = ADG.frame.renderFrame(cfg, step, 0.5, { playing });
        const issues = ADG.grid.selfCheck(r.grid).length;
        if (issues || r.skipped.length) failures.push({ template, theme, border, cols, step, playing, issues, skipped: r.skipped });
      }));
    }))));
    const out = { runs, failures };
    if (typeof console !== 'undefined' && opts.log !== false) console.log('[ascii-gen] QA matrix: ' + runs + ' renders, ' + failures.length + ' failing', failures);
    return out;
  }

  ADG.qa = { matrix };
})(window.ADG = window.ADG || {});
