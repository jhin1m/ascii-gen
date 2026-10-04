/* Export dialog card for animations: GIF or video (MP4 via WebCodecs, else MediaRecorder MP4 /
   WebM), fps, scale, loop, size estimate, progress and cancel. The run replays every step from
   the first one at the player speed. Closing the dialog cancels a running export. */
(function (ADG) {
  const { h, byId } = ADG.dom;
  let api = null, fmt = 'gif', fps = 15, scale = 1, loop = true, job = null, els = null;

  const mb = (b) => (b / 1048576).toFixed(b < 1048576 ? 2 : 1) + ' MB';

  function info() {
    const s = api.getState(), steps = Math.max(1, (s.steps || []).length);
    const P = ADG.animFrames.plan(steps, s.speed, fps);
    const g = api.build().grid;
    const m = ADG.canvasOut.measure(g, Object.assign({}, s, { scale, template: api.template() }));
    const parts = [steps + ' bước × ' + (s.speed / 1000).toFixed(1) + ' s = ' + (P.durationMs / 1000).toFixed(1) + ' s', P.count + ' khung', m.width + '×' + m.height + ' px'];
    if (fmt === 'gif') parts.push('≈ ' + mb(ADG.gifExport.estimate(m.width, m.height, P.count)) + ' (ước tính)');
    const cap = ADG.video.capability();
    if (fmt === 'video') parts.push(cap.ok ? (cap.path === 'webcodecs' ? 'MP4 (WebCodecs)' : (cap.ext.toUpperCase() + ' · ghi theo thời gian thực')) : 'trình duyệt không hỗ trợ');
    return { text: parts.join(' · '), limit: m.limit, ok: fmt === 'gif' || cap.ok };
  }

  function seg(list, cur, set) {
    return h('div', { class: 'seg' }, list.map(([v, label]) => h('button', { type: 'button', class: 'btn', 'aria-pressed': String(v === cur), disabled: !!job, onclick: () => { set(v); draw(); } }, label)));
  }

  function draw() {
    if (!els) return;
    const i = info(), busy = !!job;
    const cap = ADG.video.capability();
    ADG.dom.replace(els.opts,
      h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Định dạng'),
        seg([['gif', 'GIF'], ['video', 'Video ' + (cap.ext ? cap.ext.toUpperCase() : '')]], fmt, (v) => { fmt = v; })),
      h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Khung/giây'), seg([[10, '10'], [15, '15'], [24, '24'], [30, '30']], fps, (v) => { fps = v; })),
      h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Tỉ lệ'), seg([[1, '1x'], [2, '2x']], scale, (v) => { scale = v; })),
      fmt === 'gif' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: loop, disabled: busy, onchange: (e) => { loop = e.target.checked; } }), ' Lặp vô hạn') : null);
    els.info.textContent = i.text + (i.limit ? '\n⚠ ' + i.limit : '');
    els.info.classList.toggle('warn', !!i.limit);
    els.go.textContent = busy ? 'Đang xuất…' : fmt === 'gif' ? 'Xuất GIF' : 'Xuất video';
    els.go.disabled = busy || !!i.limit || !i.ok;
    els.cancel.hidden = !busy;
    els.bar.hidden = !busy;
  }

  async function start() {
    if (job) return;
    const ctrl = new AbortController(), s = api.getState();
    job = ctrl;
    els.bar.value = 0;
    draw();
    const o = { state: s, fps, scale, loop, signal: ctrl.signal, onProgress: (d, n) => { els.bar.value = d / n; els.bar.textContent = Math.round((d / n) * 100) + '%'; } };
    const t0 = performance.now(), base = 'ascii-dashboard-' + ADG.png.slug(api.template());
    try {
      let blob, ext;
      if (fmt === 'gif') { blob = await ADG.gifExport.exportGif(o); ext = 'gif'; }
      else ({ blob, ext } = await ADG.video.exportVideo(o));
      ADG.png.saveBlob(blob, base + '.' + ext);
      api.toast('Đã tải ' + base + '.' + ext + ' · ' + mb(blob.size) + ' · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s', 'ok');
    } catch (e) {
      api.toast(e.name === 'AbortError' ? 'Đã huỷ xuất animation.' : 'Không xuất được: ' + e.message, e.name === 'AbortError' ? 'ok' : 'error');
    } finally {
      job = null;
      draw();
    }
  }

  function init(dialogApi) {
    api = dialogApi;
    const root = byId('export-motion');
    els = {
      opts: h('div', { class: 'stack' }),
      info: h('div', { class: 'mono mut motion-info' }),
      go: h('button', { type: 'button', class: 'btn btn-primary', onclick: start }),
      cancel: h('button', { type: 'button', class: 'btn', hidden: true, onclick: () => job && job.abort() }, 'Huỷ'),
      bar: h('progress', { max: 1, value: 0, hidden: true, 'aria-label': 'Tiến độ xuất animation' })
    };
    ADG.dom.replace(root, h('h3', null, 'Animation · GIF / video'), els.opts, els.info, els.bar, h('div', { class: 'opt-row' }, els.go, els.cancel),
      h('p', { class: 'mut small' }, 'Chạy lại từ bước 1 tới hết theo tốc độ đang chọn. Firefox xuất WebM.'));
    root.hidden = false;
  }

  ADG.exportMotion = {
    init,
    refresh: () => { if (!job) draw(); },
    cancel: () => { if (job) job.abort(); }
  };
})(window.ADG = window.ADG || {});
