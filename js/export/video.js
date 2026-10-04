/* Video export path selection: WebCodecs + mp4-muxer (fast, exact MP4) when available, else
   MediaRecorder (real time; MP4 or WebM depending on the browser). */
(function (ADG) {
  /** What this browser will produce: { ok, path: 'webcodecs'|'recorder'|'', ext: 'mp4'|'webm'|'' }. */
  function capability() {
    if (ADG.videoWebCodecs.supported()) return { ok: true, path: 'webcodecs', ext: 'mp4' };
    const t = ADG.videoRecorder.pickType();
    if (t) return { ok: true, path: 'recorder', ext: /mp4/.test(t) ? 'mp4' : 'webm' };
    return { ok: false, path: '', ext: '' };
  }

  /**
   * @param {{ state, fps, scale, signal?, onProgress?, onPath?: (path:string) => void }} o
   * @returns {Promise<{ blob: Blob, ext: string, path: string }>}
   */
  async function exportVideo(o) {
    if (ADG.videoWebCodecs.supported()) {
      try {
        if (o.onPath) o.onPath('webcodecs');
        return { blob: await ADG.videoWebCodecs.exportMp4(o), ext: 'mp4', path: 'webcodecs' };
      } catch (e) {
        if (!e.fallback || (o.signal && o.signal.aborted)) throw e.fallback ? Object.assign(new Error('Đã huỷ.'), { name: 'AbortError' }) : e;
        console.warn('[ascii-gen] WebCodecs path unavailable, using MediaRecorder:', e.message);
      }
    }
    if (o.onPath) o.onPath('recorder');
    const blob = await ADG.videoRecorder.record(o);
    return { blob, ext: /mp4/.test(blob.type) ? 'mp4' : 'webm', path: 'recorder' };
  }

  ADG.video = { capability, exportVideo };
})(window.ADG = window.ADG || {});
