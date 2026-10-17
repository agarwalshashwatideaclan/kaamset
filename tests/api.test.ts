import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleApi, type Env } from '../worker/index.ts';
import { generateAnswer, ProviderError, userPayload } from '../server/ai.ts';
import type { Answer, AssistantRequest } from '../shared/domain.ts';

// Test-only fixtures: these stand in for Gemini and never ship in the app.
const ORIGIN = 'https://kaamset.test';
const answer = (over: Partial<Answer> = {}): Answer => ({
  status: 'answered', language: 'en', title: 'Pending payment', answer: 'You earned ₹900 and received ₹600.',
  steps: ['Keep screenshots.'], checklist: [], sourceIds: [], draft: '', missingDetails: [], caveat: '', ...over,
});
const request = (over: Partial<AssistantRequest> = {}) => ({ mode: 'safety', language: 'en', message: 'Riding in heavy rain tonight', ...over });

function env(over: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }) },
    GEMINI_API_KEY: 'test-key',
    ...over,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('unknown API paths and bare /api return JSON 404, never SPA HTML', async () => {
  for (const path of ['/api', '/api/', '/api/nope', '/api/assistant/x']) {
    const res = await worker.fetch(new Request(`${ORIGIN}${path}`, { headers: { accept: 'text/html' } }), env());
    assert.equal(res.status, 404, path);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { error: 'not_found' });
  }
  const page = await worker.fetch(new Request(`${ORIGIN}/earnings`), env());
  assert.match(await page.text(), /doctype/);
});

