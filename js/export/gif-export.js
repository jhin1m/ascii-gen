/* GIF export: animation frames → theme palette indices → GIF encoder (frame diff, loop).
   Runs on the main thread one frame per task, with progress and cancel. */
(function (ADG) {
  /** Rough size estimate in bytes before exporting (first frame full, later frames are diffs). */
  function estimate(width, height, frames) {
    return Math.round(width * height * 0.12 + frames * width * height * 0.012);
  }

  /**
   * @param {{ state, fps, scale, loop: boolean, signal?, onProgress? }} o
   * @returns {Promise<Blob>}
   */
  async function exportGif(o) {
    const P = ADG.gifPalette.build(ADG.store.palette(o.state));
    let enc = null, idx = null, delayCs = 0, carry = 0;
    await ADG.animFrames.run({
      // GIF delays are ≥ 2 cs: 50 fps at most
      state: o.state, fps: Math.min(50, o.fps), scale: o.scale, signal: o.signal, onProgress: o.onProgress,
      onStart(canvas, plan) {
        enc = ADG.gif.createEncoder(canvas.width, canvas.height, P.rgb, { loop: o.loop ? 0 : -1 });
        idx = new Uint8Array(canvas.width * canvas.height);
        delayCs = 100 / plan.fps;
      },
      onFrame(canvas) {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        // GIF delays are whole centiseconds: carry the rounding so the total duration stays exact
        const want = delayCs + carry, d = Math.max(2, Math.round(want));
        carry = want - d;
        enc.addFrame(ADG.gifPalette.quantize(data, P, idx), d);
      }
    });
    return new Blob([enc.finish()], { type: 'image/gif' });
  }

  ADG.gifExport = { exportGif, estimate };
})(window.ADG = window.ADG || {});
