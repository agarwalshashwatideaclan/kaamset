import { useState } from 'react';
import { Copy, Download, Save, ExternalLink, ListChecks } from 'lucide-react';
import type { AssistantResponse, Language, Mode } from '../../shared/domain.ts';
import { useApp } from '../context.ts';
import { downloadFile } from './ui.tsx';

interface Props {
  response: AssistantResponse;
  mode: Mode;
  /** Stable per answer, so saving twice updates instead of duplicating. */
  saveId: string;
  workId?: string;
  question: string;
}

/** Renders model output as plain text only; never as HTML. */
export function AnswerView({ response, mode, saveId, workId, question }: Props) {
  const { t, saveDraft, saveChecklist, notify } = useApp();
  const [draft, setDraft] = useState(response.draft);
  const [savedDraftAt, setSavedDraftAt] = useState<string>();
  const [checklistSaved, setChecklistSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const lang: Language = response.language;

  async function onSaveDraft() {
    const now = new Date().toISOString();
    const ok = await saveDraft({ id: saveId, title: response.title.slice(0, 180), text: draft, language: lang, workId, createdAt: savedDraftAt ?? now, updatedAt: now });
    if (ok) { setSavedDraftAt(savedDraftAt ?? now); notify('draftSaved'); }
  }

  async function onSaveChecklist() {
    const now = new Date().toISOString();
    const ok = await saveChecklist({
      id: saveId, title: response.title.slice(0, 180), mode, language: lang,
      items: response.checklist.map((text, i) => ({ id: `i${i}`, text, done: false })),
      sources: response.sources.map(({ id, title, url }) => ({ id, title, url })),
      createdAt: now, updatedAt: now,
    });
    if (ok) { setChecklistSaved(true); notify('checklistSaved'); }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked; text remains selectable */ }
  }

  const needsSources = mode === 'rights_welfare' || mode === 'documents';

  return (
    <article className="answer" lang={lang} aria-label={response.title}>
      <p className="hint question"><span className="sr-only">{t('youAsked')}: </span>{question}</p>
      <p className="ai-badge">{t('aiBadge')}</p>
      {response.status !== 'answered' && (
        <p className={`badge badge-${response.status}`}>{t(response.status === 'needs_details' ? 'needsDetails' : 'cannotVerify')}</p>
      )}
      <h2>{response.title}</h2>
      {response.answer.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)}

      {response.steps.length > 0 && (
        <>
          <h3>{t('steps')}</h3>
          <ol className="steps">{response.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>
      )}

      {response.missingDetails.length > 0 && (
        <>
          <h3>{t('missing')}</h3>
          <ul>{response.missingDetails.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </>
      )}

      {mode === 'grievance' && response.draft && (
        <div className="draft">
          <label htmlFor={`draft-${saveId}`}><h3>{t('draftHeading')}</h3></label>
          <p className="hint">{t('notSent')}</p>
          <textarea id={`draft-${saveId}`} rows={10} value={draft} maxLength={8000} onChange={e => setDraft(e.target.value)} />
          <div className="actions actions-wrap">
            <button type="button" className="btn btn-primary" onClick={onSaveDraft}><Save aria-hidden="true" size={20} /> {t('saveDraft')}</button>
            <button type="button" className="btn" onClick={onCopy}><Copy aria-hidden="true" size={20} /> {copied ? t('copied') : t('copy')}</button>
            <button type="button" className="btn" onClick={() => downloadFile('kaamset-draft.txt', draft)}><Download aria-hidden="true" size={20} /> {t('download')}</button>
          </div>
        </div>
      )}

      {response.checklist.length > 0 && (
        <>
          <h3>{t('checklist')}</h3>
          <ul className="plain-checklist">{response.checklist.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <button type="button" className="btn" onClick={onSaveChecklist} disabled={checklistSaved}>
            <ListChecks aria-hidden="true" size={20} /> {checklistSaved ? t('checklistSaved') : t('saveChecklist')}
          </button>
        </>
      )}

      {response.sources.length > 0 ? (
        <>
          <h3>{t('sources')}</h3>
          <ul className="sources">
            {response.sources.map(s => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} <ExternalLink aria-hidden="true" size={16} /></a>
                <span className="hint"> · {s.publisher}</span>
              </li>
            ))}
          </ul>
        </>
      ) : needsSources && <p className="hint">{t('noSources')}</p>}

      {response.caveat && <p className="caveat">{response.caveat}</p>}
    </article>
  );
}
