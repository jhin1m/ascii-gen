# Visual QA — ASCII Dashboard Generator

Date: 2026-10-04 · Browser: Chrome (desktop, 2048px viewport) via extension + Chrome headless for `file://`.
Screenshot after fixes: `qa-agent-pipeline-midnight-after.png` (Agent pipeline · Midnight · macOS · 96 cols · step fork).

## Ref.png checklist (Agent pipeline + Midnight + macOS)

| Item | Ref | Ours | Status |
|---|---|---|---|
| Background / accents | navy bg, pink lead, yellow advisor, teal router | same palette (theme `midnight`) | match |
| Title + `=====/##/=====` divider + `[#]` legend + command | yes | yes | match |
| Breadcrumb `+ plan > / fork > 3 delegate …` with highlighted current | yes | yes | match |
| Side column: dashed box, `:` rail, `<>` milestones, pulse, kv, dashed arrows to nodes | yes | yes (dashed box added in QA) | match |
| Flow nodes: dashed boxes (lead / workers / review), router table double border | dashed | was solid → **fixed** (`box: 'dash'`) | match |
| Router table: header, highlighted row `>`, bars, values, routes, note | yes | yes | match; ref tints the whole table background, ours tints only the highlight row (accepted) |
| Fan-out `v` connectors, caption, fan-in back to review node, back edge `split` in gutter | yes | yes | match |
| Worker footers `$ idle` + bar + `[..]` | yes | yes (now auto from activity: idle → running → done) | match |
| Timeline: actor rows, `<>` marks, cursor column highlight, `^` on axis, step labels | yes | yes | match |
| Log tail with last-row highlight + blinking `_` | yes | yes | match |
| Meters `@####....` + notes | yes | yes | match |
| Status: `> █`, `key [value]` pairs, spinner right | yes | yes | match |
| Density / font | JetBrains Mono, line-height 1.5 | same defaults | match |

Remaining differences (accepted): wording is generic (no real model names, by design); ref height 68 rows vs ours 70; table interior tint.

## Matrix / automated
- `ADG.qa.matrix()` (4 templates × 7 themes × 2 borders × 80/96/120 × every step, paused + playing): **0 issues, 0 skipped links** (also pinned by `tests/qa-matrix.test.js`).
- `node tests/run.js`: 168 pass.

## Exports (Chrome, real)
- PNG 2x Agent pipeline 96 cols with macOS chrome: 1595 × 2838 px, ~517 KB, fonts loaded (`document.fonts.check` ok).
- GIF 1x 15 fps, 7 steps × 1.2 s (126 frames): 10.9 s encode, 1.1 MB, decodes (ImageDecoder), infinite loop; colors match theme (frame inspected).
- MP4 (WebCodecs + mp4-muxer 5.2.2): `ftyp isom`, `moov`, `avc1` present. MediaRecorder fallback: `video/mp4` in this Chrome; cancel works.

## Mobile 390px (iframe 390×844)
- No horizontal scroll (`scrollWidth = 390`), preview scaled to 38% with tap-to-zoom 1:1, panel below as accordion.
- Touch targets ≥ 44px on inputs/buttons; checkboxes 24px with 10px margin (44px hit row).

## file://
- Headless Chrome on `file://…/index.html`: renders, self-check badge OK. Share link from `file://` shows the "needs SHARE_BASE" warning (unit-tested).

## Not verified here (needs the user's machines)
- Safari (display, PNG, MP4) and Firefox (WebM path): no Safari/Firefox in this environment.
- Real file downloads / clipboard prompts (downloads require user consent; blobs were verified in-page instead).
- Slack/Discord GIF preview; QuickTime playback of the MP4.
- Incognito specifically (verified in a fresh tab with empty storage instead).

## Unresolved questions
- User sign-off that the style matches ref.png.

## Deploy
- https://jhin1m.github.io/ascii-gen/ — share link created on the live site reopened in a new tab with empty localStorage: identical config (ci-cd-build, "Thợ build", step 5/7, 120 cols, unicode, Ubuntu window), self-check OK.
