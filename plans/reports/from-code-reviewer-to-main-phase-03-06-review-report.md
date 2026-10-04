# Code review: Phase 3 (Flow DSL) and Phase 6 (Canvas output and exports)

Reviewer: code-reviewer · Date: 2026-10-04 · Mode: report only (no source or test edits)

## Scope
- Modified: `index.html`, `js/app.js`, `js/blocks/flow.js`, `js/templates/agent-pipeline.js`, `style.css`, `tests/blocks.test.js`, `tests/layout.test.js`
- New: `js/core/flow-dsl.js` (133), `js/core/flow-graph.js` (102), `js/blocks/flow-presets.js` (29), `js/output/window-chrome.js` (79), `js/output/canvas-chrome.js` (184), `js/output/canvas-renderer.js` (140), `js/export/{png,plain-text,config-file,share-link}.js`, `js/ui/export-dialog.js` (172), 4 test files
- About 1,300 new LOC. Every file is under 300 lines and uses kebab-case names.
- Verification run:
  - `node tests/run.js` gives **134 passed, 0 failed**.
  - `node --check` passes on every changed or new JS file.
  - A scratch probe harness checked the parser, graph and layout edge cases, the full theme/border/width matrix, share encode/decode, and a decompression bomb.

## Overall assessment
The work is solid and well bounded. The DSL parser has input caps and line/column errors. The graph analyser refuses shapes it cannot draw instead of drawing them wrong. Share-link decoding is hardened: strict hash regex, pure-JS base64url, a 1 MB inflate cap (a 50 MB zero bomb is refused in 4 ms), fatal UTF-8 and table-driven validation. No `innerHTML` receives untrusted data. I found no Critical issues. The main risks are design decisions that phase 4 and 5 will inherit:
- node identity is tied to the actor's display name
- a share hash overrides saved state
- object-prototype names corrupt node keys

**Score: 8/10**

---

## Critical
None.

## High

### H1. Preset node identity = actor display name, so a rename silently drops node data and side-column anchors
- **Where:** `js/blocks/flow.js:204-208` (empty DSL → `presetDsl(preset, names = ctx.N(role))`), `js/blocks/flow.js:51-52` (`cfg.nodes[node.key]`, id defaults to the key), `js/blocks/flow-presets.js:18`.
- **Failure:**
  - Use the preset (empty `dsl`) and rename actor `lead` to "Trưởng nhóm". Node keys become `Trưởng-nhóm` and `Trưởng-nhóm#2`.
  - `cfg.nodes.lead` and `cfg.nodes['lead#2']` (custom lines, `id:'review'`) are no longer found.
  - The anchors `lead` and `review` disappear, and compose logs 2 "no clear path for link" warnings (verified).
  - The box title shows the sanitised `Trưởng-nhóm` (space → `-`), not the real name.
  - This conflicts with plan success criterion "Đổi tên actor 1 chỗ → mọi khối auto cập nhật; khối sửa tay giữ nguyên".
- **Why High:** it fixes the keying contract for `flow.nodes`. Phase 5 persists that contract in localStorage, `.json` and share links.
- **Options** (spec says "DSL dùng tên hiển thị", so this is a decision for the lead/user):
  - **(a) Recommended.** Resolve each node to an actor id. In `build()`, use `d = own(cfg.nodes, node.key) || own(cfg.nodes, actorIdOf(node.name))`. The default anchor id is the actor id, and the title is `ctx.N(id)` (real name, not the identifier-safe one). Renames keep node data and anchors.
  - **(b)** Keep display-name keys and make the phase 5 rename action rewrite both the DSL and the keys of `cfg.nodes`. This is more fragile: hand-edited DSL plus a rename means a partial rewrite.

## Medium

