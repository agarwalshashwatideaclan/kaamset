import { useId, type ReactNode } from 'react';
import type { Summary } from '../../shared/domain.ts';
import { formatMoney } from '../i18n.ts';
import { useApp } from '../context.ts';

export function downloadFile(name: string, contents: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The byte-order mark lets spreadsheet apps read Hindi and Punjabi text as UTF-8. */
export const downloadCsv = (name: string, csv: string) => downloadFile(name, `\uFEFF${csv}`, 'text/csv;charset=utf-8');

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

/** Persistent label, hint and error wired to the control for screen readers. */
export function Field({ label, hint, error, optional, children }: FieldProps) {
  const { t } = useApp();
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="optional"> ({t('optional')})</span>}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export function SummaryGrid({ summary }: { summary: Summary }) {
  const { t, lang } = useApp();
  const m = (p: number) => formatMoney(p, lang);
  return (
    <dl className="summary">
      <div className="stat stat-main"><dt>{t('netEarned')}</dt><dd>{m(summary.netEarnedPaise)}</dd><p className="hint">{t('netHelp')}</p></div>
      <div className="stat"><dt>{t('earned')}</dt><dd>{m(summary.earnedPaise)}</dd></div>
      <div className="stat"><dt>{t('received')}</dt><dd>{m(summary.receivedPaise)}</dd></div>
      <div className={`stat${summary.pendingPaise > 0 ? ' stat-warn' : ''}`}><dt>{t('pending')}</dt><dd>{m(summary.pendingPaise)}</dd><p className="hint">{t('pendingHelp')}</p></div>
      <div className="stat"><dt>{t('expenses')}</dt><dd>{m(summary.expensePaise)}</dd></div>
    </dl>
  );
}
