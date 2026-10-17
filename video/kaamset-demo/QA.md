# KaamSet demo video — QA

Output: `renders/kaamset-mobile-demo.mp4` (git-ignored; regenerate with `npx hyperframes render --quality high --output renders/kaamset-mobile-demo.mp4`).

## Version 2 (voice), recorded 17 Oct 2026
- All 8 scenes were re-recorded on the production app, which now shows the centre nav mic. The new `voice-welfare-hindi` scene replaces the typed Hindi welfare question with a dictated one.
- Dictation in the recording uses a scripted recogniser, because a headless browser has no microphone. The app's real recording panel appears, and the real Ask flow and real Gemini answer follow. The on-screen caption discloses this. Real Hindi dictation was confirmed by the user on an Android phone. Read-aloud isn't demonstrated because the video is silent.
- 7 genuine Gemini answers, at 2.5–4.1 s real latency, not sped up. The only edits are trims of blank lead-ins and 0.2 s tails. Provenance is in `capture-manifest.json`.
- `npx hyperframes check`: passed. 0 errors; one accepted density warning. 14/14 text checks pass WCAG AA contrast.
