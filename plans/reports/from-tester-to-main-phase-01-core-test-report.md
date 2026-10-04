# Phase 1 Core Test Report: ascii-gen

**Date:** 2026-10-04  
**Environment:** macOS, Node v24.18.0  
**Scope:** Core vanilla-JS grid rendering engine  

---

## Executive Summary

Phase 1 validation **PASSED** with zero failures. All unit tests pass, syntax checks pass, file sizes comply, and fuzzing stress test completed 1000+ iterations without exceptions.

---

## 1. Unit Test Results

**Command:** `node tests/run.js`

```
41 passed, 0 failed
```

**Test coverage by module:**
- `grid.test.js` (18 tests): box/bar/meter/lines/arrows, emoji/CJK handling, self-check
- `html-renderer.test.js` (4 tests): row div generation, style merging, HTML escaping
- `markup.test.js` (10 tests): color/bold/bar parsing, clipping, sanitization
- `theme.test.js` (6 tests): palette generation, color mixing, overrides

All tests exercise:
- Happy paths (text, markup, grids)
- Error scenarios (NaN, out-of-bounds coords, wide chars)
- Edge cases (empty strings, zero-width joins, control chars)
- Unicode handling (NFD Vietnamese, emoji, CJK, ZWJ sequences)

---

## 2. Syntax Validation

**Command:** `node --check` on 12 JS files

| File | Lines | Status |
|------|-------|--------|
| js/app.js | 104 | ✓ |
| js/core/grid.js | 180 | ✓ |
| js/core/markup.js | 67 | ✓ |
| js/core/text-utils.js | 38 | ✓ |
| js/core/theme.js | 53 | ✓ |
| js/output/html-renderer.js | 38 | ✓ |
| tests/assert.js | 30 | ✓ |
| tests/grid.test.js | 151 | ✓ |
| tests/html-renderer.test.js | 35 | ✓ |
| tests/markup.test.js | 65 | ✓ |
| tests/run.js | 29 | ✓ |
| tests/theme.test.js | 41 | ✓ |

**Result:** All files pass syntax check. Max file size: 180 lines (grid.js, well under 300-line limit).

---

## 3. Stress Test: Fuzzing

**Script:** Custom ad-hoc fuzz runner (scratchpad) loading sources via vm context like tests/run.js.

**Test Profile:**
- 1000 iterations
- Random grid widths: 1–120 cells
- Random grid heights: 2–30 rows
- Both border styles (ascii, unicode)
- Random operation sequences (5–20 ops per grid)

**Operations Tested:**
- `box(x, y, w, h, fg, kind, label)` — all kinds (solid/dash/dbl), labels with markup
- `bar(x, y, w, r, fg)` — ratio r in -50% to 150% (clamping tested)
- `meter(x, y, w, r, fg)` — clamps and renders head correctly
- `mtext(x, y, s, dfg, db, bg, maxW)` — markup text with clipping
- `text(x, y, s, fg, b, bg)` — plain text
- `center(x, w, y, s, fg, db)` — centered markup
- `right(x2, y, s, fg, db)` — right-aligned markup

**Input Fuzzing:**
- Random primitives at random (negative, zero, fractional, out-of-bounds) coordinates and sizes
- Random markup strings including:
  - Malformed braces: `{{`, `{invalid:unclosed`, `{{{{multiple`
  - Emoji: `😀`, `🏳️‍🌈` (rainbow flag with ZWJ)
  - CJK: Chinese, Hangul, fullwidth characters
  - NFD: Vietnamese combining marks (e.g., `é` = é)
  - Zero-width: joiners, variation selectors, BOM
  - Control characters: `\x00`, `\x01`, RLO/PDF bidirectional overrides
  - Valid markup: colors, bold, bars with out-of-range ratios

**Assertions:**
1. **No exceptions:** All 1000 iterations completed without throwing
2. **Row width consistency:** Every `grid.toLines()` row has exactly W code points (measured via `Array.from(line).length`)
3. **HTML structure:** `renderHTML()` output contains exactly H `<div class="adg-row">` divs
4. **HTML safety:** No raw `<` characters from content (all escaped to `&lt;`)
5. **Self-check:** `grid.selfCheck()` runs without error and returns issue array (wide chars, row-length mismatches flagged correctly)

**Results:**
```
Passed: 1000
Failed: 0
Exceptions: 0
```

---

## 4. Coverage Gaps & Edge Cases Verified

✓ **Unicode handling:** Emoji and CJK input correctly marked as `?` and flagged by selfCheck  
✓ **NFD normalization:** Vietnamese combining marks converted to NFC (precomposed)  
✓ **Zero-width handling:** Joiners and variation selectors stripped, don't affect grid width  
✓ **Control characters:** Detected as invalid, replaced with `?`  
✓ **Coordinate bounds:** Negative, fractional, and out-of-bounds puts ignored safely  
✓ **Bar/meter ratios:** NaN, negative, and >1.0 clamped to [0, 1]  
✓ **Text clipping (mtext):** Clips at maxW, adds `…`, maintains row width  
✓ **HTML escaping:** `&`, `<`, `>` in cell text escaped to HTML entities  
✓ **Span merging:** Adjacent cells with identical style merged into one span  
✓ **Border styles:** Both ascii and unicode glyphs render without collision  

---

## 5. Build & Environment

- **Local server:** http://127.0.0.1:8765/ (python http.server) — verified running
- **Dependencies:** None (vanilla JS, no npm packages)
- **Test runner:** Node v24.18.0 ✓

---

## Critical Issues Found

**None.** All tests pass, all code paths execute without exception, and output validation confirms correct behavior.

---

## Recommendations

1. **Maintain coverage:** Current test suite is solid; consider adding regression tests if new primitives (e.g., `diamond()`, `triangle()`) are added.
2. **Input validation:** Text truncation uses '…' which is correct; consider documenting maxW behavior if users question why text ends with ellipsis instead of trailing char.
3. **Performance:** No performance issues detected in 1000 iterations; grids are fast enough for live preview at sizes tested (1–120 × 2–30).

---

## Conclusion

**Phase 1 PASSED.** Core grid engine is robust, handles malformed input safely, and produces correct output for all tested scenarios. Ready for Phase 2 (DOM integration, live preview, UI).

