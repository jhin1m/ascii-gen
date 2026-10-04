# Code Review: commit 353bcf1, phase 5 (editor UI, templates, autosave, mobile)

## Scope
- Files: js/app.js, js/core/{store,list-codec}.js, js/ui/{dom,panel,schema-form,data-source-form,layout-list,flow-editor,style-tab,json-tab,preview}.js, js/output/html-chrome.js, js/export/{storage,config-file}.js, js/templates/*, js/blocks/flow-presets.js, export-dialog.js (diff only), index.html, editor.css, style.css, tests/editor-core.test.js
- LOC: +1677 / -154 (28 files)
- Tests: `node tests/run.js` gives 161 passed, 0 failed
- File size: every file is under 300 lines (largest are export-dialog.js at 189 and app.js at 188)
- Probes I ran in Node, through the same vm loader the tests use:
  - list-codec delete/insert behaviour
  - validate() with `__proto__` keys and an out-of-range step
  - all 4 templates validating as their own config
  - DSL parse of trailing whitespace and NFD input
  - a 4000-iteration fuzz of renderFrame with validated, malformed block configs. It found 0 crashes, so the renderer is robust and the risk is in the UI layer.

## Overall Assessment
The architecture is sound: a flat store, microtask-batched notifications, one coalesced render and a clear boot order. The core modules stay DOM-free. I found no XSS. The only HTML sink is `preview.js:30`. Grid text goes through `escapeHtml`, chrome strings go through `esc` with `&quot;`, and every style value is either a palette entry (hex-validated) or a constant. Toasts and errors use `textContent`.

The main weakness is **editing ergonomics under re-render**. Sections are rebuilt wholesale on unrelated changes (every playback step) and right after each commit. This wipes text the user is still typing and swallows clicks. There are also several silent data-loss paths: positional list merge, share-link overwrite, a rejected autosave and row delete.

## Critical
None. There is no trust-boundary defect. Share-link and JSON content is shape- and size-checked, and nothing user-controlled reaches `innerHTML` unescaped.

## High

### H1. Typed-but-uncommitted text is wiped on every playback step
- **Where:**
  - `js/ui/data-source-form.js:59,67`: `KEYS` includes `'step'`, so the whole form redraws.
  - `js/ui/panel.js:63`: the block form redraws on `changed.step && api.selected()`.
  - `js/ui/dom.js:30-41`: `replace()` restores focus and selection but not the in-progress `value`.
- **Scenario:** press Phát, click an actor name and type "Planner". Within 1.2 s the next `store.set({step})` from `app.js:168` redraws the section. The new input carries the old name and the caret stays where it was, so further typing lands inside the old value. The same happens for step names and for every text field or list textarea of the selected block.
- **Fix:**
  - Do not rebuild a section whose root contains `document.activeElement` when the change is step-only.
  - For data-source, toggle the `.current` class on step change instead of redrawing.
  - For the block form, redraw on step only when the block is `auto` and focus is outside the form.
  - Alternative: in `dom.replace`, copy `active.value` into the re-created control when it differs from the value the control was built with. Store that value as `data-initial`.

### H2. Flow DSL textarea rewrites the user's text while they type (trim mismatch)
- **Where:** `js/ui/flow-editor.js:34` (`dslOf` trims), `:41` (commits the untrimmed `text`), `:122` (`dsl !== shown` leads to `els.dsl.value = dsl`).
- **Scenario:** type `lead -> worker`, press Enter and pause for 350 ms. `"lead -> worker\n"` is valid (verified: parse plus analyze succeed), so it is committed. The redraw computes the trimmed DSL, which differs from `shown`, so the textarea is overwritten: the newline disappears and the caret jumps to the end. The next line is then glued on as `lead -> workerworker -> lead`. A trailing space before a pause is eaten the same way.
- **Fix:** in `commit`, set `shown = text.trim()` before `put(...)`, or guard the rewrite with `els.dsl.value.trim() !== dsl`.

### H3. Commit-then-rebuild detaches the element the user is moving to (needs a manual Chrome check)
- **Where:** all forms commit on `change`, which fires during blur when focus leaves for the next control. The store flush is a microtask that runs right after the `change` listener, so `panel.js:63`, `data-source-form.js:67` and `layout-list.js:85` replace the whole section mid-transition (`dom.js:34`).
- **Scenarios (high probability, not yet verified in a browser):**
  1. Edit an actor name, then click "+ Actor" or "×". mousedown blurs the input, the section is rebuilt, and the original button is detached before mouseup, so the click never reaches the new button's handler. The first click is lost.
  2. Edit a block title, then Tab or click into the next field. `replace()` re-focuses the edited field via `data-focus`, and the browser's pending focus target is detached. Focus bounces back to the field just edited.
- **Fix:** defer section redraws while focus is inside the root. Schedule the redraw on `focusout` of the root, then `setTimeout(0)` and re-check `root.contains(document.activeElement)`. Or update control values in place for same-shape changes.

## Medium

### M1. list-codec merges hidden properties by position, so insert, delete or reorder moves them to the wrong item
- **Where:** `js/core/list-codec.js:47` (`old[i]` for variants), `:52` (`old[i]` for fields).
- **Verified:** with timeline rows `[{lead, color:a1}, {worker, color:a4}]`, deleting the first line gives `[{actor:'worker', pattern:'..##', color:'a1'}]`. Worker silently gets lead's colour. The same applies to milestone `snap`/`reach`, table row `color` and similar fields. The test at `editor-core.test.js:24` only covers the same-position case.
- **Fix:**
  - Map each old item by its encoded line (`toLines` per item) and reuse the extras of an exact text match.
  - Fall back to the item at the same index only when the line count is unchanged.
  - Otherwise start from `{}`.
- **Also:** `cells()` trims every value (`:23`), so leading or trailing spaces in `msg`/`note` text are lost on any edit of the list. That is low severity; document it or trim only around the `|` separators.

### M2. The UI can build a state that `validate()` rejects, which silently discards the autosave and then overwrites it
- **Where:**
  - `layout-list.js:70` caps **rows** at 40, but `config-file.js:26` caps **blocks** at 40. agent-pipeline has 8 blocks in 6 rows, so adding rows up to 40 gives 42 blocks.
  - List textareas can push blocks JSON past 200 KB (`config-file.js:28`).
  - `storage.js:17` is all-or-nothing, so one bad key loses everything.
  - The next debounced save, or `pagehide` saveNow (`app.js:183`), overwrites the stored work even if the user made no edit.
- **Fix:**
  - Disable "+ Thêm hàng" when `Object.keys(blocks).length >= 40`.
  - Make `storage.load` lenient: validate per key and drop only the bad keys.
  - Before the first overwrite after a failed load, copy the raw value to `adg:v1:bad`.

### M3. Opening a share link overwrites in-progress work with no undo
- **Where:** `app.js:139-141`. Autosave persists the shared config within 500 ms.
- **Fix:** capture `before = configFile.wrap(store.get())` and pass an undo action to the toast, the same way `switchTemplate` (`app.js:117`) does.

### M4. Row delete permanently drops block configs (including flow DSL and node data) with no confirm or undo
- **Where:** `layout-list.js:59-64`. This is inconsistent with the template switch, which has undo.
- **Fix:** add an undo toast that restores `{layout, blocks}`.

### M5. Stale dirty JSON text reverts edits made elsewhere
- **Where:** `json-tab.js:20,26-31,43`. An invalid parse leaves `dirty=true` and the refresh is skipped indefinitely, including when the tab is shown again.
- **Scenario:** type invalid JSON, switch to Khối, rename an actor or change a layout, come back and fix the typo. The whole stale config is applied and the other edits are reverted.
- **Related:** while playing, any JSON edit re-applies the `step` in the text, which rewinds the player (`app.js:97`).
- **Fix:** when state changes externally while dirty, show a "config changed elsewhere, press Định dạng lại" status. Or apply only the keys that differ from the baseline text captured when editing started. Drop `step` from JSON-tab patches.

### M6. Export dialog is refreshed on every playback step
- **Where:** `app.js:104` calls `exportDialog.refresh()` on every `onChange`, including each step.
  - `syncControls()` overwrites `#opt-credit` and `#opt-size` while the user types (they commit on `change`). Credit is only editable there, which is a plan requirement.
  - `refreshShare` clears the URL and disables Copy each step, so the link flickers and can't be copied reliably.
- **Fix:** in app.js, skip `refresh()` when playing and `changed` contains only `step`. In the export dialog (phase 7 owner), don't overwrite a focused input.

### M7. A second flow block cannot be edited
- **Where:** `app.js:26-35` `flowKey()` always returns the first flow block. `layout-list.js:70-77` allows adding more flow rows. For a selected second flow block, `schema-form.js:70` says "edit in the Flow section", but that section edits a different block.
- **Fix:** have `flowKey()` prefer `selected` when it is a flow block.

### M8. Keyboard focus is lost after button actions (a11y)
- **Where:** the following buttons have no `data-focus` key, so `replace()` drops focus to `<body>` after each press:
  - row ↑/↓/× (`layout-list.js:53-64`)
  - chip select (`:41`)
  - actor +/× (`data-source-form.js:29-31`)
  - step ↑/↓/× and "+ Bước" (`:50-55`)
  - window/cols buttons (`preview.js:63-68`)
  - preset cards (`flow-editor.js:68`)
- **Fix:** add stable `data-focus` keys. For moves, use the destination index (e.g. `row-up-<newIndex>`); after a delete, fall back to a neighbour.

### M9. The flow editor's debounced commit throws if the flow block disappears within 350 ms
- **Where:** `flow-editor.js:37-42`. After `draw()` takes the no-flow path, `els` is null (`:118`) or `block()` is undefined, so `els.dsl` or `block().dsl` throws a TypeError in the timer.
- **Scenario:** type in the DSL, then delete the flow row or switch to the Trống template.
- **Fix:** call `commit.cancel()` in `draw()` when the key changes or there is no flow, and add `if (!els || !block()) return;` in `commit`.

## Low
- **L1:** `validate()` doesn't check that `step < steps.length`. Verified: `{steps:[a,b,c], step:50}` is accepted. The header then shows `51/3 · undefined` (`app.js:85`), and `player.sync` doesn't clamp (`player.js:65`). Clamp in `onChange`, or add a cross-field check after validation.
- **L2:** the `ID` regex (`config-file.js:14`) accepts `__proto__`. Verified: validate keeps an own `__proto__` block key, and the DSL parser accepts a `__proto__` node.
  - `Object.assign({}, blocks, {[key]: cfg})` (`app.js:37`, `layout-list.js:49-51`, `flow-editor.js:81`) then sets the *prototype* instead of an own key, so that block or node data is silently dropped.
  - Fix: use object spread (`{...blocks, [key]: cfg}`, which defines own properties), or reject `__proto__|constructor|prototype`.
- **L3:** the JSON tab shows the error line only for V8's "position N" message (`json-tab.js:10-11`). Firefox and Safari ("line L column C") show no location. Parse that form as well.
- **L4:** carry-over N2 (parser column vs NFD input) is not addressed. Columns are reported, but no caret is placed, and the column is not mapped from NFC back to the textarea's raw offsets.
- **L5:** `#step-label` (aria-live) is rewritten on every animation frame (`app.js:169` → `:85`), so screen readers may chatter. Write it only when the text changes, and consider `aria-live="off"` while playing. `#play` toggles both its label (Phát/Dừng) and `aria-pressed`, so it is announced as "Dừng, pressed". Keep one of the two.
- **L6:** the preview zoom toggle is a click on a div (`preview.js:81`), so keyboard users can't reach it. Add a button or `tabindex` plus a key handler.
- **L7:** `#cols-custom` is shown but never hidden again after a preset column count is chosen (`preview.js:70`).
- **L8:** the table `cols` field label says "tên | thanh | tuyến" (`table.js:67`), but the codec treats each line as one column (`list-codec.js:43`). One line with pipes becomes a single header `"a | b | c"`. Fix the label.
- **L9:** the touch-target rules in `editor.css:143-151` skip checkboxes: `.check` (28px), the layout row visibility checkbox and the effects checkboxes. The plan requires at least 44px.
- **L10:** the template-switch undo calls `validate(before)` (`app.js:117`). If the current state is invalid (see M2), the undo throws an uncaught error and does nothing.

## Plan requirements not met or partial
1. "Mọi điều khiển trong mockup hoạt động thật" (every mockup control works): partial. A second flow block can't be edited (M7), and the first click after an edit is lost (H3).
2. Touch targets of at least 44px: checkboxes are not covered (L9).
3. Carry-over N2 (NFD error column and caret placement): not addressed (L4).
4. "Reload giữ nguyên bản đang làm" (a reload keeps the work in progress): fails when the state exceeds validate limits (M2).
5. Credit editable: only through the export dialog, and it is clobbered while playing (M6). Acceptable placement, but buggy.
6. The phase file is marked `status: completed`, but its Success Criteria checkboxes are all unchecked. This is a documentation inconsistency.

Met: header controls; actors/steps CRUD and reorder; layout ↑↓, show/hide, ratios and tags; schema forms; flow presets, DSL with inline error and the old picture kept (M6 carry-over), node details, duplicate-id warning (N4) and skipped-link reasons; style tab (7 themes, 9 colours, 4 fonts, size, line-height, border, effects); JSON tab (400 ms, errors, apply); preview toolbar, custom columns 40–200 and badge; 4 HTML chromes reusing `window-chrome.js`; 4 templates; `adg:v1` storage with try/catch and a 500 ms debounce; boot order autosave then hash; mobile accordion with scale-to-fit.

## Edge Cases Found by Scouting
- The renderer survived 4000 fuzzed, validated malformed configs (null, NaN, 1e9, huge strings, `[null]`, unknown kinds, `w: 0.0001`, empty actors and steps). The share-link crash risk sits in UI state handling, not in the renderer.
- Every template has 8 blocks or fewer and no unused blocks, and each one validates as its own config.
- `presetDsl` with an empty actor list falls back to `n1..n5`. That works.

## Recommended Actions (priority order)
1. H2: one-line fix (`shown = text.trim()` in commit).
2. H1 and H3: don't rebuild a section that holds focus; skip the step-only redraw of data-source and the block form. Verify the click and Tab behaviour in Chrome afterwards.
3. M1: content-keyed merge in list-codec, plus a test for insert and delete.
4. M2, M3, M4: lenient autosave load with a backup slot; undo for share-link apply and row delete; cap blocks at 40 in the UI.
5. M6: gate `exportDialog.refresh()` on non-step changes while playing.
6. M5, M7, M8, M9, then the Low items.

## Metrics
- Tests: 161/161 pass. The UI modules have no automated tests (DOM), and the list-codec test covers only the same-position merge.
- Lint/type: none configured (vanilla JS).
- XSS sinks: 1 (`preview.js:30`), with all inputs escaped.

## Score: 6.5/10
The structure, security and renderer robustness are solid. Typing, focus and data-loss bugs in the core editing flows keep it below shippable polish.

## Unresolved Questions
- H3 is inferred from the event ordering (change fires during blur, then the microtask rebuild runs). Confirm in Chrome: edit an actor name, then click "+ Actor" directly.
- Should JSON-tab edits be allowed to change `step` at all?

Status: DONE_WITH_CONCERNS
Summary: No XSS or renderer-crash paths; three High editing bugs (typing wiped during play, DSL newline eaten on commit, rebuild-on-commit swallowing clicks and focus) and several silent data-loss paths (positional list merge, rejected autosave, share link and row delete without undo) need fixes.
