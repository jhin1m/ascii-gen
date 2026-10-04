/* Template: blank — a header and a status bar to start from. */
(function (ADG) {
  const CONFIG = {
    grid: { cols: 96 },
    border: 'ascii',
    actors: [
      { id: 'me', name: 'me', color: 'a1' },
      { id: 'bot', name: 'bot', color: 'a3' }
    ],
    steps: ['start', 'work', 'done'],
    current: 0,
    seed: 0,
    layout: [['header'], ['status']],
    blocks: {
      header: { auto: true, title: 'MY DASHBOARD', command: '{a2b:> hello}' },
      status: { auto: true, prompt: true }
    }
  };

  ADG.templates = ADG.templates || {};
  ADG.templates.blank = { label: 'Trống', get: () => JSON.parse(JSON.stringify(CONFIG)) };
})(window.ADG = window.ADG || {});
