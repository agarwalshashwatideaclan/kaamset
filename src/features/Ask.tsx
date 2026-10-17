import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, RotateCcw } from 'lucide-react';
import {
  earningsContext, MODES, OCCUPATIONS,
  type AssistantRequest, type AssistantResponse, type EarningsContext, type Mode, type Occupation, type Period, type WorkEntry,
} from '../../shared/domain.ts';
import { formatDate, formatMoney, type MessageKey } from '../i18n.ts';
import { askAssistant, AskError } from '../api.ts';
import { useApp } from '../context.ts';
import { Field } from '../components/ui.tsx';
import { AnswerView } from '../components/AnswerView.tsx';
import { speak } from '../speech.ts';
import { MODE_META } from './Today.tsx';

type Focus = NonNullable<AssistantRequest['focus']>;
type Issue = 'grvPayment' | 'grvDeduction' | 'grvBlocked' | 'grvOther';
interface Turn { id: string; question: string; response: AssistantResponse }

const OCC_LABEL: Record<Occupation, MessageKey> = { delivery: 'occDelivery', driver: 'occDriver', daily: 'occDaily', other: 'occOther' };
const ISSUE_EN: Record<Issue, string> = { grvPayment: 'Payment not received', grvDeduction: 'Wrong deduction or penalty', grvBlocked: 'Account blocked or restricted', grvOther: 'Other work problem' };
const DEFAULT_FOCUS: Partial<Record<Mode, Focus>> = { rights_welfare: 'rights', documents: 'checklist' };

let handledPreset: number | undefined;

