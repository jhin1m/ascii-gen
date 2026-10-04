/* Video fallback: canvas.captureStream(0) + MediaRecorder. Frames are pushed with
   track.requestFrame() at real-time pace (the recorder timestamps by wall clock), so this path
   takes as long as the animation itself. MP4 when the browser records it (Safari, recent
   Chrome), otherwise WebM (Firefox). */
(function (ADG) {
  const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

  /** Best recordable type, or '' when MediaRecorder / captureStream are missing. */
  function pickType() {
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return '';
    return TYPES.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }

  const supported = () => !!pickType();

  /**
   * @param {{ state, fps, scale, signal?, onProgress? }} o
   * @returns {Promise<Blob>} recorded video (type tells mp4 / webm)
   */
  async function record(o) {
    const type = pickType();
    if (!type) throw new Error('Trình duyệt không ghi được video từ canvas.');
    let rec = null, track = null, start = 0, frameMs = 66, stopped = null, failed = null;
    const chunks = [];
    try {
      await ADG.animFrames.run({
        state: o.state, fps: o.fps, scale: o.scale, even: true, signal: o.signal, onProgress: o.onProgress,
        onStart(canvas, plan) {
          frameMs = plan.frameMs;
          const stream = canvas.captureStream(0);
          track = stream.getVideoTracks()[0];
          rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 });
          rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
          // listen before starting: a recorder that fails mid-way stops on its own
          stopped = new Promise((resolve) => { rec.onstop = resolve; });
          rec.onerror = (e) => { failed = new Error('Ghi video lỗi: ' + ((e && e.error && e.error.message) || 'không rõ')); };
          rec.start();
          start = performance.now();
        },
        async onFrame(canvas, i) {
          if (failed) throw failed;
          if (rec.state === 'inactive') throw new Error('Trình duyệt dừng ghi video giữa chừng (khung hình quá lớn?).');
          if (track.requestFrame) track.requestFrame();
          const due = start + (i + 1) * frameMs - performance.now(); // hold each frame for its real duration
          if (due > 0) await new Promise((r) => setTimeout(r, due));
        }
      });
      if (rec.state !== 'inactive') rec.stop();
      await Promise.race([stopped, new Promise((r) => setTimeout(r, 5000))]); // never hang on a lost stop event
      if (failed) throw failed;
      if (!chunks.length) throw new Error('Không ghi được dữ liệu video.');
      return new Blob(chunks, { type: type.split(';')[0] });
    } catch (e) {
      if (rec && rec.state !== 'inactive') rec.stop();
      throw e;
    } finally {
      if (track) track.stop();
    }
  }

  ADG.videoRecorder = { pickType, supported, record };
})(window.ADG = window.ADG || {});
