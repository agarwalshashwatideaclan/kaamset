import { useEffect, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { listenOnce, recognitionSupported, stopListening } from '../speech.ts';
import type { MessageKey } from '../i18n.ts';
import { useApp } from '../context.ts';

/** Dictates one utterance in the UI language. Renders nothing where the browser lacks speech recognition. */
export function MicButton({ onText, label = 'micStart' }: { onText(text: string): void; label?: MessageKey }) {
  const { t, lang } = useApp();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => () => stopListening(), []);
  if (!recognitionSupported()) return null;

  async function toggle() {
    if (listening) { stopListening(); setListening(false); return; }
    setError(null);
    setListening(true);
    try {
      onText(await listenOnce(lang));
    } catch (e) {
      const code = (e as Error).message;
      if (code !== 'aborted') setError(code === 'not-allowed' || code === 'service-not-allowed' ? 'micDenied' : 'micError');
    } finally {
      setListening(false);
    }
  }

  return (
    <div className="mic">
      <button type="button" className={`btn mic-button${listening ? ' listening' : ''}`} aria-pressed={listening} onClick={toggle}>
        {listening ? <MicOff aria-hidden="true" size={22} /> : <Mic aria-hidden="true" size={22} />}
        {listening ? t('micStop') : t(label)}
      </button>
      <p className="mic-status" role="status" aria-live="polite">
        {listening ? t('micListening') : error ? <span className="error">{t(error)}</span> : null}
      </p>
      <p className="hint">{t('micNote')}</p>
    </div>
  );
}
