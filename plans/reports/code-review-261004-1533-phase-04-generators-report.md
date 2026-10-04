# Code Review: commit 5fecf61 (Phase 4: generators, seeded randomize, step player)

## Scope
- Commit: `5fecf61`, 20 files, +712 / -50
- New: `js/core/generators.js` (221 lines), `js/core/random.js` (119), `js/core/frame.js` (47), `js/ui/player.js` (75), `tests/generators.test.js`
- Modified: `js/app.js`, `js/blocks/{flow,log,meters,status,timeline}.js`, `js/core/layout.js`, `js/export/config-file.js`, `js/templates/agent-pipeline.js`, 3 test files
- Untracked `js/core/store.js` (concurrent phase-5 work) was not reviewed

## Verification run
| Check | Result |
|---|---|
| `node tests/run.js` | 151 passed, 0 failed |
| Self-check matrix: 2 presets (fan, hub) × 80/96/120 × ascii/unicode × 7 steps × playing/paused × seeds {0,7} × auto off / all 6 auto | 672 frames, 0 issues, no unresolved `{@` / raw tags |
| Wider matrix (fan + hub DSL, seeds 0/1/42/9998/999999) | 1680 frames, 0 issues |
| Same seed → same grid; seed 0 vs 777 → same alphabetic word multiset | Pass (only diff is a timeline `x` glyph run, a pattern and not a word) |
| `renderFrame` mutating its input | No (JSON clone) |
| `jitter(cfg, 0)` | No-op, confirmed |
| Render time, 96 cols, 200 frames, including `selfCheck` | about 3.6 ms per frame (auto off and all auto) |
| File size < 300 lines | All pass (largest: flow.js 262) |
| `js/core/**` DOM-free | Yes (frame, generators, random use only the `window.ADG` namespace) |
| `layout.compose(config, frame?)` / `makeCtx(config, frame?)` | Backward compatible (the second argument is optional) |
| Player simulated with a fake RAF clock: speed change, seek while playing, non-loop end, replay, double play, steps shrinking, many toggles | Correct, except items L2/L3 below |
| Token injection through actor names | Blocked: `makeCtx` strips `{}*` and validates ids against `^[A-Za-z0-9_-]+$` plus RESERVED. A name like `{a1:x}**b**` renders as `A1:XB`. The replace callback is single-pass, so a name containing `{@other}` is not resolved again. |
| renumber regex | Tag names (`{a3b:`, `{@agent2}`, `{x2y:`), `{bar:..}`, `{{` and `{2024}` stay unchanged. Only digits in text or tag bodies change. |

## Overall Assessment
The core design holds: a pure `renderFrame` pipeline, streams keyed by (seed, path), word choices kept separate from the seed (`rng(0, …)` for picks), and names sanitized at the context boundary. No critical defects. The problems are in what renumber produces (numbers that make no sense together), unsanitized step names, a `{@step}` collision with actor ids, generated side-column links that are always skipped, and one phantom test assertion.

## Critical Issues
None.

## High Priority

### H1. Randomize produces impossible values in the shipped template (about 42% of presses)
- **File:** `js/core/random.js:33-46` (`digits` / `renumber`), applied by `random.js:87` (status) and `:72` / `:93`
- **Scenario:** The template has status `workers {a2b:0/3}`. Each part of a fraction gets new digits on its own. Over seeds 1..200, 83 produce a numerator larger than the denominator or a zero denominator: `3/2`, `6/2`, `8/0`, `6/1`, `9/7`. Other forms seen in probes: `100%` → `402%`, `0.5 s` → `7.8 s` (the leading `0` of a decimal is forced to 1-9, a 15× change), `09:30` → `63:78`. Users hit this on the main Randomize button of the only template, and the "numbers change, words don't" promise reads as broken.
- **Fix:** In `renumber`, treat compound tokens as units:
  - `(\d+)/(\d+)`: keep the denominator, draw the numerator from `r.int(0, den)`
  - `\d+%`: clamp to 0..100
  - `\d{1,2}:\d{2}`: skip, or regenerate as a valid clock
  - decimals: keep a leading `0.` (only force a non-zero first digit when the integer part has 2+ digits)

  Add a test that asserts numerator ≤ denominator over seeds 1..50.

## Medium Priority

