/* Frames of the animation export (GIF and video): the run is replayed from step 0, one frame
   every 1/fps s for (steps × seconds per step), each drawn with ADG.frame.renderFrame in playing
   mode through the canvas renderer onto an opaque canvas (backdrop behind the window frame), so
   the export matches the preview. The blinking cursor follows the frame time. Work is split per
   frame (await) so the page stays responsive, and an AbortSignal cancels it. */
(function (ADG) {
  const BLINK_MS = 525; // half period of the CSS blink (1.05 s)

  /** Frame timing: { count, frameMs, durationMs }. */
  function plan(steps, msPerStep, fps) {
    fps = Math.max(1, Math.min(60, Math.round(fps) || 15));
    const durationMs = Math.max(1, steps) * Math.max(100, msPerStep);
    return { fps, frameMs: 1000 / fps, durationMs, count: Math.max(1, Math.round((durationMs * fps) / 1000)) };
  }

  /** Step, t and blink state of frame i. */
  function at(i, P, steps) {
    const ms = i * P.frameMs, pos = ADG.frame.timeAt(ms, P.durationMs / Math.max(1, steps), steps, 0, true);
    return { ms, step: pos.step, t: pos.t, blink: Math.floor(ms / BLINK_MS) % 2 === 0 };
  }

  // yield to the page between frames; MessageChannel is not throttled in background tabs (setTimeout is)
  const tick = () => new Promise((r) => {
    if (typeof MessageChannel !== 'function') { setTimeout(r, 0); return; }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); r(); };
    ch.port2.postMessage(0);
  });
  const abortError = () => { const e = new Error('Đã huỷ.'); e.name = 'AbortError'; return e; };

  /**
   * Draw every frame and hand it to onFrame(canvas, index, info) (may be async).
   * @param {{ state: object, fps: number, scale: number, even?: boolean, signal?: AbortSignal,
   *           onProgress?: (done:number, total:number) => void, onFrame: Function, onStart?: Function }} o
   * @returns {Promise<{ width, height, plan }>}
   */
  async function run(o) {
    const s = o.state, cfg = ADG.store.toConfig(s), pal = ADG.store.palette(s);
    const steps = Math.max(1, (s.steps || []).length);
    const P = plan(steps, s.speed, o.fps);
    const opts = { scale: o.scale, chrome: s.chrome, win: s.win, font: s.font, size: s.size, lineHeight: s.lineHeight, glow: s.glow, scanline: s.scanline, credit: s.credit, template: s.template };
    await ADG.canvasOut.ensureFont(opts);
    // the page height can differ between steps: size the output for the tallest one
    let W = 0, H = 0;
    for (let st = 0; st < steps; st++) {
      const m = ADG.canvasOut.measure(ADG.frame.renderFrame(cfg, st, 0, { playing: true }).grid, opts);
      if (m.limit) throw new Error(m.limit);
      W = Math.max(W, m.width); H = Math.max(H, m.height);
    }
    if (o.even) { W += W % 2; H += H % 2; } // H.264 needs even sizes
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d', { willReadFrequently: !o.even });
    if (!ctx) throw new Error('Trình duyệt không tạo được khung hình ' + W + '×' + H + ' px.');
    const back = ADG.gifPalette.backdrop(pal), scratch = document.createElement('canvas');
    if (o.onStart) await o.onStart(out, P);
    for (let i = 0; i < P.count; i++) {
      if (o.signal && o.signal.aborted) throw abortError();
      const f = at(i, P, steps);
      const grid = ADG.frame.renderFrame(cfg, f.step, f.t, { playing: true }).grid;
      ADG.canvasOut.draw(grid, pal, Object.assign({}, opts, { blinkOff: !s.blink || !f.blink }), scratch);
      ctx.fillStyle = back; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(scratch, 0, 0);
      await o.onFrame(out, i, Object.assign({ index: i, count: P.count }, f));
      if (o.onProgress) o.onProgress(i + 1, P.count);
      await tick();
    }
    return { width: W, height: H, plan: P };
  }

  ADG.animFrames = { plan, at, run, BLINK_MS };
})(window.ADG = window.ADG || {});
