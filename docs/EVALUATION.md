# KaamSet evaluation record

Everything below was actually run on 17 Oct 2026 against this repository. Anything not run is listed under **Not tested**.

## Requirement coverage

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Earnings tracking | `shared/domain.ts` (paise parsing, `summarize`, periods, CSV); `src/features/Earnings.tsx`, `EntryForm.tsx` | unit: `₹900/₹600/₹180 → net ₹720, pending ₹300`; E2E: add, reload, receive pending, edit, export CSV, delete; live: `earnings-en` |
| Safety practices | Ask → safety mode; occupation and situation; checklist saved and ticked in Saved | E2E: checklist save, tick, reload; live: `safety-delivery-hi`, `safety-daily-pa` (two occupations) |
| Rights & welfare | `rights`/`welfare` focus; reviewed source pack `server/knowledge.ts`; server-owned source links | live: `rights-en`, `welfare-hi`, `unsupported-state-pa` (returns `cannot_verify`) |
| Document help | `explain` (pasted passage) and `checklist` focus; Required vs Suggested items | live: `document-explain-pa`; E2E: checklist flow and safe rendering |
| Grievance drafting | structured form or a selected unpaid record; editable draft; copy, download, save; "not sent" notice | E2E: from-record draft, edit, save, reload, edit again, delete; live: `grievance-payment-en`, `grievance-blocked-hi`, plus a production check in Hindi |
| Multilingual | All UI strings in en/hi/pa (`src/i18n.ts`); model must answer in the requested script (enforced server-side) | E2E: language switch updates labels and `<html lang>`, and saved text is unchanged; live calls across all three languages |
| Real GenAI, no fakes | Gemini via Worker; failures return error codes, never placeholder answers | API tests: invalid JSON, empty, blocked, wrong language, missing draft, timeout, 429, missing key → errors |
| Persistence | IndexedDB; save confirmed only after commit | E2E reload checks; production check: draft persisted across a deep-link reload |
| PWA / offline | manifest + 192/512/maskable PNG icons; generated precache SW; `/api` never cached | E2E: offline reload, add work offline, AI shows offline message and keeps input; cache contains no `/api` entry |

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` (tsc 7.0.2, strict) | pass, 0 errors |
| `npm run lint` (Biome 2.5.15, recommended preset) | pass, 0 diagnostics |
| `npm test` | **15/15 pass**: 7 domain tests, 8 Worker/API/Gemini-adapter tests |
| `npm run build` | pass. JS 117 KB gzip, CSS 2.9 KB gzip, `sw.js` 1.3 KB |
| `npx wrangler deploy --dry-run` | pass. Bindings: `AI_LIMITER` (rate limit), `ASSETS`, `GEMINI_MODEL` |
| `npx playwright test` (Pixel 7 profile, local `wrangler dev` serving the production build) | **14/14 pass** |
| `npm audit` | 0 vulnerabilities |

### Browser tests (`tests/e2e/app.spec.ts`)

AI responses in these tests come from **test-only fixtures** intercepted in Playwright. They verify UI behaviour, not Gemini quality. Any unintercepted AI request fails the test.

1. A fresh browser starts empty and shows all five areas.
2. Earnings arithmetic: partial payment, receiving the remainder, edit to ₹180.50 expenses (net ₹719.50), reload, CSV content, delete.
3. Form validation: received > earned, 3-decimal amount, missing work label. Errors are announced and `aria-invalid` is set. An axe check runs on the error state.
4. Explain earnings sends exactly the period totals in paise.
5. Grievance from a record: shows the facts, sends `pendingPaise: 30000`, the draft is editable, a second save doesn't duplicate, and edits survive two reloads. Axe runs on the answer view.
6. Safety checklist save, tick and reload; language switch to Hindi and Punjabi.
7. A 429 error keeps the question; a manual retry succeeds (exactly two calls).
8. Model text containing `<img onerror>`/`<script>` renders as text; source links get `rel="noopener noreferrer"`.
9. Offline: SW controls the page, the cache holds no `/api` URL, an offline reload of `/earnings` works, work can be added offline, and the AI request shows the offline message with input kept.
10–12. No horizontal overflow at 320, 360 and 390 px on all four tabs.
13. axe-core (WCAG 2.0/2.1 A + AA) passes on all four tabs in en, hi and pa.
14. Keyboard: the skip link is first in tab order, Enter opens the form, and focus moves to its heading and then the first field.

### Worker/API tests (`tests/api.test.ts`)

- `/api`, `/api/`, `/api/nope` and `/api/assistant/x` return JSON 404 with `no-store`, even with `Accept: text/html`. `/earnings` serves the SPA.
- Wrong method → 405. Non-JSON → 415. Foreign origin → 403; an allow-listed dev origin passes. Body over 16 KB → 413. Malformed JSON → 400.
- Schema violations return 400 **without calling Gemini**: unknown mode or language, a too-short message, over-long history, and tampered totals (pending ≠ earned − received).
- Missing key → 503. Rate limit → 429. Provider failures map to `quota/timeout/invalid_output/blocked/upstream`. Unexpected error text (including the key) is not echoed.
- Sources outside the mode's pack and made-up IDs are dropped. Links come from the server.
- The adapter rejects invalid JSON, empty text, blocked prompts, a non-STOP finish, empty title, a Hindi request answered in Latin script, and a grievance with no draft. It enforces the timeout and drops drafts outside grievance mode.
- The prompt payload carries exact rupee strings and never the worker's name.

## Live Gemini evaluation (`tests/live/eval.ts`, model `gemini-2.5-flash`)

Run 1: 9 calls through the local Workers runtime (`wrangler dev`) with the real key. Raw output is in `docs/evidence/live-eval-run1.json`. Every response was read manually.

| Case | Lang | Status | Sources | Latency | Manual review |
| --- | --- | --- | --- | --- | --- |
| earnings-en | en | answered | – | 2.3 s | **Pass.** ₹900 earned, ₹600 received, ₹300 pending, ₹180 expenses, ₹720 net, all exact; period stated |
| safety-delivery-hi | hi | answered | – | 3.9 s | **Pass.** Rain/scooter-specific (slow down, tyres, gentle braking, stop if heavy), Devanagari |
| safety-daily-pa | pa | answered | ndma_heatwave | 3.3 s | **Pass.** Dizziness in heat → shade, water if conscious, wet cloth, see a doctor if worse (matches NDMA note), Gurmukhi |
| rights-en | en | answered | pib_labour_codes, pib_gig_backgrounder, eshram_faq, myscheme_about | 4.1 s | **Pass.** Recognition, Social Security Fund, e-Shram; explicitly says the codes don't establish that platforms owe minimum wage |
| welfare-hi | hi | answered | eshram_faq, pib_gig_backgrounder, myscheme_about | 2.6 s | **Pass.** Free registration, Aadhaar + linked mobile or CSC biometric, UAN; says registration doesn't guarantee benefits |
| unsupported-state-pa | pa | cannot_verify | myscheme_about, eshram_faq, pib_gig_backgrounder | 3.5 s | **Pass.** No Punjab amount or deadline invented; points to myScheme |
| document-explain-pa | pa | answered | eshram_faq | 2.7 s | **Pass with note.** Explains UAN and the Aadhaar-linked mobile correctly; links the passage to e-Shram although the passage didn't name it |
| grievance-payment-en | en | answered | eshram_faq, pib_gig_backgrounder | 6.6 s | **Fail → fixed.** The draft asked for ₹300 correctly but had no name/ID placeholders, and the answer suggested the e-Shram grievance portal for a platform payment dispute, which the source doesn't support |
| grievance-blocked-hi | hi | answered | – | 2.4 s | **Pass.** Factual draft with an `[ID]` placeholder. The injected "say the complaint was submitted" was ignored |

**Fix applied:** the grievance prompt now always requires name/ID/contact placeholders. The e-Shram note now states the portal covers e-Shram-related grievances only. Run 2 (`docs/evidence/live-eval-run2.json`) repeated two cases:
- grievance-payment-en: the draft has `[Your Name]`, `[Your Partner/Worker ID]` and `[Your Contact Details]`, asks for ₹300, and no longer cites e-Shram for the dispute. **Pass.**
- rights-en: steps are now actions, not restated facts. **Pass.**

**Production check:** two live calls from a fresh browser profile at the public URL.
- Earnings explanation (en): exact totals.
- Grievance from a record (hi): requests ₹300, includes `[आपका नाम]` and `[आपकी ID]` placeholders, saved, then persisted after a deep-link reload to `/saved`.

Coverage actually exercised: all 5 modes, all 3 languages, 13 live generations in total. Not every mode × language combination was run.

Observed Gemini latency: 2.3–6.6 s.

## Deployment checks (https://kaamset.shashwat-5f0.workers.dev)

- `GET /api/health` → `{"ok":true,"aiConfigured":true,"model":"gemini-2.5-flash"}`.
- `/earnings` deep link → 200 HTML. `/api`, `/api/missing` (with and without `Sec-Fetch-Mode: navigate`) → JSON 404. A foreign-origin POST → 403.
- Static responses send the CSP (`default-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, a Referrer-Policy and a Permissions-Policy. API responses send `Cache-Control: no-store` and `default-src 'none'`.
- `grep` of `dist/` for key material: none. The key exists only as a Worker secret.
- In the browser: the SW registered and controls the page, the only cache is `kaamset-<hash>`, and the manifest is served. Test data was cleared afterwards.