### M1. Object-prototype names corrupt node keys and graph state
- **Where:** `js/core/flow-dsl.js:44` (`count = {}, first = {}`), `:66` (`lineSeen = {}`); `js/core/flow-graph.js:43` (`out/state`), `:57` (`rank/pending`); `js/blocks/flow.js:71,214` (`pm`, `nodes`).
- **Failure (verified):** `constructor -> b` parses to the key `constructor#function Object() { [native code] }1`. The same happens for `toString`, `valueOf`, `hasOwnProperty` and `__proto__` (`__proto__#[object Object]1`). The anchor id is garbage and `cfg.nodes.constructor` is never read. Even with the parser fixed, `flow-graph.findBack` checks `!state[e.to]`, which is truthy for inherited props, so DFS never visits such a node and a back edge is missed. Nothing crashes and nothing is polluted (no writes to prototypes), but the result is wrong. DSL text will arrive from share links in phase 5.
- **Fix:** use `Object.create(null)` for every map keyed by node name or key (`count`, `first`, `lineSeen`, `out`, `state`, `rank`, `pending`, `seen`, `pm`, `nodes`), or use `Map`. Add a test: `constructor -> toString -> __proto__` gives keys equal to the names and 3 anchors.

### M2. A share hash overrides saved work on every reload (phase 5 data-loss trap)
- **Where:** `js/app.js:61-72, 85-86`. The hash is applied but never cleared. The comment says "the hash wins over … later, over saved state".
- **Failure:** in phase 5 the user opens a share link, edits, and autosave writes `adg:v1`. On reload the hash still exists and overrides the autosave, so the edits are lost. A later `hashchange` back to the same URL does the same.
- **Fix:** after a successful apply, call `history.replaceState(null, '', location.pathname + location.search)`. Also drop stale async results: keep a sequence number in `loadFromHash` so an older decode that resolves late cannot override a newer one.

### M3. Canvas size check ignores total pixel area; a null context gives a cryptic error
- **Where:** `js/output/canvas-renderer.js:5, 112-117`.
- **Failure:** only width and height are each checked against 16384. Safari/iOS limit canvas area to about 16.7 MP (stricter on iOS). 200 cols at 3x is about 4.7k × 4.2k ≈ 20 MP, and size 48 at 3x is about 130 MP. Safari then returns `null` from `getContext('2d')`, `ctx.setTransform` throws a TypeError, and the toast shows "null is not an object". Safari is a target browser.
- **Fix:** add `MAX_AREA = 16_777_216` and reject `width*height > MAX_AREA` with the existing Vietnamese message. Also guard `if (!ctx) throw new Error(...)`. Show the same warning in `refreshSize` before the user clicks Download.

### M4. Hub mode does not satisfy "mũi tên side column trỏ đúng node"
- **Where:** `js/blocks/flow.js:149-195` with `templates/agent-pipeline.js` side links.
- **Failure (verified):** setting `flow.dsl = presetDsl('hub')` in the pipeline template gives 3 layout warnings. `lead` and `worker` are anchored but have no clear path (the left spoke sits between the side column and the centre), and `review` does not exist. Self-check stays at 0.
- **Assessment:** this is phase 3 success criterion 2. The developer accepted it as "hub not default". The phase 5 Server monitor template uses the hub preset. If that template has a side column, this becomes a real defect.
- **Fix:** either make the side-column consumer target only reachable anchors (the left spoke, and the centre through a vertical lane above the left spoke), or document that hub plus side links is unsupported and refuse it explicitly, as the graph analyser does.

### M5. The DSL rejects NFD (decomposed) Vietnamese; presets mangle it
- **Where:** `js/core/flow-dsl.js:13, 40`; `js/blocks/flow-presets.js:18`.
- **Failure (verified):** `Tién -> b` fails with `unexpected character "́"`, and the message shows an invisible combining mark. `presetDsl('fan', {lead: 'Tién'})` gives `Tie-n`. NFD text comes from pasted text and some IMEs/OSes. Core `text-utils` already normalises to NFC, so the parser is inconsistent with it.
- **Fix:** add `text = text.normalize('NFC')` in `parse()` and normalise in `ident()`. Optionally add `\p{M}` to `BODY`. Astral letters (e.g. `𝒜`) also fail because the tokenizer indexes UTF-16 units. Iterate by code point (`codePointAt`), or accept and document that limit.

