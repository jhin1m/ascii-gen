# System Architecture

ASCII Dashboard Generator: static vanilla-JS app, no bundler, no framework. `index.html` loads classic `<script>` tags (order matters), everything hangs off `window.ADG`, and it runs from `file://`. UI text is Vietnamese; template content is English.

Plan: `plans/261004-0554-ascii-dashboard-generator/plan.md`.

## 1. Module map

Load order = order of the `<script>` tags in `index.html` (core, blocks, templates, output, export, ui, `app.js`). A file may only use, at load time, namespaces from files above it.

| Folder | Role | Key namespaces |
|---|---|---|
| `js/core/` | Pure logic, DOM-free: text width, themes, markup, grid buffer, layout, Flow DSL/graph, seeded random, generators, state store, frame, list codec, QA matrix | `text`, `theme`, `markup`, `grid`, `layout`, `flowDsl`, `flowGraph`, `random`, `generators`, `frame`, `store`, `listCodec`, `qa` |
| `js/blocks/` | Block types registered in `ADG.blocks` (status, header, steps, meters, log, table, timeline, side-column, flow) + flow presets | `blocks` |
| `js/templates/` | Template content (agent-pipeline, server-monitor, ci-cd-build, blank) + `index.js` list | `templateList` |
| `js/output/` | Grid to picture: HTML (preview) and canvas (export); window chrome spec shared by both | `htmlOut`, `htmlChrome`, `canvasOut`, `canvasChrome`, `windowChrome` |
| `js/export/` | Files out, state in/out: PNG, text, config file, share link, autosave, GIF, video | `png`, `plainText`, `configFile`, `share`, `storage`, `gif`, `gifPalette`, `animFrames`, `gifExport`, `videoWebCodecs`, `videoRecorder`, `video` |
| `js/ui/` | DOM only: helpers, player, preview, editor panel and tabs, export dialog | `dom`, `player`, `preview`, `panel`, `exportDialog`, ... |
| `js/app.js` | Bootstrap: store, player, autosave, share hash, header controls | none |
| `tests/` | Node tests + `run.js` loader | - |

**Loader rule** (`tests/run.js`): it reads `index.html`, takes every `js/**` script except `js/app.js` and `js/ui/*`, and runs them in that order in a `vm` context that only has `window`, `console`, `setTimeout`. So every file outside `ui/` and `app.js` must be DOM-free **at load time** (browser APIs such as `CompressionStream` or `localStorage` are looked up lazily and guarded). A new script only needs a tag in `index.html`; the loader picks it up and fails on a missing file.

Conventions: files under ~300 lines, kebab-case names.

## 2. Render pipeline

One function, `ADG.frame.renderFrame(config, step, t, { playing })`, produces every picture: live preview, player, PNG, GIF, video. Preview and exports cannot drift apart.

```
 state (flat object)
   |  ADG.store.toConfig(state)   { grid:{cols}, border, actors, steps, current, layout, blocks, seed }
   v
 ADG.frame.renderFrame(cfg, step, t, {playing})
   |  1. clone config (JSON deep copy; state is never mutated)
   |  2. generators.apply          blocks with auto:true get content from actors + steps (+ flow graph)
   |  3. random.jitter(seed)       varies numbers of hand-written blocks; seed 0 = untouched
   |  4. generators.resolveTokens  {@id} {@id^} {@step} {@step^} {@stepn}
   |  5. layout.compose            rows x columns; each block renders into its own grid, blitted to a page grid
   v
 { grid, cols, rows, anchors, skipped }     cell = { ch, fg, bg, b, k }; fg/bg are palette KEYS, not hex
   |
   +--> preview: htmlOut.renderHTML(grid, pal) -> htmlChrome.frameHTML(...) -> innerHTML   (ui/preview.js)
   +--> export:  canvasOut (renderCanvas/draw) + canvasChrome.paintFrame -> PNG / GIF / video
   +--> text:    plainText (rows joined by \n, trailing spaces trimmed)
```

