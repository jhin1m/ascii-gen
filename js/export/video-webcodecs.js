/* MP4 through WebCodecs (H.264) + mp4-muxer. The muxer is the only script loaded from the
   network, lazily and pinned, the first time an MP4 is exported; a failed or slow load (8 s)
   rejects so the caller can fall back to MediaRecorder. Timestamps come from the frame index,
   so the video is exact however long encoding takes. */
(function (ADG) {
  const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js';
  // Subresource Integrity of that exact file: a changed CDN response is refused, not executed
  const MUXER_SRI = 'sha384-wr0AQH9RBAKio/g7bHM5245MBCU5B/b0Y9u42cTxRYQQJXKEijZvWEJKL9JG26hs';
  const LOAD_TIMEOUT = 8000;
  // H.264 profiles from widely supported to high-resolution capable
  const CODECS = ['avc1.42001f', 'avc1.4d0028', 'avc1.640028', 'avc1.640033', 'avc1.42003e', 'avc1.640034'];
  let loading = null;

  function loadMuxer() {
    if (window.Mp4Muxer) return Promise.resolve(window.Mp4Muxer);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const timer = setTimeout(() => { s.remove(); reject(new Error('Tải mp4-muxer quá lâu.')); }, LOAD_TIMEOUT);
      s.src = MUXER_URL; s.async = true; s.crossOrigin = 'anonymous'; s.integrity = MUXER_SRI;
      s.onload = () => { clearTimeout(timer); window.Mp4Muxer ? resolve(window.Mp4Muxer) : reject(new Error('mp4-muxer không khởi tạo được.')); };
      s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('Không tải được mp4-muxer (mạng?).')); };
      document.head.appendChild(s);
    }).catch((e) => { loading = null; throw e; });
    return loading;
  }

  /** First supported H.264 config for this size, or null. */
  async function pickConfig(width, height, fps) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
    const bitrate = Math.min(12e6, Math.max(1e6, width * height * fps * 0.12));
    for (const codec of CODECS) {
      const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch (e) { /* try the next profile */ }
    }
    return null;
  }

  const supported = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

  /**
   * @param {{ state, fps, scale, signal?, onProgress? }} o
   * @returns {Promise<Blob>} video/mp4; rejects with { fallback: true } when this path cannot run
   */
  async function exportMp4(o) {
    const fallback = (msg) => Object.assign(new Error(msg), { fallback: true });
    if (!supported()) throw fallback('Trình duyệt không có WebCodecs.');
    const aborted = () => { if (o.signal && o.signal.aborted) { const e = new Error('Đã huỷ.'); e.name = 'AbortError'; throw e; } };
    let Mux;
    try { Mux = await loadMuxer(); } catch (e) { aborted(); throw fallback(e.message); }
    aborted(); // cancelled while the muxer was loading
    let muxer = null, encoder = null, failure = null, fps = 15, frames = 0;
    try {
      await ADG.animFrames.run({
        state: o.state, fps: o.fps, scale: o.scale, even: true, signal: o.signal, onProgress: o.onProgress,
        async onStart(canvas, plan) {
          fps = plan.fps;
          const config = await pickConfig(canvas.width, canvas.height, fps);
          if (!config) throw fallback('Không có cấu hình H.264 cho ' + canvas.width + '×' + canvas.height + '.');
          muxer = new Mux.Muxer({ target: new Mux.ArrayBufferTarget(), video: { codec: 'avc', width: canvas.width, height: canvas.height }, fastStart: 'in-memory' });
          const out = (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { failure = failure || e; } };
          encoder = new VideoEncoder({ output: out, error: (e) => { failure = failure || e; } });
          encoder.configure(config);
          aborted();
        },
        async onFrame(canvas, i) {
          // an encoder that fails before producing anything: let the recorder try instead
          if (failure) throw frames ? failure : fallback(failure.message || String(failure));
          const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
          try { encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); } finally { frame.close(); }
          frames++;
          while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5)); // back-pressure
        }
      });
      await encoder.flush();
      if (failure) throw failure;
      muxer.finalize();
      return new Blob([muxer.target.buffer], { type: 'video/mp4' });
    } finally {
      if (encoder && encoder.state !== 'closed') try { encoder.close(); } catch (e) { /* already closed */ }
    }
  }

  ADG.videoWebCodecs = { MUXER_URL, supported, loadMuxer, pickConfig, exportMp4 };
})(window.ADG = window.ADG || {});
