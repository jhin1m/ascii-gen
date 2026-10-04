---
phase: 2
title: "Phase 2: Layout engine and blocks"
status: done
priority: P1
effort: "10h"
dependencies: [1]
---

# Phase 2: Layout engine and blocks

## Overview
Bộ bố cục hàng × cột + anchor và 9 khối vẽ trong lưới (chrome nằm ngoài lưới, làm ở phase 5/6). Kết thúc phase: template Agent pipeline (flow viết tay tạm, chưa DSL) render 96 cột giống mockup.

## Requirements
- Functional:
  - `layout`: `[[{block, w}]]`; `w` là tỉ lệ; tổng cột trừ margin 1 + gap chia theo tỉ lệ, phần dư cho khối cuối
  - Mỗi block: `{ type, schema, render(cfg, width, ctx) → { grid, anchors } }`; `ctx` = `{ actors, steps, step, palette keys, seed data, border, minHeight }`
  - Hàng: render từng khối → height = max → render lại khối `stretch` với `minHeight` (side column kéo dài `:`) → blit vào grid chính
  - Anchor registry: khối export `{id, x, y, w, h}` (toạ độ tuyệt đối sau blit); khối tiêu thụ (side column milestone `link: nodeId`) → post-pass vẽ mũi tên ngang nét đứt tới cạnh trái node, cùng y milestone (milestone snap y theo target nếu `snap: true`)
  - Blocks: `header` (title, divider có emblem, legend `[#] nhãn`, dòng lệnh), `steps` (breadcrumb, highlight bước hiện tại), `side-column` (items: milestone/note/kv/pulse/gap), `flow` (tạm: node box + table, toạ độ tính từ width), `table` (cột tên/bar/số/route, 1 dòng highlight, divider, note), `timeline` (rows = actors, pattern resample theo width, axis ticks = steps, cursor `^`), `log` (hh:mm actor msg, dòng cuối nền + `_` blink), `meters` (`@####...` + nhãn), `status` (prompt `>` + `█`, `key [value]`, spinner)
  - Timeline pattern: chuỗi ký hiệu/actor (`....<>..####..`) resample về width track; token `<>` giữ nguyên 2 ô
  - Box có label trên viền (`+- session timeline ---+`)
  - Text tràn → `clip` theo bề rộng ô
- Non-functional: block thuần (không DOM), test được Node

## Architecture
```
composeLayout(config, cols) → grid
  for row in layout: widths = split(cols-2, row.w)
    results = row.map(b => BLOCKS[b.block].render(cfg[b.block], wi, ctx))
    h = max(heights); rerender stretchers với minHeight=h
    blit; collect anchors (offset x,y)
  post-pass: cross-block arrows từ consumers → anchors
  rows tổng = sum(h) + gaps (tự tính số dòng)
```

## Related Code Files
- Create: `js/core/layout.js`, `js/blocks/registry.js`, `js/blocks/header.js`, `js/blocks/steps.js`, `js/blocks/side-column.js`, `js/blocks/flow.js` (tạm), `js/blocks/table.js`, `js/blocks/timeline.js`, `js/blocks/log.js`, `js/blocks/meters.js`, `js/blocks/status.js`
- Create: `js/templates/agent-pipeline.js` (config đầy đủ, chữ tiếng Anh, actor id: advisor, lead, router, worker, explorer, researcher)
- Create: `tests/layout.test.js`, `tests/blocks.test.js`
- Modify: `index.html` (script order), `js/app.js` (render template)

## Implementation Steps
1. `registry.js`: `ADG.blocks.register(type, def)`; schema field types `text|textarea|number|select|bool|list(lines, pipe-delimited)|color-slot`
2. `layout.js`: split widths, 2-pass stretch, blit, anchor offset, cross-block arrow pass, gap 1 dòng giữa hàng
3. Viết từng block theo thứ tự đơn giản → phức tạp: status, header, steps, meters, log, table, timeline, side-column, flow tạm
4. Template Agent pipeline: tái hiện bố cục mockup (side 30% | flow 70%, timeline, log 62% | meters 38%, status)
5. Tests: widths cộng đúng, mọi dòng đúng `cols`, anchors đúng toạ độ sau blit, timeline resample giữ `<>`, render ở 80/96/120 không lỗi self-check

## Success Criteria
- [x] Agent pipeline 96 cột render giống mockup canvas (so mắt) — 96×70, ảnh headless Chrome khớp phong cách ref.png
- [x] 80/120 cột: không vỡ khung, self-check 0 (ascii + unicode, bước 0..6)
- [x] Bật/tắt 1 khối, đổi thứ tự hàng → layout tự tính lại số dòng
- [x] Tests pass (94/94)

## Risk Assessment
- Side column cần y của node bên flow → render flow trước trong hàng (khối provider trước consumer, sort trong hàng theo `provides/consumes`)
- 80 cột quá hẹp cho 3 node song song → flow tự hạ còn 2 cột/hàng hoặc clip; ghi lại hành vi trong schema help

## Completion Notes (2026-10-04)
- Block contract thêm `links: [{x, y, to}]` (consumer → anchor); `compose(config)` → `{grid, anchors, cols, rows}`; layout item = `'key'` hoặc `{block, w}`, `config.blocks[key].type` mặc định = key, `hidden: true` tắt khối
- Lề 1 cột 2 bên, gap 1 cột / 1 dòng, đệm trên 1 dòng; tối đa 4 khối/hàng, 40 hàng, trang ≤ 400 dòng; list có giới hạn độ dài
- Mũi tên link chỉ vẽ khi node cùng hàng layout, y nằm trong node, đường đi trống; ngược lại bỏ + `console.warn`
- Milestone có `link` mặc định snap (tắt bằng `snap: false`)
- `grid.JUNCTIONS.right` mới; hướng junction: rời viền dưới = ┬/╤, vào viền trên = ┴/╧
- Màu từ config qua `util.slot()` (chỉ key palette); actor id trùng tag markup (`a1`, `dim`, `bar`, `a1b`…) bị loại
- `tests/run.js` lấy danh sách nguồn từ `index.html` (trừ `app.js`, `js/ui/`)
- Hoãn: định dạng dòng `list` cho editor (`|` trong pattern timeline, `\n` trong note) → Phase 5; token tên actor → Phase 4
- Reports: `../reports/from-tester-to-main-phase-02-layout-blocks-test-report.md`, `../reports/from-code-reviewer-to-main-phase-02-layout-blocks-review-report.md`

