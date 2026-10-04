# Code review: Phase 2 — layout engine, 9 blocks, Agent pipeline template

Date: 2026-10-04 · Reviewer: code-reviewer subagent (report saved by main session) · Score: 7.5/10, 0 critical

## Verdict
All Phase 2 requirements met, no Phase 1 regression, 89/89 tests at review time, 34 hostile configs did not throw or break width. Findings below; "Fixed" = applied in the same phase before commit (94/94 tests after).

## Findings
| ID | Sev | Finding | Outcome |
|---|---|---|---|
| H1 | High | Link arrows drawn through other content (sibling fan box, table corner, a block between side and flow) | Fixed: `layout.linkClear` draws only if target in same layout row, link y within target rows, path blank; else skip + `console.warn`. 3 regression tests |
| M1 | Med | Config colors not validated → non-palette keys in cells (`constructor` → junk CSS) | Fixed: `util.slot()` palette-key guard in layout/header/table/side/flow/meters/timeline; test asserts every cell fg/bg ∈ COLOR_KEYS |
| M2 | Med | No size caps → tiny share link can build millions of cells | Fixed: list caps (`util.arr(v, max)`, default 100; table 30, timeline 20, fan 8, side 40, lines 10, layout 40 rows, ≤4 blocks/row), page ≤ 400 rows; test |
| M3 | Med | `list` schema vs pipe-delimited editing: `|` in timeline patterns, `\n` in notes, single-field lists stored as strings, `snap` missing from variants | Deferred to Phase 5 (editor design decision) |
| L1 | Low | Literal `'|'` in fan-in instead of `J.v`; `┴/┬` where `┼` would be exact for odd fan | `J.v` fixed; `┼` left (cosmetic, Phase 3 rewrites flow) |
| L2 | Low | Names hard-coded in markup → rename needs a name token | Phase 4 (generators) |
| L3 | Low | Actor id equal to a markup tag (`a1`, `dim`, `bar`, `a1b`) hijacks it | Fixed: `makeCtx` rejects reserved/invalid ids |
| L4 | Low | `footer: true` reserved 4 blank rows | Fixed (`isObj` in `nodeHeight`) |
| L5 | Low | run.js source discovery fragile; excluded `js/export/` | Fixed: strips comments, any attribute order, includes all `js/**` except `app.js`/`ui/`, asserts non-empty + files exist |
| L6 | Low | Non-object `blocks[key]` passed as cfg | Fixed (`util.obj`) |
| L7 | Low | Test name claimed ref is 96×70 (ref is 96×68) | Fixed name |
| L8 | Low | log/meters 0.66/0.34 vs plan 62/38; snap default-on when linked | Kept (intentional, documented in side-column header) |
| L9 | Low | Anchors with w ≤ 0 at extreme widths | Fixed (filter `w >= 3`) |
| L10 | Low | Registry `{}` → `__proto__` key | Fixed (`Object.create(null)`) |
| L11 | Low | steps separator width by `.length` | Fixed (cell count) |

## Contract changes (intentional)
- `ADG.grid.JUNCTIONS.right` added (`+` / `├`)
- Junction direction: leave bottom border = down (┬/╤), enter top border = up (┴/╧) — mockup had table junctions inverted
- `tests/run.js` reads sources from `index.html`
- `index.html`: emoji toggle removed; `cols-select`, `step-select` added
- Block contract adds `links: [{x, y, to}]`; `compose()` returns `{grid, anchors, cols, rows}`

## Notes for later phases
- Phase 3: `drawNode`/`nodeHeight` exported from flow block; link pass only supports right-pointing arrows to a left edge
- Phase 4: `compose(config)` has no `t` yet; spinner follows step; app mutates `config.current`
- Phase 5: settle M3 before building list editors

## Unresolved questions
1. Unreachable linked milestone: currently arrow dropped + console warn. Should UI mark it (e.g. `<>?`)?
2. Actor ids user-typed or generated from name? (validation now in `makeCtx`; UI may need its own)
3. List editor: last field takes rest of line vs `\|` escapes (M3)
