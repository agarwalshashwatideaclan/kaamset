---
workflow: general-video
flow: automation
storyboard: no
message: "KaamSet really works: five kinds of help for gig workers, in English, Hindi and Punjabi, on a phone."
destination: event submission (unlisted YouTube / Drive)
aspect: "9:16"
format: 1080x1920
fps: 30
length: ~165s
language: en
audience: PromptWars evaluators
---

## Intent

Show the actual KaamSet app as it is (docs/DEMO_VIDEO_PLAN.md). Real mobile screen recordings from the live public URL are the only product visuals. Each of the five challenge areas appears with a genuine Gemini response, in all three languages.

## Customizations

- Show-it-as-is: captured footage is played unaltered at real speed (AI waits not shortened), framed on the app's own warm off-white palette.
- Short chapter label plus one plain-English caption per scene; designed intro and outro cards.
- Silent: no music, no narration (plan: no music needed for the first cut).

## Assets

- assets/*.mp4: H.264 30 fps transcodes of captures/*.webm (Playwright, 390×844 CSS-px phone layout rendered at 2× = 780×1688).
- captures/manifest.json and manifest-retake.json: provenance (URL, commit, inputs, real latencies).

## Notes

- The route was changed from product-launch-video to general-video because the inputs are finished screen recordings, not a URL capture.
- grievance and saved-offline were retaken: in the first take an emulated End key put the typed text mid-draft. The superseded takes are kept in ../captures-raw/superseded.
