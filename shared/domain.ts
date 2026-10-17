import { z } from 'zod';

export const LANGUAGES = ['en', 'hi', 'pa'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

export const OCCUPATIONS = ['delivery', 'driver', 'daily', 'other'] as const;
export const occupationSchema = z.enum(OCCUPATIONS);
export type Occupation = z.infer<typeof occupationSchema>;

export const MODES = ['earnings', 'safety', 'rights_welfare', 'documents', 'grievance'] as const;
export const modeSchema = z.enum(MODES);
export type Mode = z.infer<typeof modeSchema>;

/** ₹10 lakh per entry field; period totals use the larger aggregate bound below. */
export const MAX_ENTRY_PAISE = 100_000_000;
export const MAX_ENTRIES = 5000;
export const MAX_AGGREGATE_PAISE = MAX_ENTRY_PAISE * MAX_ENTRIES;

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidWorkDate(value: string, today = localDate()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && localDate(d) === value && value >= '2000-01-01' && value <= today;
}

/** Parses a typed rupee amount into integer paise without float arithmetic. Returns null when invalid. */
export function parseRupees(input: string): number | null {
  const value = input.trim().replaceAll(',', '');
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return paise <= MAX_ENTRY_PAISE ? paise : null;
}

export function paiseToInput(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest ? `${rupees}.${String(rest).padStart(2, '0')}` : String(rupees);
}

const paise = z.number().int().min(0).max(MAX_ENTRY_PAISE);
const isoTime = z.string().max(40);

export const workEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().refine(v => isValidWorkDate(v), 'Choose a valid date that is not in the future.'),
  work: z.string().trim().min(1).max(80),
  earnedPaise: paise,
  receivedPaise: paise,
  expensePaise: paise,
  hours: z.number().finite().gt(0).max(24).optional(),
  note: z.string().trim().max(500).optional(),
  createdAt: isoTime,
  updatedAt: isoTime,
}).refine(e => e.receivedPaise <= e.earnedPaise, { message: 'Received cannot be more than earned.', path: ['receivedPaise'] });
export type WorkEntry = z.infer<typeof workEntrySchema>;

export interface Summary {
  count: number;
  earnedPaise: number;
  receivedPaise: number;
  expensePaise: number;
  /** earned − expenses */
  netEarnedPaise: number;
  /** earned − received */
  pendingPaise: number;
  hours: number;
}

export function summarize(entries: readonly WorkEntry[]): Summary {
  let earnedPaise = 0, receivedPaise = 0, expensePaise = 0, hours = 0;
  for (const e of entries) {
    earnedPaise += e.earnedPaise;
    receivedPaise += e.receivedPaise;
    expensePaise += e.expensePaise;
    hours += e.hours ?? 0;
  }
  return {
    count: entries.length, earnedPaise, receivedPaise, expensePaise,
    netEarnedPaise: earnedPaise - expensePaise,
    pendingPaise: earnedPaise - receivedPaise,
    hours: Math.round(hours * 100) / 100,
  };
}

export const PERIODS = ['7d', '30d', 'all'] as const;
export type Period = typeof PERIODS[number];

export function periodStart(period: Period, today = localDate()): string | undefined {
  if (period === 'all') return undefined;
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - (period === '7d' ? 6 : 29));
  return localDate(d);
}

export function filterPeriod(entries: readonly WorkEntry[], period: Period, today = localDate()): WorkEntry[] {
  const from = periodStart(period, today);
  return entries.filter(e => (!from || e.date >= from) && e.date <= today);
}

export function sortEntries(entries: readonly WorkEntry[]): WorkEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function csvText(value: string): string {
  // Spreadsheet apps evaluate cells starting with these, even after leading whitespace or control characters.
  const text = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Amounts are app-computed numbers, so negative values stay numeric instead of being escaped. */
const csvAmount = (p: number) => (p / 100).toFixed(2);

export function toCsv(entries: readonly WorkEntry[]): string {
  const header = ['Date', 'Work', 'Earned INR', 'Received INR', 'Pending INR', 'Expenses INR', 'Net earned INR', 'Hours', 'Note'].join(',');
  const rows = entries.map(e => [
    e.date, csvText(e.work), csvAmount(e.earnedPaise), csvAmount(e.receivedPaise), csvAmount(e.earnedPaise - e.receivedPaise),
    csvAmount(e.expensePaise), csvAmount(e.earnedPaise - e.expensePaise), e.hours ?? '', csvText(e.note ?? ''),
  ].join(','));
  return [header, ...rows].join('\r\n');
}

export const profileSchema = z.object({
  name: z.string().trim().max(60).optional(),
  occupation: occupationSchema.optional(),
  location: z.string().trim().max(80).optional(),
});
export type Profile = z.infer<typeof profileSchema>;

export const draftSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  text: z.string().max(8000),
  language: languageSchema,
  workId: z.string().uuid().optional(),
  createdAt: isoTime,
  updatedAt: isoTime,
});
export type Draft = z.infer<typeof draftSchema>;

