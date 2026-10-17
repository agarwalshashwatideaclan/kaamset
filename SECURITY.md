# Security

KaamSet keeps a deliberately small attack surface: no accounts, no server-side user data, one API route, and the
only secret lives in a Cloudflare Worker binding. This document records the threat model, the controls, and the
test that proves each control.

## Trust boundaries

| Boundary | Treated as | Control |
| --- | --- | --- |
| Browser → Worker (`POST /api/assistant`) | Untrusted | Zod schema (`shared/domain.ts`), 16 KB body cap, JSON-only, same-origin check, rate limit |
| Worker → Gemini | Trusted channel, untrusted output | Fixed JSON response schema, Zod validation, semantic checks, allow-listed source IDs |
| Worker/model → browser | Untrusted text | React text rendering only (no `dangerouslySetInnerHTML`), strict CSP, `rel="noopener noreferrer"` on links |
| Reference notes (`server/knowledge.ts`) | Reviewed by hand | Server attaches source links; the model may only cite IDs from the mode's pack |
| Worker records (IndexedDB) | Belong to the device owner | Never leave the device unless the worker ticks "share"; export and delete-all controls |

## Controls and where they are tested

| Threat | Control | Test |
| --- | --- | --- |
| API key exposure | `GEMINI_API_KEY` is a Worker secret, read from `env` only; never in `VITE_*`, bundles, logs or responses | `tests/api.test.ts`: error bodies never echo provider text; only `worker/index.ts` reads `env.GEMINI_API_KEY`, the client has no key path |
| Prompt injection via user text, pasted documents or history | Everything in the user payload is declared untrusted data in the system prompt; output must match the schema and the requested language/script; drafts outside grievance mode are dropped | `tests/api.test.ts` adapter cases (wrong script, missing draft, non-STOP finish, blocked prompt) |
| Fabricated sources or links | Model returns IDs only; unknown IDs are discarded; URLs come from `server/knowledge.ts` | `tests/api.test.ts`: foreign and made-up source IDs dropped |
| XSS from model or user content | No HTML rendering of model text; CSP `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`; `X-Frame-Options: DENY`, COOP | `tests/e2e/app.spec.ts` test 8 (`<img onerror>`/`<script>` render as text) |
| Cross-site request abuse | `Origin` must equal the Worker origin (dev origins allow-listed via `ALLOWED_DEV_ORIGINS`); JSON content type required | `tests/api.test.ts`: foreign origin → 403, non-JSON → 415 |
| Quota exhaustion / cost abuse | Cloudflare rate-limit binding, 20 requests/min per client IP per location; 1,500-character message cap; 45 s upstream timeout; one model call per explicit user action; `thinkingBudget: 0` | `tests/api.test.ts`: 429 path; e2e test 7 (retry keeps input, exactly two calls) |
| Oversized or malformed requests | `content-length` and decoded-byte checks (413), JSON parse guard (400), schema violations rejected before any Gemini call | `tests/api.test.ts` |
| Tampered financial context | Server re-checks `net = earned − expenses` and `pending = earned − received` before prompting | `tests/domain.test.ts`, `tests/api.test.ts` |
| CSV formula injection in exports | Cells starting with `= + - @` (after whitespace/control characters) are prefixed with `'`; quotes and newlines escaped | `tests/domain.test.ts` |
| Information leakage in logs | Logs carry `mode`, `language`, error category and latency only; never message text, amounts, names, audio or provider bodies | `tests/api.test.ts` (unexpected error text not echoed) |
| Microphone misuse | Web Speech API only on an explicit tap; `Permissions-Policy: microphone=(self)`; recogniser released on stop/unmount; no audio is stored or sent to the Worker | `tests/e2e/voice.spec.ts` (denied mic, stop) |
| Stale or cached AI responses | `Cache-Control: no-store` on every `/api/*` response; the service worker never caches `/api` | `tests/api.test.ts`, e2e test 9 |
| Supply chain | Four runtime dependencies (`react`, `react-dom`, `zod`, `lucide-react`); lockfile committed; `npm audit` clean | recorded in `docs/EVALUATION.md` |

## Why there is no login

Every record a worker creates stays in their browser's IndexedDB. The Worker is stateless and stores nothing, so
there is no central store of earnings, drafts or identities for an account system to protect. Adding OAuth would
create a credential surface and a personal-data store that the product does not need, and would gate evaluators
and workers on a third-party identity provider. The accepted trade-off is that anyone with physical access to an
unlocked phone can see that phone's records; the app says so on the Today screen and offers **Delete all my data**.

## Known limits

- The rate limit is per Cloudflare location and per IP; it is an abuse brake, not a global spending cap. Provider
  quota on the Gemini key is the hard ceiling.
- Origin checks are not authentication. Non-browser clients can call the API within the rate limit; the API only
  returns model text and holds no user data, so the exposure is cost, not privacy.
- Local storage is as safe as the device. There is no encryption at rest beyond what the OS provides.

## Reporting

Open a GitHub issue titled "Security" without exploit details; the maintainer will reply there with a private channel.
