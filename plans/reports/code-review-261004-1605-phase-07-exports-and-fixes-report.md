# Code Review: 894ce64 (phase 7 GIF/video export), a5d96e3 (phase-5 review fixes), cdac0a8 (QA matrix, dashed boxes)

## Scope
- 894ce64: js/export/{animation-frames,gif-encoder,gif-palette,gif-export,video-webcodecs,video-recorder,video}.js, js/ui/export-motion.js, export-dialog.js, canvas-renderer.js, tests/gif-encoder.test.js (+702)
- a5d96e3: app.js, dom.js, panel.js, data-source-form.js, layout-list.js, flow-editor.js, json-tab.js, schema-form.js, style-tab.js, preview.js, list-codec.js, config-file.js, storage.js, export-dialog.js, table.js (+391/-80)
- cdac0a8: js/core/qa-matrix.js, side-column.js, agent-pipeline.js, index.html (+44)
- Tests: `node tests/run.js` gives 168 passed, 0 failed
- File size: all files are under 300 lines. The largest are app.js (218) and export-dialog.js (193).
- Probes I ran in Node (vm loader, same as the tests):
  - Grid size per step at t=0 compared with t∈(0,1) for every template: identical, so sizing the canvas from t=0 is safe.
  - GIF palette size: 256 for all 7 themes. It is always truncated: 30 base colours × 15 → 450 candidates.
  - Delay carry over 10 s: exact 1000 cs at 10/15/24/30 fps. It drifts to 1200 cs at 60 fps.
  - LZW: the round-trip test covers more than 4096 codes (clear-code path). The code-size bump timing matches omggif and Weiner.

## Overall Assessment
The GIF encoder is correct and compact:
- The LZW, the GCE/descriptor packing, the NETSCAPE block, the diff bbox and the merging of identical frames are all right.
- The delay carry keeps the total duration exact.
- Buffers are reused or copied correctly.

WebCodecs cleanup is mostly sound: frames are closed, the encoder is closed in `finally`, and errors are surfaced at the next frame.

The weak spots:
- **(a)** The MediaRecorder path can hang forever and leave the motion card stuck in "busy".
- **(b)** The new `dom.section` focusout redraw reintroduces the phase-5 H3 click-swallow, because it bypasses the pointer-down deferral.
- Several guardrails are missing: no SRI on the CDN script, an abort that does nothing during the muxer load, no cap on GIF size or time, and background-tab timing in the real-time recorder.

## Critical
None. No data exposure. The only third-party code is the pinned muxer (see M1).

## High

### H1. MediaRecorder path can await a `stop` event that already fired: export stuck "busy" forever
- **Where:** `js/export/video-recorder.js:25,44-46`. `stopped()` attaches `rec.onstop` only after all frames are done, and `rec.onerror` is never handled.
- **Scenario:**
  1. The canvas is large (2x, 120 cols, CRT chrome). `pickConfig` finds no H.264 level, so `video.js` falls back to the recorder.
  2. The recorder's encoder fails on the same resolution. MediaRecorder fires `error` and then `stop`, and its state becomes `inactive`.
  3. Frames keep being pushed in real time (up to 60 s).
  4. `rec.stop()` on an inactive recorder is a no-op per the current spec, so `await done` never resolves.
  5. `job` is never cleared. Cancel and closing the dialog only call `abort()`, which nothing observes after `run()`.
  6. The card stays on "Đang xuất…" until the page is reloaded.
- **Fix:**
  - Create the stop promise in `onStart`, right after `new MediaRecorder`: `stopP = new Promise(r => rec.addEventListener('stop', r, { once: true }))`.
  - Add `rec.onerror = (e) => { failure = e.error || new Error('MediaRecorder lỗi'); }`.
  - In `onFrame`, `if (failure || rec.state === 'inactive') throw failure || ...`.
  - At the end: `if (rec.state !== 'inactive') rec.stop(); await stopP;`.

### H2. The `dom.section` focusout redraw rebuilds a section while the pointer is down: the H3 click-swallow is back
- **Where:**
  - `js/ui/dom.js:63-65`: `focusout → setTimeout(0) → draw()` when stale.
  - `js/app.js:68-82`: the `pointerDown` deferral only covers `queueUi`.
