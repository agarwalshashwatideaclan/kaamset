import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { listenOnce, recognitionSupported, stopListening } from '../speech.ts';
import { useApp } from '../context.ts';

/**
 * Centre button of the bottom navigation. While listening it shows a full-width recording sheet
 * so it is obvious the microphone is on. Renders nothing where speech recognition is unavailable.
 */
export function NavMic({ onText }: { onText(text: string): void }) {
  const { t, lang, notify } = useApp();
  const [listening, setListening] = useState(false);
  const stopRef = useRef<HTMLButtonElement>(null);
  const stoppedByUser = useRef(false);

  useEffect(() => () => stopListening(), []);
  useEffect(() => { if (listening) stopRef.current?.focus(); }, [listening]);
  if (!recognitionSupported()) return null;

  function stop() {
    stoppedByUser.current = true;
    stopListening();
  }

  async function start() {
    stoppedByUser.current = false;
    setListening(true);
    try {
      onText(await listenOnce(lang));
    } catch (e) {
      const code = (e as Error).message;
      if (!stoppedByUser.current && code !== 'aborted') notify(code === 'not-allowed' || code === 'service-not-allowed' ? 'micDenied' : 'micError');
    } finally {
      setListening(false);
    }
  }

  return (
    <>
      <div className="tab tab-mic">
        <button type="button" className="mic-fab" aria-label={t('micAsk')} aria-pressed={listening}
          onClick={() => (listening ? stop() : start())}>
          <Mic aria-hidden="true" size={28} />
        </button>
        <span aria-hidden="true">{t('micNav')}</span>
      </div>
      {listening && (
        <div className="recording" role="status" aria-live="assertive">
          <div className="recording-visual" aria-hidden="true">
            <span className="ring" /><span className="ring ring-2" />
            <span className="recording-mic"><Mic size={40} /></span>
          </div>
          <p className="recording-title"><span className="rec-dot" aria-hidden="true" />{t('micRecording')}</p>
          <p className="recording-hint">{t('micListening')}</p>
          <button ref={stopRef} type="button" className="btn btn-primary" onClick={stop}>
            <Square aria-hidden="true" size={18} /> {t('micStop')}
          </button>
          <p className="hint">{t('micNote')}</p>
        </div>
      )}
    </>
  );
}