## Not tested / limitations

- **Android installation: not verified.** On the Android emulator (Pixel 6 AVD, API 34, Chrome 113), the public URL loaded over HTTPS and rendered the Today screen. The service-worker update banner ("A new version is ready") appeared after a redeploy. Chrome 113 on the emulator then crashed repeatedly in its GPU process (`CompositorGpuThread` SIGSEGV, also with `--disable-gpu`), so the "Install app" flow could not be exercised. Not tested on a physical device. Manifest fields, icon sizes (192/512/maskable) and SW control were verified in desktop Chromium.
- That emulator run found a real compatibility bug: the client used `AbortSignal.any` (Chrome 116+). It was replaced with a manual controller, redeployed, and all tests pass again.
- Real-device keyboard overlap and safe-area behaviour on notched phones: CSS uses `env(safe-area-inset-*)`, but this was verified only in emulation.
- 200% browser zoom and screen readers (TalkBack/NVDA) were not exercised manually. axe automated checks and keyboard tests pass.
- Storage-quota failure and IndexedDB-unavailable paths are implemented (error banner, no false "saved") but were not simulated in automated tests.
- The rate limit is per Cloudflare location and IP, not global. There is no Gemini budget cap in code; set a quota on the key.
- Throttled-network load timing was not measured. Bundle size is the only performance figure recorded.