### M1. Step names are not sanitized before they reach markup, and `String.replace` interprets `$` patterns
- **Files:** `js/core/layout.js:43` (steps get `text.sanitize` only, while names also get `.replace(/[{}*]/g,'')`). Step names flow into markup at `generators.js:203` (`{@step}` inside `{a2b:{@step}}`), `generators.js:130` (log phrases), `generators.js:170` (side-column milestone titles) and `flow.js:94` (`'{dim:' + steps… + '}'`).
- **Scenario:** Step `fo}rk $& {n}` (verified):
  - status renders `step [fork $& {n}}]` because the `}` closes the tag early and a stray `}` is left over
  - the log renders `fo}rk {step} 8: started`: `$&` expands to the matched `{step}`, then `.replace('{n}', …)` hits the step name's `{n}` instead of the phrase's placeholder

  Not reachable from share links today (config-file has no `steps`), but the phase-5 editor will make it user input.
- **Fix:**
  - in `makeCtx`, apply the same `[{}*]` strip to steps
  - in the log generator, use one callback replace: `phrase.replace(/\{(step|n|d)\}/g, (m, k) => ({ step, n: …, d: … })[k])`

### M2. Actor ids `step` / `stepn` collide with the step tokens
- **File:** `js/core/generators.js:201-206`, `js/core/layout.js:11`
- **Scenario:** An actor with id `step` is accepted by `makeCtx` (not in RESERVED). Generated header/status markup emits `{@step}` meaning "this actor's name", but resolveTokens checks `id === 'step'` first and substitutes the current step name. Verified: `{@step}` → `delegate`, not `Stepper`.
- **Fix:** Add `'step', 'stepn'` to `RESERVED` in `layout.js` (one line), or use a different token namespace for steps (e.g. `{@#step}`).

### M3. Auto side-column always emits a skipped link in the default (fan) preset
- **File:** `js/core/generators.js:167-171`
- **Scenario:** The generator puts the `{m:listening}` note before the first milestone, so `before plan → lead` lands below the lead node row. `skipped = [{from:'before plan', to:'lead', reason:'out-of-rows'}]` at 80, 96 and 120 cols, every step. The hand-written template puts the milestone first and gets no skips. The hub preset with auto has 0 skipped, which is good.
- **Fix:** Emit the first milestone before the note (match the template order), and add an assertion in generators.test that `skipped` is empty for an auto side-column in fan and hub at 96 cols.

### M4. Phantom assertion: "different seed → same words" is not actually tested
- **File:** `tests/generators.test.js:5,31`
- **Scenario:** `words()` is defined, but the only use is `assert.eq(words(s42).replace(/ /g,'').length > 0, true)`, which is always true. A generator that picked words from the seeded stream would pass. The fixed substring list covers only 6 hand-written phrases, not auto blocks.
- **Fix:** Compare sorted alphabetic word lists for seed 0 and seed N, with the auto blocks on and off. A ready check is in the review scratch (`rv4b.js`): `(s.match(/[A-Za-z][A-Za-z']*/g)||[]).sort()`. Ignore runs of a single glyph repeated, which are timeline patterns.

### M5. Setting state while playing renders one paused frame (flicker)
- **File:** `js/app.js:59-63` (`setState` → `render()` with no args → `playing=false`)
- **Scenario:** Clicking Randomize, or changing theme/border/cols, during playback renders one paused frame: the timeline fully revealed, the cursor mid-step, meters full. The next RAF tick restores the playing frame, so the user sees a visible one-frame flash. `player.sync` restarts the clock only when the patch contains `step`.
- **Fix:** In `setState`, render from the player state: `const p = player && player.state(); render(p && p.playing ? p.step : undefined, p && p.t, p && p.playing);`

### M6. The plan requires a loop control; there is no UI for it
- **File:** `index.html:30-34`, `js/app.js:96-110`; plan phase-04 "Player: Play/Pause, prev/next, tốc độ (0.3–3 s/bước), loop"
- **Scenario:** `player.setLoop` exists but nothing calls it, so loop is always on and the non-loop path (`done`, auto-restart) is unreachable from the app. The phase is marked `completed`.
- **Fix:** Add a loop checkbox wired to `player.setLoop`, or record the deferral in the plan.

## Low Priority

### L1. Generator step is not clamped like `ctx.step`
- **File:** `js/core/generators.js:187`
- **Scenario:** A share link with `step: 50` (allowed by `config-file` 0..99) on 7 steps: `ctx.step` clamps to 6 (`{@step}` = ship), but the status generator uses 50, so every actor shows `done` (lead should be `busy` at ship) and events are multiplied by 51.
- **Fix:** Use `ADG.layout.makeCtx(config).step` (already computed inside `activity`). Return it on `A`.

