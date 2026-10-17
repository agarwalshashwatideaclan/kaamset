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

/** Combines the caller's signal with a client timeout without AbortSignal.any, which older Android Chrome lacks. */
export async function askAssistant(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 55_000);
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  let res: Response;
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new AskError('err_timeout');
    throw signal.aborted ? error : new AskError('err_network');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
  const body = await res.json().catch(() => null) as (AssistantResponse & { error?: string }) | null;
  if (!res.ok || !body || body.error) {
    const code = body?.error;
    throw new AskError(code && KNOWN_ERRORS.has(code) ? `err_${code}` as MessageKey : 'err_generic');
  }
  return body;
}
