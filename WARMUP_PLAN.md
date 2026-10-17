# KaamSet — final warm-up implementation plan

**Status:** Final planning handoff, 17 October 2026. This supersedes earlier warm-up scope and design proposals. It is a specification, not a claim that the application has been implemented or tested. Product implementation remains with the developer agent.

## 1. Exact problem and product scope

> Design and build a GenAI-powered assistant that supports gig and informal workers such as delivery partners, drivers, and daily-wage workers. The solution must leverage Generative AI as a core component to provide multilingual guidance on earnings tracking, safety practices, rights and welfare scheme awareness, document help, and grievance or dispute drafting in simple language.

**KaamSet is a multilingual worker assistant covering all five areas.** It is not scoped primarily as an earnings tracker or a payment-dispute application. All five areas must have visible entry points, real contextual GenAI behavior, and functional acceptance checks. They share one assistant engine rather than five separate implementations.

- Brand: **KaamSet**. Voice: respectful, practical, empowering; workers control their records and decisions.
- Audience: delivery partners, drivers, daily-wage workers; support an “other work” option.
- Languages: English, Hindi in Devanagari, Punjabi in Gurmukhi. Localize navigation, forms, errors, and generated content.
- Delivery: mobile-first Progressive Web App hosted publicly on **Cloudflare Workers with static assets**, deployed through **Wrangler**, tested first on Android Chrome and usable without installation. Anyone with the URL can use it without a Cloudflare/GitHub account or their own API key. Desktop remains usable for evaluators.
- Distribution: link or QR code → immediate use → optional installation after a useful action.
- First use: language choice and optional occupation/location, with skip available. Do not silently assume a delivery role or a city for someone who skips.
- Success: an evaluator can independently exercise each required area and see useful, honest, personalized results.

## 2. Evaluation criteria → implementation decisions → evidence

The briefing emphasized **code quality and problem-statement alignment**, followed by security and efficiency, with testing and accessibility also required. Numerical weights and a detailed automated rubric were not supplied. The following is our engineering plan, not a representation of secret benchmark tests or a promise of a score.

| Criterion | Required design decision | Evidence to deliver |
| --- | --- | --- |
| Problem alignment | Five explicit task modes, three languages, real Gemini calls, relevant occupation/location context | Requirement-to-test matrix and live smoke results for every area |
| Code quality | Strict TypeScript, small domain/UI/storage/AI modules, shared validation, clear errors, one provider adapter, no duplication across modes | Typecheck, lint, production build; readable domain tests and architecture notes |
| Security | Server-only credentials, validated input/output, text rendering, approved source URLs, no arbitrary URL fetching, rate and concurrency limits, minimal personal-data exposure | Invalid input, injection, quota, origin, and secret-exposure checks |
| Efficiency | Reuse scaffold, one Cloudflare deployment for static frontend and Worker API, small client, one generation per action, bounded context/output, local arithmetic and storage | Bundle-size measurement, mobile loading checks, request-count and AI latency observations |
| Testing | Domain and API tests, browser workflows, small separate live-AI evaluation | Actual commands/results, failures fixed, untested cases explicitly listed |
| Accessibility | Large targets, readable translated text, labels, keyboard/focus support, contrast, zoom and reflow | Automated accessibility check plus manual keyboard/mobile checks |
| Functional review | Everything visible works; state and outputs reflect real user actions | Fresh-browser evaluation across all five modes, reload/offline checks, deployed smoke test when deployment exists |

No fabricated records, canned AI successes, fake source citations, decorative nonfunctional buttons, false “saved/submitted” messages, or hard-coded responses masquerading as application behavior. Reviewed reference content, UI translations, and test-only fixtures are legitimate inputs; distinguish them from generated results and real user data.

## 3. Mandatory feature contracts

### A. Earnings tracking and guidance

**Input:** work date, work/platform/employer label, earned amount, amount received, expenses; optional hours and notes.

**Behavior:** add/edit/delete real entries, date filter, partial payments, exact totals, persistence, CSV export. Start empty. “Explain my earnings” sends the selected period's computed summary to Gemini after the worker chooses to share it. Include the period in the request and visible answer context.

**AI output:** simple explanation of actual earnings and costs, distinction between earned and received money, relevant next steps. No invented shifts, market wages, financial forecasts, or savings guarantees.