### M6. The flow block discards the previous picture on a DSL error; "hình cũ giữ nguyên" now depends on phase 5
- **Where:** `js/blocks/flow.js:210-213, 197-201`.
- **Failure:** an invalid `dsl` renders one `[!] flow: …` line with no anchors. Every side link then warns (3 `console.warn` per render, verified). The parser itself meets the spec (`{error:{line,col,msg}}`, nothing partial). Keeping the old graph is not implemented anywhere yet.
- **Fix:** record as an explicit phase 5 contract: the flow editor must call `ADG.flowDsl.parse` plus `ADG.flowGraph.analyze` before committing `dsl` to the store, and show the error inline. Optionally have the layout skip links whose target block returned an error grid, to avoid console noise.

## Low

### L1. Share "Copy link" can copy a stale URL
`js/ui/export-dialog.js:49-56, 168`. `refreshShare` is async, but the button stays enabled with the previous URL while the new link is being encoded. A quick click after changing an option copies the old state. Fix: set `btn.disabled = true` at the start of `refreshShare`.

### L2. Double refresh per dialog change
`export-dialog.js:77`: `patch()` calls `api.setState()`, which already calls `exportDialog.refresh()` (`app.js:57`), and then calls `refresh()` again. Each change costs 5 composes (about 3.4 ms each at 120 cols) plus 2 deflate/encode runs. Fix: `function patch(p) { api.setState(p); }`.

### L3. `step` validated against 0..99, not against the template's step count
`js/export/config-file.js:18`. A share link with `step: 50` passes, `#step-select` shows blank, and compose clamps silently (no crash, verified). Fix: clamp on load, or validate against `steps.length - 1` once templates live in state (phase 5).

### L4. `cols-select` grows options
`js/app.js:46-49`. Every distinct loaded `cols` adds an option permanently. This is cosmetic: replace one "custom" option instead.

### L5. Clipboard fallback loses focus inside the modal
`js/export/plain-text.js:11-22`. The temporary textarea takes focus and is removed, so focus falls to `<body>`, outside the focus trap. iOS also needs `ta.setSelectionRange(0, text.length)`. Fix: save `document.activeElement` and restore it after removal.

### L6. No-chrome PNG radius does not match the preview
`window-chrome.js:14` uses `none.radius = 0.4em`, but the preview `.adg-screen` uses `border-radius: 0.7em` (`style.css:33`). The 1px ring is also drawn at `-1` (offscreen) when the margin is 0. Fix: align with the preview, or let phase 5 adopt 0.4em in the HTML chrome.

### L7. DSL small gaps
- `#` anywhere cuts the rest of the line, so a label like `: retry #2` is truncated (`flow-dsl.js:61`).
- `a : x` (label without an operator) is silently dropped.
- A comment-only DSL gives "empty graph", while an empty DSL falls back to the preset. This is inconsistent.
- `a <-> a` creates a spoke `a#2`.

Fix: return an error for a label without an operator. Pick one behaviour for the comment-only case.

### L8. Docs and tests
- The `flow-graph.js:8-9` header omits `tailEdges`.
- There is no automated test for `encode`/`decode`. The harness is sync, but it could `await` a returned promise. The round trip and the bomb cap are verified only by scratch scripts, so the most security-relevant path has no regression test.

---

## (a) Acceptance criteria

### Phase 3
| Criterion | Status | Evidence |
|---|---|---|
| Preset fan ≈ ref.png layout incl. `split` loop | **Met** | 96-col render in the developer report; `flow-layout.test.js:11` asserts back-edge head plus label at 80/96/120 × ascii/unicode. The back edge is dashed (ref shows solid); the developer documented this. |
| Preset hub like mockup; side-column arrows hit the right node | **Partial** | Standalone hub is tested (`flow-layout.test.js:30`). With the template side column there are 3 link warnings (M4). |
| Bad DSL → line/col error, old picture kept | **Partial** | The parser returns `{error:{line,col,msg}}` (tested). The block replaces the picture; keeping it is deferred to the phase 5 editor (M6). |
| Tests pass | **Met** | 134/134 |
| Syntax: 6 operators, groups, `@table`, repeats → new instance, `#` comments | **Met** | `flow-dsl.test.js:8-57` |
| Tier rows of ≤4, wrap beyond | **Partial** | Wrapping is allowed only for the last tier; other cases are refused as unsupported (by design, documented). |
| Anchors for every node | **Met** | Tested; anchors narrower than 3 cols are filtered. |
| Default node data from actor (sub/footer) | **Deferred** | Accepted deviation, moved to phase 4. |