export const checklistSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  mode: modeSchema,
  language: languageSchema,
  items: z.array(z.object({ id: z.string().min(1).max(40), text: z.string().min(1).max(300), done: z.boolean() })).min(1).max(12),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().url() })).max(6),
  createdAt: isoTime,
  updatedAt: isoTime,
});
export type Checklist = z.infer<typeof checklistSchema>;

/** Totals the app computed locally; the server re-checks consistency before prompting. */
export const earningsContextSchema = z.object({
  from: z.string().max(10).optional(),
  to: z.string().max(10),
  count: z.number().int().min(1).max(MAX_ENTRIES),
  earnedPaise: z.number().int().min(0).max(MAX_AGGREGATE_PAISE),
  receivedPaise: z.number().int().min(0).max(MAX_AGGREGATE_PAISE),
  expensePaise: z.number().int().min(0).max(MAX_AGGREGATE_PAISE),
  netEarnedPaise: z.number().int().min(-MAX_AGGREGATE_PAISE).max(MAX_AGGREGATE_PAISE),
  pendingPaise: z.number().int().min(0).max(MAX_AGGREGATE_PAISE),
  work: z.string().trim().max(80).optional(),
}).refine(s => s.receivedPaise <= s.earnedPaise
  && s.netEarnedPaise === s.earnedPaise - s.expensePaise
  && s.pendingPaise === s.earnedPaise - s.receivedPaise, 'Earnings totals are inconsistent.');
export type EarningsContext = z.infer<typeof earningsContextSchema>;

export function earningsContext(entries: readonly WorkEntry[], period: Period, today = localDate()): EarningsContext | undefined {
  const selected = filterPeriod(entries, period, today);
  if (!selected.length) return undefined;
  const { count, earnedPaise, receivedPaise, expensePaise, netEarnedPaise, pendingPaise } = summarize(selected);
  return {
    from: periodStart(period, today) ?? selected.reduce((min, e) => (e.date < min ? e.date : min), today),
    to: today, count, earnedPaise, receivedPaise, expensePaise, netEarnedPaise, pendingPaise,
  };
}

export function entryContext(e: WorkEntry): EarningsContext {
  const s = summarize([e]);
  return {
    from: e.date, to: e.date, count: 1, work: e.work,
    earnedPaise: s.earnedPaise, receivedPaise: s.receivedPaise, expensePaise: s.expensePaise,
    netEarnedPaise: s.netEarnedPaise, pendingPaise: s.pendingPaise,
  };
}

export const FOCUSES =['rights', 'welfare', 'explain', 'checklist'] as const;

export const assistantRequestSchema = z.object({
  mode: modeSchema,
  language: languageSchema,
  focus: z.enum(FOCUSES).optional(),
  message: z.string().trim().min(3).max(1500),
  profile: z.object({ occupation: occupationSchema.optional(), location: z.string().trim().max(80).optional() }).default({}),
  earnings: earningsContextSchema.optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) })).max(4).default([]),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const answerSchema = z.object({
  status: z.enum(['answered', 'needs_details', 'cannot_verify']),
  language: languageSchema,
  title: z.string().trim().min(1).max(160),
  answer: z.string().trim().min(1).max(2500),
  steps: z.array(z.string().trim().min(1).max(400)).max(5),
  checklist: z.array(z.string().trim().min(1).max(250)).max(8),
  sourceIds: z.array(z.string().max(40)).max(4),
  draft: z.string().max(5000),
  missingDetails: z.array(z.string().trim().min(1).max(250)).max(2),
  caveat: z.string().max(500),
});
export type Answer = z.infer<typeof answerSchema>;

export interface SourceLink { id: string; title: string; publisher: string; url: string }
export type AssistantResponse = Answer & { sources: SourceLink[] };
