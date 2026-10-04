/* Step player: Play/Pause, prev/next, speed (seconds per step), loop. One requestAnimationFrame
   loop drives the clock (ADG.frame.timeAt); onFrame(step, t, playing) is called on every tick
   while playing and once on every state change, and the caller re-renders only when the picture
   changes. Changing the speed while playing keeps the current position. */
(function (ADG) {
  const MIN_MS = 300, MAX_MS = 3000;

  /**
   * @param {{ steps: () => number, onFrame: (step:number, t:number, playing:boolean) => void,
   *           step?: number, speed?: number, loop?: boolean }} opts
   */
  function create(opts) {
    let step = Math.max(0, Math.floor(opts.step) || 0), t = 0, playing = false;
    let speed = clampMs(opts.speed), loop = opts.loop !== false;
    let t0 = 0, from = 0, raf = 0;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const count = () => Math.max(1, Math.floor(opts.steps()) || 1);
    const emit = () => opts.onFrame(step, t, playing);

    function tick() {
      const pos = ADG.frame.timeAt(now() - t0, speed, count(), from, loop);
      step = pos.step; t = pos.t;
      if (pos.done) { playing = false; t = 0; raf = 0; emit(); return; }
      emit();
      raf = requestAnimationFrame(tick);
    }

    function play() {
      if (playing) return;
      if (!loop && step >= count() - 1) step = 0; // a finished run starts over
      playing = true; t0 = now(); from = step; t = 0;
      raf = requestAnimationFrame(tick);
      emit();
    }

    function pause() {
      if (!playing) return;
      playing = false; t = 0;
      cancelAnimationFrame(raf); raf = 0;
      emit();
    }

    /** Jump to a step (keeps playing from there when playing). */
    function seek(s) {
      const n = count();
      step = ((Math.floor(s) % n) + n) % n; t = 0;
      if (playing) { t0 = now(); from = step; }
      emit();
    }

    function setSpeed(ms) {
      const pos = step + t;
      speed = clampMs(ms);
      if (playing) { t0 = now(); from = pos; }
    }

    return {
      play, pause, seek, setSpeed,
      toggle: () => (playing ? pause() : play()),
      next: () => seek(step + 1),
      prev: () => seek(step - 1),
      setLoop: (v) => { loop = !!v; },
      /** Follow an outside step change (template switch, loaded config) without emitting. */
      sync: (s) => { step = Math.max(0, Math.floor(s) || 0); t = 0; if (playing) { t0 = now(); from = step; } },
      state: () => ({ step, t, playing, speed, loop })
    };
  }

  function clampMs(ms) {
    ms = Number(ms);
    return Number.isFinite(ms) ? Math.max(MIN_MS, Math.min(MAX_MS, ms)) : 1200;
  }

  ADG.player = { create, MIN_MS, MAX_MS, clampMs };
})(window.ADG = window.ADG || {});
