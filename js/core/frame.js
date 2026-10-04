/* One animation frame as a pure function of (config, step, t): the live preview, the player and
   the GIF/video exports all draw through renderFrame, so they always show the same picture.
     prepare: clone → auto blocks generated → numbers varied by seed → name/step tokens resolved
     compose: layout with ctx.step, ctx.t (0..1 inside the step), ctx.playing, ctx.activity
   playing=false shows a step in full (timeline complete, cursor mid-step); playing=true reveals
   it progressively with t. */
(function (ADG) {
  const clone = (v) => JSON.parse(JSON.stringify(v == null ? {} : v));

  /** Config ready for layout at `step` (no rendering). @returns {{ cfg, activity }} */
  function prepare(config, step) {
    const cfg = clone(config);
    if (step != null) cfg.current = step;
    const activity = ADG.generators.apply(cfg);
    ADG.random.jitter(cfg, cfg.seed);
    ADG.generators.resolveTokens(cfg);
    return { cfg, activity };
  }

  /**
   * @param {object} config dashboard config (see layout.compose) + seed
   * @param {number} step   current step index
   * @param {number} [t]    progress inside the step, 0..1
   * @param {{playing?: boolean}} [opts]
   * @returns {{ grid, cols, rows, anchors, skipped }}
   */
  function renderFrame(config, step, t, opts) {
    const { cfg, activity } = prepare(config, step);
    const tt = Math.max(0, Math.min(1, Number(t) || 0));
    return ADG.layout.compose(cfg, { t: tt, playing: !!(opts && opts.playing), activity });
  }

  /**
   * Player clock: where a run that started at position `from` (step + fraction) is after `elapsed` ms.
   * @returns {{ step: number, t: number, done: boolean }} done = a non-looping run reached the end
   */
  function timeAt(elapsed, msPerStep, steps, from, loop) {
    steps = Math.max(1, Math.floor(steps) || 1);
    msPerStep = Math.max(1, Number(msPerStep) || 1000);
    const pos = Math.max(0, Number(elapsed) || 0) / msPerStep + Math.max(0, Number(from) || 0);
    if (!loop && pos >= steps) return { step: steps - 1, t: 1, done: true };
    const p = pos % steps;
    return { step: Math.floor(p), t: p - Math.floor(p), done: false };
  }

  ADG.frame = { prepare, renderFrame, timeAt };
})(window.ADG = window.ADG || {});
