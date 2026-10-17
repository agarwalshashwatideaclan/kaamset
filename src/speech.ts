import type { Language } from '../shared/domain.ts';

const LOCALE: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };
const QUIET_KEY = 'kaamset.quiet';

interface RecognitionResultEvent { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const recognitionSupported = () => Boolean(recognitionCtor());

let active: Recognition | null = null;

export function stopListening() {
  active?.abort();
  active = null;
}

/** Resolves with one utterance's transcript; rejects with the browser's error code (e.g. "not-allowed"). */
export function listenOnce(lang: Language): Promise<string> {
  const Ctor = recognitionCtor();
  if (!Ctor) return Promise.reject(new Error('unsupported'));
  stopSpeaking();
  stopListening();
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    active = rec;
    let heard = '';
    rec.lang = LOCALE[lang];
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = e => { heard = e.results[0]?.[0]?.transcript?.trim() ?? ''; };
    rec.onerror = e => { active = null; reject(new Error(e.error)); };
    rec.onend = () => {
      if (active === rec) active = null;
      if (heard) resolve(heard); else reject(new Error('no-speech'));
    };
    rec.start();
  });
}

export function readAloudEnabled(): boolean {
  try { return localStorage.getItem(QUIET_KEY) !== '1'; } catch { return true; }
}

export function setReadAloud(on: boolean) {
  try { localStorage.setItem(QUIET_KEY, on ? '0' : '1'); } catch { /* preference only */ }
}

const emitSpeaking = (speaking: boolean) => dispatchEvent(new CustomEvent('kaamset:speaking', { detail: speaking }));

export function stopSpeaking() {
  if ('speechSynthesis' in globalThis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  emitSpeaking(false);
}

/** Speaks only when the device has a voice for the language; otherwise stays silent. */
export function speak(text: string, lang: Language): boolean {
  if (!('speechSynthesis' in globalThis) || !readAloudEnabled()) return false;
  const prefix = LOCALE[lang].slice(0, 2);
  const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').toLowerCase().startsWith(prefix));
  if (!voice) return false;
  stopListening();
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onend = utterance.onerror = () => emitSpeaking(false);
  emitSpeaking(true);
  speechSynthesis.speak(utterance);
  return true;
}