### L2. In non-loop mode, `play()` at the last step restarts from 0 even when the user picked it
- **File:** `js/ui/player.js:30`
- **Scenario:** Pause, select the last step manually, press Play: playback jumps to step 0. Not reachable today because of M6.
- **Fix:** Track a `finished` flag set in `tick`'s `done` branch and restart only when it is set.

### L3. `seek(NaN)` sets `step = NaN`
- **File:** `js/ui/player.js:46`
- **Scenario:** Not reachable from current buttons. `sync` guards with `|| 0` but `seek` does not.
- **Fix:** `Math.floor(s) || 0`.

### L4. Unknown actor tokens render as raw `{@ghost}` / `{@lead^}`
- **File:** `js/core/generators.js:206`
- **Scenario:** Deleting the `lead` actor (phase-5 editor) leaves the template showing `{@lead^}` as literal text inside headers and nodes. Note that `ctx.N` falls back to the id for unknown ids.
- **Fix:** Fall back to `id` (upper-cased for `^`) instead of returning `m`, or surface a self-check warning.

### L5. Per-tick waste in the app loop
- **File:** `js/app.js:97` (`steps: n` → `templates.get()` deep copy every RAF), `js/app.js:31-33` (3 `setProperty` calls every frame), `onFrame` writes `textContent` / `aria-pressed` every tick, `grid.js:205` `console.warn` in `selfCheck` runs at 60 fps when a config has issues
- **Fix:** Cache the step count and update it on `setState`. Write the play button and CSS vars only on change. Throttle or deduplicate the self-check warning.

### L6. Duplicate actor ids are listed twice by generators
- **File:** `js/core/generators.js:51`
- **Scenario:** Duplicate id `lead`: timeline rows `…,lead`, meters `lead,lead,router` (verified). `makeCtx` uses the last entry for name and slot.
- **Fix:** Dedupe `ids` in `activity()` (`Array.from(new Set(...))`). The phase-5 editor should prevent duplicates as well.

### L7. `resolveTokens` mutates in place, and the test helpers mutate the caller's config
- **File:** `tests/layout.test.js:3`, `tests/flow-layout.test.js:3`
- **Scenario:** The `compose` wrapper resolves tokens on the passed config. A test that composes, renames an actor, then composes the same object again would keep the old name. No current test does this, but it is a footgun.
- **Fix:** Resolve on a clone in the helper, or document the in-place behavior in the helper comment.

### L8. Jittered `{bar:1:6:a1}` on the lead node contradicts its "high" label
- **File:** `agent-pipeline.js` lead node, `random.js:50`
- **Scenario:** Cosmetic, within the agreed design (numbers vary).
- **Fix:** Exempt full bars (ratio ≥ 1), as `ratio()` already does for meters.

## Edge Cases Found by Scout
- Actor-name injection (`{`, `}`, `*`, `@`): neutralized at `makeCtx`, verified.
- Step-name injection: not neutralized (M1).
- `{@step}` / `{@stepn}` collide with ids (M2).
- Out-of-range `current` (L1). Steps shrinking while playing: handled by modulo and the `done` path.
- Hidden tab (long gap in elapsed time): handled by modulo in loop mode, `done` in non-loop mode.
- `<>` token at the reveal boundary: `<` is drawn and `>` is dotted for one frame. Acceptable.

## Plan follow-ups (report only; plan not edited)
Done:
- rename propagation (tested)
- seed determinism
- auto=false kept
- < 8 ms
- tests pass
- the self-check matrix is clean

Open:
- loop control (M6)
- the success-criteria checkboxes in the phase file are still unchecked although `status: completed`
- the "same words" criterion has no real test (M4)

## Metrics
- Tests: 151/151 pass
- Self-check: 0 issues across 1680 + 672 frames
- Render time: about 3.6 ms per frame at 96 cols (including selfCheck)
- Lint/type: no tooling in the repo (vanilla JS)

## Score: 7.5/10

## Unresolved Questions
- Should Randomize offer a way back to seed 0 (the exact ref.png look)? It currently picks 1..9998 only.
- Should `speed` be persisted in the config/share link the way `seed` is?

Status: DONE_WITH_CONCERNS
Summary: Phase 4 meets its acceptance criteria (tests, determinism, rename propagation, perf, clean self-check matrix). Randomize turns template fractions like `0/3` into impossible values about 42% of the time. Step names are not sanitized before markup, `{@step}` collides with actor ids, the auto side-column always skips its first link in the fan preset, and the "same words" test is a phantom assertion.
