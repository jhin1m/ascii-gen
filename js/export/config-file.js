/* Config file / share payload: { version: 1, ...app state }. Validation is table-driven (FIELDS) and
   forward-compatible: only known keys are read, unknown keys are ignored, missing keys keep the
   current value. Later phases extend FIELDS instead of changing the format. */
(function (ADG) {
  const VERSION = 1;
  const MAX_FILE = 1024 * 1024;

  const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  const num = (lo, hi) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  const bool = (v) => (typeof v === 'boolean' ? v : undefined);
  const oneOf = (list) => (v) => (typeof v === 'string' && list().indexOf(v) >= 0 ? v : undefined);

  /** key → validator returning the clean value, or undefined when invalid. */
  const FIELDS = {
    theme: oneOf(() => Object.keys(ADG.theme.THEMES)),
    border: oneOf(() => ['ascii', 'unicode']),
    cols: int(40, 200),
    step: int(0, 99),
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
   * Validate an untrusted object and return the state patch it describes.
   * @throws {Error} with a Vietnamese message when the shape or a value is invalid
   */
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Cấu hình không hợp lệ (cần một đối tượng JSON).');
    if (!Number.isInteger(obj.version) || obj.version < 1) throw new Error('Cấu hình thiếu hoặc sai "version".');
    if (obj.version > VERSION) throw new Error('Cấu hình từ phiên bản mới hơn (v' + obj.version + '); hãy cập nhật trang.');
    const patch = {}, bad = [];
    Object.keys(FIELDS).forEach((k) => {
      if (!(k in obj)) return;
      const v = FIELDS[k](obj[k]);
      if (v === undefined) bad.push(k); else patch[k] = v;
    });
    if (bad.length) throw new Error('Giá trị không hợp lệ: ' + bad.join(', ') + '.');
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
