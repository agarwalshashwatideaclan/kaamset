import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isValidWorkDate, localDate, paiseToInput, parseRupees, type WorkEntry } from '../../shared/domain.ts';
import type { MessageKey } from '../i18n.ts';
import { useApp } from '../context.ts';
import { Field } from '../components/ui.tsx';

type Errors = Partial<Record<'date' | 'work' | 'earned' | 'received' | 'expenses' | 'hours', MessageKey>>;

export function EntryForm({ entry, onDone }: { entry?: WorkEntry; onDone(): void }) {
  const { t, saveEntry } = useApp();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState({
    date: entry?.date ?? localDate(),
    work: entry?.work ?? '',
    earned: entry ? paiseToInput(entry.earnedPaise) : '',
    received: entry ? paiseToInput(entry.receivedPaise) : '',
    expenses: entry ? paiseToInput(entry.expensePaise) : '',
    hours: entry?.hours?.toString() ?? '',
    note: entry?.note ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { headingRef.current?.focus(); }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    const earned = parseRupees(form.earned);
    const received = parseRupees(form.received);
    const expenses = form.expenses.trim() === '' ? 0 : parseRupees(form.expenses);
    const hours = form.hours.trim() === '' ? undefined : Number(form.hours);
    if (!isValidWorkDate(form.date)) errs.date = 'errDate';
    if (!form.work.trim()) errs.work = 'errRequired';
    if (earned === null) errs.earned = form.earned.trim() ? 'errAmount' : 'errRequired';
    if (received === null) errs.received = form.received.trim() ? 'errAmount' : 'errRequired';
    else if (earned !== null && received > earned) errs.received = 'errReceived';
    if (expenses === null) errs.expenses = 'errAmount';
    if (hours !== undefined && !(Number.isFinite(hours) && hours >= 0.1 && hours <= 24)) errs.hours = 'errHours';
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return;
    }
    const now = new Date().toISOString();
    setSaving(true);
    const ok = await saveEntry({
      id: entry?.id ?? crypto.randomUUID(),
      date: form.date,
      work: form.work.trim().slice(0, 80),
      earnedPaise: earned!, receivedPaise: received!, expensePaise: expenses!,
      hours, note: form.note.trim() || undefined,
      createdAt: entry?.createdAt ?? now, updatedAt: now,
    });
    setSaving(false);
    if (ok) onDone();
  }

  const err = (k: keyof Errors) => (errors[k] ? t(errors[k]!) : undefined);
  const money = { inputMode: 'decimal' as const, autoComplete: 'off', placeholder: '0' };

  return (
    <section className="screen">
      <h1 tabIndex={-1} ref={headingRef}>{entry ? t('editTitle') : t('addTitle')}</h1>
      <form onSubmit={submit} noValidate className="stack">
        <Field label={t('fieldDate')} error={err('date')}>
          {p => <input {...p} type="date" max={localDate()} min="2000-01-01" value={form.date} onChange={set('date')} required />}
        </Field>
        <Field label={t('fieldEarned')} error={err('earned')}>
          {p => <div className="money"><span aria-hidden="true">₹</span><input {...p} {...money} value={form.earned} onChange={set('earned')} required /></div>}
        </Field>
        <Field label={t('fieldReceived')} hint={t('fieldReceivedHint')} error={err('received')}>
          {p => <div className="money"><span aria-hidden="true">₹</span><input {...p} {...money} value={form.received} onChange={set('received')} required /></div>}
        </Field>
        <Field label={t('fieldExpenses')} hint={t('fieldExpensesHint')} error={err('expenses')}>
          {p => <div className="money"><span aria-hidden="true">₹</span><input {...p} {...money} value={form.expenses} onChange={set('expenses')} /></div>}
        </Field>
        <Field label={t('fieldWork')} hint={t('fieldWorkHint')} error={err('work')}>
          {p => <input {...p} value={form.work} onChange={set('work')} maxLength={80} required />}
        </Field>
        <details open={Boolean(entry?.hours || entry?.note)}>
          <summary>{t('moreDetails')}</summary>
          <Field label={t('fieldHours')} optional error={err('hours')}>
            {p => <input {...p} inputMode="decimal" value={form.hours} onChange={set('hours')} />}
          </Field>
          <Field label={t('fieldNote')} optional>
            {p => <textarea {...p} rows={2} maxLength={500} value={form.note} onChange={set('note')} />}
          </Field>
        </details>
        <div className="actions sticky-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{t('saveWork')}</button>
          <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        </div>
      </form>
    </section>
  );
}