**Acceptance:** earned ₹900, received ₹600, expenses ₹180 → net earned ₹720, pending ₹300. Later receiving ₹300 makes pending zero without changing net earned. Edit, reload, and export preserve the facts.

### B. Safety practices

**Input:** occupation plus situation, e.g. delivery work in heavy rain, a tired driver, or work around construction equipment. Do not assume all workers face the same hazards.

**Behavior:** focused situation form or prompt, role-specific Gemini guidance, short checklist that can be saved and checked off.

**AI output:** practical precautions and clear stop/escalation conditions where appropriate. If immediate danger is described, prioritize getting to safety and contacting local emergency services; do not diagnose, claim to dispatch help, or encourage app use while driving. Prefer reviewed official safety notes for high-stakes recommendations.

**Acceptance:** distinct relevant guidance for at least two occupations; checklist persists. The feature must provide useful advice, not only an emergency disclaimer or a static safety article.

### C. Rights and welfare scheme awareness

**Input:** occupation, state/city when relevant, and the worker's question. Additional circumstances are optional and asked only when needed.

**Behavior:** distinguish “Understand my rights” and “Explore welfare support” within this mode. Explain what the reviewed sources establish, identify what still needs checking, and offer a concrete next step. Include links to the specific official material used.

**AI output:** plain-language guidance grounded in the supplied reference pack. No automatic eligibility verdict, invented law, benefit guarantee, made-up deadline, or unsupported claim that a worker has a particular employment status.

**Acceptance:** answer one supported rights question and one supported welfare question with matching sources. For an unsupported state-specific entitlement, say what cannot be verified and where to check; do not invent an answer.

**Reference scope:** begin with reviewed e-Shram and myScheme material, plus a relevant official labour/rights source. Those two portal descriptions alone are not enough to claim rights coverage. Add a small number of specific, verified facts that support useful questions. Save publisher, exact URL, scope/jurisdiction, review date, and factual notes. No comprehensive nationwide eligibility engine.

### D. Document help

**Input:** choose a task such as preparing for worker registration or a dispute, or paste a short document passage after removing personal identifiers.

**Behavior:** Gemini explains a field/passage in simple language or prepares a task-specific checklist. Users can save the checklist and mark readiness. Uploads and OCR are not required.

**AI output:** meaning, next steps, missing information, and required-versus-suggested items clearly distinguished. Official requirements must come from the reference pack. User-pasted material is untrusted input, not verified government policy.

**Acceptance:** explain a non-sensitive document passage in Hindi or Punjabi; generate a relevant preparation checklist; preserve checked state after reload. Never claim a document is authenticated, submitted, or approved.

### E. Grievance or dispute drafting

**Input:** issue type, facts, intended recipient, desired resolution; dates and amounts only if known. Support both payment and non-payment disputes, e.g. a disputed deduction or account restriction.

**Behavior:** a worker can begin independently or from a selected earnings record. Show and confirm imported facts before sending them to Gemini. Generate an editable draft plus an evidence-to-collect checklist. Copy, download, and save locally. Do not send automatically.

**AI output:** a respectful factual message in the selected language. Missing names/IDs/dates remain clearly marked placeholders. Do not invent evidence, accusations, legal sections, compensation, or deadlines.

**Acceptance:** a ₹300 pending-payment draft requests ₹300; a non-payment dispute also works. Editing and saving retains the user's edits. “Saved draft” never means “Complaint submitted.”

## 4. Mobile design specification

Use the supplied Nova design document as a reference, with the following decisions overriding its generic iOS-first rules.

**Four labelled bottom tabs:** Today · Earnings · Ask · Saved.

| Screen | Content and purpose |
| --- | --- |
| Today | Language control; compact actual earnings summary if records exist; prominent add-work action; all five task shortcuts; useful empty state. No large marketing hero. |
| Earnings | Records and period totals; full-screen add/edit form on small devices; export; payment status; explain selected period. |
| Ask | Five visible mode choices, compact context form, follow-up conversation, structured answers, source links, draft/checklist actions. Changing mode starts a new task; preserve unfinished work or ask before discarding. |
| Saved | Saved drafts and checklists; edit, copy/download, completion state, deletion. Profile/data/export controls remain reachable. |

