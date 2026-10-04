/* Status block: optional prompt line (`> █`), then `key [value]` pairs and a spinner on the right
   edge that turns with the current step (four turns per step while playing). */
(function (ADG) {
  const U = ADG.blocks.util;
  const SPIN = '|/-\\';

  ADG.blocks.register('status', {
    label: 'Thanh trạng thái',
    schema: [
      { key: 'prompt', label: 'Dòng nhắc (> █)', type: 'bool' },
      { key: 'items', label: 'Mục: khoá | giá trị (markup)', type: 'list', fields: ['k', 'v'] },
      { key: 'spinner', label: 'Spinner', type: 'bool' }
    ],
    render(cfg, w, ctx) {
      const prompt = cfg.prompt !== false, spin = cfg.spinner !== false && w > 2;
      const g = ctx.grid(w, prompt ? 2 : 1);
      if (prompt) { g.put(0, 0, '>', 'a2', true); g.put(2, 0, '█', 'fg', false, null, 'blink'); }
      const y = prompt ? 1 : 0;
      const line = U.arr(cfg.items, 12).map((it) => U.str(it.k) + ' [' + U.str(it.v) + ']').join('   ');
      g.mtext(0, y, line, 'dim', false, null, spin ? w - 2 : w);
      const turn = ctx.step + (ctx.playing ? Math.floor(ctx.t * 4) : 0);
      if (spin) g.put(w - 1, y, SPIN[((turn % 4) + 4) % 4], 'dim');
      return { grid: g };
    }
  });
})(window.ADG = window.ADG || {});
