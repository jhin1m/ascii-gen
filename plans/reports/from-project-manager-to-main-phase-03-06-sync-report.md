# Plan sync: Phase 3 + 6 complete

Plan: plans/261004-0554-ascii-dashboard-generator/

## Progress: 4/8 phases done (1, 2, 3, 6)
| Phase | Status | Evidence |
|---|---|---|
| 3 Flow DSL | Completed | 140/140 tests, self-check 0 warn, review 8.5/10 |
| 6 Canvas/exports | Completed | same; unit-level only for downloads/clipboard/pixel parity |

## Success criteria not ticked (by design)
- P3: hub side-column arrows (agent-pipeline hub shows none); DSL invalid keeps old picture (M6 -> Phase 5).
- P6: PNG 2x parity with real web fonts; share link/.json in real browser -> Phase 8.

## Carry-over written
- P4: actor-derived node title/footer/sub defaults; skipped[] contract; hub side-column arrows.
- P5: autosave sync before loadFromHash; M6; N2; N4; show skipped reasons; reuse window-chrome.js (now Modify/reuse, not Create); integrate existing export UI.
- P8: real downloads/clipboard, file://, Safari/Firefox, font parity, >16.7MP guard, fan vs ref.png.

## Scope changes logged
- DSL keys = actor ids; presetDsl(id) (plan text updated).
- window-chrome.js moved Phase 5 -> Phase 6.
- layout.compose returns skipped[] (replaces console warnings).

## Next
- Runnable now: Phase 4 (dep 3 done). Then Phase 5 (dep 4). Phase 7 needs 4 + 6 (6 done, waits on 4). Phase 8 needs 5, 6, 7.
- Critical path: 4 -> 5 -> 8 (7 parallel to 5 once 4 done).
- Owner: main agent. DoD each phase: tests green, self-check 0 warn, phase file ticked, 1 conventional commit.

## Risks
- Phase 6 browser behavior unverified until Phase 8 (late discovery risk; font metrics drift could force rework). Mitigation: smoke-test PNG export in Phase 5 once UI wired.
- Uncommitted work: Phase 3/6 files still untracked/modified in git; commit per plan constraint (1 commit/phase).

## Unresolved questions
- Commit Phase 3 and 6 as two commits or one? (changes interleaved in js/app.js, index.html, style.css)
