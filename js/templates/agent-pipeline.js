/* Template: Agent pipeline (the ref.png composition). Content is English and uses generic role
   names only. get() returns a fresh deep copy so callers can mutate it freely. */
(function (ADG) {
  const node = (id, lines, footer) => Object.assign({ id, lines }, footer ? { footer } : {});
  const worker = (id, desc) => node(id, [id, '{lead:lead} · {a2:medium}', '{dim:' + desc + '}'], { status: 'idle', ratio: 0, badge: '{m:[..]}' });

  const CONFIG = {
    grid: { cols: 96 },
    border: 'ascii',
    actors: [
      { id: 'advisor', name: 'advisor', color: 'a2' },
      { id: 'lead', name: 'lead', color: 'a1' },
      { id: 'router', name: 'router', color: 'a3' },
      { id: 'worker', name: 'worker', color: 'a2' },
      { id: 'explorer', name: 'explorer', color: 'a2' },
      { id: 'researcher', name: 'researcher', color: 'a2' }
    ],
    steps: ['plan', 'fork', 'delegate', 'work', 'merge', 'review', 'ship'],
    current: 1,
    layout: [
      ['header'],
      ['steps'],
      [{ block: 'side', w: 0.3 }, { block: 'flow', w: 0.7 }],
      ['timeline'],
      [{ block: 'log', w: 0.66 }, { block: 'meters', w: 0.34 }],
      ['status']
    ],
    blocks: {
      header: {
        title: 'AGENT PIPELINE · {a1b:LEAD} WORKS · {a2b:ADVISOR} ON CALL',
        emblem: '=/##/=',
        legend: ['lead high', 'workers medium', 'router forks', 'advisor on call'],
        command: '{a2b:> /advisor on}      Advisor set to {a2b:on call}'
      },
      steps: {},
      side: {
        type: 'side-column',
        title: '{a2b:ADVISOR · on call}',
        sub: 'watches · reads it all',
        items: [
          { kind: 'milestone', title: 'before a plan', q: 'right approach?', a: 'run migration first', link: 'lead' },
          { kind: 'note', text: '{m:listening}' },
          { kind: 'pulse', bits: '1101110011' },
          { kind: 'note', text: 'reads every tool\ncall and result' },
          { kind: 'kv', k: 'calls', v: '6' },
          { kind: 'kv', k: 'tokens', v: '643k' },
          { kind: 'note', text: 'silent on every\nroutine turn' },
          { kind: 'note', text: 'never writes code' },
          { kind: 'milestone', title: 'error again', q: 'wrong place?', a: 'stop retrying', link: 'worker' },
          { kind: 'milestone', title: 'before done', q: 'what did I miss?', a: 'add 1 test', link: 'review' }
        ]
      },
      flow: {
        top: node('lead', ['{a1b:LEAD · main session}', 'effort {bar:1:6:a1} {a2b:high} · ctx 1M', '{dim:plans + decides}']),
        loop: { label: 'split' },
        table: {
          id: 'router',
          title: '{a3b:ROUTER} · {a3b:fork layer} · one call · < 0.5 s',
          right: '{a3b:1,683 forks}',
          cols: ['fork', 'p(top)', 'route'],
          rows: [
            { name: 'which file', ratio: 0.84, route: 'sharp -> code' },
            { name: 'which tool', ratio: 0.46, route: '{a1b:split -> lead}' },
            { name: 'retry/stop', ratio: 0.54, route: '{a1b:split -> lead}' }
          ],
          highlight: 0,
          note: '{a3b:sharp}: runs in code, lead never sees it'
        },
        caption: 'delegate · 3 workers · {a2b:effort medium}',
        fan: [worker('worker', 'edits + checks'), worker('explorer', 'reads the code'), worker('researcher', 'pulls the docs')],
        bottom: node('review', ['{a1b:back to main session · high}', '**review + verify**', '{advisor:advisor} reviews · {lead:lead} ships', '{dim:4 diffs · no edits until go}'])
      },
      timeline: {
        title: 'session timeline',
        bounds: [0, 0.2, 0.34, 0.5, 0.64, 0.78, 0.9, 1],
        rows: [
          { actor: 'advisor', pattern: '....<>...........................................<>..................<>......' },
          { actor: 'lead', pattern: '###############.....................###.###..####....................#############' },
          { actor: 'router', pattern: '.................||||.|.|.||.|.||||......................................' },
          { actor: 'worker', pattern: '.......................................=======xxxxxxx======..................' },
          { actor: 'explorer', pattern: '.......................................==============.........................' },
          { actor: 'researcher', pattern: '.......................................======================................' }
        ]
      },
      log: {
        title: 'tail -f session.log',
        rows: 6,
        lines: [
          { t: '23:58', actor: 'lead', msg: 'session start · 6 actors online', step: 0 },
          { t: '23:59', actor: 'advisor', msg: 'listening · reads every tool call', step: 0 },
          { t: '00:00', actor: 'lead', msg: 'plan: check agents, draft missing, diff', step: 0 },
          { t: '00:00', actor: 'advisor', msg: 'advising · before a plan -> reviewed', step: 0 },
          { t: '00:01', actor: 'lead', msg: 'fork: route 3 questions', step: 1 },
          { t: '00:02', actor: 'router', msg: 'which file  explorer.md  0.84 {a3b:sharp ->}', step: 1 },
          { t: '00:04', actor: 'lead', msg: 'delegate · 3 workers · effort medium', step: 2 },
          { t: '00:06', actor: 'worker', msg: 'edits + checks · 2 files touched', step: 3 },
          { t: '00:09', actor: 'lead', msg: 'merge · review + verify', step: 4 },
          { t: '00:10', actor: 'advisor', msg: 'advising · before done -> reviewed', step: 5 },
          { t: '00:11', actor: 'lead', msg: '4 diffs ready · no edits until go', step: 5 },
          { t: '00:12', actor: 'lead', msg: 'ship · tests green · done', step: 6 }
        ]
      },
      meters: {
        title: 'who sees what',
        items: [
          { actor: 'router', ratio: 1, note: 'every fork' },
          { actor: 'lead', ratio: 0.35, note: 'splits only' },
          { actor: 'advisor', ratio: 0.1, note: '3 moments' }
        ]
      },
      status: {
        prompt: true,
        items: [
          { k: 'step', v: '{a2b:fork}' },
          { k: 'effort', v: '{a1b:high}' },
          { k: 'workers', v: '{a2b:0/3}' },
          { k: 'advisor', v: '{a2b:on call}' },
          { k: 'router', v: '{a3b:1,683}' }
        ]
      }
    }
  };

  ADG.templates = ADG.templates || {};
  ADG.templates['agent-pipeline'] = { label: 'Agent pipeline', get: () => JSON.parse(JSON.stringify(CONFIG)) };
})(window.ADG = window.ADG || {});
