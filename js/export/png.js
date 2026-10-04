/* PNG export helpers + the generic "save a Blob as a file" used by every download. */
(function (ADG) {
  const slug = (s) => String(s || 'dashboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'dashboard';

  function fileName(template, scale) { return 'ascii-dashboard-' + slug(template) + '-' + scale + 'x.png'; }

  function sizeLabel(width, height) { return width + ' × ' + height + ' px'; }

  function toBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh PNG (ảnh quá lớn?)'))), 'image/png');
    });
  }

  /** Trigger a download of `blob` as `name`. */
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /** Render the grid to a PNG file and download it. @returns {Promise<string>} the file name */
  async function exportPng(grid, pal, opts, template) {
    const canvas = await ADG.canvasOut.renderCanvas(grid, pal, Object.assign({}, opts, { template }));
    const blob = await toBlob(canvas);
    const name = fileName(template, ADG.canvasOut.normalize(opts).scale);
    saveBlob(blob, name);
    return name;
  }

  ADG.png = { fileName, sizeLabel, toBlob, saveBlob, exportPng, slug };
})(window.ADG = window.ADG || {});
