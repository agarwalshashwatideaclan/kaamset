# KaamSet: submission notes

**Live app:** https://kaamset.shashwat-5f0.workers.dev (no login, no API key)
**Repository:** https://github.com/agarwalshashwatideaclan/kaamset

## What it is

KaamSet is a phone-first assistant for delivery partners, drivers and daily-wage workers, in English, Hindi and Punjabi. Workers keep their own earnings records on the device. Google Gemini then gives plain-language help across five areas: understanding their money, staying safe, knowing their rights and welfare options, preparing documents, and drafting complaints. Every answer is grounded in the worker's own data or in reviewed official sources, and it says so when something can't be verified.

## Five requirements → features

| Requirement | Feature |
| --- | --- |
| Earnings tracking | Add/edit/delete daily work with earned, received (partial payments) and expenses. Exact totals (net earned, pending), 7/30-day/all-time filters, CSV export. "Explain this period" sends the totals to Gemini, but only if the worker ticks "share". |
| Safety practices | The worker describes their work and situation. Gemini returns occupation-specific precautions and when to stop or get help, plus a checklist that can be saved and ticked in Saved. |
| Rights & welfare awareness | Two options: "Understand my rights" and "Explore welfare support". Answers use only reviewed official notes (PIB labour-code releases, e-Shram FAQ, myScheme) and link to them. Unsupported questions get "Could not be verified" plus where to check. |
| Document help | Explain a pasted passage (with a warning to remove ID numbers), or build a preparation checklist with items marked Required or Suggested. |
| Grievance / dispute drafting | Payment, deduction, blocked account or other problems. Start from an unpaid work record (facts shown for confirmation) or from scratch. The draft is editable and has `[placeholders]` for unknown details, plus an evidence checklist. Copy, download or save. It is never sent and never claimed as submitted. |

## How Gemini is used

- **Model:** `gemini-2.5-flash` via the Gemini REST API, called only from a Cloudflare Worker. The API key is a Worker secret and is never sent to the browser.
- **Where:** a single endpoint, `POST /api/assistant`, serves all five areas. Each area gets its own rules in the system prompt, and only the source notes relevant to that area.
- **Structured output:** Gemini returns JSON fitting a fixed schema: status, title, answer, steps, checklist, sources, draft, follow-up questions, caveat.
- **Validation:** the server rejects answers in the wrong language or script, grievance answers without a draft, and source IDs not allowed for the area. Failed answers become a clear error with a retry button; there are no fake fallback answers.
- **Grounding:** rights, scheme and document-requirement claims must come from `server/knowledge.ts`. Each note records its publisher, URL, scope and review date, and includes explicit limits, for example that the sources do not establish platform workers are owed minimum wage. Source links are attached by the server, not written by the model.
- **Cost and abuse controls:**
  - one model call per button press, with no streaming or background calls;
  - input limited to 1,500 characters and 16 KB per request;
  - 45-second timeout;
  - a Cloudflare rate limit of 20 requests/min per IP per location.

## Demo video

`video/kaamset-demo/renders/kaamset-mobile-demo.mp4` — 2:39, 1080×1920 (9:16), English voiceover and captions, including the new centre-mic voice input (the dictation in the recording is scripted, as the caption discloses). It is built from real recordings of the live app (provenance: `video/kaamset-demo/capture-manifest.json`, QA: `video/kaamset-demo/QA.md`). It covers all five areas and all three languages. Upload it as an unlisted YouTube video or a shared Drive link for the form.

## Demo script (about 4 minutes)

1. **Open the link on a phone.** Pick हिन्दी or ਪੰਜਾਬੀ, then switch back to English. Point out that everything starts empty.
2. **Earnings:** Add work with ₹900 earned, ₹600 received and ₹180 expenses. The app shows net earned ₹720 and pending ₹300, marked "Part paid". Tap **Explain this period** → **Get help**. Gemini explains the exact totals.
3. **Grievance:** On the entry, tap **Write complaint**. The record's facts appear for confirmation. Add "Only ₹600 of ₹900 was paid", then **Get help**. The draft asks for ₹300 and has `[Your Name]`/`[ID]` placeholders. Edit a line, then **Save draft**.
4. **Safety (Punjabi):** Switch to ਪੰਜਾਬੀ. Choose ਕੰਮ ’ਤੇ ਸੁਰੱਖਿਆ, set work to daily-wage, and describe heat and dizziness at a construction site. You get NDMA-based heat first aid. **Save checklist**.
5. **Rights & welfare (Hindi):** Ask "ई-श्रम पर पंजीकरण कैसे करूँ?". The answer covers free registration, Aadhaar plus linked mobile or a CSC, and the UAN, with an e-Shram link. Then ask about a Punjab monthly gig payment: it shows "Could not be verified" and points to myScheme.
6. **Document help:** Paste a short passage about the UAN and get a simple explanation.
7. **Saved:** Tick a checklist item, reload, and it's still ticked. The edited draft is still there. Show export and "Delete all my data".
8. **Offline:** Turn on airplane mode and reopen the app. Earnings still work. Asking a question shows the offline message and keeps the text.

## Honest limitations

- The source pack is small and reviewed by hand; there is no eligibility engine.
- AI answers can still be wrong and are labelled as guidance.
- Android installation was not verified: the emulator's Chrome crashed in its GPU process. Data stays on one device with no sync.
