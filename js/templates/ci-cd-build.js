/* Template: CI/CD build — a DSL chain (push → build → parallel checks → deploy) with a rollback
   back edge and a reviewer on call. Most blocks are auto: they follow the actors + steps. */
(function (ADG) {
  const CONFIG = {
    grid: { cols: 96 },
    border: 'ascii',
    actors: [
      { id: 'reviewer', name: 'reviewer', color: 'a2' },
      { id: 'git', name: 'git', color: 'a3' },
      { id: 'builder', name: 'builder', color: 'a1' },
      { id: 'unit', name: 'unit', color: 'a4' },
      { id: 'lint', name: 'lint', color: 'a5' },
      { id: 'e2e', name: 'e2e', color: 'a6' },
      { id: 'deploy', name: 'deploy', color: 'a2' }
    ],
    steps: ['push', 'build', 'test', 'package', 'stage', 'approve', 'release'],
    current: 2,
    seed: 0,
    layout: [
      ['header'],
      ['steps'],
      [{ block: 'side', w: 0.3 }, { block: 'flow', w: 0.7 }],
      ['timeline'],
      [{ block: 'log', w: 0.62 }, { block: 'meters', w: 0.38 }],
      ['status']
    ],
    blocks: {
      header: {
        auto: true,
        title: 'CI/CD BUILD · {a1b:{@builder^}} COMPILES · {a2b:{@reviewer^}} APPROVES',
        emblem: '=>>=',
        command: '{a2b:> make release}      pipeline step {a2b:{@stepn}}'
      },
      steps: {},
      side: { type: 'side-column', auto: true },
      flow: {
        dsl: 'git -> builder -> [unit, lint, e2e] -> deploy\ndeploy ..> builder : rollback',
        caption: 'fan out · 3 checks · {a2b:parallel}',
        nodes: {
          git: { lines: ['{a3b:{@git^} · main branch}', '{dim:push + tag}'] },
          builder: { lines: ['{a1b:{@builder^} · build farm}', 'cache {bar:0.6:6:a1} {a4b:warm}', '{dim:compiles + packs}'] },
          deploy: { lines: ['{a2b:{@deploy^} · staging -> prod}', '{dim:canary 5% · then all}'] }
        }
      },
      timeline: { auto: true, title: 'pipeline timeline' },
      log: { auto: true, title: 'tail -f build.log', rows: 6 },
      meters: { auto: true, title: 'time share' },
      status: { auto: true, prompt: true }
    }
  };

  ADG.templates = ADG.templates || {};
  ADG.templates['ci-cd-build'] = { label: 'CI/CD build', get: () => JSON.parse(JSON.stringify(CONFIG)) };
})(window.ADG = window.ADG || {});
