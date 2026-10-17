# KaamSet demo video — QA

Output: `renders/kaamset-mobile-demo.mp4` (git-ignored; regenerate with `npx hyperframes render --quality high --output renders/kaamset-mobile-demo.mp4`).

## Checked
- `npx hyperframes check`: passed. 0 errors. One warning (`timeline_track_too_dense`: 10 caption clips on one track) was accepted. 14/14 text checks pass WCAG AA contrast.
- Render: H.264, 1080×1920, 30 fps, 4,701 frames, 156.7 s, 16.8 MB, silent by design. A full `ffmpeg` decode pass completed with no errors.
- Frames sampled every 13 s across the render, plus scene-midpoint snapshots before render, were inspected:
  - Every caption matches the footage under it.
  - Money values are correct on screen: ₹900 / ₹600 / ₹180 → ₹720 net, ₹300 pending.
  - Hindi and Punjabi text renders correctly in the app footage.
  - The bottom tabs are never clipped, and the outro URL fits on one line.
- Provenance (`capture-manifest.json`):
  - Every clip was recorded on the public URL at commit `3289f19`.
  - All 7 AI answers in the cut are genuine (HTTP 200; one intentionally `cannot_verify`), at real latency (2.5–3.7 s). They were not sped up.
  - The only edits are trims of blank page-load lead-ins and 0.2 s tails.
  - No requests were intercepted and no data was seeded.

## Limitations
- The footage comes from desktop Chromium emulating a phone (390×844 CSS px rendered at 2×). It is not a physical device, and no install flow is shown.
- The grievance and saved-offline clips are a retake from a second browser session. Its setup page (adding the work record and saving the document checklist) was recorded and discarded. The Gemini call behind that discarded setup checklist is the only answer not shown in the cut.
- The intro and outro headings use the generic `serif` family. The renderer resolved it to a sans face, so the headings look different from the Studio preview. This was left as is.
- `npx hyperframes snapshot` sent the snapshot frames to Gemini vision for auto-descriptions, because `GEMINI_API_KEY` was set in the shell. That used a few extra calls on the same key.
