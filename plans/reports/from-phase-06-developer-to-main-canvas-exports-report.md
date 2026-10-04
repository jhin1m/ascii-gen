# Phase 6 report: canvas output and exports

Status: DONE_WITH_CONCERNS. `node tests/run.js`: 134 passed, 0 failed (16 new tests; the rest includes the flow agent's tests, green at the time of the final run).

## Files
Created: `js/output/window-chrome.js`, `canvas-chrome.js`, `canvas-renderer.js`; `js/export/png.js`, `plain-text.js`, `config-file.js`, `share-link.js`; `js/ui/export-dialog.js`; `tests/plain-text.test.js`, `tests/share-link.test.js`.
Modified: `index.html` (Xuất button, dialog markup, toast, new script tags only; the flow-* tags are untouched), `style.css` (appended), `js/app.js` (rewritten bootstrap).
`tests/run.js` is unchanged.

## Coordination note (phase 5)
I created `js/output/window-chrome.js` (`ADG.windowChrome`), DOM-free. It holds geometry in em of fontSize for none/macos/windows/ubuntu/crt, plus `PAD`, `MARGIN`, `SHADOW`, `titles()` and `layout(spec, gridW, gridH, e)`. Canvas draws from it. Phase 5 should reuse `spec()/titles()/PAD` for the HTML chrome and must not recreate the file.

## Decisions
- Cell width comes from `measureText('M')` at the base font size, then `ctx.scale(scale)`. PNG size is therefore exactly scale × the 1x size. Row height is `lineHeight × size` and the baseline uses `fontBoundingBox` ascent/descent. Background runs are pixel-snapped so rows show no seams.
- Frame margin is 1.6em of transparent space for shadow, applied to every framed window including CRT. No-chrome has margin 0.
- Glow sets `shadowBlur` only when on, and updates it only on colour change. Scanline alpha is 0.06 on light backgrounds (luminance > 0.5), otherwise 0.22. Blink cells are drawn static.
- API split: `canvasOut.ensureFont`, `measure` and `draw` (sync, reusable canvas for phase 7 frames), plus `renderCanvas` (async, waits for the font then draws).
- Config / share payload is `{version:1, ...state}`. Validation is table-driven (`ADG.configFile.FIELDS`), strict on invalid values, tolerant of unknown or missing keys, and rejects a version newer than 1. Phase 5 extends `FIELDS`. Keys now: theme, border, cols (40..200), step, win, chrome, glow, scanline, font, size, lineHeight, credit.
- Share link: pure-JS base64url (no `btoa`), a 1 MB cap on decompressed size, `SHARE_BASE=''`. Under `file://` the link uses the full current URL plus the "chỉ mở được trên máy này" warning. The >8 KB warning is also implemented.
- The hash is applied at init and on `hashchange`; an invalid hash gives an error toast and the app keeps working. There is no localStorage yet, so "hash wins over localStorage" is untestable until phase 5.
- `ADG.png.saveBlob` is the shared download helper; `configFile.download` uses it.
- `#export-motion` is an empty hidden section for phase 7 to fill.
- Font, size and lineHeight in state also drive the HTML preview through the `--adg-*` CSS variables, so the PNG matches the preview font.

## Deviations
- The dialog has no live thumbnail like the mockup. YAGNI; the size line and filename are shown instead.
- The sync test harness does not await promises, so I wrote no async tests. Deflate/inflate was verified with a scratch Node script and in Chrome. Tests cover the pure parts: base64url vs Node `Buffer`, URL building, warnings, config validation, window layout, plain text.
- I did not use a `<dialog>` element; it is a div with `role=dialog`, a focus trap, Esc and backdrop close.

## Verified
- In headless Chrome (CDP-less, via `--dump-dom` and `--screenshot`): the app page loads with 0 console errors, and the dialog opens with a size line (1595×2838 at 2x, 96 cols), share URL, 70-line text preview and a 0.2 KB link.
- `#c=<valid>` applies dracula, cols 100 and the other fields, with an ok toast. `#c=AAAA` gives an error toast and the app keeps working.
- 4 window styles plus no-chrome render with correct bars, bezel, foot, glow and scanline (screenshot checked). A 3x 96-col render took about 8 ms of draw time (2393×4257 px, 0.9 MB PNG blob).

## Not verified
- Actual file downloads (PNG/.json) and the clipboard in a real, interactive browser.
- Pixel comparison of the PNG against the HTML preview with the real web fonts. The Google Fonts offline fallback was used, so VT323, IBM Plex and Fira metrics are unchecked.
- `file://` opening, Safari and Firefox.
- Mid-session, the python `http.server` with headless Chrome intermittently dropped script loads (blocks/templates undefined). Bundling the scripts in a scratch page made it deterministic. It is a test-rig artefact: the final plain-server run of the real page had 0 errors.

## Concerns
- `window-chrome` HTML-side parity (phase 5) is untested; the em numbers come from the mockup but only the canvas uses them so far.
- The earlier 23 test failures seen mid-session came from the parallel flow work and cleared by themselves. I confirmed by running the baseline without my files that they were not mine.

Status: DONE_WITH_CONCERNS

## Review fixes
- M2: `loadFromHash` clears `#c=` via `history.replaceState` (pathname + search kept, try/catch) before decoding, success or failure; a sequence number drops a stale decode that resolves after a newer link.
- M3: `ADG.canvasOut.checkSize(w, h)` (pure) enforces side <= 16384 and area <= 16,777,216 px with Vietnamese messages. `measure()` returns `limit`; `draw()` throws it, and a null 2D context now throws a clear message. The dialog shows the reason under the size line (warn colour), disables Tải PNG, and disables other scales that exceed the limit (the tooltip gives the reason).
- Low: Copy link is cleared and disabled while a new link is built; the double refresh on dialog change is removed (`app.setState` refreshes); the cols dropdown replaces its single custom option instead of accumulating.
- Test added: size/area guard in `tests/share-link.test.js`. `node tests/run.js`: 135 passed, 0 failed.
- Browser check (headless Chrome): hash applied and cleared (`hash=""`, theme=dracula); font 40px at 2x showed 48.1 MP with the warning, Tải PNG disabled, and 3x disabled while 1x/2x stayed enabled.

Status: DONE