- Primary visual treatment: warm off-white `#F8F7F2`, charcoal `#111827`, dark terracotta `#B94725` for primary actions; white button text. Use subtle borders, restrained green status accents, no decorative chart libraries or large illustrations.
- Minimum 48 CSS px interactive targets; primary actions approximately 52 px high. Provide visible pressed, focus, loading, and disabled states.
- Body 16–18 px, supporting text at least 14 px, headings 24–28 px; flexible line height for native scripts. No critical information at 11 px.
- 16 px screen padding, 4 px spacing scale, 12–16 px corner radii. Let translated rows and buttons grow instead of clipping text.
- Normal text contrast ≥4.5:1; large text ≥3:1; meaningful controls/focus indicators ≥3:1 against adjacent colors. Verify actual pairs.
- System fonts with suitable Devanagari/Gurmukhi fallbacks. No external font dependency for the first render.
- Put work date, earnings, received, and expenses first. Optional fields follow. Numeric input modes, visible currency, persistent labels; validate decimal values without silently rounding extra precision.
- Respect safe areas; ensure the keyboard does not hide focused fields or submit controls. Use browser Back predictably. Avoid nested scroll traps.
- English/Hindi/Punjabi labels, errors, and empty states; set document language appropriately. Changing language must not silently translate or alter saved drafts; offer an explicit new generation if needed.
- Meet keyboard navigation and modal focus behavior; announce loading/results/errors; allow 200% zoom and reduced motion. Do not rely only on color or icons.
- Validate at 320, 360, and 390 CSS px widths, and at desktop width. Light mode is required; dark mode is deferred.

## 5. PWA and offline contract

Installation and offline behavior are separate features. Implement both explicitly.

- Deploy over HTTPS. Add a linked manifest with KaamSet name/short name, start URL, scope, stable app ID, theme/background colors, standalone display, and proper 192/512 PNG icons including a maskable variant. Verify actual asset dimensions.
- Show installation UI only where the browser supports it; never gate usage on installation or promise the prompt will appear on every device. Suggest installation after a successful task, not as a blocking first screen.
- Cache versioned application assets for offline reopening after a successful online visit. Keep `/api/*` and AI responses out of service-worker caches. Prevent stale app updates from discarding in-progress forms; offer a controlled refresh.
- Store worker records, drafts, and checklists in IndexedDB. Use localStorage only for tiny preferences if useful. Save confirmations follow successful writes; handle unavailable storage, quota failure, and corrupt/old data without silent deletion.
- Offline: open the cached app, add/edit/delete work, calculate totals, read/edit saved drafts, and update saved checklists.
- Online only: new Gemini responses and external official websites. Preserve an unsent question during a network error and offer manual retry. Do not automatically replay AI requests when connectivity returns.
- Include explicit device-local storage messaging, export, and clear-data controls. Installation is not a backup. Do not claim cloud sync or encryption at rest. Shared-device users must be able to remove their data.
- Service worker installation, offline reload, and real Android installation must be tested separately. Desktop emulation does not prove Android installation; record any unavailable device check honestly.

