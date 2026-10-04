---
phase: 2
title: "Phase 2: Layout engine and blocks"
status: todo
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
- [ ] Agent pipeline 96 cột render giống mockup canvas (so mắt)
- [ ] 80/120 cột: không vỡ khung, self-check 0
- [ ] Bật/tắt 1 khối, đổi thứ tự hàng → layout tự tính lại số dòng
- [ ] Tests pass

## Risk Assessment
- Side column cần y của node bên flow → render flow trước trong hàng (khối provider trước consumer, sort trong hàng theo `provides/consumes`)
- 80 cột quá hẹp cho 3 node song song → flow tự hạ còn 2 cột/hàng hoặc clip; ghi lại hành vi trong schema help
