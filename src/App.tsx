import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, MessageCircleQuestion, Bookmark, Wallet, Volume2, VolumeX } from 'lucide-react';
import { readAloudEnabled, setReadAloud, stopSpeaking } from './speech.ts';
import type { Checklist, Draft, Language, Profile, WorkEntry } from '../shared/domain.ts';
import { LANGUAGES } from '../shared/domain.ts';
import * as db from './db.ts';
import { translator, type MessageKey } from './i18n.ts';
import { AppContext, type AppContextValue, type AskPreset, type Route } from './context.ts';
import { Today } from './features/Today.tsx';
import { Earnings } from './features/Earnings.tsx';
import { Ask } from './features/Ask.tsx';
import { Saved } from './features/Saved.tsx';

const ROUTES: Route[] = ['/', '/earnings', '/ask', '/saved'];
const LANG_KEY = 'kaamset.lang';

function currentRoute(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return (ROUTES as string[]).includes(path) ? path as Route : '/';
}

function storedLang(): Language | undefined {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return (LANGUAGES as readonly string[]).includes(v ?? '') ? v as Language : undefined;
  } catch { return undefined; }
}

interface InstallEvent extends Event { prompt(): Promise<void> }

export default function App() {
  const [lang, setLangState] = useState<Language>(() => storedLang() ?? 'en');
  const [route, setRoute] = useState<Route>(currentRoute);
  const [ws, setWs] = useState<db.Workspace | null>(null);
  const [storageBroken, setStorageBroken] = useState(false);
  const [toast, setToast] = useState<{ key: MessageKey; id: number } | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [askPreset, setAskPreset] = useState<AskPreset>();
  const [addWorkRequest, setAddWorkRequest] = useState<number>();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [readAloud, setReadAloudState] = useState(readAloudEnabled);
  const [speaking, setSpeaking] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const t = useMemo(() => translator(lang), [lang]);

  useEffect(() => {
    db.loadWorkspace().then(setWs).catch(() => {
      setStorageBroken(true);
      setWs({ entries: [], drafts: [], checklists: [], profile: {}, unreadable: 0 });
    });
    const onPop = () => setRoute(currentRoute());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    const onUpdate = () => setUpdateReady(true);
    const onSpeaking = (e: Event) => setSpeaking((e as CustomEvent<boolean>).detail);
    // Chrome loads synthesis voices lazily; asking early makes them ready by the first answer.
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    addEventListener('kaamset:speaking', onSpeaking);
    addEventListener('popstate', onPop);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    addEventListener('beforeinstallprompt', onInstall);
    addEventListener('kaamset:update', onUpdate);
    return () => {
      removeEventListener('popstate', onPop);
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
      removeEventListener('beforeinstallprompt', onInstall);
      removeEventListener('kaamset:update', onUpdate);
      removeEventListener('kaamset:speaking', onSpeaking);
    };
  }, []);

  useEffect(() => { document.documentElement.lang = lang; document.title = 'KaamSet'; }, [lang]);

  const notify = useCallback((key: MessageKey) => setToast({ key, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const navigate = useCallback((next: Route) => {
    if (next !== currentRoute()) history.pushState(null, '', next);
    setRoute(next);
    scrollTo(0, 0);
    requestAnimationFrame(() => mainRef.current?.querySelector('h1')?.focus());
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* preference only */ }
  }, []);

  /** Updates state only after IndexedDB confirms the write. */
  const persist = useCallback(async (write: () => Promise<unknown>, update: (w: db.Workspace) => db.Workspace, ok?: MessageKey) => {
    try {
      await write();
      setWs(prev => prev && update(prev));
      if (ok) notify(ok);
      return true;
    } catch {
      notify('storageError');
      return false;
    }
  }, [notify]);

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some(x => x.id === item.id) ? list.map(x => x.id === item.id ? item : x) : [item, ...list];

  const value: AppContextValue | null = ws && {
    lang, setLang, t, ws, online, navigate, notify, askPreset, addWorkRequest,
    openAddWork: () => { setAddWorkRequest(Date.now()); navigate('/earnings'); },
    openAsk: preset => { setAskPreset({ ...preset, nonce: Date.now() }); navigate('/ask'); },
    saveEntry: (e: WorkEntry) => persist(() => db.put('entries', e), w => ({ ...w, entries: upsert(w.entries, e) }), 'workSaved'),
    deleteEntry: id => persist(() => db.remove('entries', id), w => ({ ...w, entries: w.entries.filter(e => e.id !== id) }), 'workDeleted'),
    saveDraft: (d: Draft) => persist(() => db.put('drafts', d), w => ({ ...w, drafts: upsert(w.drafts, d) })),
    deleteDraft: id => persist(() => db.remove('drafts', id), w => ({ ...w, drafts: w.drafts.filter(d => d.id !== id) }), 'deleted'),
    saveChecklist: (c: Checklist) => persist(() => db.put('checklists', c), w => ({ ...w, checklists: upsert(w.checklists, c) })),
    deleteChecklist: id => persist(() => db.remove('checklists', id), w => ({ ...w, checklists: w.checklists.filter(c => c.id !== id) }), 'deleted'),
    saveProfile: (p: Profile) => persist(() => db.saveProfile(p), w => ({ ...w, profile: p }), 'profileSaved'),
    clearAll: () => persist(() => db.clearAll(), () => ({ entries: [], drafts: [], checklists: [], profile: {}, unreadable: 0 }), 'cleared'),
    installPrompt: installEvent ? () => { installEvent.prompt().finally(() => setInstallEvent(null)); } : undefined,
  };

  if (!value) return <p className="loading" role="status">{t('loading')}</p>;

  const tabs: { route: Route; label: MessageKey; Icon: typeof Wallet }[] = [
    { route: '/', label: 'navToday', Icon: CalendarDays },
    { route: '/earnings', label: 'navEarnings', Icon: Wallet },
    { route: '/ask', label: 'navAsk', Icon: MessageCircleQuestion },
    { route: '/saved', label: 'navSaved', Icon: Bookmark },
  ];

  return (
    <AppContext.Provider value={value}>
      <div className="shell">
        <header className="topbar">
          <a href="/" className="brand" onClick={e => { e.preventDefault(); navigate('/'); }}>
            <img src="/icons/icon.svg" alt="" width="28" height="28" /> KaamSet
          </a>
          <div className="topbar-actions">
          <button type="button" className="icon-toggle" aria-pressed={readAloud} aria-label={t('readAloud')} title={t('readAloud')}
            onClick={() => { const next = !readAloud; setReadAloud(next); setReadAloudState(next); if (!next) stopSpeaking(); }}>
            {readAloud ? <Volume2 aria-hidden="true" size={22} /> : <VolumeX aria-hidden="true" size={22} />}
          </button>
          <label className="lang-select">
            <span className="sr-only">{t('language')}</span>
            <select value={lang} onChange={e => setLang(e.target.value as Language)}>
              <option value="en" lang="en">English</option>
              <option value="hi" lang="hi">हिन्दी</option>
              <option value="pa" lang="pa">ਪੰਜਾਬੀ</option>
            </select>
          </label>
          </div>
        </header>

        {speaking && (
          <p className="banner banner-speaking">
            <button type="button" className="btn btn-small" onClick={stopSpeaking}><VolumeX aria-hidden="true" size={20} /> {t('stopSpeaking')}</button>
          </p>
        )}
        {!online && <p className="banner banner-offline" role="status">{t('offline')}</p>}
        {storageBroken && <p className="banner banner-error" role="alert">{t('storageUnavailable')}</p>}
        {value.ws.unreadable > 0 && <p className="banner banner-error" role="alert">{t('unreadableRecords')}</p>}
        {updateReady && (
          <p className="banner" role="status">
            {t('updateReady')}{' '}
            <button type="button" className="link-button" onClick={() => dispatchEvent(new Event('kaamset:apply-update'))}>{t('refresh')}</button>
          </p>
        )}

        <main ref={mainRef} id="main">
          {route === '/' && <Today />}
          {route === '/earnings' && <Earnings />}
          {route === '/ask' && <Ask />}
          {route === '/saved' && <Saved />}
        </main>

        <div className="toast-region" role="status" aria-live="polite">
          {toast && <p className="toast" key={toast.id}>{t(toast.key)}</p>}
        </div>

        <nav className="tabbar" aria-label={t('mainNav')}>
          {tabs.map(({ route: r, label, Icon }) => (
            <a key={r} href={r} className="tab" aria-current={route === r ? 'page' : undefined}
              onClick={e => { e.preventDefault(); navigate(r); }}>
              <Icon aria-hidden="true" size={24} strokeWidth={route === r ? 2.4 : 1.8} />
              <span>{t(label)}</span>
            </a>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
