---
phase: 1
title: "Phase 1: Core grid, markup, theme, HTML output"
status: done
priority: P1
effort: "6h"
dependencies: []
---

# Phase 1: Core grid, markup, theme, HTML output

## Overview
Dựng khung dự án + lõi render: buffer ô ký tự, primitives vẽ, markup inline, theme/palette, xuất HTML `<pre>`, self-check, test runner Node.

## Requirements
- Functional:
  - Grid `W×H` ô `{ch, fg, bg, b, k}`; `fg/bg` là **key màu** (`fg, mut, dim, dot, a1..a6, hlrow, hlstep, hlcur, logrow`), không hex
  - Primitives: `put, text, mtext, center, right, fillBg, hline(dashed), vline, divider, box(solid|dash|dbl, label), bar, meter, arrowR/arrowL/arrowDown, arrowBoth`, junction set `J` theo kiểu viền (ascii `+-|=` / unicode `┌─│═┬┴╤╧╟`)
  - Markup: `{a1:..}`, `{a1b:..}`, `{actor:..}` (bold, màu actor), `{dim:..}`, `{m:..}`, `{bar:r:w:slot}`, `**..**`; `mlen()`; `clip(s,n)` với `…`
  - Theme: 7 palette (giá trị trong mockup), `palette(theme, overrides)` sinh màu phái sinh bằng `mix()`
  - HTML output: mỗi dòng 1 `<div>`, span gộp cùng style; space không bg nhập span kề; class `adg-blink` cho ô `k='blink'`
  - Self-check: dòng ≠ W ô hoặc chứa ký tự rộng/emoji → `console.warn` + trả danh sách lỗi
  - Input text: `normalize('NFC')`; ký tự rộng → `?`
- Non-functional: `js/core/*` không dùng DOM; mỗi file < 300 dòng

## Architecture
- `window.ADG = window.ADG || {}`; mỗi file gắn 1 namespace con (`ADG.grid`, `ADG.markup`, `ADG.theme`, `ADG.htmlOut`)
- Thứ tự `<script>` trong `index.html` = thứ tự phụ thuộc (core → blocks → output → ui → app)
- Tests: `tests/run.js` tạo `vm` context `{ window: {}, console }`, nạp `js/core/*.js` theo thứ tự, chạy `tests/*.test.js` (mini `assert` tự viết, ~40 dòng)

## Related Code Files
- Create: `index.html`, `style.css`, `js/core/grid.js`, `js/core/markup.js`, `js/core/theme.js`, `js/core/text-utils.js` (NFC, wide-char, clip), `js/output/html-renderer.js`, `js/app.js` (bootstrap tối thiểu: render 1 grid demo)
- Create: `tests/run.js`, `tests/assert.js`, `tests/grid.test.js`, `tests/markup.test.js`, `tests/theme.test.js`
- Reference: `plans/reports/brainstorm-mockup-261004/Terminal.dc.html` (makeGrid, parse, palette, toRows, selfCheck)

## Implementation Steps
0. `git init`; `.gitignore` (`.DS_Store`, `node_modules/`, `*.log`); commit đầu `chore: scaffold project` (gồm `ref.png`, `plans/`) <!-- Updated: Validation Session 1 - git init -->
1. Scaffold `index.html` (Google Fonts link 4 font, preview container), `style.css` (tokens app UI tối, `.adg-pre` tắt ligature: `font-variant-ligatures:none; font-feature-settings:"liga" 0,"calt" 0`, `@keyframes` blink)
2. `text-utils.js`: `toCells(str)` = `Array.from(str.normalize('NFC'))`, `isWide(ch)`, `clip`
3. `grid.js`: `createGrid(W,H,{border})` + primitives + `J`; `put` bỏ qua ngoài biên; `put` không ghi đè `bg` khi không truyền
4. `markup.js`: `parse(s, actors)` → segments; escape `{{` → `{`; `mlen`
5. `theme.js`: `THEMES`, `mix`, `palette()` + override từng màu
6. `html-renderer.js`: `renderHTML(grid, pal, {blink})` → string (escape `& < >`), dùng `innerHTML` một lần cho preview
7. `selfCheck(grid)` trong `grid.js` (kiểm tra trên cells sau khi ghi + chuỗi serialize)
8. Tests: primitives đúng ký tự/toạ độ, box 3 kiểu × 2 viền, markup lồng màu/bar, clip, NFC tiếng Việt, wide char → `?`

## Success Criteria
- [x] `node tests/run.js` pass (48/48)
- [x] Mở `index.html` (file://) thấy 1 grid demo đủ box/bar/markup, đổi 7 theme đúng màu
- [x] Self-check 0 cảnh báo cho demo; chèn emoji → có cảnh báo, không vỡ cột

## Risk Assessment
- Ligature Fira Code làm lệch cột HTML → CSS tắt liga/calt (kiểm tra bằng mắt ở phase 8)
- Ký tự ambiguous width (`·`, `»`, `█`) — giữ danh sách ký tự an toàn; thêm vào test

## Completion Notes (2026-10-04)
- Thêm ngoài spec: `grid.blit(src,x,y)` (mang theo issues của grid con), `vline(..., ch)` ký tự tuỳ chọn, `toLines()`
- Toạ độ/kích thước lẻ được floor; `{bar}` width cap 256; ký tự `\p{Cf}` bị loại, `\p{Zl}\p{Zp}\p{Cs}` → `?`
- Phase 2: side column dùng `vline(..., ':')` ở cả 2 kiểu viền (giống ref.png)
- Reports: `../reports/from-code-reviewer-to-main-phase-01-core-review-report.md`, `../reports/from-tester-to-main-phase-01-core-test-report.md`
