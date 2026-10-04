---
phase: 5
title: "Phase 5: Editor UI and persistence"
status: completed
priority: P1
effort: "10h"
dependencies: [4]
---

# Phase 5: Editor UI and persistence

## Overview
Giao diện app theo mockup đã duyệt: header toolbar, panel trái thu gọn (Khối / Giao diện / JSON), preview phải với chọn cửa sổ + cột, window chrome HTML, 4 template, localStorage, mobile 390px.

## Requirements
- Functional:
  - Header: logo, select Template (Agent pipeline / Server monitor / CI/CD build / Trống), Prev/Play/Next + bước + tốc độ, Randomize, Share link, Xuất
  - Tab Khối: Nguồn dữ liệu (actors: tên + slot, thêm/xoá; steps: thêm/xoá/sắp xếp), Bố cục (hàng kéo-thả hoặc nút ↑↓, bật/tắt, tỉ lệ cột, nhãn `auto`/`preset`/`sửa tay ↺`), form từng khối sinh từ `schema`, Flow (2 thẻ preset + textarea DSL + lỗi inline + chi tiết node)
  - Tab Giao diện: 7 theme, color picker 9 màu, font (4), cỡ chữ, line-height, kiểu viền, scanline/glow/blink
  - Tab JSON: textarea toàn config, parse khi dừng gõ 400 ms, lỗi hiện dòng, hợp lệ → render
  - Preview toolbar: cửa sổ macOS/Windows/Ubuntu/Retro CRT, cột 80/96/120/tuỳ (40–200), badge self-check
  - Window chrome HTML 4 kiểu (theo mockup: tab + `_ □ ×`; `you@host:` + nút cam; bezel CRT + LED), title tự điền `cols×rows`, credit sửa được
  - Template Server monitor (preset hub), CI/CD build (DSL chuỗi), Trống (header + status)
  - Persist: `localStorage` key `adg:v1` (try/catch, debounce 500 ms); nạp lại khi mở; config có `version` để migrate
  - Mobile ≤ 720px: chỉnh sửa đầy đủ như desktop — **cùng code panel**, CSS chuyển các section thành accordion (không viết UI riêng) <!-- Updated: Validation Session 1 - mobile full accordion -->; preview trên, scale bằng `transform: scale(containerW / preW)` + set chiều cao wrapper; panel dưới; touch target ≥ 44px; không cuộn ngang
  - Hiệu ứng CSS: scanline overlay, glow `text-shadow` currentColor, blink
- Non-functional: a11y (label, aria-pressed, focus ring), không framework

## Carry-over from phases 3/6
<!-- Updated: phase 3/6 execution -->
- Boot order: load autosave synchronously BEFORE `loadFromHash()` so share link wins.
- M6: DSL invalid -> keep old picture (graph/grid); show inline error. Deferred from Phase 3.
- N2: parser error column vs NFD input - verify cursor placement on error.
- N4: duplicate anchor/node ids not warned - editor should warn.
- Show `layout.compose().skipped` reasons (missing/unreachable/out-of-rows) in flow editor.
- Reuse `js/output/window-chrome.js` (em geometry macos/windows/ubuntu/crt/none) for HTML chrome; do not recreate.
- DSL uses actor ids; `presetDsl(id)` no names arg; rename actor needs no DSL rewrite.
- Export dialog/UI wiring already exists in `js/ui/export-dialog.js`, `js/export/*` (Phase 6); integrate, don't duplicate.

## Related Code Files
- Create: `js/ui/panel.js`, `js/ui/schema-form.js`, `js/ui/data-source-form.js`, `js/ui/layout-list.js`, `js/ui/flow-editor.js`, `js/ui/style-tab.js`, `js/ui/json-tab.js`, `js/ui/preview.js` (scale-to-fit), `js/core/store.js` (state + subscribe), `js/export/storage.js`, `js/templates/server-monitor.js`, `js/templates/ci-cd-build.js`, `js/templates/blank.js`, `js/templates/index.js`
- Modify: `index.html`, `style.css`, `js/app.js`
- Modify/reuse: `js/output/window-chrome.js` (created in Phase 6) <!-- Updated: phase 3/6 execution -->
- Reference: `plans/reports/brainstorm-mockup-261004/Main.dc.html`, `Mobile.dc.html`

## Implementation Steps
1. `store.js`: state đơn, `set(patch)`, `subscribe`, render batched qua rAF
2. Markup tĩnh khung app trong `index.html`; `style.css` theo token mockup (#0d0f14, #12141b, #171a23, accent #ecd67a, IBM Plex Sans + JetBrains Mono)
3. `schema-form.js`: field → input; list → textarea pipe-delimited (`00:09 | lead | msg`); sửa → `auto=false`
4. Data source, layout list, flow editor, style tab, JSON tab
5. HTML chrome dùng lại `window-chrome.js` (đã có từ Phase 6, hình học em) <!-- Updated: phase 3/6 execution -->
6. Templates + storage + mobile scale
7. Kiểm tra tay trên Chrome desktop + DevTools 390px

## Success Criteria
- [ ] Mọi điều khiển trong mockup hoạt động thật
- [ ] Reload giữ nguyên bản đang làm; localStorage bị chặn → app vẫn chạy
- [ ] JSON sai không làm vỡ trang
- [ ] 390px: không cuộn ngang, preview vừa ngang

## Risk Assessment
- File UI phình to → tách theo tab/khu vực, mỗi file < 300 dòng
- Form sinh tự động khó dùng cho flow → flow có editor riêng (preset + DSL)
