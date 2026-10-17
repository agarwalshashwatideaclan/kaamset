import { useState } from 'react';
import { Wallet, ShieldCheck, Landmark, FileText, MessageSquareWarning, Plus, type LucideIcon } from 'lucide-react';
import { filterPeriod, summarize, type Mode } from '../../shared/domain.ts';
import { LANGUAGE_LABEL, type MessageKey } from '../i18n.ts';
import { LANGUAGES } from '../../shared/domain.ts';
import { useApp } from '../context.ts';
import { SummaryGrid } from '../components/ui.tsx';
import { MicButton } from '../components/MicButton.tsx';

export const MODE_META: Record<Mode, { title: MessageKey; body: MessageKey; Icon: LucideIcon }> = {
  earnings: { title: 'modeEarnings', body: 'modeEarningsBody', Icon: Wallet },
  safety: { title: 'modeSafety', body: 'modeSafetyBody', Icon: ShieldCheck },
  rights_welfare: { title: 'modeRights', body: 'modeRightsBody', Icon: Landmark },
  documents: { title: 'modeDocuments', body: 'modeDocumentsBody', Icon: FileText },
  grievance: { title: 'modeGrievance', body: 'modeGrievanceBody', Icon: MessageSquareWarning },
};

const WELCOME_KEY = 'kaamset.welcomed';

function welcomed(): boolean {
  try { return localStorage.getItem(WELCOME_KEY) === '1'; } catch { return true; }
}

export function Today() {
  const { t, ws, lang, setLang, openAddWork, openAsk } = useApp();
  const [showWelcome, setShowWelcome] = useState(() => !welcomed());
  const week = summarize(filterPeriod(ws.entries, '7d'));

  const closeWelcome = () => {
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* preference only */ }
    setShowWelcome(false);
  };

  return (
    <section className="screen">
      <h1 tabIndex={-1}>{t('todayTitle')}</h1>
      <p className="lede">{t('tagline')}</p>

      {showWelcome && (
        <div className="card welcome">
          <p className="card-title" aria-hidden="true">{t('language')}</p>
          <fieldset className="segmented"><legend className="sr-only">{t('language')}</legend>
            {LANGUAGES.map(l => (
              <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANGUAGE_LABEL[l]}</button>
            ))}
          </fieldset>
          <button type="button" className="btn btn-primary" onClick={closeWelcome}>OK</button>
        </div>
      )}

      <div className="card">
        <h2>{t('last7')}</h2>
        {week.count > 0 ? (
          <>
            <SummaryGrid summary={week} />
            <p className="hint">{t('entriesCount', { n: week.count })}</p>
          </>
        ) : (
          <>
            <p className="empty-title">{t('emptyTodayTitle')}</p>
            <p>{t('emptyTodayBody')}</p>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={openAddWork}>
          <Plus aria-hidden="true" size={20} /> {t('addWork')}
        </button>
      </div>

      <h2>{t('tasksTitle')}</h2>
      <MicButton label="micAsk" onText={text => openAsk({ text })} />
      <ul className="task-list">
        {(Object.keys(MODE_META) as Mode[]).map(mode => {
          const { title, body, Icon } = MODE_META[mode];
          return (
            <li key={mode}>
              <button type="button" className="task" onClick={() => openAsk({ mode })}>
                <Icon aria-hidden="true" size={26} />
                <span><strong>{t(title)}</strong><span className="task-body">{t(body)}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{t('localNote')}</p>
    </section>
  );
}
