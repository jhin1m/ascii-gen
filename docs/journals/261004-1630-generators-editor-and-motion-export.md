# Generators, Editor and Motion Export: three reviews, three rounds of "it works on my tab"

**Date**: 2026-10-04 16:30
**Severity**: Medium
**Component**: Generators and step player (phase 4), editor panel and autosave (phase 5), GIF/MP4 export (phase 7), QA matrix (phase 8)
**Status**: Resolved in code (168 tests, `ADG.qa.matrix` 0 issues); Safari/Firefox, real downloads and deploy unverified

## What Happened

Phases 4, 5, 7 and 8 landed in one stretch. Phase 4 added generators, seeded randomize, the step player and a pure `renderFrame` pipeline. Phase 5 added the editor panel, three new templates, autosave (`adg:v1`), a JSON tab, HTML window chrome and a mobile accordion. Phase 7 added our own GIF89a/LZW encoder (frame diff, fixed theme palette) and MP4 via WebCodecs plus mp4-muxer 5.2.2 (lazy CDN load with SRI), with a MediaRecorder fallback. Phase 8 ran the QA matrix and added dashed boxes to match `ref.png`. Commits: `5fecf61`, `7a1e7d1`, `353bcf1`, `894ce64`, `a5d96e3`, `cdac0a8`, `7ee44fa`. Tests went 140 -> 168.

## The Brutal Truth

Every review found real bugs, and the scores say so: 7.5, 6.5, 7.5. Phase 5 at 6.5 stings most. The editor lost the user's first click, wiped playback steps on every keystroke, and ate a DSL newline. A hand-test would have caught each of these in under a minute. We found them through review and a real-mouse browser run. It's also annoying that hidden-tab throttling nearly fooled our own verification, so some "passing" checks were just the browser sleeping.

## Technical Details

- Phase 4 review: randomize turned ratio "0/3" into "8/0". Step names were unsanitized. `{@step}` collided with the actor id `step`.
- Phase 5 review: typing cleared all playback steps. A trim mismatch consumed the DSL newline. The first click was lost because commit-on-blur rebuilt the section between mousedown and click. The list codec merged hidden fields by position.
- Phase 7 review: the MediaRecorder `stop` listener was attached too late, so export stayed busy forever. A `focusout` redraw bypassed the pointer gate.
- Browser testing: hidden tabs pause `requestAnimationFrame`, and `setTimeout` is throttled to >= 1 s. Store notifications moved to microtasks, preview render falls back to `setTimeout` when `document.hidden`, and frame yielding switched to `MessageChannel`. Stale closures in click handlers overwrote just-committed edits. Handlers now read state at event time. A real-mouse test (rename, then click "+ Actor") confirmed the fix.
- Performance: render ~2.9 ms at 96 cols. GIF of 126 frames at 96 cols, 1x, took 10.9 s and 1.1 MB.

## What We Tried / Decisions

- `agent-pipeline` stays hand-tuned, not auto-generated, to match `ref.png`. Auto layout drifted from the reference.
- Renames propagate through `{@id}` name tokens resolved at render time. The alternative, generators rewriting text, would fight hand-edited DSL, the same trap as name-keyed identity in the earlier flow DSL entry.
- Seed changes only numbers. `renumber` now skips ratios, times, percents and decimals.
- Wrote our own GIF encoder instead of pulling a library. The fixed theme palette and frame diff keep size at 1.1 MB.

## Root Cause Analysis

Two causes. First, UI state was captured in closures and redraws rebuilt DOM mid-gesture, so events raced the render. Second, we tested in a backgrounded tab, where timing primitives behave differently from a foreground one. Randomize breaking ratios was a plain lack of a "what must not change" spec.

## Lessons Learned

- Read state at event time, never from a closure created at render time.
- Never rebuild DOM between mousedown and click. Gate redraws on pointer state.
- Attach listeners before starting the thing that fires them (`MediaRecorder.stop`).
- Do not trust rAF or timers in headless or hidden tabs. Use microtasks or `MessageChannel`.
- Randomizers need an explicit list of values they may not touch.

## Next Steps

- Owner: user. Sign off on the `ref.png` style match.
- Owner: user. Provide repo name and visibility so GitHub Pages deploy can be set up.
- Test Safari and Firefox manually: WebCodecs fallback, `getContext` null, MediaRecorder path.
- Verify real downloads (GIF, MP4, PNG) and clipboard outside the test harness.

Status: DONE
Summary: Journal written covering phases 4, 5, 7 and 8, with decisions, review findings, browser-timing lessons and unverified items.
