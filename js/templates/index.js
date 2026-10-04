/* Template list (menu order) and the state content a template starts from. A template switch
   replaces the content (actors, steps, layout, blocks, step, seed) and keeps the look. */
(function (ADG) {
  const ORDER = ['agent-pipeline', 'server-monitor', 'ci-cd-build', 'blank'];

  const ids = () => ORDER.filter((id) => ADG.templates && ADG.templates[id]);
  const label = (id) => (ADG.templates[id] ? ADG.templates[id].label : id);

  /** State patch with the content of template `id` (unknown id → the first template). */
  function content(id) {
    if (ids().indexOf(id) < 0) id = ids()[0];
    const c = ADG.templates[id].get();
    return { template: id, actors: c.actors, steps: c.steps, layout: c.layout, blocks: c.blocks, step: c.current || 0, seed: c.seed || 0 };
  }

  ADG.templateList = { ids, label, content };
})(window.ADG = window.ADG || {});