export function Ask() {
  const { t, lang, ws, online, askPreset } = useApp();
  const [mode, setMode] = useState<Mode | null>(null);
  const [focus, setFocus] = useState<Focus | undefined>();
  const [occupation, setOccupation] = useState<Occupation | ''>(ws.profile.occupation ?? '');
  const [location, setLocation] = useState(ws.profile.location ?? '');
  const [message, setMessage] = useState('');
  const [issue, setIssue] = useState<Issue>('grvPayment');
  const [recipient, setRecipient] = useState('');
  const [resolution, setResolution] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [shareTotals, setShareTotals] = useState(false);
  const [linked, setLinked] = useState<{ entry: WorkEntry; facts: EarningsContext } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingText, setPendingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const onDictation = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (mode) setMessage(prev => (prev ? `${prev} ${text}` : text).slice(0, 1200));
      else setPendingText(text);
    };
    addEventListener('kaamset:dictation', onDictation);
    return () => removeEventListener('kaamset:dictation', onDictation);
  }, [mode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per new preset nonce, not on every render.
  useEffect(() => {
    if (!askPreset || askPreset.nonce === handledPreset) return;
    handledPreset = askPreset.nonce;
    reset(askPreset.mode ?? null);
    if (askPreset.text) {
      if (askPreset.mode) setMessage(askPreset.text); else setPendingText(askPreset.text);
    }
    if (askPreset.mode === 'earnings' && askPreset.earnings) setShareTotals(true);
    if (askPreset.mode === 'grievance' && askPreset.entry && askPreset.earnings) {
      setLinked({ entry: askPreset.entry, facts: askPreset.earnings });
      setResolution(`${t('pending')}: ${formatMoney(askPreset.earnings.pendingPaise, lang)}`);
    }
  }, [askPreset]);

  function reset(next: Mode | null) {
    abortRef.current?.abort();
    setMode(next);
    setFocus(next ? DEFAULT_FOCUS[next] : undefined);
    setMessage(''); setRecipient(''); setResolution(''); setIssue('grvPayment');
    setShareTotals(false); setLinked(null); setTurns([]); setError(null); setLoading(false);
  }

  function chooseMode(next: Mode | null) {
    const dirty = turns.length > 0 || message.trim() || recipient.trim() || resolution.trim();
    if (dirty && !confirm(t('confirmDiscard'))) return;
    reset(next);
  }

  const totals = mode === 'earnings' ? earningsContext(ws.entries, period) : undefined;

  function buildMessage(): string {
    const text = message.trim();
    if (turns.length) return text;
    if (mode === 'grievance') {
      return [
        `Problem type: ${ISSUE_EN[issue]}`,
        recipient.trim() && `Recipient: ${recipient.trim()}`,
        resolution.trim() && `Desired resolution: ${resolution.trim()}`,
        `What happened: ${text || '(not described)'}`,
      ].filter(Boolean).join('\n');
    }
    if (mode === 'documents' && focus === 'explain') return `Explain this passage in simple words:\n"""${text}"""`;
    if (mode === 'earnings' && !text) return 'Explain my earnings for this period.';
    return text;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!mode || loading) return;
    const question = buildMessage();
    const textOptional = mode === 'earnings' && turns.length === 0;
    if (!textOptional && message.trim().length < 3) {
      setError('errRequired');
      return;
    }
    if (!online) { setError('offlineAi'); return; }

    const request: AssistantRequest = {
      mode, language: lang, focus,
      message: question.slice(0, 1500),
      profile: { occupation: occupation || undefined, location: location.trim() || undefined },
      earnings: mode === 'earnings' ? (shareTotals ? totals : undefined) : mode === 'grievance' ? linked?.facts : undefined,
      history: turns.slice(-2).flatMap(turn => [
        { role: 'user' as const, text: turn.question.slice(0, 2000) },
        { role: 'assistant' as const, text: `${turn.response.title}\n${turn.response.answer}\n${turn.response.draft}`.slice(0, 2000) },
      ]),
    };

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await askAssistant(request, controller.signal);
      if (controller.signal.aborted) return;
      setTurns(prev => [...prev, { id: crypto.randomUUID(), question: message.trim() || question, response }]);
      setMessage('');
      speak(`${response.title}. ${response.answer}`, response.language);
      requestAnimationFrame(() => resultRef.current?.lastElementChild?.querySelector('h2')?.focus());
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof AskError ? err.key : 'err_generic');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  if (!mode) {
    return (
      <section className="screen">
        <h1 tabIndex={-1}>{t('askTitle')}</h1>
        <p className="lede">{t('chooseMode')}</p>
        {pendingText && <p className="facts"><span className="sr-only">{t('youAsked')}: </span>“{pendingText}”</p>}
        <ul className="task-list">
          {MODES.map(m => {
            const { title, body, Icon } = MODE_META[m];
            return (
              <li key={m}>
                <button type="button" className="task" onClick={() => { reset(m); if (pendingText) { setMessage(pendingText); setPendingText(''); } }}>
                  <Icon aria-hidden="true" size={26} />
                  <span><strong>{t(title)}</strong><span className="task-body">{t(body)}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const { title, Icon } = MODE_META[mode];
  const focusOptions: Focus[] = mode === 'rights_welfare' ? ['rights', 'welfare'] : mode === 'documents' ? ['checklist', 'explain'] : [];
  const FOCUS_LABEL: Record<Focus, MessageKey> = { rights: 'focusRights', welfare: 'focusWelfare', explain: 'focusExplain', checklist: 'focusChecklist' };
  const messageLabel: MessageKey = turns.length ? 'followUp'
    : mode === 'safety' ? 'msgSafety'
    : mode === 'earnings' ? 'msgEarnings'
    : mode === 'grievance' ? 'grvFacts'
    : mode === 'documents' ? (focus === 'explain' ? 'msgDocExplain' : 'msgDocChecklist')
    : 'msgRights';
  const placeholder: MessageKey | undefined = turns.length ? undefined
    : mode === 'safety' ? 'msgSafetyPh'
    : mode === 'rights_welfare' ? (focus === 'welfare' ? 'msgWelfarePh' : 'msgRightsPh')
    : mode === 'documents' && focus === 'checklist' ? 'msgDocChecklistPh' : undefined;
  const m = (p: number) => formatMoney(p, lang);

  return (
    <section className="screen">
      <div className="mode-head">
        <Icon aria-hidden="true" size={28} />
        <h1 tabIndex={-1}>{t(title)}</h1>
      </div>
      <button type="button" className="link-button" onClick={() => chooseMode(null)}>← {t('back')}</button>

      {turns.length === 0 && focusOptions.length > 0 && (
        <fieldset className="segmented"><legend className="sr-only">{t(title)}</legend>
          {focusOptions.map(f => <button key={f} type="button" aria-pressed={focus === f} onClick={() => setFocus(f)}>{t(FOCUS_LABEL[f])}</button>)}
        </fieldset>
      )}

      <div ref={resultRef} className="turns">
        {turns.map(turn => (
          <AnswerView key={turn.id} response={turn.response} mode={mode} saveId={turn.id} workId={linked?.entry.id} question={turn.question} />
        ))}
      </div>

      <form onSubmit={submit} className="stack card" noValidate aria-busy={loading}>
        {turns.length === 0 && (
          <>
            {mode !== 'earnings' && (
              <div className="row-2">
                <Field label={t('occupation')} optional>
                  {p => (
                    <select {...p} value={occupation} onChange={e => setOccupation(e.target.value as Occupation | '')}>
                      <option value="">{t('occNone')}</option>
                      {OCCUPATIONS.map(o => <option key={o} value={o}>{t(OCC_LABEL[o])}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={t('location')} optional>
                  {p => <input {...p} value={location} maxLength={80} onChange={e => setLocation(e.target.value)} autoComplete="address-level1" />}
                </Field>
              </div>
            )}

            {mode === 'earnings' && (
              totals ? (
                <fieldset className="share">
                  <legend className="sr-only">{t('shareEarnings')}</legend>
                  <fieldset className="segmented"><legend className="sr-only">{t('periodLabel')}</legend>
                    {(['7d', '30d', 'all'] as Period[]).map(p => (
                      <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{t(p === '7d' ? 'period7d' : p === '30d' ? 'period30d' : 'periodAll')}</button>
                    ))}
                  </fieldset>
                  <label className="check">
                    <input type="checkbox" checked={shareTotals} onChange={e => setShareTotals(e.target.checked)} />
                    <span>{t('shareEarnings')}</span>
                  </label>
                  <p className="facts">
                    {totals.from && `${formatDate(totals.from, lang)} – ${formatDate(totals.to, lang)} · `}
                    {t('earned')} {m(totals.earnedPaise)} · {t('received')} {m(totals.receivedPaise)} · {t('pending')} {m(totals.pendingPaise)} · {t('expenses')} {m(totals.expensePaise)} · {t('netEarned')} {m(totals.netEarnedPaise)}
                  </p>
                </fieldset>
              ) : <p className="hint">{t('noEarningsToShare')}</p>
            )}

            {mode === 'grievance' && (
              <>
                {linked && (
                  <div className="facts-box">
                    <p className="card-title">{t('linkedWork')}</p>
                    <p className="facts">
                      {linked.entry.work} · {formatDate(linked.entry.date, lang)} · {t('earned')} {m(linked.facts.earnedPaise)} · {t('received')} {m(linked.facts.receivedPaise)} · {t('pending')} {m(linked.facts.pendingPaise)}
                    </p>
                    <button type="button" className="link-button" onClick={() => setLinked(null)}>{t('removeLinked')}</button>
                  </div>
                )}
                <Field label={t('grvIssue')}>
                  {p => (
                    <select {...p} value={issue} onChange={e => setIssue(e.target.value as Issue)}>
                      {(Object.keys(ISSUE_EN) as Issue[]).map(i => <option key={i} value={i}>{t(i)}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={t('grvRecipient')} optional>
                  {p => <input {...p} value={recipient} maxLength={120} placeholder={t('grvRecipientPh')} onChange={e => setRecipient(e.target.value)} />}
                </Field>
                <Field label={t('grvResolution')} optional>
                  {p => <input {...p} value={resolution} maxLength={200} placeholder={t('grvResolutionPh')} onChange={e => setResolution(e.target.value)} />}
                </Field>
              </>
            )}
          </>
        )}

        <Field label={t(messageLabel)} optional={mode === 'earnings' && turns.length === 0} error={error === 'errRequired' ? t('errRequired') : undefined}>
          {p => (
            <textarea {...p} rows={mode === 'documents' && focus === 'explain' ? 6 : 3} maxLength={1200} value={message}
              placeholder={placeholder ? t(placeholder) : undefined} onChange={e => setMessage(e.target.value)} />
          )}
        </Field>

        <p className="hint">{t('privacyNote')}</p>

        {error && error !== 'errRequired' && (
          <div className="alert" role="alert">
            <p>{t(error)}</p>
            <p className="hint">{t('inputKept')}</p>
          </div>
        )}
        {loading && <p className="loading-line" role="status">{t('sending')}</p>}

        <div className="actions actions-wrap">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {error && error !== 'errRequired' ? <RotateCcw aria-hidden="true" size={20} /> : <Send aria-hidden="true" size={20} />}
            {error && error !== 'errRequired' ? t('retry') : turns.length ? t('followUp') : t('send')}
          </button>
          {turns.length > 0 && <button type="button" className="btn" onClick={() => chooseMode(mode)}>{t('newTask')}</button>}
        </div>
      </form>
    </section>
  );
}