Implementation references: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [Google offline storage guidance](https://web.dev/learn/pwa/offline-data).

## 6. Fastest maintainable architecture

**Reuse React + TypeScript + Vite, Zod schemas, translations, domain logic, and the Gemini prompt/reference work. Replace the thin Express HTTP layer with a Cloudflare Worker handler.** This targeted runtime adaptation is required by the selected hosting; do not rewrite the product. Keep the lockfile and make only justified dependency changes. Use Context7 for current library/CLI documentation when available; otherwise use official documentation and note the fallback.

One public origin serves the frontend and `/api/*`. Deploy the Vite build as Workers static assets and the Gemini endpoint as Worker code in the same Wrangler project. GitHub may hold source code but is not the hosting target. No separate backend host, SQL database, account system, vector database, agent framework, or global state library is needed.

Module boundaries, adapted to existing paths:

- `shared/`: schemas, money/date functions, request/response types. Pure functions with no UI/provider coupling.
- `server/ai.ts`: runtime-independent Gemini adapter, explicit key/model configuration, structured-output handling and bounded timeout. Prefer native `fetch` against the documented Gemini REST API for this small Worker; the existing SDK can remain only if runtime compatibility is verified without unnecessary Node shims. Keep one adapter, not two competing production implementations.
- `server/knowledge.ts`: reviewed source facts and task-based selection; no user-URL fetching.
- `worker/index.ts`: native request handler for `/api/health` and `/api/assistant`, validation, limits, safe JSON errors, and response headers. No `app.listen`, Node filesystem static serving, or process-global secret dependency.
- `src/features/`: focused work, assistant, and saved-item flows.
- `src/components/`: shared controls, answer/checklist/draft renderer, navigation.
- `src/store.ts` or a small storage folder: IndexedDB repository, migrations, export/clear.
- `src/i18n.ts`: translated interface and locale formatting.
- `wrangler.jsonc`: Worker entry point, explicit compatibility date, asset directory/binding, API routing, non-secret model/configuration, and rate-limiting bindings. No secret values.
- `tests/`: domain and Worker/API checks, browser journeys, opt-in live-AI evaluation.

Avoid a giant application component, duplicated prompts, speculative abstractions, or unnecessary dependencies. Use a small helper for IndexedDB/PWA generation only when it reduces implementation risk. Node is the local build/test toolchain, not a long-running production server. Test the deployed backend in the Workers runtime, not only with Node tests.

### Cloudflare / Wrangler deployment contract

Required flow: **visitor → Cloudflare static frontend → same-origin Worker `/api/assistant` → Google Gemini**. The final deliverable is a public HTTPS `workers.dev` URL or configured custom domain. Use **Workers static assets + `wrangler deploy`**; do not create a separate Cloudflare Pages project or use `wrangler pages deploy` for this architecture.

- Add Wrangler as a project dev dependency, pin through the lockfile, verify the authenticated Cloudflare account with `wrangler whoami`, and use existing authorized account access. Do not purchase plans or register a domain without separate authorization.
- Build frontend assets into `dist`. Configure the Worker entry point, a deliberate compatibility date, the asset directory, and an asset binding. Enable Node compatibility only if actually required by a verified dependency.
- Configure SPA fallback for client navigation and ensure `/api` and `/api/*` reach Worker code before asset fallback. Missing API routes must return JSON 404 and unsupported methods a suitable error, never `index.html` with HTTP 200. Test both browser navigation and fetch requests because static-asset routing can treat them differently.
- Use root-relative app routes and frontend requests to `/api/assistant`. Configure manifest start URL/scope and service-worker scope for this deployment. A GitHub repository base path and a cross-origin API base URL are not needed.
- Bind `GEMINI_API_KEY` as a **Cloudflare Worker secret**, accessed through `env.GEMINI_API_KEY` and passed explicitly to the provider adapter. Keep `GEMINI_MODEL` as non-secret configuration. The frontend build must never receive the key.
- Use `wrangler secret put GEMINI_API_KEY` securely without printing the key. Understand that secret updates can create/deploy a Worker version; target only this application's Worker/environment. Local secrets belong in ignored `.dev.vars` or `.env` files, never tracked config. Cloudflare credentials stay out of source, logs, and frontend assets too.
- Configure and exercise Workers-supported rate limiting. In-memory counters/concurrency guards are best-effort per isolate, not a global daily budget. Cloudflare rate limits are not an exact cross-location billing cap. Pair bounded requests with actual provider quota controls where available; if a strict global allowance becomes necessary, explicitly add durable coordination rather than claiming a plain counter provides it.
- Use Wrangler local development for the backend, optionally with the Vite dev server proxying to it. Generate binding types. Verify the final build with Wrangler's dry-run bundling and local Workers execution before publishing.
- Deploy the complete frontend and Worker with `wrangler deploy`. Keep all five mandatory flows accessible without Cloudflare Access login, a GitHub account, or visitor-supplied Gemini keys. Rate limits must allow reasonable evaluator use.
- Configure static-asset headers and Worker response headers in their appropriate places; a static `_headers` file does not automatically protect Worker-generated API responses. Keep AI requests and all `/api/*` responses out of CDN/service-worker caches, with `Cache-Control: no-store` on API responses.
- After deployment verify the actual public URL from a fresh signed-out browser: static loading, all five real Gemini flows, language handling, deep-link reload, error responses, persistence, offline reopen, and installation behavior. Record the deployment version and real URL. A successful upload or a rendered shell alone does not prove the app works.
- If Cloudflare account access or Gemini secret setup is missing, surface that exact blocker while finishing the implementation and Wrangler configuration. Do not fabricate a URL or mark deployment complete.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Worker/API routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/), [rate-limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), and [Gemini REST API](https://ai.google.dev/api/generate-content).

### Core data rules

- Work entry: UUID, local work date, work label, `earnedPaise`, `receivedPaise`, `expensePaise`, optional hours/note, timestamps.
- Integer paise throughout persistence and arithmetic; format INR only at the UI/export boundary.
- `netEarned = earned − expenses`; `pending = earned − received`. If showing `received − expenses`, label it separately as net cash received.
- Validate safe finite integers and bounds; `0 ≤ received ≤ earned`; expenses may exceed earnings. Reject invalid/future work dates. Hours are optional; if supplied, greater than zero and no more than 24 per entry.
- Do not reuse per-entry maximums for period totals: many valid entries can produce a larger total. Define aggregate bounds separately.
- Profile: optional name, occupation, location, language. Name is not shared with Gemini by default.
- Draft: UUID, title, editable text, language, optional linked work ID, timestamps.
- Checklist: UUID, task, language, items with stable IDs and checked state, source references, timestamps.
- Deleting a linked work entry does not silently rewrite/delete a saved draft; it remains a dated snapshot for user review.

## 7. Gemini contract, grounding, and cost controls

Use a configurable available Gemini Flash-class model. Verify one real generation early; model-list access or a present key is not proof generation works. Keep keys server-side as recommended by the [official SDK](https://github.com/googleapis/js-genai).

One `POST /api/assistant` handles `earnings`, `safety`, `rights_welfare`, `documents`, and `grievance`. Request: selected mode/language, bounded message, relevant optional profile context, explicit selected work facts/summary, and at most the last few turns of this task. Validate amounts and summary consistency server-side before prompting. User-entered data remains self-reported, never described as externally verified.

Response contract:

```text
status: answered | needs_details | cannot_verify
language: en | hi | pa
title: short title
answer: simple-language explanation
steps: up to 5 practical next steps
checklist: up to 8 preparation items, if relevant
sourceIds: only sources actually supplied and relevant to claims
draft: editable text for drafting tasks, otherwise empty
missingDetails: up to 2 focused follow-up questions
caveat: short task-specific uncertainty or limitation
```

- Use one model call per explicit user action; no AI calls during typing, navigation, or arithmetic. No background content generation.
- Prefer a complete validated JSON response over streaming partial JSON. Start with about 100–180 answer words, plus relevant steps/draft; use a bounded output budget sufficient for all three scripts.
- Approximately 45-second upstream timeout and a slightly longer client timeout; cancel/ignore stale results after navigation or task changes. A retry must not duplicate ledger writes or saved items.
- Select only relevant reference notes by task; no embeddings pipeline is needed for a small source pack. Do not imply live browsing.
- Rights, scheme benefits, mandatory documents, legal deadlines, and eligibility statements require matching verified source facts. Source allowlisting alone does not prove factual correctness.
- Prompt/reference/profile/pasted-text content boundaries must be explicit. The model has no tools that can execute code, write records, send complaints, or fetch arbitrary URLs.
- Persist no user messages on the server. Log request ID, duration, safe error category, and token counts where available; never raw provider error bodies, keys, document text, or worker records.
- Validate response schema and semantic invariants: relevant mode, language field, known source IDs, draft expected for a sufficiently specified grievance. Do not show malformed/refused output as success. Grounding and natural-language quality also need live manual evaluation.
- Preserve user input on failures. Local app functions remain usable. Translate application-generated error messages.
- Rate-limit with Workers-supported bindings and bound individual request cost/time. A per-isolate in-flight guard is only best-effort concurrency protection; do not call it a global limit. Apply provider quotas where available and document their actual scope. Origin checks alone are not authentication or complete abuse control. Retain evaluation quota and avoid endless test generations.

## 8. Security requirements proportionate to this scope

- Worker runtime secrets only; `.env*` and `.dev.vars*` ignored except explicitly safe example files containing no credentials. Never put Gemini keys in `VITE_*`, source code, logs, browser storage, screenshots, or submission text.
- Validate client and server data with shared schemas, including string lengths, safe monetary bounds, date validity, allowed modes/languages, history length, and maximum body size. Plain-text document help needs an explicit short input limit.
- Use safe text rendering; no `dangerouslySetInnerHTML` for model/user content. Source links are server-owned HTTPS URLs with safe external-link attributes.
- Serve appropriate security headers for both static assets and Worker API responses; verify actual CSP and other response policies. Use same-origin requests and reject mismatched browser origins where present. Allow explicit local-development origins only if required; no permissive CORS is needed for production. Origin policy is not authentication.
- CSV exports neutralize formula prefixes including leading whitespace/control-character cases and escape quotes/newlines. Test against malicious work labels and notes.
- Derive client identity for rate limiting from trusted Cloudflare request metadata. Do not trust arbitrary client-supplied X-Forwarded-For values or retain Express proxy assumptions in the Worker.
- Local-only, no-auth data design prevents a central database from mixing workers' records, but does not protect against someone using the same browser profile. Explain that limitation and offer clear-data controls.
- Keep security checks focused on actual features. Do not add authentication, file-upload infrastructure, or speculative compliance systems to this MVP.

## 9. Delivery sequence and scope discipline

Use the actual remaining challenge time; the warm-up deadline was not given in the transcript. Percentages below are planning allocations, not benchmark weights.

1. **10% — inspect and prove:** inspect scaffold, reconcile schema/branding, establish scripts and real Gemini connectivity. If provider access fails, surface the blocker immediately while continuing local UI/record work.
2. **15% — complete assistant slice:** one shared five-mode interface, language handling, request/response validation, useful source pack, loading/error behavior. Exercise all five modes early so breadth is not left to the end.
3. **25% — real records and outputs:** integer-money ledger, partial payments, draft editing/export, persistent checklists and saved items. Connect selected earnings to explanation and payment drafting.
4. **20% — mobile/PWA integration:** finalized navigation, all translations, IndexedDB persistence, manifest/icons, app caching, offline behavior, accessible forms and keyboard behavior.
5. **30% — verification and handoff:** functional/security/domain tests, mobile QA, live model evaluation, production build, deployed verification if available, README and evaluation evidence.

Test meaningful changes as they land; the final allocation is for integration and release checks. Reduce decorative polish first if time tightens. **Do not remove any of the five required areas, real Gemini integration, persistence, security essentials, or honest error handling to save time.**

Explicitly out of scope: login/OTP, cloud sync, payment collection, bank connections, uploads/OCR, native Android packaging, automatic scheme applications, sending grievances, GPS, push notifications, voice input/output, dark mode, animations beyond basic feedback, analytics dashboards, natural-language ledger extraction. These can be reconsidered after the warm-up; none is needed to fulfill the core brief.

## 10. Tests and evidence required before calling the build ready

### Automated domain/API tests

- Exact paise arithmetic, partial payments, negative net, zero-income entry, multi-entry aggregate limits, local date boundaries, invalid dates/hours/amounts.
- Editing/deleting/receiving payment updates the correct totals; the ₹900/₹600/₹180 case remains stable.
- CSV formula injection, leading whitespace, quotes/newlines, and native-script text.
- Oversized/malformed request, unsupported mode/language, inconsistent totals, unknown sources, invalid provider JSON, empty response, refusal, missing key, timeout, 429, and unexpected provider failure.
- Errors preserve privacy and do not return fake answer/success fields. Development proxy and production same-origin requests work; unapproved browser origins fail. Unknown API paths return JSON 404 rather than SPA HTML. Exercise handlers in the local Workers runtime.
- Test fixtures/provider stubs are isolated to tests. They do not validate real Gemini connectivity.

### Browser journeys

- Fresh browser: no seeded records or fabricated output; all five entry points visible and functional.
- Add/edit/delete entries, receive partial payment, reload, filter period, export; verify stored facts.
- Produce a draft, edit, copy/download/save, reopen, and delete it; verify actual changes and confirmation feedback.
- Save a safety/document checklist, check items, reload; verify persistence.
- Switch languages; labels/errors/buttons update, saved text remains unchanged unless explicitly regenerated.
- Simulate a storage write failure and corrupt legacy data; no false saved state or silent data loss.
- After online caching: offline reload, work CRUD, saved draft/checklist access; new AI action shows an understandable unavailable state without fake output. Reconnect and manually retry once.
- Keyboard-only forms/navigation, focus restoration, semantic labels, live error announcements, contrast checks, 200% zoom, reduced motion, 320/360/390 px widths. Use an automated accessibility audit where available and manually verify the critical paths.
- Inspect production manifest/icons/service-worker behavior and absence of `/api` caches. Verify Android Chrome installation on a real device or capable emulator when available; report if untested.
- Verify API credentials and unnecessary server code are absent from production frontend output; run dependency audit and triage material findings without blind major-version upgrades.

### Bounded live Gemini evaluation

Keep live calls separate from ordinary unit/E2E runs. Start with roughly eight purposeful calls: earnings explanation; safety for two occupations; one rights question; one welfare question; one pasted-document explanation; payment grievance; non-payment dispute. Distribute these across English, Hindi, and Punjabi. Add a targeted unsupported-claim/injection check if needed. This sample does not prove every language/mode combination; record the coverage actually exercised.

For each record the input category, language, source IDs, observed output, correctness, latency, and pass/fail. Confirm semantic accuracy manually; checking only that text exists or uses a script is insufficient. Record exact numbers/placeholders in drafts, source support for rights/scheme claims, and useful caution when facts are unavailable. Reuse test records only in a disclosed testing environment, then clear them before final fresh-state checks.

### Performance observations

Record production JS/CSS transfer sizes, mobile loading behavior under a documented throttling setting, and observed AI latency. Aim for a small initial client (approximately 250 KB compressed JS as an internal target) and immediate local actions. These are engineering targets, not event scoring thresholds. Investigate material bloat; do not spend the warm-up chasing an arbitrary Lighthouse score while required flows fail.

## 11. Existing scaffold: what the developer must reconcile

Inspected on 17 October 2026. It is incomplete and unverified, not a working application.

- `package.json`, `index.html`, `public/favicon.svg`, server prompts/messages, `src/i18n.ts`, and storage naming contain the earlier Saathi branding. Rename product-facing content to KaamSet.
- `src/main.tsx` references `App` and `styles.css`, which were not present at inspection. There is no completed UI.
- `shared/domain.ts` stores rupee numbers and a paid boolean; replace with integer paise and amount received. Separate aggregate limits, make optional profile/hour fields truly optional, and add persistent checklist schemas.
- `src/store.ts` uses localStorage; implement the IndexedDB repository. If legacy data exists, migrate safely: paid → received equals earned, unpaid → received zero; preserve unknown/corrupt data for recovery. Do not blindly clear it.
- `server/ai.ts` has a preliminary Gemini adapter and only two brief portal references. Extend task-specific grounding, roles, response handling, and rights/safety/document coverage. Revalidate all facts before relying on them.
- `server/app.ts` and `server/index.ts` are preliminary Express code. Port useful validation/error/origin behavior into `worker/index.ts`; replace Express-specific middleware and process-local limits with Worker-compatible controls. Pass secrets through bindings. Update scripts/tests and remove unused production server dependencies after the Worker is verified.
- Test scripts exist but test files and browser-test configuration were absent. Build meaningful checks and verify actual commands run.
- Gemini model-list access succeeded earlier; real generation, a complete build, UI behavior, deployment, and installation were not verified.

Inspect current files before editing because another developer may have progressed since this snapshot. Reuse useful code; do not preserve scaffold decisions that conflict with this final plan.

## 12. Deliverables and submission boundary

Deliver:

1. Working KaamSet code, production build, and local preview instructions.
2. README: setup, environment variables, supported Node version, architecture, scripts, five feature walkthroughs, privacy/offline boundaries, deployment instructions, known limitations.
3. `docs/EVALUATION.md`: criterion-to-feature-to-test mapping, commands and real results, live-AI observations, mobile/PWA evidence, failures/untested checks. Never fabricate screenshots or claim unrun tests passed.
4. `docs/SUBMISSION.md`: concise product description, all five requirements mapped to functionality, Gemini usage, source-grounding approach, deployment/repository links only when real, and a short demonstration script covering all five areas.
5. Complete Wrangler configuration and deploy scripts for one Cloudflare Worker with static assets, secure Gemini-secret setup instructions, and a verified public HTTPS URL. Use the actual authorized Cloudflare account. Confirm live Gemini calls from that URL in a fresh signed-out browser. If account or secret access is unavailable, identify the remaining setup without describing deployment as complete. Do not purchase services or claim a local preview is publicly deployed.

Warm-up has **one submission attempt**. Do not click Submit or consume it as a test. The main-round video requirement is explicit; warm-up video requirements must be checked in the actual form. Do not imply warm-up scores count toward final ranking. Preserve API capacity for evaluators. No login credentials are needed for this local-data, no-login MVP.

**Definition of done:** all five areas work through real Gemini; all three languages work in exercised flows; earnings and saved outputs persist; mobile navigation and stated offline behavior work; production build and meaningful checks pass; the public Cloudflare URL serves both frontend and working Gemini-backed Worker API without visitor login or API-key entry; installation is verified or its testing gap is explicitly reported; evaluation evidence matches what was actually tested. Any missing mandatory area means the app is incomplete.
