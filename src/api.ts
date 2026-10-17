import type { AssistantRequest, AssistantResponse } from '../shared/domain.ts';
import type { MessageKey } from './i18n.ts';

const KNOWN_ERRORS = new Set(['invalid_request', 'rate_limited', 'quota', 'timeout', 'not_configured', 'blocked', 'invalid_output']);

export class AskError extends Error {
  readonly key: MessageKey;
  constructor(key: MessageKey) {
    super(key);
    this.key = key;
  }
}

export async function askAssistant(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResponse> {
  let res: Response;
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.any([signal, AbortSignal.timeout(55_000)]),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new AskError((error as Error).name === 'TimeoutError' ? 'err_timeout' : 'err_network');
  }
  const body = await res.json().catch(() => null) as (AssistantResponse & { error?: string }) | null;
  if (!res.ok || !body || body.error) {
    const code = body?.error;
    throw new AskError(code && KNOWN_ERRORS.has(code) ? `err_${code}` as MessageKey : 'err_generic');
  }
  return body;
}