### Phase 6
| Criterion | Status | Evidence |
|---|---|---|
| PNG 2x = 2× preview, right font, ±chrome, 4 window styles | **Partial** | Size is scale × the 1x layout by construction (`canvas-renderer.js:57`). The HTML chrome does not exist yet. There is no pixel comparison with real web fonts (developer "Not verified"). Radius mismatch (L6). |
| Plain text aligned in a Markdown code block | **Met** | `plain-text.test.js`; the core guarantees single-width cells (wide → `?`). |
| Share link reproduces the picture; `.json` round trip identical | **Partial** | Appearance-state round trip is tested (`share-link.test.js` validate round trip). There is no automated compression test (L8). The payload carries no template/content/seed yet, which is fine while content is fixed; phase 5 must extend `FIELDS`. |
| Tests pass | **Met** | 134/134 |
| Font wait, measured `M` width, bold 700, glow `shadowBlur` only when on, scanline | **Met** | `canvas-renderer.js:38-104` |
| Clipboard + `execCommand` fallback | **Met** | `plain-text.js:25-33` (L5 nit) |
| `SHARE_BASE`, file:// warning, >8 KB warning, hash beats defaults | **Met** | Tested; "beats localStorage" is untestable until phase 5 (M2). |
| Dialog per mockup | **Partial** | No live thumbnail (accepted YAGNI deviation). |
| PNG 3x 96 cols < 1 s | **Unverified** | 8 ms draw reported; `toBlob` encode time not measured. |

## (b) Regression check
- `layout.compose` contract: **unchanged**. No diff in `js/core/layout.js`. An error grid without `anchors` is tolerated (verified).
- Block render signature `render(cfg, w, ctx) → {grid, anchors}`: **kept**. `drawNode`/`nodeHeight` are still exported.
- Side-column anchors `lead`/`router`/`worker`/`explorer`/`researcher`/`review`: **present** at 80/96/120 × both borders (test plus my run). `review` comes from `'lead#2': {id:'review'}`.
- Self-check matrix for agent-pipeline (7 themes × 2 borders × 80/96/120): **0 warnings, 0 layout warnings, every fg key resolves in every palette** (scratch run, `bad = 0`).
- Test edits in `blocks.test.js` and `layout.test.js` only follow the new config path. Assertions are unchanged except for adding `id:'router'` for the table-anchor test. Acceptable.

## (c) Public contract changes
1. **Flow block config:** `{ preset?: 'fan'|'hub', dsl: string, caption: markup, nodes: { [nodeKey]: nodeData } }`.
   - Removed: `top`, `table`, `fan`, `bottom`, `loop`.
   - Node keys are DSL names, with `name#n` for repeats.
   - `nodes[key].id` overrides the anchor id.
   - Table nodes take the table block config.
   - See H1 for the keying risk.
2. **New `ADG.*` exports:**
   - `flowDsl{parse,KINDS}`, `flowGraph{analyze,WRAP}`, `flowPresets{presetDsl,ids,label}`
   - `windowChrome{PAD,MARGIN,SHADOW,WINDOWS,LABELS,SPECS,spec,titles,layout}`
   - `canvasChrome{paintFrame,roundRect}`, `canvasOut{FONTS,DEFAULTS,normalize,ensureFont,measure,draw,renderCanvas}`
   - `png{fileName,sizeLabel,toBlob,saveBlob,exportPng,slug}`, `plainText{toPlainText,copy}`
   - `configFile{VERSION,FIELDS,wrap,validate,parse,readFile,download}`
   - `share{SHARE_BASE,WARN_URL_LEN,b64url*,encode,decode,baseUrl,buildUrl,readHash,warnings,createLink}`
   - `exportDialog{init,open,close,refresh,toast}`
3. **Payload format v1:** `{version:1, theme, border, cols(40..200), step(0..99), win, chrome, glow, scanline, font, size(6..48), lineHeight(1..3), credit(≤60)}`.
   - Unknown keys are ignored, and a missing key keeps the current value.
   - Any invalid known value rejects the whole payload.
   - A version greater than 1 is rejected.
   - Share link format: `#c=<base64url(deflate-raw(JSON))>`.
   - Phase 5 must add template, actors, steps, blocks and seed under the same version. That works because unknown keys are tolerated, but decide now whether content additions bump to v2.
