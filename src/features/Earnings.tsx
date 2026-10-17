import { useEffect, useState } from 'react';
import { Plus, Download, Sparkles } from 'lucide-react';
import { earningsContext, entryContext, filterPeriod, PERIODS, sortEntries, summarize, toCsv, type Period, type WorkEntry } from '../../shared/domain.ts';
import { formatDate, formatMoney, type MessageKey } from '../i18n.ts';
import { useApp } from '../context.ts';
import { SummaryGrid, downloadCsv } from '../components/ui.tsx';
import { EntryForm } from './EntryForm.tsx';

let handledAddRequest: number | undefined;

const PERIOD_LABEL: Record<Period, MessageKey> = { '7d': 'period7d', '30d': 'period30d', all: 'periodAll' };

export function Earnings() {
  const { t, lang, ws, saveEntry, deleteEntry, openAsk, addWorkRequest } = useApp();
  const [period, setPeriod] = useState<Period>('30d');
  const [editing, setEditing] = useState<WorkEntry | 'new' | null>(null);

  useEffect(() => {
    if (addWorkRequest && addWorkRequest !== handledAddRequest) {
      handledAddRequest = addWorkRequest;
      setEditing('new');
    }
  }, [addWorkRequest]);

  if (editing) return <EntryForm entry={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />;

  const entries = sortEntries(filterPeriod(ws.entries, period));
  const summary = summarize(entries);
  const context = earningsContext(ws.entries, period);
  const m = (p: number) => formatMoney(p, lang);

  const receiveRest = (e: WorkEntry) => saveEntry({ ...e, receivedPaise: e.earnedPaise, updatedAt: new Date().toISOString() });

  return (
    <section className="screen">
      <h1 tabIndex={-1}>{t('earningsTitle')}</h1>
      <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
        <Plus aria-hidden="true" size={20} /> {t('addWork')}
      </button>

      <fieldset className="segmented"><legend className="sr-only">{t('periodLabel')}</legend>
        {PERIODS.map(p => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{t(PERIOD_LABEL[p])}</button>
        ))}
      </fieldset>

      {ws.entries.length === 0 ? (
        <div className="card"><p className="empty-title">{t('emptyTodayTitle')}</p><p>{t('emptyEarningsBody')}</p></div>
      ) : (
        <>
          <div className="card">
            <SummaryGrid summary={summary} />
            <p className="hint">{t('entriesCount', { n: summary.count })}</p>
            <div className="actions">
              {context && (
                <button type="button" className="btn" onClick={() => openAsk({ mode: 'earnings', earnings: context })}>
                  <Sparkles aria-hidden="true" size={20} /> {t('explainPeriod')}
                </button>
              )}
              <button type="button" className="btn" disabled={!entries.length}
                onClick={() => downloadCsv(`kaamset-earnings-${period}.csv`, toCsv(entries))}>
                <Download aria-hidden="true" size={20} /> {t('exportCsv')}
              </button>
            </div>
          </div>

          {entries.length === 0 ? <p>{t('noEntries')}</p> : (
            <ul className="entry-list">
              {entries.map(e => {
                const pending = e.earnedPaise - e.receivedPaise;
                const status: MessageKey = pending === 0 ? 'fullyPaid' : e.receivedPaise === 0 ? 'unpaid' : 'partPaid';
                return (
                  <li key={e.id} className="card entry">
                    <div className="entry-head">
                      <div>
                        <p className="entry-work">{e.work}</p>
                        <p className="hint">{formatDate(e.date, lang)}{e.hours ? ` · ${e.hours} h` : ''}</p>
                      </div>
                      <span className={`badge badge-${status}`}>{t(status)}</span>
                    </div>
                    <dl className="entry-figures">
                      <div><dt>{t('earned')}</dt><dd>{m(e.earnedPaise)}</dd></div>
                      <div><dt>{t('received')}</dt><dd>{m(e.receivedPaise)}</dd></div>
                      <div><dt>{t('pending')}</dt><dd>{m(pending)}</dd></div>
                      <div><dt>{t('expenses')}</dt><dd>{m(e.expensePaise)}</dd></div>
                    </dl>
                    {e.note && <p className="entry-note">{e.note}</p>}
                    <div className="actions actions-wrap">
                      {pending > 0 && <button type="button" className="btn btn-small" onClick={() => receiveRest(e)}>{t('receivePending')}</button>}
                      {pending > 0 && <button type="button" className="btn btn-small" onClick={() => openAsk({ mode: 'grievance', earnings: entryContext(e), entry: e })}>{t('draftComplaint')}</button>}
                      <button type="button" className="btn btn-small" onClick={() => setEditing(e)}>{t('edit')}<span className="sr-only">: {e.work}, {formatDate(e.date, lang)}</span></button>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => { if (confirm(t('confirmDeleteEntry'))) deleteEntry(e.id); }}>
                        {t('delete')}<span className="sr-only">: {e.work}, {formatDate(e.date, lang)}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
