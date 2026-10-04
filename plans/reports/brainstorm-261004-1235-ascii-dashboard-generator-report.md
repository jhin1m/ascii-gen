# Brainstorm: ASCII Dashboard Generator

Ngày: 2026-10-04 · Trạng thái: **design đã duyệt** · Mockup: https://claude.ai/artifact/KW695kPHAcUgT568UiizKx
Nguồn mockup (tham khảo, KHÔNG phải code thật): `plans/reports/brainstorm-mockup-261004/` · Ảnh mẫu: `ref.png` (1640×2186)

## 1. Vấn đề & mục tiêu
Web app tĩnh tạo hình "bảng điều khiển terminal" vẽ hoàn toàn bằng ký tự, phong cách giống `ref.png`. Người dùng sửa nội dung → xuất PNG/GIF/MP4/text để khoe/minh hoạ. Không nội dung cố định (không tên model/agent thật), mọi chữ sửa được. Ưu tiên **đỡ điền tay**: preset + gõ nhanh + tự sinh nội dung.

## 2. Quyết định đã chốt
| Hạng mục | Quyết định |
|---|---|
| Stack | Không framework, không build. `index.html` + `style.css` + `js/*.js` (classic `<script>`, namespace `window.ADG`) → chạy được trên `file://` |
| Bố cục | Hàng × cột + anchor: layout = list hàng, mỗi hàng 1–3 khối có tỉ lệ bề rộng; khối nhận width → trả height; khối cùng hàng giãn bằng nhau; node đăng ký anchor để vẽ mũi tên xuyên khối |
| Render | Lưới ô `{ch, fg, bg, b, k}`; primitives `box(solid/dash/dbl) / text / mtext / bar / meter / arrow / hline / vline / divider`; self-check console (sai bề rộng, ký tự rộng 2 ô) |
| Output | HTML `<pre>`+span gộp cùng style (preview) · canvas vẽ từng ô (PNG/GIF/MP4) |
| Markup | `{a1:..}` màu · `{a1b:..}` màu+đậm · `{actor:..}` màu actor · `{bar:0.8:6:a1}` bar inline · `**đậm**` · `{dim:..}` `{m:..}` chữ phụ |
| Màu | Theme = bg, fg, mut, a1..a6. Màu highlight/dot/dim **trộn tự động** (mix). Actor trỏ vào slot (a1..a6), không hex → đổi theme recolor actor |
| Theme | Midnight, Dracula, Gruvbox, Solarized Dark, Phosphor Green, Amber CRT, Light Paper (palette trong mockup Terminal.dc.html) + color picker từng màu |
| Cửa sổ | macOS, Windows Terminal, Ubuntu (GNOME/Yaru), Retro CRT; + "không chrome" khi export |
| Flow preset | Fan-out/fan-in (= ref.png), Hub & spoke |
| Flow DSL | Có, 1 dòng = 1 chuỗi; preset chỉ là DSL soạn sẵn |
| Tự điền | Actors + steps là nguồn duy nhất → legend, timeline, log, meters, status tự sinh; sửa tay → cờ `auto=false`, nút ↺ sinh lại |
| Animation | Hàm thuần `render(config, step, t)`; breadcrumb/timeline cursor/log/bar/status cùng đọc `step`; Randomize = `seed` lưu trong config (share link tái tạo đúng hình) |
| Video | WebCodecs + mp4-muxer (lazy-load CDN khi export) → fallback MediaRecorder (MP4 nếu `isTypeSupported`, else WebM) |
| GIF | Encoder tự viết: LZW + palette từ theme (mỗi màu × vài mức trộn với bg, ≤256) + frame diff (chỉ ghi vùng đổi) |
| Browser | Chrome/Edge + Safari mới (Firefox: video WebM) |
| UI | Tiếng Việt; nội dung template tiếng Anh. Actor "planner" → "lead" (vừa cột route) |
| Phạm vi GIF/MP4 | Phase cuối v1 |

