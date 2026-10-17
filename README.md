# KaamSet

A mobile-first, multilingual (English · हिन्दी · ਪੰਜਾਬੀ) assistant for gig and informal workers: delivery partners, drivers and daily-wage workers. Google Gemini powers all five help areas:

| Area | What the worker does | What Gemini adds |
| --- | --- | --- |
| **Earnings tracking** | Logs each day's earned, received (partial payments supported) and expenses. Totals are computed locally in exact integer paise. | Explains the chosen period's real totals (only when the worker ticks "share") |
| **Safety practices** | Describes their work and situation | Occupation-specific precautions, stop/escalation conditions and a checklist that can be saved and ticked |
| **Rights & welfare** | Asks about rights or welfare support | A plain-language answer grounded in reviewed official sources (PIB, e-Shram, myScheme), with links. Says `cannot_verify` instead of inventing benefits |
| **Document help** | Pastes a passage or names a task | An explanation, or a checklist marking items as "Required" (only when a source says so) or "Suggested" |
| **Grievance drafting** | Describes the problem, or starts from an unpaid work record | An editable, factual draft with `[placeholders]` plus an evidence checklist. Never sent automatically |

**Voice (optional):** a mic button in the centre of the bottom navigation dictates in the UI language (`en-IN`/`hi-IN`/`pa-IN`) through the browser's Web Speech API. While it listens, a recording sheet with a pulsing mic and a Stop button makes clear the voice is being recorded. On Ask the words go into the open question box; elsewhere Ask opens with them ready. Answers are read aloud with `speechSynthesis` when the device has a matching voice. A header toggle turns reading aloud off (saved in this browser), and a "Stop speaking" bar appears while it talks. The controls are hidden where the browser lacks the API, and typing always works.

**Live:** https://kaamset.shashwat-5f0.workers.dev. No login or API key is needed.
**Docs:** [Evaluation](docs/EVALUATION.md) · [Submission notes](docs/SUBMISSION.md)

## Architecture

```
Browser (React PWA, IndexedDB) ──same origin──▶ Cloudflare Worker ──▶ Gemini REST API
        │                                        ├─ /api/assistant  (validate → rate-limit → prompt → validate output)
        └─ service worker (app shell only)       ├─ /api/health
                                                 └─ everything else → static assets (SPA fallback)
```

- `shared/domain.ts`: Zod schemas, integer-paise money parsing, totals, period filters, CSV export. Pure functions shared by client and server.
- `server/ai.ts`: one Gemini adapter (native `fetch`, JSON schema output, 45 s timeout, thinking disabled so the JSON isn't truncated) plus semantic checks: correct language and script, a draft required for grievances, and only allowed source IDs.
- `server/knowledge.ts`: reviewed official source notes, each tagged with publisher, URL, scope, review date and the modes it may support. No live browsing; no user-supplied URLs.
- `worker/index.ts`: the Worker handler. It checks method, content type, origin, body size (16 KB) and schema, applies a rate limit, and returns safe JSON error codes with `no-store`.
- `src/`: React UI.
  - `features/`: Today, Earnings, Ask, Saved.
  - `components/AnswerView.tsx`: one renderer for every mode, plain text only.
  - `db.ts`: IndexedDB. Saves are confirmed only after the transaction commits; unreadable records are kept, not deleted.
  - `i18n.ts`: all UI strings in three languages.
- `src/sw-template.js`: becomes `dist/sw.js` at build time, with an exact precache list. It never caches `/api/*`. Updates wait for the user to tap "Refresh", so forms in progress aren't lost.

One model call per explicit button press. There is no streaming, no background generation and no automatic retries.

## Setup

Requires Node ≥ 22.18. Node 24 was used for development, because the tests run TypeScript directly.

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars   # then put your Gemini key in .dev.vars (git-ignored)
```

```bash
npm run preview                  # production build served by the local Workers runtime on :8787
```

For UI hot reload, run `npm run dev:worker` (API on :8787) and `npm run dev` (Vite on :5173, proxies `/api`).

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run check` | typecheck + Biome lint + unit/API tests + production build |
| `npm test` | domain and Worker/API tests (`node --test`) |
| `npm run test:e2e` | Playwright browser tests (Pixel 7 profile) against `wrangler dev` with the production build; AI calls are intercepted |
| `npm run eval:live` | opt-in live Gemini evaluation (spends quota): `node tests/live/eval.ts <baseUrl>` |
| `npm run check:deploy` | build + `wrangler deploy --dry-run` |
| `npm run deploy` | build + `wrangler deploy` |

## Deploying (Cloudflare Workers + static assets)

```bash
npx wrangler login
```

```bash
printf %s "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY
```

```bash
npm run deploy
```

`wrangler.jsonc` sets `run_worker_first: ["/api", "/api/*"]`, so API paths never fall through to `index.html`. It also declares a `ratelimits` binding: 20 AI requests per 60 s per client IP, **per Cloudflare location**. This limit is best-effort abuse control, **not a global spending cap**. Set a quota or budget on the Gemini API key in Google Cloud for that. `GEMINI_MODEL` is a plain variable (default `gemini-2.5-flash`). The key exists only as a Worker secret and is never in the frontend bundle.

## Security

Threat model, controls and the test that proves each one are in [SECURITY.md](SECURITY.md). In short: the Gemini key
is a Worker secret, every request and every model response is schema-validated, model text is rendered as text under a
strict CSP, sources are server-owned, and the Worker stores nothing.

## Efficiency

- Production JS is 119 KB gzipped (CSS 3.3 KB) with four runtime dependencies; assets are content-hashed and cached
  for a year, `sw.js` is `no-cache` so updates land on the next visit.
- One Gemini call per explicit user action, no streaming or background calls, `thinkingBudget: 0`, a 45 s timeout and
  a 1,500-character input cap keep latency and cost bounded (2–4 s typical on `gemini-2.5-flash`, see
  `docs/EVALUATION.md`).
- Totals, filters and CSV export are computed locally from IndexedDB, so the ledger works offline and never waits
  on the network.

## Privacy and offline behaviour

- Records, drafts, checklists and profile stay in this browser's IndexedDB. There is no account and no cloud sync. Saved data is not encrypted, so anyone using the same browser profile can see it. Saved → "Delete all my data" removes it, and "Export" downloads JSON/CSV.
- Gemini receives only the question, the optional work type and location, and totals the worker chose to share. It never receives the name.
- After one online visit, the app reopens offline. Earnings add/edit/delete, totals, saved drafts and checklists all work offline. New AI answers need internet: the question is kept and the worker can retry manually. Nothing is queued or replayed.

## Limitations

- The source pack is deliberately small: five reviewed official pages. Questions beyond it, such as state-specific schemes, amounts or deadlines, get `cannot_verify` with a pointer to the official portal. There is no eligibility engine.
- Safety guidance outside the NDMA heat note is general practical advice from Gemini, not an official safety standard.
- AI output can still be wrong. Answers are labelled as AI guidance, and the worker is asked to check important facts.
- Android installation is not verified. On an emulator (Chrome 113) the app loaded and rendered, but Chrome crashed in its GPU process before the install flow could run. It has not been tested on a physical device. See `docs/EVALUATION.md`.
- Voice depends on the browser. Chrome's speech recognition sends audio to the browser vendor's speech service, and the UI says so. Punjabi recognition and Hindi/Punjabi synthesis voices vary by device; with no matching voice the app stays silent.
- Out of scope: login, cloud sync, uploads/OCR, sending complaints, payments.
