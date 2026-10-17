import { assistantRequestSchema, type Answer, type AssistantRequest, type AssistantResponse } from '../shared/domain.ts';
import { generateAnswer, ProviderError, type GeminiConfig, type ProviderErrorCategory } from '../server/ai.ts';
import { toLinks } from '../server/knowledge.ts';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_DEV_ORIGINS?: string;
}

type Generate = (req: AssistantRequest, cfg: GeminiConfig) => Promise<Answer>;

const MAX_BODY_BYTES = 16_384;

const API_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

export type ErrorCode = 'not_found' | 'method_not_allowed' | 'forbidden_origin' | 'unsupported_media_type' | 'too_large'
  | 'invalid_request' | 'rate_limited' | 'not_configured' | 'quota' | 'timeout' | 'upstream' | 'invalid_output' | 'blocked';

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...API_HEADERS, ...extra } });
}

/** The client translates `error` codes; no provider details or user content are echoed back. */
const fail = (error: ErrorCode, status: number, extra?: Record<string, string>) => json({ error }, status, extra);

function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  return (env.ALLOWED_DEV_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}

const STATUS_FOR: Record<ProviderErrorCategory, number> = {
  not_configured: 503, quota: 429, timeout: 504, upstream: 502, invalid_output: 502, blocked: 422,
};

export async function handleApi(request: Request, env: Env, generate: Generate = generateAnswer): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health') {
    if (request.method !== 'GET') return fail('method_not_allowed', 405, { allow: 'GET' });
    return json({ ok: true, aiConfigured: Boolean(env.GEMINI_API_KEY), model: env.GEMINI_MODEL || 'gemini-2.5-flash' });
  }
  if (pathname !== '/api/assistant') return fail('not_found', 404);
  if (request.method !== 'POST') return fail('method_not_allowed', 405, { allow: 'POST' });
  if (!originAllowed(request, env)) return fail('forbidden_origin', 403);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return fail('unsupported_media_type', 415);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('too_large', 413);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return fail('too_large', 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return fail('invalid_request', 400); }
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_request', 400);
  if (!env.GEMINI_API_KEY) return fail('not_configured', 503);

  if (env.AI_LIMITER) {
    // Per Cloudflare location, per client IP. Not a global spending cap.
    const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const { success } = await env.AI_LIMITER.limit({ key });
    if (!success) return fail('rate_limited', 429, { 'retry-after': '60' });
  }

  const started = Date.now();
  try {
    const answer = await generate(parsed.data, { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
    const response: AssistantResponse = { ...answer, sources: toLinks(answer.sourceIds, parsed.data.mode) };
    console.log(JSON.stringify({ event: 'assistant_ok', mode: parsed.data.mode, language: parsed.data.language, ms: Date.now() - started }));
    return json(response);
  } catch (error) {
    const category = error instanceof ProviderError ? error.category : 'upstream';
    console.log(JSON.stringify({ event: 'assistant_error', mode: parsed.data.mode, category, ms: Date.now() - started }));
    return fail(category, STATUS_FOR[category], category === 'quota' ? { 'retry-after': '60' } : {});
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
