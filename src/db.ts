import {
  checklistSchema, draftSchema, profileSchema, workEntrySchema,
  type Checklist, type Draft, type Profile, type WorkEntry,
} from '../shared/domain.ts';

const DB_NAME = 'kaamset';
const DB_VERSION = 1;
export const STORES = ['entries', 'drafts', 'checklists', 'meta'] as const;
type Store = typeof STORES[number];

let dbPromise: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('indexeddb_unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexeddb_blocked'));
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

async function tx<T>(store: Store, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    // Resolve only after the transaction commits, so "saved" means durably written.
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('transaction_aborted'));
  });
}

const getAll = (store: Store) => tx<unknown[]>(store, 'readonly', s => s.getAll());
export const put = (store: Store, value: { id: string }) => tx(store, 'readwrite', s => s.put(value));
export const remove = (store: Store, id: string) => tx(store, 'readwrite', s => s.delete(id));

export async function clearAll(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([...STORES], 'readwrite');
    for (const name of STORES) t.objectStore(name).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export interface Workspace {
  entries: WorkEntry[];
  drafts: Draft[];
  checklists: Checklist[];
  profile: Profile;
  /** Records that failed validation are left in the database untouched and counted here. */
  unreadable: number;
}

function keepValid<T>(rows: unknown[], parse: (row: unknown) => { success: boolean; data?: T }): { ok: T[]; bad: number } {
  const ok: T[] = [];
  let bad = 0;
  for (const row of rows) {
    const r = parse(row);
    if (r.success) ok.push(r.data as T); else bad++;
  }
  return { ok, bad };
}

export async function loadWorkspace(): Promise<Workspace> {
  const [e, d, c, meta] = await Promise.all([getAll('entries'), getAll('drafts'), getAll('checklists'), getAll('meta')]);
  const entries = keepValid(e, r => workEntrySchema.safeParse(r));
  const drafts = keepValid(d, r => draftSchema.safeParse(r));
  const checklists = keepValid(c, r => checklistSchema.safeParse(r));
  const rawProfile = (meta.find(m => (m as { id?: string }).id === 'profile') as { value?: unknown } | undefined)?.value;
  const profile = profileSchema.safeParse(rawProfile ?? {});
  return {
    entries: entries.ok, drafts: drafts.ok, checklists: checklists.ok,
    profile: profile.success ? profile.data : {},
    unreadable: entries.bad + drafts.bad + checklists.bad + (profile.success ? 0 : 1),
  };
}

export const saveProfile = (profile: Profile) => put('meta', { id: 'profile', value: profile } as { id: string });
