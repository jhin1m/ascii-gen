---
phase: 6
title: "Phase 6: Canvas output and exports"
status: completed
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 6: Canvas output and exports

## Overview
Renderer canvas vẽ từng ô + window chrome + hiệu ứng; dialog Xuất: PNG 1x/2x/3x (±chrome), copy plain text, tải/mở .json, share link nén vào URL hash.

## Requirements
- Functional:
  - `renderCanvas(grid, pal, opts{scale, chrome, win, font, size, lineHeight, glow, scanline})`: cell width = `measureText('M').width` của font đã load; vẽ nền, `fillRect` cho ô có bg, `fillText` từng ô (bold → font weight 700); glow = `shadowBlur`; scanline = overlay
  - Chrome canvas 4 kiểu dùng chung spec `window-chrome.js`
  - Chờ font: `document.fonts.load('700 <size>px "<font>"')` trước khi vẽ
  - PNG: `canvas.toBlob` → tải `ascii-dashboard-<template>-<scale>x.png`; hiện kích thước dự kiến trong dialog
  - Plain text: `grid` → dòng nối `\n`, cắt khoảng trắng cuối dòng; `navigator.clipboard.writeText` + fallback `execCommand('copy')`
  - JSON: tải `.json`; mở file → validate version/shape → load (lỗi → toast)
  - Share link: `JSON → CompressionStream('deflate-raw') → base64url` → `#c=...`; mở trang có hash → giải nén → load (ưu tiên hơn localStorage); cảnh báo nếu URL > 8 KB
  - Base URL: hằng `SHARE_BASE` trong `js/export/share-link.js` (URL GitHub Pages, điền ở phase 8); rỗng → `location.origin + location.pathname`; đang ở `file://` và `SHARE_BASE` rỗng → cảnh báo "link chỉ mở được trên máy này" <!-- Updated: Validation Session 1 - shareBase -->
  - Dialog Xuất theo mockup `Export.dc.html` (phần GIF/MP4 để phase 7 nối)
- Non-functional: PNG 3x 96 cột < 1 s trên máy thường

## Related Code Files
- Create: `js/output/canvas-renderer.js`, `js/output/canvas-chrome.js`, `js/output/window-chrome.js` <!-- Updated: phase 3/6 execution - created here -->, `js/export/png.js`, `js/export/plain-text.js`, `js/export/config-file.js`, `js/export/share-link.js`, `js/ui/export-dialog.js`
- Modify: `index.html`, `style.css`, `js/app.js`
- Create: `tests/plain-text.test.js`, `tests/share-link.test.js` (base64url round-trip; nén test trong trình duyệt nếu Node thiếu CompressionStream — Node ≥18 có)

## Implementation Steps
1. Đo metrics font (cell w/h theo lineHeight), canvas size = cols×cw + padding (+ chrome)
2. Vẽ grid + chrome + effects; DPR không áp cho export (scale tường minh)
3. PNG / plain text / JSON / share link
4. Export dialog + toast
5. So PNG 2x với preview HTML (ảnh chụp) — lệch thì chỉnh metrics

## Success Criteria
<!-- Updated: phase 3/6 execution -->
- [ ] PNG 2x: kích thước = 2× preview, font đúng, có/không chrome, 4 kiểu cửa sổ — code xong; parity PNG vs HTML với web font thật (VT323/IBM Plex/Fira) chưa kiểm → Phase 8
- [x] Plain text dán vào code block Markdown thẳng cột — `tests/plain-text.test.js`; clipboard thật trong trình duyệt → Phase 8
- [ ] Share link mở tab mới ra đúng hình; .json round-trip giống hệt — round-trip unit test xanh; tải/clipboard/mở tab thật, file://, Safari/Firefox chưa kiểm → Phase 8
- [x] Tests pass — 140/140

Ghi chú hoàn thành: `js/output/window-chrome.js` (ADG.windowChrome, hình học em cho macos/windows/ubuntu/crt/none) đã tạo ở Phase 6; Phase 5 dùng lại. Canvas area guard cũng chặn Chrome/Firefox >16.7MP (chấp nhận).

## Risk Assessment
- VT323 metrics khác (hẹp/cao) → đo thật, không giả định 0.6em
- Canvas glow chậm ở 3x → chỉ bật shadowBlur khi glow on, vẽ theo run cùng màu