test('wrong methods, media types, origins and oversized bodies are rejected', async () => {
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/assistant`), env())).status, 405);
  assert.equal((await handleApi(new Request(`${ORIGIN}/api/health`, { method: 'POST' }), env())).status, 405);
  assert.equal((await handleApi(post(request(), { 'content-type': 'text/plain' }), env())).status, 415);
  assert.equal((await handleApi(post(request(), { origin: 'https://evil.example' }), env())).status, 403);
  assert.equal((await handleApi(post(request(), { origin: 'http://127.0.0.1:5173' }), env({ ALLOWED_DEV_ORIGINS: 'http://127.0.0.1:5173' }), async () => answer())).status, 200);
  assert.equal((await handleApi(post({ ...request(), message: 'x'.repeat(20_000) }), env())).status, 413);
  assert.equal((await handleApi(post('{not json'), env())).status, 400);
});

test('schema violations return 400 without calling Gemini', async () => {
  let calls = 0;
  const gen = async () => { calls++; return answer(); };
  const bad = [
    request({ mode: 'general' as never }),
    request({ language: 'ta' as never }),
    request({ message: 'hi' }),
    request({ history: Array.from({ length: 5 }, () => ({ role: 'user' as const, text: 'x' })) }),
    request({ mode: 'earnings', earnings: { to: '2026-10-17', count: 1, earnedPaise: 90000, receivedPaise: 60000, expensePaise: 18000, netEarnedPaise: 72000, pendingPaise: 1 } }),
  ];
  for (const body of bad) {
    const res = await handleApi(post(body), env(), gen);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'invalid_request' });
  }
  assert.equal(calls, 0);
});

test('missing key → 503 and rate limit → 429, with no answer fields', async () => {
  const noKey = await handleApi(post(request()), env({ GEMINI_API_KEY: undefined }));
  assert.equal(noKey.status, 503);
  assert.deepEqual(await noKey.json(), { error: 'not_configured' });
  const limited = await handleApi(post(request()), env({ AI_LIMITER: { limit: async () => ({ success: false }) } }), async () => answer());
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'rate_limited' });
});

test('success returns validated answer with server-owned source links for the mode only', async () => {
  const res = await handleApi(post(request({ mode: 'rights_welfare', message: 'How do I register on e-Shram?' })), env(),
    async () => answer({ sourceIds: ['eshram_faq', 'ndma_heatwave', 'made_up'] }));
  assert.equal(res.status, 200);
  const body = await res.json() as { sources: { id: string; url: string }[] };
  assert.deepEqual(body.sources.map(s => s.id), ['eshram_faq']);
  assert.equal(body.sources[0].url, 'https://eshram.gov.in/faqs');
});

test('provider failures map to safe error codes without leaking details', async () => {
  const cases: [ProviderError['category'], number][] = [['quota', 429], ['timeout', 504], ['invalid_output', 502], ['blocked', 422], ['upstream', 502]];
  for (const [category, status] of cases) {
    const res = await handleApi(post(request()), env(), async () => { throw new ProviderError(category); });
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { error: category });
  }
  const unexpected = await handleApi(post(request()), env(), async () => { throw new Error('secret upstream body test-key'); });
  assert.deepEqual(await unexpected.json(), { error: 'upstream' });
});

function gemini(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}
const candidate = (text: string, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
const req = (over: Partial<AssistantRequest> = {}): AssistantRequest => ({ mode: 'safety', language: 'en', message: 'Riding in heavy rain', profile: {}, history: [], ...over });

async function rejects(p: Promise<unknown>, category: string) {
  await assert.rejects(p, (e: unknown) => e instanceof ProviderError && e.category === category);
}

test('Gemini adapter validates provider output strictly', async () => {
  const cfg = (fetchImpl: typeof fetch) => ({ apiKey: 'k', fetchImpl });
  await rejects(generateAnswer(req(), { apiKey: undefined }), 'not_configured');
  await rejects(generateAnswer(req(), cfg(gemini({}, 429))), 'quota');
  await rejects(generateAnswer(req(), cfg(gemini({}, 500))), 'upstream');
  await rejects(generateAnswer(req(), cfg(gemini(candidate('not json')))), 'invalid_output');
  await rejects(generateAnswer(req(), cfg(gemini(candidate('')))), 'invalid_output');
  await rejects(generateAnswer(req(), cfg(gemini({ promptFeedback: { blockReason: 'SAFETY' } }))), 'blocked');
  await rejects(generateAnswer(req(), cfg(gemini(candidate('{}', 'SAFETY')))), 'blocked');
  await rejects(generateAnswer(req(), cfg(gemini(candidate(JSON.stringify({ ...answer(), title: '' }))))), 'invalid_output');
  await rejects(generateAnswer(req({ language: 'hi' }), cfg(gemini(candidate(JSON.stringify(answer({ language: 'hi' })))))), 'invalid_output');
  await rejects(generateAnswer(req({ mode: 'grievance' }), cfg(gemini(candidate(JSON.stringify(answer()))))), 'invalid_output');
  const followUp = await generateAnswer(
    req({ mode: 'grievance', history: [{ role: 'user', text: 'Draft it' }, { role: 'assistant', text: 'Dear Support…' }] }),
    cfg(gemini(candidate(JSON.stringify(answer({ answer: 'Keep the payment screenshot.' }))))),
  );
  assert.equal(followUp.draft, '', 'a follow-up question may be answered without a new draft');
  const timeout: typeof fetch = async (_u, init) => new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
  await rejects(generateAnswer(req(), { apiKey: 'k', fetchImpl: timeout, timeoutMs: 20 }), 'timeout');

  const ok = await generateAnswer(req({ language: 'pa' }), cfg(gemini(candidate(JSON.stringify(answer({ language: 'pa', answer: 'ਮੀਂਹ ਵਿੱਚ ਹੌਲੀ ਚਲਾਓ।', draft: 'should be dropped', sourceIds: ['eshram_faq'] }))))));
  assert.equal(ok.draft, '');
  assert.deepEqual(ok.sourceIds, [], 'sources outside the mode pack are removed');
});

test('prompt payload carries exact totals and never the worker name', () => {
  const payload = JSON.parse(userPayload(req({
    mode: 'earnings',
    earnings: { from: '2026-10-11', to: '2026-10-17', count: 1, earnedPaise: 90000, receivedPaise: 60000, expensePaise: 18000, netEarnedPaise: 72000, pendingPaise: 30000 },
  })));
  assert.equal(payload.earnings.pending, '₹300.00');
  assert.equal(payload.earnings.netEarned, '₹720.00');
  assert.equal(payload.earnings.period, '2026-10-11 to 2026-10-17');
  assert.ok(!('name' in payload.profile));
});
