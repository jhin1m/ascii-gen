---
phase: 8
title: "Phase 8: Visual QA and polish"
status: todo
priority: P1
effort: "4h"
dependencies: [5, 6, 7]
---

# Phase 8: Visual QA and polish

## Overview
Kiểm tra trực quan trong trình duyệt thật: so template Agent pipeline + Midnight với `ref.png`, export PNG 2x, mobile 390px, ma trận self-check; chỉnh đến khi khớp phong cách.

## Requirements
- Functional:
  - Mở app (file:// và `python3 -m http.server`), chụp màn hình preview Agent pipeline/Midnight/macOS → so `ref.png`: màu nền/nhấn, độ đậm, viền, highlight dòng bảng, breadcrumb, timeline cursor, log tail, status bar, mật độ chữ
  - Export PNG 2x → mở file kiểm tra kích thước, font, chrome
  - DevTools 390px: không cuộn ngang, preview vừa, nút ≥ 44px
  - Ma trận self-check tự động: script trong console `ADG.qa.matrix()` chạy 4 template × 7 theme × 2 viền × 80/96/120 → 0 cảnh báo
  - Safari: hiển thị + PNG + MP4
- Non-functional: ghi lại ảnh chụp trước/sau vào `plans/261004-0554-ascii-dashboard-generator/reports/`

## Related Code Files
- Create: `js/core/qa-matrix.js` (chỉ gọi tay từ console), `plans/261004-0554-ascii-dashboard-generator/reports/visual-qa-report.md`
- Modify: theo phát hiện (theme Midnight, block spacing, chrome)

## Implementation Steps
1. Chạy ma trận self-check, sửa lỗi
2. Chụp + so ref.png, liệt kê khác biệt, chỉnh, lặp
3. PNG 2x + GIF + MP4 thử thật
4. Mobile 390px
5. Viết QA report (ảnh, khác biệt còn lại, quyết định chấp nhận)
6. Deploy GitHub Pages: **hỏi người dùng xác nhận** tên repo + public/private trước khi `gh repo create` / push; bật Pages (branch `main`, root); điền `SHARE_BASE`; mở URL thật kiểm tra share link từ máy/tab ẩn danh <!-- Updated: Validation Session 1 - GitHub Pages deploy -->

## Success Criteria
- [ ] Người dùng xác nhận phong cách khớp ref.png
- [ ] Ma trận self-check 0 cảnh báo
- [ ] PNG 2x, mobile 390px đạt
- [ ] `node tests/run.js` pass
- [ ] App chạy trên GitHub Pages; share link mở đúng hình ở tab ẩn danh

## Risk Assessment
- "Khớp phong cách" chủ quan → so theo checklist hạng mục ở trên, người dùng chốt cuối
