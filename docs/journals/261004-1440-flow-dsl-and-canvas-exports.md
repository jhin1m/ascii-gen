# Flow DSL and Canvas Exports: two phases in parallel, one spec reversal

**Date**: 2026-10-04 14:40
**Severity**: Medium
**Component**: Flow DSL (`js/core/flow-dsl.js`, `flow-graph.js`, `blocks/flow.js`), canvas output and exports (`js/output/*`, `js/export/*`)
**Status**: Resolved (phases 3 and 6 closed; browser parity unverified until phase 8)

## What Happened

Phase 3 (DSL parser, tier/hub/back-edge layout, fan/hub presets) and phase 6 (canvas renderer, window chrome, PNG/text/JSON/share link) ran in parallel under strict file ownership. The orchestrator pre-created the phase 3 stub files and their script tags, so only phase 6 touched `index.html`. That avoided merge conflicts. Commits: `6a9b11d` (phase 3), `a88fbba` (phase 6). Tests went 94 -> 140. Review score went 8 -> 8.5/10.

## The Brutal Truth

The review found a High issue that was our own spec's fault. The spec said "DSL uses display names". We built to it. Then the review showed that renaming actor `lead` to "Trưởng nhóm" silently orphaned `cfg.nodes.lead` and the side-column anchors, and produced two "no clear path" warnings. That contradicts our own success criterion that renaming an actor in one place updates every block. Shipping phase 4/5 on top of name-keyed persistence would have been expensive to unwind. It's irritating that the spec contradicted itself and nobody noticed until review.

## Technical Details

- H1: node keys were derived from display names. Fixed so the DSL references actor IDs and `flow.js` `identity()` resolves them through `ctx.slot`/`ctx.N`.
- M1: `constructor -> b` parsed to the key `constructor#function Object() { [native code] }1`. `{}` maps were replaced with `Object.create(null)`.
- M2: a share hash overrode autosave on every reload, so it is now cleared via `replaceState`, with a sequence guard against stale decodes.
- M3: the canvas check only covered per-side limits. Added a 16,777,216 px area cap and a null-context guard, because Safari returns `null` from `getContext('2d')` and the toast said "null is not an object".
- M5: NFD Vietnamese (`Tién`) was rejected by the parser. Now normalised to NFC and read by code point.

## What We Tried / Decisions

- N1 (re-review): to silence the hub-plus-side-column warnings, `side-column.js` started dropping links silently. That also hid typos: `link = 'leadd'` gave 0 warnings. Decision: replace the silent drop with `layout.compose().skipped [{from,to,reason}]`, so the phase 5 editor can show reasons inline.
- Rejected: option (b), keeping display-name keys and rewriting them on rename. It is fragile when the DSL is hand-edited.
- M6 (a bad DSL discards the previous picture) is deferred to phase 5. The editor must validate before committing.

## Root Cause Analysis

Name-keyed identity came from a spec that conflated display text with identity. N1 was a "make the warnings go away" fix that removed the diagnostic along with the noise. The original test never asserted the warning, so nothing caught it.

## Lessons Learned

- Never key persisted data by display text. Use ids.
- The shared `index.html` script list that `tests/run.js` reads is the hotspot for parallel work. Pre-create stubs and tags, and give one phase sole ownership of the file.
- Silencing a warning is not a fix. Replace it with structured output (`skipped[]`) rather than deleting it.
- Pin diagnostics with tests, not just the geometry.

## Next Steps

- Phase 4 (main agent): actor-derived node title/footer/sub defaults, hub side-column arrows.
- Phase 5: load autosave synchronously before `loadFromHash()`; reuse `window-chrome.js`; validate the DSL before commit (M6); surface `skipped` reasons; extend `configFile.FIELDS` and decide on payload v1 vs v2.
- Phase 8: real downloads and clipboard, `file://`, Safari/Firefox, font pixel parity between canvas and HTML preview. This is unverified, so a late surprise is possible. Smoke-test PNG export in phase 5 once the UI is wired.

Status: DONE
Summary: Journal written. AgentWiki publish skipped: `agentwiki` CLI not found and no AgentWiki MCP tools exposed in this session.
