/* Flow presets are DSL text over the stable actor ids (lead, router, worker, explorer, researcher).
   A node whose name is an actor id shows that actor's current name and color, so renaming an actor
   never needs a DSL or node-data rewrite. `health` is a free node (title = its name). */
(function (ADG) {
  const PRESETS = {
    fan: {
      label: 'Fan-out',
      dsl: 'lead -> router@table -> [worker, explorer, researcher] -> lead\nrouter ..> lead : split'
    },
    hub: {
      label: 'Hub & spoke',
      dsl: 'lead <-> [router, worker, explorer, researcher]\nlead -> health@table'
    }
  };

  /** DSL text of a preset, or '' for an unknown id. */
  function presetDsl(id) {
    return Object.prototype.hasOwnProperty.call(PRESETS, id) ? PRESETS[id].dsl : '';
  }

  ADG.flowPresets = { presetDsl, ids: () => Object.keys(PRESETS), label: (id) => (PRESETS[id] ? PRESETS[id].label : id) };
})(window.ADG = window.ADG || {});