4. **App state shape** (`app.js:6-11`) is now the de facto store seed for phase 5 (`store.js`).
5. **`index.html` script order:** `flow-dsl`/`flow-graph` load before `blocks/registry.js`, and `flow-presets` before `flow.js`. `tests/run.js` picks them up automatically.

## (d) Patterns and style
The code is consistent with phases 1 and 2:
- IIFE on `window.ADG`
- DOM-free load for core, blocks, output and export (`scratch` canvas and `document` are lazy)
- Vietnamese user messages
- JSDoc on public functions
- kebab-case files under 300 lines
- `own()` for config lookups

Deviations:
- maps keyed by plain `{}` in DSL and graph code (M1)
- `flow.js` duplicates the role list from `flow-presets.js:5` (`flow.js:207`); export `ROLES` instead

## (e) Lint, syntax, tests
- `node --check` is clean on all changed and new files.
- No linter is configured in the repo.
- `node tests/run.js`: 134 passed, 0 failed.

## Security notes (threat model: static page, untrusted hash, `.json` and DSL text, no secrets)
- **Hash decode:**
  - The regex anchors the whole hash.
  - base64url decoding rejects bad characters.
  - Inflate is capped at 1 MB and the stream is cancelled when the cap is hit.
  - `TextDecoder` runs with `fatal:true`.
  - `JSON.parse` runs inside `try`.
  - `validate` reads only own keys from `FIELDS` (`__proto__` in JSON is ignored, verified).
  - No pollution path found.
- **`.json`:** files are limited to 1 MB and go through the same validation.
- **XSS:** toasts, warnings, the text preview and file names use `textContent`. `innerHTML` is only cleared (`''`) or set from `renderHTML`, which escapes `& < >` (attribute values come from palette hex only). Credit text is drawn only on the canvas.
- **CSS injection:** `--adg-font` and `--adg-size` come from validated `font` and `size` values only.
- **DSL DoS:** 4,000 characters, 40 lines, 40 nodes, 80 edges and groups of 8. The worst case parses in under 3 ms (verified).

## Recommended actions (priority order)
1. H1: decide the node-key strategy (option a recommended) before phase 4/5 persist `flow.nodes`.
2. M1: use null-prototype maps in flow-dsl, flow-graph and flow, plus a regression test.
3. M2: clear the hash after applying it, plus a sequence guard.
4. M3: add an area limit and a null-ctx guard in `canvasOut.draw`.
5. M5: normalise DSL and preset names to NFC.
6. M4 and M6: write the hub/side-link limitation and the editor's "keep the old graph" duty into phase 5.
7. L1, L2, L8: disable the copy button during encode, remove the double refresh, and add an async-capable test for encode/decode plus the bomb cap.

