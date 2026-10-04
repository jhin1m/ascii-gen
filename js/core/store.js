/* App state: one flat object (content + view options), the same shape that config files, share
   links and autosave carry (see export/config-file.js). set(patch) merges shallowly and notifies
   subscribers once per batch (a microtask by default), so several edits in one event cause one
   notification; rendering is coalesced separately by the app. DOM-free: tests pass a synchronous scheduler. */
(function (ADG) {
  /** View options every state has; content (template, actors, steps, layout, blocks, step, seed) comes from a template. */
  const VIEW_DEFAULTS = {
    theme: 'midnight', colors: {}, border: 'ascii', cols: 96,
    win: 'macos', chrome: true, glow: false, scanline: false, blink: true,
    font: 'JetBrains Mono', size: 12.5, lineHeight: 1.5, credit: 'made by @you',
    speed: 1200, loop: true
  };

  /**
   * @param {object} initial
   * @param {(fn: Function) => void} [schedule] defers notifications (default: microtask)
   */
  function create(initial, schedule) {
    let state = Object.assign({}, initial);
    const subs = [];
    let pending = null;
    schedule = schedule || ((fn) => Promise.resolve().then(fn));

    function flush() {
      const changed = pending;
      pending = null;
      subs.slice().forEach((fn) => fn(state, changed));
    }

    /** Merge `patch`; keys whose value did not change (===) are not reported. */
    function set(patch) {
      const changed = Object.keys(patch || {}).filter((k) => state[k] !== patch[k]);
      if (!changed.length) return;
      state = Object.assign({}, state, patch);
      const first = !pending;
      pending = pending || {};
      changed.forEach((k) => { pending[k] = true; });
      if (first) schedule(flush);
    }

    return {
      get: () => state,
      set,
      /** @returns {() => void} unsubscribe */
      subscribe(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
    };
  }

  /** Dashboard config for layout / renderFrame from the app state. */
  function toConfig(s) {
    return { grid: { cols: s.cols }, border: s.border, actors: s.actors, steps: s.steps, current: s.step, layout: s.layout, blocks: s.blocks, seed: s.seed };
  }

  /** Palette of the state: theme + per-color overrides. */
  const palette = (s) => ADG.theme.palette(s.theme, s.colors);

  ADG.store = { VIEW_DEFAULTS, create, toConfig, palette };
})(window.ADG = window.ADG || {});
