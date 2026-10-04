---
phase: 4
title: "Phase 4: Generators, randomize, player"
status: todo
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 4: Generators, randomize, player

## Overview
Actors + steps thành nguồn chung tự sinh nội dung khối; Randomize theo seed; animation theo bước (render là hàm thuần của config + step + t).

## Requirements
- Functional — auto:
  - Mỗi khối có `auto: true|false`; `auto` → generator sinh nội dung từ `actors`, `steps`, flow graph: legend, timeline patterns, log lines (mẫu câu theo step × actor), meters, status (`step [..]`, `key [value]`)
  - Người dùng sửa form/JSON khối → `auto=false`, giữ nội dung; nút ↺ → `auto=true`, sinh lại
  - Đổi tên actor: id cố định, `name` đổi → mọi chỗ dùng `{actorId:..}`/N(id) cập nhật; DSL viết lại theo tên mới
- Functional — randomize: `seed` (mulberry32) đổi số, độ dài bar, pattern timeline, pulse; **không** đổi chữ; seed lưu config
- Functional — animation (`state.step`, `t∈[0,1)` trong bước):
  - breadcrumb chuyển bước; timeline: đang play → chỉ vẽ activities tới cursor (sau cursor là `.`), dừng → hiện đầy đủ như ref (cố định, không có tuỳ chọn) <!-- Updated: Validation Session 1 - timeline reveal --> ; GIF/MP4 xuất ở chế độ play; log hiện dòng có `step ≤ current` (6 dòng cuối); bar/meter lerp theo `t`; status + spinner đổi
  - Player: Play/Pause, prev/next, tốc độ (0.3–3 s/bước), loop; dùng `requestAnimationFrame`, render khi frame đổi
  - API thuần `renderFrame(config, step, t) → grid` (dùng lại cho GIF/MP4)
- Non-functional: render 96×70 < 8 ms (đo `performance.now`)

## Related Code Files
- Create: `js/core/generators.js`, `js/core/random.js` (mulberry32, pick, range), `js/ui/player.js`
- Modify: các block (đọc `ctx.step`, `ctx.t`), `js/core/layout.js` (truyền `t`), `js/app.js`
- Create: `tests/generators.test.js`

## Implementation Steps
1. `random.js` + `dataFor(seed)` pattern như mockup
2. `generators.js`: hàm theo block type `(cfg, actors, steps, graph, seed) → content`; merge với nội dung tay khi `auto=false`
3. Thêm `step/t` vào ctx; block tự suy trạng thái
4. Player + nút; đo hiệu năng render
5. Tests: cùng seed → cùng grid; seed khác → số khác, chữ giữ; đổi tên actor → không còn tên cũ trong grid; khối `auto=false` không bị ghi đè

## Success Criteria
- [ ] Đổi tên "lead" → header, node, bảng, timeline, log, meters, status cập nhật
- [ ] Play chạy hết 7 bước mượt, lặp; tốc độ đổi lập tức
- [ ] Render < 8 ms/frame ở 96 cột
- [ ] Tests pass

## Risk Assessment
- Mẫu câu log sinh tự động nghe máy móc → bộ mẫu ngắn theo bước, người dùng sửa tay được
- Re-render mỗi frame gây giật DOM → chỉ cập nhật innerHTML khi chuỗi HTML đổi
