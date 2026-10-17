import { createContext, useContext } from 'react';
import type { Checklist, Draft, EarningsContext, Language, Mode, Profile, WorkEntry } from '../shared/domain.ts';
import type { MessageKey, T } from './i18n.ts';
import type { Workspace } from './db.ts';

export type Route = '/' | '/earnings' | '/ask' | '/saved';

/** What another screen hands to Ask: a mode and optionally facts the worker chose to share. */
export interface AskPreset { mode: Mode; earnings?: EarningsContext; entry?: WorkEntry; nonce: number }

export interface AppContextValue {
  lang: Language;
  setLang(lang: Language): void;
  t: T;
  ws: Workspace;
  online: boolean;
  navigate(route: Route): void;
  openAsk(preset: Omit<AskPreset, 'nonce'>): void;
  askPreset?: AskPreset;
  addWorkRequest?: number;
  openAddWork(): void;
  notify(key: MessageKey): void;
  saveEntry(entry: WorkEntry): Promise<boolean>;
  deleteEntry(id: string): Promise<boolean>;
  saveDraft(draft: Draft): Promise<boolean>;
  deleteDraft(id: string): Promise<boolean>;
  saveChecklist(list: Checklist): Promise<boolean>;
  deleteChecklist(id: string): Promise<boolean>;
  saveProfile(profile: Profile): Promise<boolean>;
  clearAll(): Promise<boolean>;
  installPrompt?: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppContext');
  return ctx;
}
