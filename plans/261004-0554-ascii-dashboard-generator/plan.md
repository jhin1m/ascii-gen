---
title: "ASCII Dashboard Generator"
description: "Web app tĩnh (không framework/build) tạo dashboard terminal vẽ bằng ký tự, tuỳ chỉnh và xuất PNG/GIF/MP4/text/share link"
status: in-progress
priority: P1
effort: "55h"
tags: [frontend, vanilla-js, canvas, export]
blockedBy: []
blocks: []
created: 2026-10-04
---

# ASCII Dashboard Generator

## Overview
Greenfield. Lưới ký tự là lõi: mọi khối vẽ vào 1 buffer → luôn thẳng cột → xuất HTML (preview) + canvas (PNG/GIF/MP4). Bố cục hàng × cột + anchor để tái hiện `ref.png`. Đỡ điền tay bằng: actors + steps là nguồn chung, Flow DSL + preset, template, Randomize theo seed.

Nguồn quyết định: [brainstorm report](../reports/brainstorm-261004-1235-ascii-dashboard-generator-report.md) · Mockup đã duyệt: https://claude.ai/artifact/KW695kPHAcUgT568UiizKx · Code tham khảo mockup: `plans/reports/brainstorm-mockup-261004/Terminal.dc.html` (grid, markup parse, compose fan/hub, palette — dùng làm reference, không copy nguyên).

## Constraints (không đổi)
- Không framework, không build; `index.html` + `style.css` + `js/**/*.js` classic `<script>`, namespace `window.ADG`; chạy trên `file://`
- `js/core/**` không đụng DOM → test được bằng Node (`node tests/run.js`, vm context, không dependency)
- Phụ thuộc mạng duy nhất: Google Fonts, mp4-muxer CDN (lazy, chỉ khi xuất MP4)
- Chrome/Edge + Safari mới; Firefox: video WebM
- UI tiếng Việt; nội dung template tiếng Anh, không tên model/agent thật
- localStorage luôn bọc try/catch
- File JS < ~300 dòng; tên kebab-case
- Git: `git init` ở phase 1; mỗi phase xong = 1 commit conventional (không nhắc AI)
- Hosting: GitHub Pages (share link cần URL thật); tạo repo/push chỉ sau khi người dùng xác nhận ở phase 8

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Renderer lưới + self-check, 0 lệch cột | P1 |
| 2 | Template Agent pipeline + Midnight khớp phong cách ref.png | P1 |
| 3 | Đỡ điền tay: actors/steps auto, Flow DSL + preset fan/hub, 4 template | P1 |
| 4 | Export PNG 1x/2x/3x, text, JSON, share link | P1 |
| 5 | GIF + MP4/WebM | P2 |
| 6 | Mobile 390px không cuộn ngang | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Core grid, markup, theme, HTML output](./phase-01-start.md) | Completed |
| 2 | [Phase 2: Layout engine and blocks](./phase-02-layout-engine-and-blocks.md) | Completed |
| 3 | [Phase 3: Flow DSL and presets](./phase-03-flow-dsl-and-presets.md) | Completed |
| 4 | [Phase 4: Generators, randomize, player](./phase-04-generators-randomize-and-player.md) | Pending |
| 5 | [Phase 5: Editor UI and persistence](./phase-05-editor-ui-and-persistence.md) | Pending |
| 6 | [Phase 6: Canvas output and exports](./phase-06-canvas-output-and-exports.md) | Completed |
| 7 | [Phase 7: GIF and video export](./phase-07-gif-and-video-export.md) | Pending |
| 8 | [Phase 8: Visual QA and polish](./phase-08-visual-qa-and-polish.md) | Pending |

Dependencies: 1 → 2 → 3 → 4 → 5; 6 cần 2 (chạy song song được với 3–5); 7 cần 4 + 6; 8 cần tất cả.

## Data flow
```
config ─► generators (điền phần auto, seed) ─► layout (block.render(cfg,w,ctx) → sub-grid, blit, anchors, arrows)
       ─► Grid ─► output/html (preview) | output/canvas (+ chrome) ─► png / gif / video
```

