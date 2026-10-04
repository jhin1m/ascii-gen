/* Config file / share payload / autosave: { version: 1, ...app state }. Validation is table-driven
   (FIELDS) and forward-compatible: only known keys are read, unknown keys are ignored, missing keys
   keep the current value. Content (actors, steps, layout, blocks) is checked for shape and size;
   block fields themselves are read through the blocks' own guards when rendering. */
(function (ADG) {
  const VERSION = 1;
  const MAX_FILE = 1024 * 1024;

  const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  const num = (lo, hi) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  const bool = (v) => (typeof v === 'boolean' ? v : undefined);
  const oneOf = (list) => (v) => (typeof v === 'string' && list().indexOf(v) >= 0 ? v : undefined);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  // ids become object keys: names of Object.prototype members would set the prototype instead
  const ID_RE = /^[A-Za-z0-9_-]{1,24}$/, PROTO = ['__proto__', 'constructor', 'prototype'];
  const ID = { test: (v) => typeof v === 'string' && ID_RE.test(v) && PROTO.indexOf(v) < 0 };
  const MAX_BLOCKS_JSON = 200 * 1024;
  const shortStr = (max) => (v) => typeof v === 'string' && v.length <= max;

  /** Array of 0..max items that all pass `ok`, or undefined. */
  const list = (max, ok) => (v) => (Array.isArray(v) && v.length <= max && v.every(ok) ? v : undefined);

  const actor = (a) => isObj(a) && ID.test(a.id) && shortStr(40)(a.name) && ADG.theme.COLOR_KEYS.indexOf(a.color) >= 0;
  const uniqueIds = (v) => (v && new Set(v.map((a) => a.id)).size === v.length ? v : undefined);
  const layoutItem = (it) => (typeof it === 'string' && ID.test(it)) || (isObj(it) && ID.test(it.block) && (it.w === undefined || (typeof it.w === 'number' && it.w > 0 && it.w <= 100)));
  const layoutRow = (r) => layoutItem(r) || (Array.isArray(r) && r.length >= 1 && r.length <= 4 && r.every(layoutItem));
  function blocks(v) {
    if (!isObj(v) || Object.keys(v).length > 40) return undefined;
    if (!Object.keys(v).every((k) => ID.test(k) && isObj(v[k]))) return undefined;
    return JSON.stringify(v).length <= MAX_BLOCKS_JSON ? v : undefined;
  }
  function colors(v) {
    if (!isObj(v)) return undefined;
    const ok = Object.keys(v).every((k) => ADG.theme.BASE_KEYS.indexOf(k) >= 0 && /^#[0-9a-f]{6}$/i.test(v[k]));
    return ok ? v : undefined;
  }

  /** key → validator returning the clean value, or undefined when invalid. */
  const FIELDS = {
    theme: oneOf(() => Object.keys(ADG.theme.THEMES)),
    border: oneOf(() => ['ascii', 'unicode']),
    cols: int(40, 200),
    step: int(0, 99),
    seed: int(0, 999999),
    template: oneOf(() => ADG.templateList.ids()),
    actors: (v) => uniqueIds(list(20, actor)(v)),
    steps: list(20, shortStr(40)),
    layout: list(40, layoutRow),
    blocks,
    colors,
    blink: bool,
    loop: bool,
    speed: int(300, 3000),
    win: oneOf(() => ADG.windowChrome.WINDOWS),
    chrome: bool,
    glow: bool,
    scanline: bool,
    font: oneOf(() => ADG.canvasOut.FONTS),
    size: num(6, 48),
    lineHeight: num(1, 3),
    credit: (v) => (typeof v === 'string' && v.length <= 60 ? v : undefined)
  };

  /** Versioned payload from the app state (known keys only). */
  function wrap(state) {
    const out = { version: VERSION };
    Object.keys(FIELDS).forEach((k) => { if (state && state[k] !== undefined) out[k] = state[k]; });
    return out;
  }

  /**
   * Validate an untrusted object and return the state patch it describes. With { lenient: true }
   * invalid keys are dropped instead of failing the whole object (autosave, undo).
   * @throws {Error} with a Vietnamese message when the shape or a value is invalid
   */
  function validate(obj, opts) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Cấu hình không hợp lệ (cần một đối tượng JSON).');
    if (!Number.isInteger(obj.version) || obj.version < 1) throw new Error('Cấu hình thiếu hoặc sai "version".');
    if (obj.version > VERSION) throw new Error('Cấu hình từ phiên bản mới hơn (v' + obj.version + '); hãy cập nhật trang.');
    const patch = {}, bad = [];
    Object.keys(FIELDS).forEach((k) => {
      if (!(k in obj)) return;
      const v = FIELDS[k](obj[k]);
      if (v === undefined) bad.push(k); else patch[k] = v;
    });
    if (bad.length && !(opts && opts.lenient)) throw new Error('Giá trị không hợp lệ: ' + bad.join(', ') + '.');
    // a step past the end of its own step list points at nothing
    if (Array.isArray(patch.steps) && patch.step !== undefined) patch.step = Math.max(0, Math.min(patch.steps.length - 1, patch.step));
    return patch;
  }

  /** @throws {Error} when text is not valid JSON or fails validate() */
  function parse(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('File không phải JSON hợp lệ.'); }
    return validate(obj);
  }

  /** Read a File chosen by the user (size-capped). @returns {Promise<string>} */
  async function readFile(file) {
    if (!file) throw new Error('Chưa chọn file.');
    if (file.size > MAX_FILE) throw new Error('File quá lớn (tối đa 1 MB).');
    return file.text();
  }

  /** Download the state as pretty-printed .json. @returns {string} file name */
  function download(state, template) {
    const name = 'ascii-dashboard-' + ADG.png.slug(template) + '.json';
    ADG.png.saveBlob(new Blob([JSON.stringify(wrap(state), null, 2) + '\n'], { type: 'application/json' }), name);
    return name;
  }

  ADG.configFile = { VERSION, FIELDS, wrap, validate, parse, readFile, download };
})(window.ADG = window.ADG || {});
