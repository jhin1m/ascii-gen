---
phase: 3
title: "Phase 3: Flow DSL and presets"
status: todo
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 3: Flow DSL and presets

## Overview
Thay flow tạm bằng: DSL 1 dòng/chuỗi → graph → bố cục tầng (fan/chain) hoặc hub → vẽ node, bảng, fan-out/fan-in, mũi tên nét đứt, vòng ngược có nhãn. 2 preset (fan, hub) = DSL soạn sẵn.

## Requirements
- Functional — cú pháp:
  - `a -> b -> c` chuỗi; `[a, b, c]` nhóm song song; `a <-> [b, c, d, e]` hub & spoke
  - `a ..> b` nét đứt; `: nhãn` cuối dòng = nhãn mũi tên; `x@table` node kiểu bảng
  - Tên trùng trong 1 chuỗi = node mới ở tầng sau; dòng khác tham chiếu lần xuất hiện đầu
  - Comment `#` cuối dòng bị bỏ qua; dòng trống bỏ qua
  - Lỗi → `{ error: {line, col, msg} }`, giữ graph cũ, UI hiện lỗi inline
- Functional — node data: `nodes[id] = { title, lines[≤3 + footer], color slot, kind: box|table, status }` (mặc định sinh từ actor: title = tên, sub = `{lead:..} · medium`, footer `$ idle` + bar + badge)
- Functional — layout:
  - Chain/fan: tầng dọc; tầng 1 node = box rộng; N node = chia đều (tối đa 4/hàng, quá thì xuống hàng); fan-out `+- - -+- - -+` + `v`; fan-in tương tự; nối tiếp tầng có caption tuỳ chọn
  - Hub: center box nét đôi, ≤4 spoke (trên/trái/phải/dưới) mũi tên `<->`; spoke thứ 5+ → bảng phía dưới
  - Back-edge (`..>` ngược tầng): đi theo cột phải ngoài cùng, góc `+`/`┐┘`, nhãn cạnh mũi tên
  - Export anchors cho mọi node (side column dùng)
- Preset: `fan` = `lead -> router@table -> [worker, explorer, researcher] -> lead` + `router ..> lead : split`; `hub` = `lead <-> [router, worker, explorer, researcher]` + `lead -> health@table`. DSL dùng **tên hiển thị** actor; đổi tên actor → viết lại DSL tương ứng

## Architecture
```
flow-dsl.parse(text) → { nodes:[{key,name,kind}], edges:[{from,to,style,label}], groups }
flow-graph.rank(graph) → tiers | hub
blocks/flow.render(cfg,w,ctx): rank → place (x,y,w,h) → draw boxes → draw edges → anchors
```

## Related Code Files
- Create: `js/core/flow-dsl.js` (tokenizer + parser), `js/core/flow-graph.js` (rank tiers, detect hub, back-edges), `js/blocks/flow-presets.js`
- Modify: `js/blocks/flow.js` (thay bản tạm), `js/templates/agent-pipeline.js` (dùng preset fan)
- Create: `tests/flow-dsl.test.js`, `tests/flow-layout.test.js`

## Implementation Steps
1. Tokenizer: ident (unicode letter/digit/-_.), `->`, `..>`, `<->`, `[`, `]`, `,`, `@`, `:`, `#`
2. Parser theo dòng → nodes/edges; xử lý trùng tên → instance mới
3. Rank: BFS từ nút không có cạnh vào (bỏ back-edge); nhận diện hub khi có `<->` với nhóm
4. Placement theo width; reuse `table` block để vẽ node `@table`
5. Vẽ edges: thẳng xuống, fan-out/in, back-edge cột phải, `<->` ngang/dọc
6. Preset + hàm `presetDsl(id, names)`
7. Tests: parse các ví dụ + lỗi; rank fan/hub; render 80/96/120 self-check 0; anchors có cho mọi node

## Success Criteria
- [ ] Preset fan render tương đương bố cục ref.png (gồm vòng `split`)
- [ ] Preset hub render như mockup; mũi tên side column trỏ đúng node
- [ ] DSL sai → báo lỗi dòng/cột, hình cũ giữ nguyên
- [ ] Tests pass

## Risk Assessment
- Graph tuỳ ý có thể không vẽ đẹp → giới hạn hỗ trợ: DAG theo tầng + back-edge + hub; ngoài phạm vi → báo "không hỗ trợ" thay vì vẽ sai
- DSL scope creep → giữ đúng 6 toán tử ở trên (YAGNI)
