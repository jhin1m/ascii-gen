/* App bootstrap: state store, autosave, share-link hash, player, header controls, editor panel,
   preview and export dialog. Boot order: template defaults ← autosave (sync) ← share link (async,
   wins). Rendering always reads the player's live position, so edits made while playing never
   flash a paused frame. */
(function (ADG) {
  const { byId } = ADG.dom;
  let store, player, selected = null, lastRender = { skipped: [] }, skippedKey = '[]', queued = false;
  const after = [];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const toast = (...a) => ADG.exportDialog.toast(...a);

  function blockOf(key) {
    const blocks = store.get().blocks, cfg = isObj(blocks) && Object.prototype.hasOwnProperty.call(blocks, key) ? blocks[key] : null;
    if (!isObj(cfg)) return null;
    const type = typeof cfg.type === 'string' ? cfg.type : key, def = ADG.blocks.get(type);
    return def ? { key, type, def, cfg } : null;
  }

  /** Content an auto block shows right now (before tokens and seed variation). */
  function generated(key) {
    const cfg = JSON.parse(JSON.stringify(ADG.store.toConfig(store.get())));
    ADG.generators.apply(cfg);
    return cfg.blocks[key];
  }

  function flowKey() {
    const s = store.get();
    for (const row of s.layout || []) {
      for (const it of Array.isArray(row) ? row : [row]) {
        const k = typeof it === 'string' ? it : it && it.block, b = k && blockOf(k);
        if (b && b.type === 'flow') return k;
      }
    }
    return null;
  }

  const setBlock = (key, cfg) => store.set({ blocks: Object.assign({}, store.get().blocks, { [key]: cfg }) });

  const api = {
    get: () => store.get(),
    set: (p) => store.set(p),
    setBlock, blockOf, generated, flowKey, toast,
    /** Hand edit: an auto block keeps what it generated, then turns manual. */
    editBlock(key, fields) {
      const b = blockOf(key);
      if (!b) return;
      setBlock(key, Object.assign({}, b.cfg.auto === true ? generated(key) : b.cfg, fields, { auto: false }));
    },
    regenerate(key) { const b = blockOf(key); if (b) setBlock(key, Object.assign({}, b.cfg, { auto: true })); },
    selected: () => selected,
    select(key) {
      selected = key;
      update(store.get(), { selected: true });
      const b = blockOf(key);
      ADG.panel.reveal(b && b.type === 'flow' ? 'flow-sect' : 'block-sect');
    },
    lastRender: () => lastRender,
    afterRender: (fn) => { after.push(fn); }
  };

  let update = () => {};

  /** Draw the player's current frame (coalesced to one per animation frame). */
  function requestRender() {
    if (queued) return;
    queued = true;
    // a hidden tab never runs animation frames: edits made there (or a share link opened in a
    // background tab) must still reach the preview
    const later = document.hidden ? (fn) => setTimeout(fn, 16) : requestAnimationFrame;
    later(() => { queued = false; renderNow(); });
  }

  function renderNow() {
    const p = player.state(), s = store.get();
    const res = ADG.preview.render(s, p.playing ? p.step : s.step, p.t, p.playing);
    lastRender = res.out;
    const key = JSON.stringify(res.out.skipped);
    if (key !== skippedKey) { skippedKey = key; update(s, { render: true }); }
    after.splice(0).forEach((fn) => fn());
  }

  function syncHeader(s, changed) {
    const p = player.state(), n = (s.steps || []).length;
    const step = p.playing ? p.step : s.step;
    byId('step-label').textContent = n ? (step + 1) + '/' + n + ' · ' + s.steps[step] : '—';
    byId('play').textContent = p.playing ? 'Dừng' : 'Phát';
    byId('play').setAttribute('aria-pressed', String(p.playing));
    if (!changed || changed.speed) {
      byId('speed').value = String(ADG.player.MAX_MS + ADG.player.MIN_MS - s.speed); // right = faster
      byId('speed-label').textContent = (s.speed / 1000).toFixed(1) + ' s/bước';
    }
    if (!changed || changed.loop) byId('loop').checked = s.loop;
    if (!changed || changed.template) byId('template-select').value = s.template;
  }

  function onChange(s, changed) {
    if ((changed.steps || changed.step) && player.state().step !== s.step) player.sync(s.step);
    if (changed.speed) player.setSpeed(s.speed);
    if (changed.loop) player.setLoop(s.loop);
    update(s, changed);
    syncHeader(s, changed);
    requestRender();
    ADG.storage.save(s);
    ADG.exportDialog.refresh();
  }

  /** Paused frame at the current step, for the export dialog. */
  function build() {
    const s = store.get(), out = ADG.frame.renderFrame(ADG.store.toConfig(s), s.step, 0, { playing: false });
    return { grid: out.grid, pal: ADG.store.palette(s), cols: out.cols, rows: out.rows };
  }

  function switchTemplate(id) {
    const before = ADG.configFile.wrap(store.get());
    selected = null;
    store.set(ADG.templateList.content(id));
    toast('Đã chuyển sang ' + ADG.templateList.label(id), 'ok', { label: 'Hoàn tác', run: () => store.set(ADG.configFile.validate(before)) });
  }

  async function shareQuick() {
    try {
      const link = await ADG.share.createLink(ADG.configFile.wrap(store.get()), window.location);
      const ok = await ADG.plainText.copy(link.url);
      toast((ok ? 'Đã copy share link' : 'Không copy được — mở Xuất để lấy link') + (link.warnings.length ? ' · ' + link.warnings[0] : ''), ok && !link.warnings.length ? 'ok' : 'error');
    } catch (e) { toast('Không tạo được link: ' + e.message, 'error'); }
  }

  let hashSeq = 0;
  /** Apply a config from the URL hash (#c=...). The hash wins over autosave. */
  async function loadFromHash() {
    const token = ADG.share.readHash(window.location.hash);
    if (!token) return;
    const mine = ++hashSeq;
    // drop the hash right away so a reload never re-applies it over later edits
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* some file:// contexts forbid it */ }
    try {
      const patch = ADG.configFile.validate(await ADG.share.decode(token));
      if (mine !== hashSeq) return; // a newer link was opened meanwhile
      selected = null;
      store.set(patch);
      toast('Đã mở cấu hình từ share link', 'ok');
    } catch (e) {
      if (mine === hashSeq) toast('Share link không hợp lệ: ' + e.message, 'error');
    }
  }

  function wireHeader() {
    const sel = byId('template-select');
    ADG.templateList.ids().forEach((id) => sel.add(new Option(ADG.templateList.label(id), id)));
    sel.addEventListener('change', () => switchTemplate(sel.value));
    byId('play').addEventListener('click', () => player.toggle());
    byId('prev').addEventListener('click', () => player.prev());
    byId('next').addEventListener('click', () => player.next());
    byId('speed').addEventListener('input', (e) => store.set({ speed: ADG.player.MAX_MS + ADG.player.MIN_MS - Number(e.target.value) }));
    byId('loop').addEventListener('change', (e) => store.set({ loop: e.target.checked }));
    byId('randomize').addEventListener('click', () => store.set({ seed: 1 + Math.floor(Math.random() * 99998) }));
    byId('share-quick').addEventListener('click', shareQuick);
  }

  function init() {
    const initial = Object.assign({}, ADG.store.VIEW_DEFAULTS, ADG.templateList.content('agent-pipeline'));
    const saved = ADG.storage.load(); // synchronous, before the hash: a share link must win
    if (saved) Object.assign(initial, saved);
    store = ADG.store.create(initial);
    player = ADG.player.create({
      steps: () => (store.get().steps || []).length, step: initial.step, speed: initial.speed, loop: initial.loop,
      onFrame: (step, t, playing) => {
        if (step !== store.get().step) store.set({ step }); else requestRender();
        syncHeader(store.get(), { step: true });
      }
    });
    ADG.exportDialog.init({ getState: () => store.get(), setState: (p) => store.set(p), build, template: () => store.get().template });
    const panelUpdate = ADG.panel.mount(api);
    const previewUpdate = ADG.preview.mount(api);
    update = (s, changed) => { panelUpdate(s, changed); previewUpdate(s, changed); };
    wireHeader();
    syncHeader(store.get());
    store.subscribe(onChange);
    renderNow();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ADG.preview.invalidate(); requestRender(); });
    loadFromHash();
    window.addEventListener('hashchange', loadFromHash);
    window.addEventListener('pagehide', () => ADG.storage.saveNow(store.get()));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.ADG = window.ADG || {});
