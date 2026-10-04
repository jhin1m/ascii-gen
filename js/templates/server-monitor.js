/* Template: Server monitor — hub & spoke around the core service, a health table below it and
   an on-call operator in the side column. Most blocks are auto: they follow the actors + steps. */
(function (ADG) {
  const CONFIG = {
    grid: { cols: 96 },
    border: 'ascii',
    actors: [
      { id: 'ops', name: 'ops', color: 'a2' },
      { id: 'api', name: 'api', color: 'a1' },
      { id: 'gateway', name: 'gateway', color: 'a3' },
      { id: 'db', name: 'db', color: 'a5' },
      { id: 'cache', name: 'cache', color: 'a4' },
      { id: 'queue', name: 'queue', color: 'a6' }
    ],
    steps: ['boot', 'probe', 'load', 'spike', 'scale', 'recover', 'steady'],
    current: 3,
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
        title: 'SERVER MONITOR · {a1b:{@api^}} SERVES · {a2b:{@ops^}} ON CALL',
        emblem: '=[::]=',
        command: '{a2b:> watch -n 2 ./health}      refresh every {a2b:2 s}'
      },
      steps: {},
      side: { type: 'side-column', auto: true },
      flow: {
        dsl: 'api <-> [gateway, db, cache, queue]\napi -> health@table',
        nodes: {
          api: { lines: ['{a1b:{@api^} · core service}', 'rps {bar:0.7:8:a1} {a4b:ok}', '{dim:routes every call}'] },
          health: {
            title: '{a3b:HEALTH} · checks every 2 s',
            right: '{a3b:12 probes}',
            cols: ['check', 'load', 'state'],
            rows: [
              { name: 'http 200', ratio: 0.97, route: '{a4b:ok}' },
              { name: 'p95 latency', ratio: 0.42, route: '{a4b:ok}' },
              { name: 'error rate', ratio: 0.08, route: '{a6b:watch}' }
            ],
            highlight: 2,
            note: '{a3b:auto-scale} when load > 0.8'
          }
        }
      },
      timeline: { auto: true, title: 'uptime timeline' },
      log: { auto: true, title: 'tail -f server.log', rows: 6 },
      meters: { auto: true, title: 'load share' },
      status: { auto: true, prompt: true }
    }
  };

  ADG.templates = ADG.templates || {};
  ADG.templates['server-monitor'] = { label: 'Server monitor', get: () => JSON.parse(JSON.stringify(CONFIG)) };
})(window.ADG = window.ADG || {});
