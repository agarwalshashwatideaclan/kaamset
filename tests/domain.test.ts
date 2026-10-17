import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  earningsContext, earningsContextSchema, entryContext, filterPeriod, isValidWorkDate, MAX_ENTRY_PAISE,
  paiseToInput, parseRupees, summarize, toCsv, workEntrySchema, type WorkEntry,
} from '../shared/domain.ts';

const TODAY = '2026-10-17';
let n = 0;
function entry(over: Partial<WorkEntry>): WorkEntry {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    date: TODAY, work: 'Food delivery', earnedPaise: 0, receivedPaise: 0, expensePaise: 0,
    createdAt: `2026-10-17T10:00:0${n % 10}.000Z`, updatedAt: '2026-10-17T10:00:00.000Z', ...over,
  };
}

test('parseRupees converts to exact integer paise without float error', () => {
  assert.equal(parseRupees('900'), 90000);
  assert.equal(parseRupees('0.1'), 10);
  assert.equal(parseRupees('19.99'), 1999);
  assert.equal(parseRupees('1,250.5'), 125050);
  assert.equal(parseRupees(' 0 '), 0);
  for (const bad of ['', '-5', '1.234', 'abc', '1e3', '12.', '.5', 'NaN', '10000001']) assert.equal(parseRupees(bad), null, bad);
  assert.equal(parseRupees('1000000'), MAX_ENTRY_PAISE);
  assert.equal(paiseToInput(125050), '1250.50');
  assert.equal(paiseToInput(90000), '900');
});

test('₹900 earned, ₹600 received, ₹180 expenses → net ₹720, pending ₹300; later ₹300 clears pending only', () => {
  const e = entry({ earnedPaise: 90000, receivedPaise: 60000, expensePaise: 18000 });
  const before = summarize([e]);
  assert.equal(before.netEarnedPaise, 72000);
  assert.equal(before.pendingPaise, 30000);
  const after = summarize([{ ...e, receivedPaise: e.receivedPaise + 30000 }]);
  assert.equal(after.pendingPaise, 0);
  assert.equal(after.netEarnedPaise, 72000);
});

test('negative net, zero-income entries and aggregates beyond the per-entry cap', () => {
  const s = summarize([entry({ earnedPaise: 0, expensePaise: 5000 }), entry({ earnedPaise: 10000, receivedPaise: 10000, expensePaise: 20000 })]);
  assert.equal(s.netEarnedPaise, -15000);
  assert.equal(s.pendingPaise, 0);
  const big = Array.from({ length: 3 }, () => entry({ earnedPaise: MAX_ENTRY_PAISE, receivedPaise: MAX_ENTRY_PAISE }));
  const total = summarize(big);
  assert.equal(total.earnedPaise, 3 * MAX_ENTRY_PAISE);
  assert.ok(earningsContextSchema.safeParse(earningsContext(big, 'all', TODAY)).success, 'aggregate bound is separate from per-entry bound');
});

test('work entry validation rejects bad dates, hours, amounts and received > earned', () => {
  const base = entry({ earnedPaise: 1000, receivedPaise: 500, date: '2026-01-05' });
  assert.ok(workEntrySchema.safeParse(base).success);
  assert.ok(!workEntrySchema.safeParse({ ...base, receivedPaise: 1001 }).success);
  assert.ok(!workEntrySchema.safeParse({ ...base, earnedPaise: 10.5 }).success);
  assert.ok(!workEntrySchema.safeParse({ ...base, hours: 0 }).success);
  assert.ok(!workEntrySchema.safeParse({ ...base, hours: 25 }).success);
  assert.ok(workEntrySchema.safeParse({ ...base, hours: 7.5 }).success);
  assert.ok(!workEntrySchema.safeParse({ ...base, date: '2999-01-01' }).success);
  assert.ok(!isValidWorkDate('2026-02-30', TODAY));
  assert.ok(!isValidWorkDate('2026-10-18', TODAY));
  assert.ok(isValidWorkDate('2026-10-17', TODAY));
});

test('period filter uses inclusive local date boundaries', () => {
  const list = [entry({ date: '2026-10-11' }), entry({ date: '2026-10-10' }), entry({ date: '2026-09-18' }), entry({ date: '2026-09-17' })];
  assert.deepEqual(filterPeriod(list, '7d', TODAY).map(e => e.date), ['2026-10-11']);
  assert.deepEqual(filterPeriod(list, '30d', TODAY).map(e => e.date), ['2026-10-11', '2026-10-10', '2026-09-18']);
  assert.equal(filterPeriod(list, 'all', TODAY).length, 4);
});

test('earnings context is internally consistent and rejects tampered totals', () => {
  const ctx = entryContext(entry({ date: '2026-10-12', earnedPaise: 90000, receivedPaise: 60000, expensePaise: 18000 }));
  assert.equal(ctx.pendingPaise, 30000);
  assert.ok(earningsContextSchema.safeParse(ctx).success);
  assert.ok(!earningsContextSchema.safeParse({ ...ctx, pendingPaise: 1 }).success);
  assert.ok(!earningsContextSchema.safeParse({ ...ctx, receivedPaise: 99999 }).success);
  assert.equal(earningsContext([], '7d', TODAY), undefined);
});

test('CSV neutralises formula injection and escapes quotes, newlines and native script', () => {
  const csv = toCsv([
    entry({ work: '=HYPERLINK("http://x")', note: '  +cmd', earnedPaise: 100 }),
    entry({ work: '\t-2+3', note: 'line1\nline "2"', earnedPaise: 100 }),
    entry({ work: 'डिलीवरी ਕੰਮ', note: '@SUM(A1)', earnedPaise: 100 }),
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 4, 'embedded newline stays inside a quoted cell');
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(csv.includes(`"'  +cmd"`));
  assert.ok(csv.includes(`"'\t-2+3"`));
  assert.ok(csv.includes(`"'@SUM(A1)"`));
  assert.ok(csv.includes('"डिलीवरी ਕੰਮ"'));
  assert.ok(csv.includes('"line1\nline ""2"""'));
  assert.ok(!/(^|,)"[\s]*[=+\-@]/m.test(csv), 'no text cell starts with a formula character');
  assert.ok(toCsv([entry({ earnedPaise: 100, expensePaise: 300 })]).includes(',-2.00,'), 'negative net stays numeric');
});