- **Scenario (block form):**
  1. Edit field A and press Tab to field B. The commit's redraw is deferred because `typing()` is true, so `stale` = true.
  2. Type in B, then click a button or checkbox in the same form ("Hiển thị", ↺).
  3. mousedown moves focus, `focusout` fires, the timer runs while the button is still held, and `typing()` is false, so `draw()` replaces the button before mouseup. The click goes to the common ancestor and the handler never runs.
  4. Safari is worse: buttons do not take focus, so focus drops to `<body>` and the result is the same.
- **Also reachable:** pressing Enter in a text input commits without blur (stale), followed by any click in that section. The same applies to layout-list and style-tab, which use `section` too.
- **Fix:** route the stale redraw through the same gate. Either expose the flag (e.g. `ADG.dom.pointerIsDown()`) and in the focusout timer re-queue on `pointerup` when it is set, or have `section` call back into `queueUi`.
- **Test:** edit a block title, Tab, type, then click the "Hiển thị" checkbox in Chrome and in Safari.

## Medium

### M1. Third-party script injected without Subresource Integrity
- **Where:** `js/export/video-webcodecs.js:16-21`.
- **Problem:** the script runs with full page privileges (it can read localStorage autosaves and share links). The version is pinned, but there is no `integrity`, so a compromised CDN or mirror response executes arbitrary code. `crossOrigin='anonymous'` is already set, so SRI costs one line.
- **Fix:** `s.integrity = 'sha384-<hash of build/mp4-muxer.js@5.2.2>'`. A mismatch fires `onerror`, which already falls back to MediaRecorder.

### M2. Cancel is ignored for up to 8 s during the muxer load (and during the H.264 probe)
- **Where:** `video-webcodecs.js:47` (`await loadMuxer()`), `:54` (`pickConfig`). The signal is first checked at frame 0 in `animation-frames.js:58`.
- **Scenario:** on a slow network, the user presses Huỷ or closes the dialog. Nothing happens for up to 8 s. If the load then fails, `video.js` falls back and starts a MediaRecorder (`onStart` runs `rec.start()`) before the abort is noticed.
- **Fix:**
  - Race the load against the signal: `await Promise.race([loadMuxer(), aborted(o.signal)])`.
  - Check `o.signal.aborted` in `video.js` before falling back.
  - Check it in `animation-frames.run` before `onStart`.

### M3. Real-time recorder breaks in background tabs
- **Where:** `video-recorder.js:40-41`. `setTimeout` pacing plus wall-clock MediaRecorder timestamps.
- **Scenario:** the user switches tabs during a 10–60 s WebM/MP4 recording.
  - Hidden-tab timers clamp to at least 1 s, and to 1/min under intensive throttling, so each frame is held for at least 1 s.
  - When the tab is shown again, `due` is negative for the backlog, so frames are pushed in a burst.
  - Chrome may also stop compositing canvas capture while the tab is hidden.
  - The result is a stretched, stuttering video with no warning. (The `MessageChannel` tick is not throttled, but the pacing timer is.)
- **Fix:**
  - On `visibilitychange` → hidden, abort with a clear message ("Giữ tab mở khi ghi video") or pause the clock: subtract the hidden time from `start` and skip `requestFrame` while hidden.
  - Show the "keep this tab visible" hint in `export-motion` when `path === 'recorder'`.

### M4. No guardrail on GIF size or time: memory and runtime blowup at large settings
- **Where:** `gif-export.js:5-7` (estimate shown, never enforced), `gif-encoder.js:7-22`.
- **Problem:** the output buffer doubles, and `out()` slices it, so peak memory is about 3× the file. The worst case the UI allows:
  - 20 steps × 3 s × 30 fps = 1800 frames.
  - 2x, 120 cols, about 2200×2000 px.
  - The estimate is about 95 MB, and encoding takes many minutes (10.9 s for 126 frames at 1x in Chrome).
  - Every frame also allocates a fresh `getImageData` (17 MB at this size, up to 67 MB at MAX_AREA).
- **Fix:**
  - Disable "Xuất GIF" when `estimate > ~40 MB` or `frames × W × H` exceeds a budget, with "giảm fps/tỉ lệ/số bước".
  - Show an ETA based on the measured ms/frame after the first 5 frames.