## 3. Phương án đã cân nhắc (đã loại)
- Xếp chồng tuyến tính: đơn giản hơn ~30% layout nhưng không ra được bố cục ref (side column cạnh flow, log cạnh meters). Loại.
- 1 file `app.js` 3k dòng: đúng spec gốc nhưng khó bảo trì. Loại. ES modules: chết trên `file://` (CORS). Loại.
- Canvas cho cả preview: 1 đường render nhưng mất chọn chữ, phải xử lý DPR, glow nặng mỗi frame. Loại; giữ HTML + canvas, giảm lệch bằng chung theme/metrics + QA so 2 bản.
- Tự tô màu tên actor (không markup): không tô được từ tuỳ ý. Loại (actor tag `{lead:..}` đã bao phủ).
- gifenc/gif.js CDN: gif.js cần worker (chết trên file://), palette tự động làm bệt màu theme. Loại.

## 4. Kiến trúc đề xuất
```
index.html · style.css · ref.png
js/
  core/grid.js          # buffer, primitives, markup parse, mlen, clip, self-check
  core/theme.js         # 7 theme, palette() derive (dim, dot, hlrow, hlstep, hlcur, logrow, chrome, line)
  core/layout.js        # rows×cols composer, stretch height, anchor registry, cross-block arrows
  core/flow-dsl.js      # DSL -> graph -> tiers (fan, hub, chain), node/table kinds
  core/generators.js    # auto content từ actors+steps; mulberry32(seed) randomize
  blocks/*.js           # header, steps, flow, side-column, table, timeline, log, meters, status (mỗi block: schema + render(cfg, w, ctx) -> Grid)
  output/html.js        # rows -> <pre>/span (gộp style; space không bg nhập span kề)
  output/canvas.js      # vẽ từng ô; glow = shadowBlur; scanline overlay
  output/chrome.js      # 4 kiểu cửa sổ, vẽ cho cả HTML lẫn canvas
  export/png.js · export/text.js · export/gif-encoder.js · export/video.js · export/share.js (CompressionStream deflate-raw + base64url) · export/storage.js (localStorage try/catch)
  ui/panel.js · ui/schema-form.js (form sinh từ schema block) · ui/json-tab.js · ui/player.js
  templates.js          # Agent pipeline, Server monitor, CI/CD build, Trống
  app.js                # bootstrap, state, render loop
```
Luồng: `config` → `generators` (điền phần auto) → `layout` (block render vào sub-grid, blit, anchors, arrows) → `Grid` → `html` | `canvas`.

### Config (phác thảo)
```json
{ "grid":{"cols":96}, "theme":"midnight", "colors":{}, "window":"macos", "chrome":{"title":"","credit":""},
  "font":{"family":"JetBrains Mono","size":12.5,"lineHeight":1.5}, "border":"ascii",
  "effects":{"scanline":false,"glow":false,"blink":true}, "seed":0,
  "actors":[{"id":"lead","name":"lead","color":"a1"}], "steps":["plan","fork",...], "current":1,
  "layout":[["header"],["steps"],[{"block":"side","w":0.3},{"block":"flow","w":0.7}],["timeline"],[{"block":"log","w":0.62},{"block":"meters","w":0.38}],["status"]],
  "blocks":{"flow":{"preset":"fan","dsl":["..."],"nodes":{}}, "log":{"auto":true,"lines":[]}, ...} }
```

### Flow DSL
- `a -> b -> c` chuỗi; `[a, b, c]` nhánh song song (fan-out từ trước, fan-in về sau)
- `a <-> [b, c, d, e]` hub & spoke
- `a ..> b` mũi tên nét đứt (vòng ngược nếu ngược tầng); `: nhãn` chữ trên mũi tên
- `x@table` node dạng bảng (table + bars)
- Tên lặp trong chuỗi = node mới ở tầng sau (vd `... -> lead` = "back to main session"); cạnh ở dòng khác trỏ lần xuất hiện đầu
- Lỗi cú pháp: báo inline dưới textarea, giữ hình cũ

## 5. Rủi ro & xử lý
| Rủi ro | Xử lý |
|---|---|
| Ligature Fira Code (`->`) | `font-variant-ligatures:none; font-feature-settings:"liga" 0,"calt" 0`; canvas vẽ từng ô |
| Ký tự rộng / NFD tiếng Việt | NFC normalize khi nhập; regex wide/emoji → self-check cảnh báo, thay `?` |
| Font chưa load khi vẽ canvas | `document.fonts.load()` trước export |
| Glyph `●`, `█` ambiguous width | Chỉ dùng ký tự an toàn trong lưới; `█` chỉ cho con trỏ |
| Preview HTML lệch PNG | Chung theme/metrics; bước QA so 2 bản ở 2x |
| Tên dài vỡ khung | `clip()` + `…` theo bề rộng ô |
| GIF nặng (870×1230, 100+ frame) | Mặc định 1x, 10–15 fps, frame diff; cảnh báo dung lượng |
| MediaRecorder rớt frame | Ưu tiên WebCodecs (frame-by-frame, timestamp xác định) |
| Hub/fan layout cứng ở 80 cột | Layout tính theo width; node co/clip; self-check báo |
| Scope v1 +15–20% (DSL, hub) | Chấp nhận; DSL nhỏ (~80–120 dòng) |

## 6. Phase đề xuất
1. Core: grid, markup, theme, HTML output, self-check
2. Layout + 9 block + template Agent pipeline khớp ref
3. Flow DSL + 2 preset + anchors/mũi tên xuyên khối + vòng ngược
4. Generators (actors/steps → auto), Randomize seed, Play/Pause + tốc độ
5. Editor UI: panel thu gọn, schema forms, tab Giao diện, tab JSON, chọn cửa sổ, 4 template, localStorage, mobile layout
6. Canvas renderer + chrome canvas, PNG 1x/2x/3x (±chrome), copy plain text, .json tải/mở, share link
7. GIF encoder, MP4 WebCodecs + fallback MediaRecorder
8. QA: chụp Agent pipeline/Midnight so ref.png, PNG 2x, mobile 390px, Safari

## 7. Tiêu chí nghiệm thu
- Template Agent pipeline + Midnight: cùng phong cách ref (màu, mật độ, viền, highlight dòng, breadcrumb, timeline cursor, log tail) — so ảnh chụp
- Self-check: 0 cảnh báo cho 4 template × 7 theme × 2 kiểu viền × 80/96/120 cột
- Đổi tên actor 1 chỗ → mọi khối auto cập nhật; khối sửa tay giữ nguyên
- DSL fan + hub render đúng; lỗi cú pháp không làm vỡ trang
- PNG 2x đúng kích thước, font đúng, có/không chrome; plain text dán vào code block thẳng cột
- Share link mở ra đúng hình (gồm seed, step)
- GIF/MP4 chạy đủ 7 bước, lặp được; Firefox ra WebM
- Mobile 390px: preview trên, scale vừa ngang, không cuộn ngang; panel dưới
- Mở trực tiếp bằng `file://` chạy đủ (trừ phụ thuộc mạng: Google Fonts, mp4-muxer CDN)

## 8. Câu hỏi còn mở
- ~~mp4-muxer~~ → chốt: mp4-muxer CDN, lazy-load khi export; lỗi mạng → fallback MediaRecorder
- ~~Font offline~~ → chốt: Google Fonts online; offline fallback monospace hệ thống
- Nội dung 2 template Server monitor / CI/CD: preset Flow tương ứng (hub cho server, fan/chuỗi cho CI) — chuỗi thẳng chưa có preset riêng, dùng DSL `a -> b -> c` là đủ?