## Success Criteria
- [ ] `node tests/run.js` xanh (grid, markup, layout, DSL, generators, gif LZW)
- [ ] Self-check 0 cảnh báo: 4 template × 7 theme × 2 kiểu viền × 80/96/120 cột
- [ ] Agent pipeline + Midnight so với ref.png: cùng phong cách (QA phase 8 có ảnh chụp)
- [ ] Đổi tên actor 1 chỗ → mọi khối auto cập nhật; khối sửa tay giữ nguyên
- [ ] PNG 2x đúng kích thước, có/không chrome; plain text dán vào code block thẳng cột
- [ ] Share link + .json tái tạo đúng hình (seed, step, theme, window)
- [ ] GIF/MP4 chạy đủ các bước, lặp; Firefox ra WebM
- [ ] Mobile 390px: preview trên, panel dưới, không cuộn ngang
- [ ] Mở bằng `file://` chạy đủ (share link cảnh báo khi chưa có `SHARE_BASE`)
- [ ] Deploy GitHub Pages; share link mở đúng hình trên máy khác

## Open Questions
None.

## Validation Log

### Session 1 — 2026-10-04
**Trigger:** `/ak:plan validate` sau khi tạo plan
**Questions asked:** 6

### Verification Results
- Tier: Full (8 phase) — greenfield, chỉ kiểm được tham chiếu tồn tại + môi trường
- Claims checked: 9 · Verified: 9 · Failed: 0 · Unverified: 0
- Verified: `ref.png`; brainstorm report; 4 file mockup `plans/reports/brainstorm-mockup-261004/*.dc.html`; mockup có `makeGrid/parse/palette/toRows/selfCheck/flowFan/flowHub` (7/7); Node v24.18.0 có `CompressionStream`; Python 3.12.5 (http.server); mp4-muxer 5.2.2 có bản non-module `/build/mp4-muxer.js` (global, nạp được bằng `<script>`); `ak plan status` parse 8 phase

#### Questions & Answers
1. **[Risk]** Share link cần URL thật; file:// không chia sẻ được. Host ở đâu?
   - Options: GitHub Pages | Netlify/Cloudflare Pages | Chưa host
   - **Answer:** GitHub Pages
   - **Rationale:** share link phải có base URL công khai
2. **[Scope]** Thư mục chưa là git repo. Init + commit mỗi phase?
   - Options: git init + commit mỗi phase | Không git
   - **Answer:** git init + commit mỗi phase
   - **Rationale:** rollback theo phase; bắt buộc cho GitHub Pages
3. **[Scope]** Thêm preset "Chuỗi thẳng"?
   - Options: Dùng DSL, không thêm preset | Thêm preset thứ 3
   - **Answer:** Dùng DSL, không thêm preset
   - **Rationale:** rank theo tầng đã vẽ được chuỗi (YAGNI)
4. **[Scope]** Lưu bản đang làm?
   - Options: 1 slot autosave | Nhiều bản có tên
   - **Answer:** 1 slot autosave
5. **[Scope]** Mobile chỉnh sửa tới đâu?
   - Options: Đầy đủ, accordion | Rút gọn
   - **Answer:** Đầy đủ, accordion — dùng chung code panel, khác CSS
6. **[Assumption]** Timeline khi Play?
   - Options: Vẽ dần tới con trỏ | Luôn hiện đầy đủ
   - **Answer:** Vẽ dần tới con trỏ; dừng → hiện đầy đủ

#### Confirmed Decisions
- Hosting GitHub Pages; `shareBase` cấu hình được, file:// → cảnh báo
- Git init phase 1, commit mỗi phase
- CI/CD template dùng DSL chuỗi; chỉ 2 preset (fan, hub)
- 1 slot localStorage
- Mobile = cùng panel, CSS accordion
- Timeline reveal khi play, đầy đủ khi pause (không có tuỳ chọn)

#### Impact on Phases
- Phase 1: `git init`, `.gitignore`, commit đầu
- Phase 4: bỏ tuỳ chọn `reveal`, cố định hành vi
- Phase 5: mobile accordion dùng chung panel
- Phase 6: `shareBase` + cảnh báo file://
- Phase 8: bước deploy GitHub Pages (xác nhận trước khi tạo repo/push)

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01..08
- Decision deltas checked: 6
- Reconciled stale references: 3 (open question CI/CD, `reveal` tuỳ chọn, deploy thiếu ở phase 8)
- Unresolved contradictions: 0

<!-- slug: ascii-dashboard-generator -->
