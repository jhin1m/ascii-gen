/* Flow presets are DSL text over the stable actor ids (lead, router, worker, explorer, researcher).
   A node whose name is an actor id shows that actor's current name and color, so renaming an actor
   never needs a DSL or node-data rewrite. `health` is a free node (title = its name).
   presetDsl(id, actorIds) fits the shape to other actors: the first actors fill the roles. */
(function (ADG) {
  const ROLES = ['lead', 'router', 'worker', 'explorer', 'researcher'];
  const PRESETS = {
    fan: {
      label: 'Fan-out',
      art: '  [a]\n ┌─┼─┐\n[b][c][d]\n └─┼─┘\n  [e]',
      dsl: (r) => r[0] + ' -> ' + r[1] + '@table -> [' + r.slice(2).join(', ') + '] -> ' + r[0] + '\n' + r[1] + ' ..> ' + r[0] + ' : split'
    },
    hub: {
      label: 'Hub & spoke',
      art: '  [b]\n   │\n[c]─[a]─[d]\n   │\n  [e]',
      dsl: (r) => r[0] + ' <-> [' + r.slice(1).join(', ') + ']\n' + r[0] + ' -> health@table'
    }
  };

  /**
   * DSL text of a preset ('' for an unknown id). With `actorIds` lacking the default roles, the
   * first five ids (in order) take the roles; missing ones become free nodes n1, n2, …
   */
  function presetDsl(id, actorIds) {
    if (!Object.prototype.hasOwnProperty.call(PRESETS, id)) return '';
    const ids = Array.isArray(actorIds) ? actorIds.filter((x) => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x) && x !== 'health') : null;
    let roles = ROLES;
    if (ids && !ROLES.every((r) => ids.indexOf(r) >= 0)) roles = ROLES.map((r, i) => ids[i] || 'n' + (i + 1));
    return PRESETS[id].dsl(roles);
  }

  ADG.flowPresets = {
    presetDsl,
    ids: () => Object.keys(PRESETS),
    label: (id) => (PRESETS[id] ? PRESETS[id].label : id),
    art: (id) => (PRESETS[id] ? PRESETS[id].art : '')
  };
})(window.ADG = window.ADG || {});