### M5. The WebCodecs path has no fallback for encoder errors, and muxer exceptions are swallowed
- **Where:** `video-webcodecs.js:57` (`output: muxer.addVideoChunk`) and `:61,69` (`failure` is rethrown without `fallback: true`).
- **Problem 1:** `isConfigSupported` returning true does not guarantee the hardware encoder starts. A failure at the first `encode` surfaces as an error toast instead of falling back to MediaRecorder.
- **Problem 2:** if `addVideoChunk` throws (e.g. a timestamp or metadata issue), the exception is an uncaught error inside the WebCodecs callback. `failure` is never set, and `finalize()` writes a truncated or broken MP4 that is reported as success.
- **Fix:**
  - `output: (c, m) => { try { muxer.addVideoChunk(c, m); } catch (e) { failure = failure || e; } }`.
  - Mark encoder errors that happen before the first output chunk as `fallback: true`.

### M6. M2 from the phase-5 review is only partly fixed: lenient load drops keys silently with no backup
- **Where:** `storage.js:19-21` copies the raw value to `adg:v1:bad` only when `validate` *throws*. In lenient mode, invalid keys are dropped without a throw (`config-file.js:86`).
- **Scenario:** list textareas push `blocks` JSON past 200 KB (still possible; the UI caps only the block count).
  1. On reload, `blocks` is dropped and layout, actors and steps are kept.
  2. The next debounced save overwrites the slot.
  3. Every block config (flow DSL, node data) is gone with no copy.
- **Fix:**
  - Have `validate(..., {lenient})` report the dropped keys, e.g. return `patch.__dropped` or take an `onDrop` callback.
  - When any key is dropped, write the `:bad` copy and toast "Một phần bản lưu không hợp lệ (blocks) — đã sao lưu".
  - Optionally, have `storage.save` validate before writing and warn when the size cap is near.

## Low
- **L1:** `export-motion.js` shows "MP4 (WebCodecs)" whenever `VideoEncoder` exists (`video.js:6`), but the H.264 probe or CDN can still send the export to the recorder: real time, and WebM on Firefox 130+. `exportVideo` accepts `onPath`, but export-motion never passes it, so the user isn't told about the switch. Pass `onPath` and update the info line and the button.
- **L2:** the delay carry drifts at fps above 50: `Math.max(2, …)` pushes `carry` negative forever (60 fps gives 1200 cs per 10 s). This is unreachable from the UI (10/15/24/30), but `plan()` accepts up to 60. Clamp GIF fps to ≤ 50 or reset `carry` when it goes below -1.
- **L3:** the palette is truncated at 256, so the 5/8–7/8 bg blends are dropped for later base colours: worst miss is 36 (a3, midnight), and the windows title bar (`barMix` 0.3) is not exact. The CRT gradient bands, as the plan accepts. Cheap improvement: add the title-bar colour as an exact base entry and put bg blends ahead of backdrop blends (the backdrop blends only serve the shadow edge).
- **L4:** the size estimate in `export-motion.js:13` measures the current step. `run()` uses the tallest step, and a step past the limit only fails after Export. Measure the maximum over all steps, as `run` does.
- **L5:** `pointerDown` can stay true after a right-click on macOS (the context menu swallows mouseup) or after a pointer released outside the window. Panel updates freeze until the next click (`app.js:80-82`). Also reset on `contextmenu`, `blur` and `visibilitychange`.
- **L6:** `onChange` clamps the step and returns early (`app.js:120`). The new notification carries only `{step}`, so the other changed keys of that batch (speed → `player.setSpeed`, steps → panel redraw) are lost. Reachable only through lenient load or JSON without a `steps` key. Fall through with the clamped state instead of returning.
- **L7:** switching flow blocks (now possible via M7) while the 350 ms DSL debounce is pending drops the last keystrokes. `draw()` rebuilds `els` for the new key, and `commit` then reads the new textarea (`flow-editor.js:38-44,125`). Flush the pending commit for the old key before `skeleton()`.
- **L8:** the JSON tab no longer refreshes on blur (the `onblur` handler was removed). After focus and blur with no edit, the text stays stale until the next non-step change. It is harmless thanks to the `shown` baseline, but confusing. Leaving the tab also discards an invalid paste without confirmation (`json-tab.js` `reset`).
- **L9:** row-delete undo restores the whole `blocks` snapshot (`layout-list.js:69`), so it also reverts block edits made between the delete and the undo click. This is acceptable for a short-lived toast.
- **L10:** `qa-matrix.js` is a console-only dev tool, but it is loaded for every user (`index.html:144`). Move it to the test loader, or keep it and document it.
- **L11:** `VideoFrame` should be closed in `finally` for robustness (`video-webcodecs.js:62-64`). This is not a leak today: no `await` sits between the `failure` check and `encode`.