## Plan follow-ups (lead to apply; no plan files edited)
- Phase 3: functionally complete except the partial items above. Mark it complete once H1 and M1 are resolved or accepted.
- Phase 6: complete except visual parity checks (real fonts, PNG vs preview pixels, Safari/Firefox, file://, real downloads and clipboard). These carry over to phase 8 QA.
- Phase 5: add these tasks:
  - extend `configFile.FIELDS` (template, content, seed)
  - flow editor validates before commit (M6)
  - clear the hash after applying it (M2)
  - reuse `windowChrome.spec/titles/PAD` for the HTML chrome and align the no-chrome radius (L6)

## Unresolved questions
1. H1: keep "DSL uses display names" (spec) with editor-side key rewriting, or key node data by actor id?
2. Will the phase 5 content fields (template/blocks/actors) ship as payload v1 or v2?
3. Is hub plus side column in scope for the Server monitor template (M4)?

Status: DONE_WITH_CONCERNS
Summary: Phase 3 and 6 are solid. Tests pass (134/134), syntax is clean, and the self-check matrix shows 0 warnings with no regressions. The share/config trust boundary is well hardened. No Critical issues; one High (node identity tied to the actor display name breaks renames).
Concerns/Blockers: H1 needs a lead/user decision before phase 4/5 persist `flow.nodes`. M1 (prototype-key names) and M2 (the share hash overriding autosave) should be fixed before phase 5.

---

## Re-review (2026-10-04, fixes for H1, M1–M5, L1, L2, L4)

Mode: report only. Verification:
- `node tests/run.js` gives **139 passed, 0 failed**.
- `node --check` is clean on `js/app.js`, `js/blocks/*.js`, `js/core/flow-*.js`, `js/output/*.js`, `js/export/*.js`, `js/ui/*.js` and `js/templates/*.js`.
- A scratch probe covered rename, prototype names, NFD and astral input, a side-link typo, the hub in the template, fan at 80/96/120 × both borders, and duplicate anchor ids.

### Verdict per item
| Item | Verdict | Evidence |
|---|---|---|
| H1 node identity | **Fixed** | `flow.js:41-44` `identity()` resolves an ident to an actor through `ctx.slot`/`ctx.N` (own-key lookups in `layout.js:46-47`). `cfg.nodes` and anchors are keyed by id. Probe: renaming `lead` to "Trưởng nhóm" gives 0 warnings and the same 6 anchors, keeps the custom data, and a node without data shows the real name with diacritics and spaces. Covered by `flow-layout.test.js:108`. The spec line in the phase file is updated to match the user decision. |
| M1 prototype names | **Fixed** | All name-keyed maps use `Object.create(null)`: `flow-dsl.js:52,74`, `flow-graph.js:16,26,43,57`, `flow.js:77,218`. Probe: `constructor -> toString -> __proto__` gives clean keys, and the back edge `__proto__ → constructor` is detected. Covered by `flow-dsl.test.js:110` and `flow-layout.test.js:130`. |
| M2 hash overrides saved work | **Fixed** | See "Hash race" below. |
| M3 canvas area / null ctx | **Fixed** | See "Canvas guard" below. |
| M4 hub plus side column | **Fixed, with one concern** | The template with the hub gives 0 warnings at 80/96/120 × both borders. It draws **0 arrows**: `lead` is unreachable, `review` is absent, and the `worker` milestone sits below the spoke rows. So criterion 2 holds only because nothing is drawn. That is acceptable for a non-default preset, but see N1. |
| M5 NFD / astral | **Fixed** | `flow-dsl.js:47` normalises to NFC. `BODY` includes `\p{M}`. The tokenizer reads by code point (`:30,35`). Probe: an NFD `Tién` gives the key `Tién`, and `𝒜 -> b` parses. Covered by `flow-dsl.test.js:121`. |
| L1 stale copy link | **Fixed** | `export-dialog.js:59` clears and disables the button before encoding. The stale-token return keeps it disabled. |
| L2 double refresh | **Fixed** | `export-dialog.js:86` `patch → api.setState` only. |
| L4 cols options grow | **Fixed** | `app.js:47-52` keeps a single `data-custom` option, which is replaced on each sync. |

### Focus points
1. **Side-column silent drop (`side-column.js:22-33`, tests `layout.test.js:122,132`).**
   - The two changed tests are legitimate. Both cases are geometry facts, not config mistakes: a node behind a sibling, and a milestone below the node rows. Both tests still assert the visual outcome (the border stays intact and there is no dashed arrow). Silencing them is right for a WYSIWYG editor.
   - **However**, `linkable` also silently drops links whose id does **not exist at all** whenever the row has a provider. See N1.
2. **`presetDsl` signature.** No caller in `js/` passes names. `flow.js:213` and `agent-pipeline.js:54` call `presetDsl(id)`. Three test calls still pass a dead `{}` second argument (`flow-dsl.test.js:60,76`, `flow-layout.test.js:31`). It is ignored and harmless; cleanup only.
3. **Hash race (`app.js:64-80`).**
   - The sequence counter is bumped synchronously before any `await`.
   - A stale success is dropped, and a stale failure is silenced.
   - `replaceState` does not fire `hashchange`, so there is no re-entry.
   - A `file://` failure is caught, and the hash then stays (documented).
   - Two residual issues, both acceptable:
     - (a) A failed link is removed from the address bar before the user can inspect it. The toast explains the failure.
     - (b) A user change made inside the few-millisecond decode window is overwritten by the link patch.
   - Phase 5 must load autosave synchronously **before** `loadFromHash()` so the hash still wins.
4. **Canvas guard (`canvas-renderer.js:48-52, 66, 122, 127`).**
   - `checkSize` is correct: per side > 16384, and area > 16,777,216, where exactly 4096² passes (tested).
   - `draw()` re-measures after `ensureFont`, so the guard uses the real metrics even if the dialog estimate used fallback metrics.
   - The null-ctx guard runs before the first ctx use.
   - The dialog disables Tải PNG and the scales over the limit. `downloadPng` re-checks via `disabled`.
   - Trade-off: Chrome and Firefox users also lose exports above 16.7 MP (e.g. 200 cols at 3x), even though those browsers could render them. This is a conservative cross-browser choice and is fine.

### New findings
**N1 (Medium): a typo or missing link target is now completely silent, and the behaviour depends on the row layout.**
- **Where:** `js/blocks/side-column.js:28-33`.
- **Failure:**
  - Probe: `side.items[0].link = 'leadd'` gives 0 warnings, self-check OK, and no arrow.
  - Before this change, `layout.js:137` warned "no clear path for link to …".
  - The same typo in a row **without** a provider still warns (`!ctx.anchors.length → true`, and the layout's `linkClear` then fails). So identical config gives different diagnostics depending on the layout.
  - In phase 5 the user loses the only signal that a renamed `nodes[key].id`, a deleted DSL node or a typo broke an arrow.
  - The existing test `layout.test.js:106` ("missing anchors draw nothing") never asserted on the warning, so this change went unnoticed.
- **Fix:**
  - Split the reasons. Keep **unreachable** and **out of rows** silent. For an **absent** id, keep emitting the link so the layout warns as before, or return a `skipped: [{to, reason}]` list for the phase 5 editor to show inline.
  - Add a test that pins the absent-id behaviour.
  - Note that the hub template test (`flow-layout.test.js:136`) asserts 0 warnings and links to `review`, which is absent in the hub. If absent ids warn again, that test needs `review` removed from the side links (or a skipped-list assertion). This is the real product question: should a side column that points at nodes missing from the current DSL be flagged?

**N2 (Low): NFC column drift.** `flow-dsl.js:47`. Error columns are computed on the NFC text. For NFD input, the column the editor textarea shows is later than the reported one (one extra code unit per combining mark before the error). Columns are also counted in UTF-16 units (documented). This is cosmetic until phase 5 places a caret from `col`. The fix then is to map back, or to normalise the textarea value on input.

**N3 (Low): stale docs and nits.**
- `flow.js:1-2` still says the preset is "built from the actor names".
- `canvas-renderer.js:6` is mis-indented.
- If a refresh runs during an export, `refreshSize` (`export-dialog.js:49`) can re-enable the busy "Đang tạo ảnh…" button. Clicks are still guarded by `busy` at `:89`, so this is cosmetic.

**N4 (informational, pre-existing): duplicate anchor ids are accepted silently.** `nodes.explorer = {id:'worker'}` gives two `worker` anchors, and the side column and layout use the first. This is worth a phase 5 editor validation and is not a regression.

### Regression check
- Template output at 96 cols is unchanged (matches the developer dump).
- 0 layout warnings and self-check 0 for the fan preset at 80/96/120 × ascii/unicode.
- Anchors `lead, router, worker, explorer, researcher, review` are present.
- `layout.compose` is unchanged.
- No new `innerHTML` with data.
- No new trust-boundary surface.

### Updated score: **8.5/10**
Every requested item is fixed and verified, with regression tests for H1, M1, M3 and M5. The only step back is N1: links with a missing target are silenced too broadly. That costs diagnosability, not correctness of the picture.

Status: DONE_WITH_CONCERNS
Summary: H1, M1–M5 and L1/L2/L4 are correctly fixed. 139/139 tests pass, syntax is clean, and the fan template has 0 warnings across the width/border matrix. One new Medium (N1): the side column now silently drops links to non-existent ids when the row has a provider, which hides typos and stale ids.
Concerns/Blockers: N1 needs a decision. Either restore the warning for absent ids only (and adjust the hub template test), or add a skipped-links channel for the phase 5 editor. N2 and N3 are cosmetic.
