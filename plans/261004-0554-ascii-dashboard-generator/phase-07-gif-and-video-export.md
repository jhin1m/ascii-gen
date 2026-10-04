---
phase: 7
title: "Phase 7: GIF and video export"
status: todo
priority: P2
effort: "8h"
dependencies: [4, 6]
---

# Phase 7: GIF and video export

## Overview
Xuất animation (chạy lại các bước từ đầu) thành GIF (encoder tự viết) và MP4 (WebCodecs + mp4-muxer CDN) với fallback MediaRecorder (MP4/WebM).

## Requirements
- Functional — chung: frames = `renderFrame(config, step, t)` theo fps (10/15/24/30), thời lượng = số bước × tốc độ; vẽ qua `renderCanvas`; thanh tiến độ + Huỷ; blink cursor theo thời gian frame
- Functional — GIF:
  - Palette cố định từ theme: mỗi màu dùng (fg/mut/a1..a6/dim/…) × 8 mức trộn với bg (+ màu chrome) ≤ 256; map pixel → index qua bảng tra `Map(rgb→idx)` + nearest cho màu lạ
  - LZW encoder (GIF89a), NETSCAPE loop, frame diff: chỉ ghi bbox vùng đổi, disposal = keep
  - Main thread, chia lô `setTimeout(0)`/`await` mỗi frame để UI không treo
  - Mặc định 1x, cảnh báo dung lượng ước tính
- Functional — video:
  - Có `VideoEncoder` + `isConfigSupported(avc1)` → lazy-load mp4-muxer (UMD từ jsDelivr, ghim version) → encode từng frame với timestamp chính xác → `.mp4`
  - Không có / CDN lỗi → `canvas.captureStream(0)` + `MediaRecorder` (mimeType: `video/mp4;codecs=avc1` nếu `isTypeSupported`, else `video/webm;codecs=vp9`), `track.requestFrame()` mỗi frame theo nhịp thời gian thực
  - Kích thước chẵn (pad 1px nếu lẻ) cho H.264
- Non-functional: GIF 96×70 1x 15 fps 8 s < 15 s encode trên laptop thường

## Related Code Files
- Create: `js/export/gif-encoder.js` (LZW + writer), `js/export/gif-palette.js`, `js/export/animation-frames.js` (iterator frame), `js/export/video-webcodecs.js`, `js/export/video-recorder.js`, `js/export/video.js` (chọn đường)
- Modify: `js/ui/export-dialog.js`
- Create: `tests/gif-encoder.test.js` (LZW với vector đã biết, header/trailer hợp lệ)

## Implementation Steps
1. Frame iterator dùng chung cho GIF + video
2. GIF palette + LZW + writer + frame diff; test Node
3. WebCodecs path (lazy script tag, timeout 8 s → fallback)
4. MediaRecorder path
5. Nối dialog: định dạng GIF/MP4/WebM, fps, tỉ lệ, lặp, tiến độ, huỷ
6. Thử trên Chrome (MP4 WebCodecs), Safari (MP4), Firefox (WebM)

## Success Criteria
- [ ] GIF mở được trên trình duyệt + Slack/Discord preview, lặp vô hạn, màu đúng theme
- [ ] MP4 Chrome/Safari phát được trong QuickTime; Firefox ra WebM
- [ ] Huỷ giữa chừng không treo UI
- [ ] Tests pass

## Risk Assessment
- mp4-muxer API thay đổi → ghim version; fallback MediaRecorder luôn sẵn
- GIF lớn → frame diff + 1x + fps thấp; hiển thị ước tính trước khi xuất
- Glow (shadowBlur) sinh nhiều màu ngoài palette → nearest-color, chấp nhận
