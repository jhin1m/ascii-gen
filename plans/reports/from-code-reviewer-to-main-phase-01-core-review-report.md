# Phase 1 Core Review — ASCII Dashboard Generator

## Scope
- Files: index.html, style.css, js/core/{text-utils,theme,markup,grid}.js, js/output/html-renderer.js, js/app.js, tests/*.js (912 LOC, all untracked on top of `0e9c375 chore: scaffold project`)
- Checks run: `node --check` on all JS (clean); `node tests/run.js` (41/41 pass); my own vm probes (edge cases + app.js with a stubbed DOM: demo self-check = 0 warnings); THEMES diffed against the mockup (identical)

## Overall
The spec is met and the code mostly matches the mockup. It improves on the mockup in several places: actors are passed per grid, `{{` escaping works, unknown tags stay literal, clip uses `maxW`, palette overrides are validated, and spans are escaped. Tests check exact output and pass. The main defect is that grid primitives crash on non-integer coordinates. Phase 2's `split(cols-2, row.w)` will produce those. A few hardening gaps also matter once share links (phase 6) load configs written by other people.

## Acceptance criteria (a)
| Item | Status |
|---|---|
| Cell `{ch,fg,bg,b,k}` with palette keys | OK |
| Primitives put/text/mtext/center/right/fillBg/hline(dashed)/vline/divider/box(3 kinds, label)/bar/meter/arrowR/L/Down/Both, J set | OK |
| Markup a1, a1b, actor, dim, m, bar, `**`, `{{`, mlen, clip with … | OK |
| 7 themes = mockup values, `palette(theme, overrides)` mixes derived colors, overrides validated | OK |
| HTML: one div per row, span merge, plain spaces join, `adg-blink`, escapes `& < >` | OK |
| selfCheck returns a list and calls console.warn once | OK |
| NFC, wide/emoji become `?` | OK (Cf gap, see M2) |
| core has no DOM, files <300 lines, kebab-case, git init + scaffold commit | OK |

## Critical
None.

## High
**H1. Non-integer coordinates throw TypeError** (grid.js:80, :97, also :36/:60/:89)
- `put` floors x/y, but `mtext`'s ellipsis branch writes `cells[y][lx].ch` directly with an unfloored `lx`, and `fillBg` indexes `cells[y][i]` without flooring.
- Reproduced:
  - `mtext(0,0,'abcdefghij','fg',false,null,5.5)` → `Cannot set properties of undefined (setting 'ch')`
  - `center(0.5, 7, 0, 'abcdefghij')` → same error
  - `fillBg(0, 0.5, 2, 'hlrow')` → `Cannot read properties of undefined`
- `createGrid(3.5,1)` builds 4 cells per row but `W=3.5`, so selfCheck reports 2 false issues.
- Why it matters: phase 2 splits widths (`split(cols-2, row.w)`) and centers inside them, so floats will reach these paths and blank the whole preview.
- Fix: floor `W`/`H` in `createGrid`. Floor `x`, `y`, `w`, `maxW` at the top of `fillBg`, `mtext`, `center`, `box`, `bar` and `meter` (or one `const I = Math.floor` helper). In `mtext`, use `g.put` for the ellipsis instead of the direct cell write. Add a test with fractional inputs.

## Medium
**M1. Inline bar width has no upper bound** (markup.js:43; grid.js:135)
- `{bar:1:20000000:a1}` takes about 3.2 s and grows linearly. Phase 6 share links render markup written by other people, so one link can freeze the recipient's tab.
- Fix: clamp `w` to a reasonable ceiling (e.g. 200), or to `W - x` in `mtext`/`bar`. Phase 5/6 should also clamp `cols`/`rows` before `createGrid`.

**M2. Format, bidi and line-separator characters are not handled** (text-utils.js:9-10; style.css:40)
- `isBadCell` and `sanitize` let these through: U+202E (RLO), U+2066 (isolates), U+00AD (soft hyphen), U+061C, U+2028/2029 and tag characters U+E00xx.
- Effects:
  - soft hyphen and tag characters are invisible, so the HTML row is one column short;
  - RLO and isolates reorder the rest of the row visually;
  - U+2028 breaks lines in the text export;
  - Hebrew/Arabic letters also get bidi-reordered inside a row.
- Fix: add `\p{Cf}` to ZERO (dropped) and `\p{Zl}\p{Zp}` to CONTROL (`?`). Add `.adg-row{direction:ltr;unicode-bidi:bidi-override}` so visual order always equals cell order.

**M3. Issues are lost when sub-grids are blitted** (grid.js:37, :43, :166)
- When `put` replaces an emoji with `?`, the only record is in that grid's `g.issues`. Phase 2 renders each block into a sub-grid and blits it into the main grid. The main grid's selfCheck then sees only `?` and reports 0 issues.
- This breaks the success criterion "chèn emoji → có cảnh báo" once blocks exist.
- Fix: add `g.blit(src, ox, oy)` to grid.js in phase 1. It should copy cells and merge `src.issues` with the offset, so layout.js does not reimplement it.

**M4. Clipping can overwrite a bar's closing bracket** (grid.js:65, :80)
- `mtext(0,0,'ab{bar:1:4:a1}xyz','fg',false,null,6)` → `ab[##…`: the bar's `]` is replaced by `…`.
- Text clipping is correct, but the content budget should be `lim-1` when anything follows.
- Fix: check bars with `n + seg.w > lim - 1` when `total > maxW`. The ellipsis branch also keeps the overwritten cell's fg/bold, while the `n<lim` branch uses dfg — inconsistent.

**M5. `bar` with w<2 draws outside its own area** (grid.js:137-142)
- `bar(3,0,0,...)` → `"  ]["`. `bar(4,0,-2,...)` writes `]` at x=1.
- Narrow layouts (phase 2 notes 80 cols is tight) can pass small widths and clobber neighbouring cells.
- Fix: `if (w < 2) return;` (and `meter` already tolerates 0).

## Low
- L1. markup.js:44 — the actor slot is not validated. `{lead:'nope'}` produces `fg:'nope'`. HTML falls back to `pal.fg`; the phase-6 canvas renderer must do the same, or validate here with `colorKey(actors[tag]) || 'fg'`.
- L2. grid.js:103 — the mockup's `vline(x,y,len,fg,ch)` took a custom character, used for the side column `:` in both border modes. The new `dashed` flag gives `╎` in unicode, which may not match the phase-2 "side column kéo dài `:`". Decide before phase 2.
- L3. grid.js:101/107 — a dashed ascii `arrowR` with an even length leaves a gap before the head (`- - - >`). Mockup parity, cosmetic.
- L4. text-utils.js:17 — a lone surrogate (e.g. `"\ud83d"` from a hand-edited JSON or share link) passes `isBadCell`. Treat `/\p{Cs}/u` as bad.
- L5. Ambiguous-width or font-fallback glyphs (✓ ⇒ ▶ ● etc. from user input) pass selfCheck but may fall back to a proportional font in the HTML preview. Canvas and text export are unaffected. Track in phase 8 visual QA.
- L6. index.html:15 `Theme` and app.js:86 `Self-check: OK` are English in a Vietnamese UI (e.g. "Chủ đề", "Kiểm tra: OK").

## API fit for later phases (c)
- Canvas (phase 6): cells hold palette keys plus `b`/`k`; the palette includes `chrome`/`line`. Fits.
- Text export: `toLines()` plus trimEnd. Fits.
- GIF palette: uses `mix` and `COLOR_KEYS`. Fits.
- Layout (phase 2): needs H1 (integer coordinates) and M3 (blit with issues) first. Without them phase 2 either crashes or silently loses the self-check guarantee.
- Pure `renderFrame` (phase 4): `createGrid` is pure. `g.issues` is per-grid, which is fine.

## Tests
Assertions check exact strings, so these are not phantom tests. Missing cases: fractional coordinates, `maxW` ≤ 2 with a bar at the boundary, `bar` w<3, Cf/bidi characters, actor with an invalid slot.

## Recommended actions
1. H1: floor coordinates and dimensions, and use `put` for the ellipsis, before phase 2.
2. M3: add `blit` with issue merging to grid.js.
3. M1: clamp bar width (plus a cols/rows clamp later).
4. M2: handle Cf/Zl/Zp and add the CSS bidi-override.
5. M4/M5: small guards plus tests.

## Unresolved questions
- Side column in unicode mode: `:` (mockup) or `╎`? (L2)

Status: DONE_WITH_CONCERNS
Summary: Phase 1 meets every spec item and matches the mockup's behaviour; 41 tests pass and the demo self-check is clean. Grid primitives crash on non-integer coordinates, which phase 2 will produce, and blitting will drop self-check issues; both should be fixed before phase 2.
Score: 7.5/10, 0 critical
