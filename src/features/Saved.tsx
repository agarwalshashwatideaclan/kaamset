import { useState, type FormEvent } from 'react';
import { Copy, Download, Trash2, ExternalLink, Smartphone } from 'lucide-react';
import { OCCUPATIONS, sortEntries, toCsv, type Checklist, type Draft, type Occupation } from '../../shared/domain.ts';
import { formatDate, type MessageKey } from '../i18n.ts';
import { useApp } from '../context.ts';
import { Field, downloadCsv, downloadFile } from '../components/ui.tsx';

const OCC_LABEL: Record<Occupation, MessageKey> = { delivery: 'occDelivery', driver: 'occDriver', daily: 'occDaily', other: 'occOther' };

function DraftCard({ draft }: { draft: Draft }) {
  const { t, lang, saveDraft, deleteDraft, notify } = useApp();
  const [text, setText] = useState(draft.text);
  const dirty = text !== draft.text;

  async function save() {
    if (await saveDraft({ ...draft, text, updatedAt: new Date().toISOString() })) notify('changesSaved');
  }

  return (
    <li className="card">
      <h3 lang={draft.language}>{draft.title}</h3>
      <p className="hint">{t('createdOn', { date: formatDate(draft.updatedAt, lang) })}</p>
      <label className="sr-only" htmlFor={`d-${draft.id}`}>{draft.title}</label>
      <textarea id={`d-${draft.id}`} lang={draft.language} rows={8} maxLength={8000} value={text} onChange={e => setText(e.target.value)} />
      <p className="hint">{t('notSent')}</p>
      <div className="actions actions-wrap">
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}>{t('saveChanges')}</button>
        <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(text).then(() => notify('copied'), () => undefined)}><Copy aria-hidden="true" size={20} /> {t('copy')}</button>
        <button type="button" className="btn" onClick={() => downloadFile('kaamset-draft.txt', text)}><Download aria-hidden="true" size={20} /> {t('download')}</button>
        <button type="button" className="btn btn-danger" onClick={() => { if (confirm(t('confirmDelete'))) deleteDraft(draft.id); }}>
          <Trash2 aria-hidden="true" size={20} /> {t('delete')}<span className="sr-only">: {draft.title}</span>
        </button>
      </div>
    </li>
  );
}

function ChecklistCard({ list }: { list: Checklist }) {
  const { t, lang, saveChecklist, deleteChecklist } = useApp();
  const done = list.items.filter(i => i.done).length;

  const toggle = (id: string) => saveChecklist({
    ...list, updatedAt: new Date().toISOString(),
    items: list.items.map(i => (i.id === id ? { ...i, done: !i.done } : i)),
  });

  return (
    <li className="card">
      <h3 lang={list.language}>{list.title}</h3>
      <p className="hint">{t('progress', { done, total: list.items.length })} · {t('createdOn', { date: formatDate(list.createdAt, lang) })}</p>
      <ul className="checklist" lang={list.language}>
        {list.items.map(item => (
          <li key={item.id}>
            <label className="check">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
              <span className={item.done ? 'done' : undefined}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {list.sources.length > 0 && (
        <ul className="sources">
          {list.sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} <ExternalLink aria-hidden="true" size={16} /></a></li>)}
        </ul>
      )}
      <button type="button" className="btn btn-danger" onClick={() => { if (confirm(t('confirmDelete'))) deleteChecklist(list.id); }}>
        <Trash2 aria-hidden="true" size={20} /> {t('delete')}<span className="sr-only">: {list.title}</span>
      </button>
    </li>
  );
}

export function Saved() {
  const { t, ws, saveProfile, clearAll, installPrompt } = useApp();
  const [name, setName] = useState(ws.profile.name ?? '');
  const [occupation, setOccupation] = useState<Occupation | ''>(ws.profile.occupation ?? '');
  const [location, setLocation] = useState(ws.profile.location ?? '');
  const drafts = [...ws.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const lists = [...ws.checklists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function onProfile(e: FormEvent) {
    e.preventDefault();
    saveProfile({ name: name.trim() || undefined, occupation: occupation || undefined, location: location.trim() || undefined });
  }

  function exportAll() {
    const data = { app: 'KaamSet', exportedAt: new Date().toISOString(), profile: ws.profile, entries: sortEntries(ws.entries), drafts: ws.drafts, checklists: ws.checklists };
    downloadFile('kaamset-data.json', JSON.stringify(data, null, 2), 'application/json');
    if (ws.entries.length) downloadCsv('kaamset-earnings-all.csv', toCsv(sortEntries(ws.entries)));
  }

  return (
    <section className="screen">
      <h1 tabIndex={-1}>{t('savedTitle')}</h1>
      <p className="hint">{t('draftLanguageNote')}</p>

      <h2>{t('drafts')}</h2>
      {drafts.length ? <ul className="saved-list">{drafts.map(d => <DraftCard key={`${d.id}-${d.updatedAt}`} draft={d} />)}</ul> : <p className="empty">{t('noDrafts')}</p>}

      <h2>{t('checklists')}</h2>
      {lists.length ? <ul className="saved-list">{lists.map(c => <ChecklistCard key={c.id} list={c} />)}</ul> : <p className="empty">{t('noChecklists')}</p>}

      {installPrompt && (
        <div className="card">
          <p>{t('installNote')}</p>
          <button type="button" className="btn" onClick={installPrompt}><Smartphone aria-hidden="true" size={20} /> {t('install')}</button>
        </div>
      )}

      <form className="card stack" onSubmit={onProfile}>
        <h2>{t('profileTitle')}</h2>
        <Field label={t('name')} hint={t('nameHint')} optional>
          {p => <input {...p} value={name} maxLength={60} autoComplete="name" onChange={e => setName(e.target.value)} />}
        </Field>
        <Field label={t('occupation')} optional>
          {p => (
            <select {...p} value={occupation} onChange={e => setOccupation(e.target.value as Occupation | '')}>
              <option value="">{t('occNone')}</option>
              {OCCUPATIONS.map(o => <option key={o} value={o}>{t(OCC_LABEL[o])}</option>)}
            </select>
          )}
        </Field>
        <Field label={t('location')} hint={t('locationHint')} optional>
          {p => <input {...p} value={location} maxLength={80} onChange={e => setLocation(e.target.value)} />}
        </Field>
        <button type="submit" className="btn btn-primary">{t('saveProfile')}</button>
      </form>

      <div className="card stack">
        <h2>{t('dataTitle')}</h2>
        <p>{t('dataNote')}</p>
        <button type="button" className="btn" onClick={exportAll}><Download aria-hidden="true" size={20} /> {t('exportAll')}</button>
        <button type="button" className="btn btn-danger" onClick={() => { if (confirm(t('confirmClear'))) clearAll(); }}>
          <Trash2 aria-hidden="true" size={20} /> {t('clearData')}
        </button>
      </div>
    </section>
  );
}