Notes:
- `playing:false` shows a step in full; `playing:true` reveals it progressively with `t` (0..1 inside the step). `frame.timeAt(...)` is the player clock.
- Page height is computed by `layout.compose`, never configured. Blocks with `stretch` re-render at the row height; blocks with `provides` render first and export anchors that `links` (side-column milestones) snap to. Links that cannot resolve are reported in `skipped`.
- Palette: `ADG.store.palette(state)` = theme (9 base colors) + per-color overrides.
- Canvas cell width is measured from the loaded font (`measureText('M')`), never assumed. `windowChrome` holds em-based geometry used by both `htmlChrome` and `canvasChrome`.
- `grid.selfCheck` flags cells that would break alignment; `ADG.qa.matrix()` asserts there are none.

## 3. State, config file, persistence

State is one flat object: view options (`ADG.store.VIEW_DEFAULTS`: theme, colors, border, cols, win, chrome, glow, scanline, blink, font, size, lineHeight, credit, speed, loop) plus content from a template (`template`, `actors`, `steps`, `layout`, `blocks`, `step`, `seed`). `templateList.content(id)` returns content only, so a template switch keeps the look.

`ADG.configFile` (`{ version: 1, ...state }`) is the single schema for the `.json` file, share link, autosave and the JSON tab:

- `FIELDS`: key -> validator returning the clean value or `undefined`. Unknown keys are ignored, missing keys keep the current value.
- `validate(obj)` throws a Vietnamese error on bad shape/value; `validate(obj, { lenient: true })` drops invalid keys instead (autosave, undo).
- Limits: file 1 MB, blocks JSON 200 KB, 40 blocks, 20 actors, 20 steps, 40 layout rows; ids match `[A-Za-z0-9_-]{1,24}` and exclude `__proto__`/`constructor`/`prototype`.
- Also `wrap(state)`, `parse(text)`, `readFile`, `download`.

| Channel | Where | Behavior |
|---|---|---|
| Autosave | `localStorage['adg:v1']` (`export/storage.js`) | Debounced 500 ms from `app.onChange`, flushed on `pagehide`. Load is lenient; if keys were dropped or the JSON is broken, the raw text is first copied to `adg:v1:bad`. All access is try/catch, so blocked or full storage never breaks the app. |
| Share link | URL hash `#c=<token>` (`export/share-link.js`) | JSON -> deflate-raw (`CompressionStream`) -> base64url (pure JS). Decoded size capped at 1 MB. Warns above 8 KB URL, and on `file://` when `SHARE_BASE` is empty. |
| File | `.json` download / upload | Same payload. |

`SHARE_BASE` is a const at the top of `share-link.js` (`https://jhin1m.github.io/ascii-gen/`): the public URL of the deployed page (GitHub Pages) used to build links from any copy of the app (also `file://` / localhost); empty means the current page, which only works locally.

Boot order (`app.js` `init`): `VIEW_DEFAULTS` + default template (`agent-pipeline`) <- autosave (sync) <- share hash (async `loadFromHash`, wins). The hash is removed from the URL immediately, and a sequence counter drops stale decodes. Template switch and share-link open show a toast with an undo action ("Hoàn tác") that restores the previous wrapped state through lenient validation.

## 4. Editor architecture

```
 UI event --> api.set / editBlock --> store.set(patch)     (shallow merge, === diff per key)
                                        | microtask, once per batch
                                        v
                                  app.onChange(state, changed)
                                    |- clamp step, sync player (step / speed / loop)
                                    |- requestRender()        one render per animation frame
                                    |                         (setTimeout fallback in a hidden tab)
                                    |- storage.save()         debounced
                                    |- exportDialog.refresh() (skipped for step-only changes while playing)
                                    '- queueUi(changed) -> ADG.dom.whenIdle -> panel + preview update(state, changed)
```