## Phase-5 review items: verification against a5d96e3
| Item | Status | Note |
|---|---|---|
| H1 typing wiped on play | Fixed | Data-source toggles `.current` only; the block form redraws on step only for auto blocks; `section` defers while typing |
| H2 DSL trim mismatch | Fixed | `dslOf` untrimmed; the preset compare is trimmed |
| H3 click swallowed after commit | **Partial** | `queueUi` pointer gate works, but the `section` focusout path bypasses it (H2 above) |
| M1 positional list merge | Fixed | Exact-line match first, positional only when the count is unchanged; test added |
| M2 invalid state kills autosave | **Partial** | Block cap of 40 and lenient load added; no backup when keys are dropped (M6) |
| M3 share link without undo | Fixed | |
| M4 row delete without undo | Fixed | (L9 caveat) |
| M5 stale JSON reverts edits | Fixed | `changedKeys` against the `shown` baseline plus reset on tab switch |
| M6 export dialog churn while playing | Fixed | Step-only refresh skipped while playing; focused inputs are not overwritten |
| M7 second flow block | Fixed | `flowKey` prefers the selected flow (L7 side effect) |
| M8 focus lost after buttons | Partial | Positional fallback: focus stays at the same index, not at the moved row |
| M9 debounce after flow removed | Fixed | Guard in `commit` |
| L1 step clamp | Fixed | `validate` plus `onChange` (L6 caveat) |
| L2 `__proto__` ids | Fixed | |
| L3 FF/Safari JSON position | Fixed | |
| L4 NFD caret | Not addressed | |
| L5 aria-live chatter / aria-pressed | Fixed | |
| L6 zoom not keyboard reachable | Not addressed | `preview.js:82` is still a div click |
| L7 cols-custom stays visible | Fixed | |
| L8 table cols label | Fixed | |
| L9 checkbox 44px targets | Not addressed | No CSS change |
| L10 undo throws on invalid state | Fixed | Lenient undo |

## cdac0a8 (QA matrix, dashed boxes)
This commit is clean:
- The side-column `box` is whitelisted at render time (`side-column.js:59`), and the schema `select` type exists.
- The matrix test covers 4 templates × 7 themes × 2 borders × 3 widths × every step × paused/playing with 0 issues.
- One gap: the matrix samples only `t=0.5`. Adding `t=0` and `t=0.99` would cover the reveal edges.

## Edge Cases Found by Scouting
- The grid size is constant within a step for every template, so canvas sizing from t=0 is valid. Steps of different heights are padded with the backdrop.
- The `even` padding can push a 16384 px side to 16385. That case is handled: `getContext` returns null and the error is surfaced.
- The GIF path holds no `VideoFrame` or object URL. `saveBlob` revokes after 10 s. The recorder `track.stop()` sits in `finally`.
- In WebCodecs, the error callback cannot run between the `failure` check and `encode`, because there is no await. On error, `encodeQueueSize` drops to 0, so the back-pressure loop exits.

## Recommended Actions
1. H1: stop promise and error handling in video-recorder (prevents a permanent busy state).
2. H2: gate the `section` focusout redraw on pointer-up, then retest click and Tab in Chrome and Safari.
3. M1: add SRI to the muxer script.
4. M2, M5: abort-aware muxer load; catch muxer errors and fall back on early encoder errors.
5. M3, M4: background-tab handling for the recorder; GIF size and time cap.
6. M6: back up when lenient load drops keys.
7. The Low items.

## Metrics
- Tests: 168/168. The GIF encoder has LZW round-trip, file structure and palette tests. The video and UI paths have no automated tests (browser APIs).
- Lint/type: none configured.
- Files under 300 lines: yes.

## Score: 7.5/10
The encoder core is solid and verified, and most phase-5 fixes landed correctly. One hang path in the recorder and a partial regression of the click-swallow fix keep the score from going higher.

## Unresolved Questions
- H2 is inferred from the event order (focusout, then a 0 ms timer while the button is held). Confirm in Safari and Chrome.
- Do we want the recorder fallback at all for canvases above H.264 level 5.2? It will likely fail the same way. An explicit "too large for video, reduce scale" message may be better.
- Is loading third-party code acceptable on file:// for all target users, or should the muxer be vendored (about 30 KB) to keep the app fully offline?

Status: DONE_WITH_CONCERNS
Summary: The GIF encoder and most phase-5 fixes are correct. The MediaRecorder path can hang the export UI forever (H1), and the new focusout redraw in `dom.section` brings back the swallowed-click bug (H2).
