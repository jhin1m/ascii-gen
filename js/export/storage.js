/* Autosave: one slot in localStorage (`adg:v1`) holding the same payload as a config file.
   Every access is wrapped: private mode, blocked storage or a full quota must never break the app
   (the app simply starts from the template). Saves are debounced. */
(function (ADG) {
  const KEY = 'adg:v1';
  const DELAY = 500;
  let timer = 0;

  function store() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } // the getter itself can throw
  }

  /** Saved state patch, or null (nothing saved, storage blocked, or the saved data is invalid). */
  function load() {
    try {
      const s = store(), raw = s && s.getItem(KEY);
      if (!raw) return null;
      // keep every valid key: one bad value must not throw away the whole saved work
      try { return ADG.configFile.validate(JSON.parse(raw), { lenient: true }); } catch (e) {
        try { s.setItem(KEY + ':bad', raw); } catch (e2) { /* full: the copy is best effort */ }
        throw e;
      }
    } catch (e) {
      console.warn('[ascii-gen] autosave not loaded:', e && e.message);
      return null;
    }
  }

  /** Write now. @returns {boolean} false when storage is unavailable or full */
  function saveNow(state) {
    clearTimeout(timer);
    try {
      const s = store();
      if (!s) return false;
      s.setItem(KEY, JSON.stringify(ADG.configFile.wrap(state)));
      return true;
    } catch (e) {
      console.warn('[ascii-gen] autosave failed:', e && e.message);
      return false;
    }
  }

  /** Debounced save: only the last state of a burst of edits is written. */
  function save(state) {
    clearTimeout(timer);
    timer = setTimeout(() => saveNow(state), DELAY);
  }

  function clear() {
    clearTimeout(timer);
    try { const s = store(); if (s) s.removeItem(KEY); } catch (e) { /* nothing to clear */ }
  }

  ADG.storage = { KEY, load, save, saveNow, clear };
})(window.ADG = window.ADG || {});