- **Store** (`core/store.js`): `set(patch)` reports only keys whose value changed; notifications are coalesced per microtask (tests inject a synchronous scheduler).
- **Render coalescing**: `renderNow` reads the player's live position (`player.state()`), so edits during playback never flash a paused frame.
- **Pointer gate**: `queueUi` defers panel updates through `ADG.dom.whenIdle`, which waits until no pointer is held down (reset on pointerup/pointercancel, contextmenu, window blur, visibilitychange). A section rebuilt between mousedown and click would swallow the click.
- **Typing guard**: `ADG.dom.section(root, draw)` returns a redraw requester that postpones `draw` while a text field inside `root` has focus, and runs it after `focusout` (via `whenIdle`). `dom.replace` keeps focus (by `data-focus` key, else position) and selection across rebuilds.
- **Auto vs manual blocks**: a block with `auto: true` is regenerated every frame from actors/steps/flow. `api.editBlock(key, fields)` stores what was generated plus the edit and sets `auto: false` (hand-written; numbers still jittered by seed). The "↺" control calls `api.regenerate(key)` to set `auto: true` again. The layout list tags blocks "auto" / "sửa tay".
- **Sections** (`ui/`): `data-source-form` (actors/steps; actor ids are immutable so DSL nodes and `{@id}` follow renames), `layout-list`, `schema-form` (forms from block `schema`; `list` fields are pipe-delimited lines via `core/list-codec.js`), `flow-editor` (DSL parsed while typing; an invalid graph keeps the last valid picture), `style-tab`, `json-tab` (applies only the keys the user changed), `panel` (tabs; accordion at <= 720 px).
- **Flow**: `flowDsl.parse` -> `flowGraph.analyze` (tiers with at most one back edge, or hub) -> `blocks/flow.js` draws. Unsupported shapes return an error instead of being drawn wrongly.

## 5. Exports

| Output | Path |
|---|---|
| PNG | `canvasOut` (explicit `scale`, `MAX_SIDE`/`MAX_AREA` size check) -> `png.saveBlob` |
| Plain text | `plainText` (copy or download) |
| JSON | `configFile.download` |
| Share link | `share.createLink` (header quick button and export dialog) |
| GIF | `animFrames` replays from step 0 for `steps x seconds-per-step` at the chosen fps via `renderFrame` in playing mode (async per frame, cancellable with `AbortSignal`) -> `gifPalette` (fixed theme palette, 8 blend steps, cached nearest-color fallback) -> `gif.createEncoder` (own LZW, one global 256-color table, NETSCAPE loop, frame diff: only the changed bounding box is stored, an identical frame extends the previous delay), orchestrated by `gifExport.exportGif` |
| Video | `video.exportVideo`: if `videoWebCodecs.supported()` use WebCodecs H.264 + mp4-muxer; on unsupported or a `fallback` error (load failure, 8 s timeout) use `videoRecorder` (MediaRecorder on `captureStream(0)`, real-time pace; MP4 or WebM depending on the browser, Firefox gets WebM) |

mp4-muxer is the only network script besides Google Fonts: `https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js`, injected lazily on the first MP4 export with an SRI `integrity` hash (sha384) and `crossOrigin='anonymous'`. Timestamps come from the frame index, so output timing is exact however long encoding takes. `ui/export-motion.js` is the GIF/video card (fps, scale, loop, size estimate, progress, cancel; closing the dialog cancels a running export).

## 6. Testing

- `node tests/run.js`: no dependencies; runs every `tests/*.test.js` (each exports `({ ADG, test, assert, warnings, sandbox }) => ...`) against the DOM-free modules. Exit code 1 on failure.
- `ADG.qa.matrix()` in the browser console: every template x theme x border x width x step (paused and playing) must render with 0 self-check issues and no skipped links; returns a summary and lists failures.
- `js/ui/` and `app.js` have no automated tests; verify by hand in the browser.

## 7. Where to change what

| Task | Touch |
|---|---|
| New block type | `js/blocks/<name>.js` (`ADG.blocks.register` with schema + render), script tag after `registry.js`; optional generator in `core/generators.js` |
| New template | `js/templates/<id>.js`, `templates/index.js`, script tag (the `template` validator reads `templateList.ids()`) |
| New persisted setting | `VIEW_DEFAULTS` in `core/store.js` and `FIELDS` in `export/config-file.js` (otherwise it is dropped on save/share) |
| New window style | `windowChrome.SPECS` / `WINDOWS`; both chromes read it |
| Public share URL | `SHARE_BASE` in `js/export/share-link.js` |
