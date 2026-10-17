import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// Test-only stand-ins for Gemini responses. Real Gemini output is checked separately by tests/live/eval.ts.
function fixture(over: Record<string, unknown> = {}) {
  return {
    status: 'answered', language: 'en', title: 'Fixture answer', answer: 'Fixture explanation.',
    steps: ['Step one.'], checklist: [], sourceIds: [], draft: '', missingDetails: [], caveat: 'Fixture caveat.', sources: [], ...over,
  };
}

async function stubAssistant(page: Page, handler: (route: Route, body: Record<string, unknown>) => Promise<void> | void) {
  await page.route('**/api/assistant', async route => handler(route, JSON.parse(route.request().postData() ?? '{}')));
}

test.beforeEach(async ({ page }) => {
  // Any unexpected AI request fails the test instead of spending quota.
  await page.route('**/api/assistant', route => route.abort('failed'));
});

async function addWork(page: Page, earned: string, received: string, expenses: string, work = 'Food delivery') {
  await page.getByRole('link', { name: 'Earnings' }).click();
  await page.getByRole('button', { name: 'Add work' }).click();
  await page.getByLabel('Amount earned (₹)').fill(earned);
  await page.getByLabel('Amount received (₹)').fill(received);
  await page.getByLabel('Work expenses (₹)').fill(expenses);
  await page.getByLabel('Work or platform').fill(work);
  await page.getByRole('button', { name: 'Save work' }).click();
  await expect(page.getByText('Work saved on this device.')).toBeVisible();
}

const stat = (page: Page, label: string) => page.locator('.summary .stat').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');

test('fresh browser starts empty and shows all five assistance areas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('No work added yet')).toBeVisible();
  for (const name of ['Understand earnings', 'Stay safe at work', 'Rights & welfare', 'Document help', 'Write a complaint']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Saved' }).click();
  await expect(page.getByText('Drafts you save from')).toBeVisible();
  await expect(page.getByText('Checklists you save from')).toBeVisible();
});

test('earnings: exact partial payment arithmetic, edit, receive, persist, export, delete', async ({ page }) => {
  await page.goto('/earnings');
  await addWork(page, '900', '600', '180');
  await expect(stat(page, 'Net earned')).toHaveText('₹720');
  await expect(stat(page, 'Pending')).toHaveText('₹300');
  await expect(page.getByText('Part paid')).toBeVisible();

  await page.reload();
  await expect(stat(page, 'Pending')).toHaveText('₹300');

  await page.getByRole('button', { name: 'Mark pending as received' }).click();
  await expect(stat(page, 'Pending')).toHaveText('₹0');
  await expect(stat(page, 'Net earned')).toHaveText('₹720');
  await expect(page.getByText('Fully paid')).toBeVisible();

  await page.getByRole('button', { name: /^Edit/ }).click();
  await page.getByLabel('Work expenses (₹)').fill('180.50');
  await page.getByRole('button', { name: 'Save work' }).click();
  await expect(stat(page, 'Net earned')).toHaveText('₹719.50');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = readFileSync(await (await download).path(), 'utf8');
  expect(csv).toContain('"Food delivery",900.00,900.00,0.00,180.50,719.50');

  await page.reload();
  await expect(stat(page, 'Net earned')).toHaveText('₹719.50');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Delete/ }).click();
  await expect(page.getByText('Work entry deleted.')).toBeVisible();
  await expect(page.getByText('No work added yet')).toBeVisible();
});

test('earnings form validation rejects bad input without saving', async ({ page }) => {
  await page.goto('/earnings');
  await page.getByRole('button', { name: 'Add work' }).click();
  await page.getByLabel('Amount earned (₹)').fill('500');
  await page.getByLabel('Amount received (₹)').fill('600');
  await page.getByLabel('Work expenses (₹)').fill('1.234');
  await page.getByRole('button', { name: 'Save work' }).click();
  await expect(page.getByText('Received cannot be more than earned.')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(v => v.id)).toEqual([]);
  await expect(page.getByText('Enter an amount like 450 or 450.50.')).toBeVisible();
  await expect(page.getByText('This is required.')).toBeVisible();
  await expect(page.getByLabel('Amount received (₹)')).toHaveAttribute('aria-invalid', 'true');
});

test('explain earnings sends only the chosen period totals', async ({ page }) => {
  await page.goto('/earnings');
  await addWork(page, '900', '600', '180');
  let sent: Record<string, unknown> | undefined;
  await stubAssistant(page, (route, body) => { sent = body; return route.fulfill({ json: fixture({ title: 'Your 30 days' }) }); });
  await page.getByRole('button', { name: 'Explain this period' }).click();
  await expect(page.getByRole('checkbox', { name: /Share the totals/ })).toBeChecked();
  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { name: 'Your 30 days' })).toBeVisible();
  expect(sent?.mode).toBe('earnings');
  expect(sent?.earnings).toMatchObject({ earnedPaise: 90000, receivedPaise: 60000, expensePaise: 18000, netEarnedPaise: 72000, pendingPaise: 30000, count: 1 });
});

test('grievance from a record: confirm facts, edit draft, save, reload, delete', async ({ page }) => {
  await page.goto('/');
  await addWork(page, '900', '600', '180', 'Swiggy');
  let sent: Record<string, unknown> | undefined;
  await stubAssistant(page, (route, body) => {
    sent = body;
    return route.fulfill({ json: fixture({ title: 'Pending ₹300', draft: 'Dear [Support team],\nPlease pay my pending ₹300 for work on [date].', checklist: ['Payment screenshot'] }) });
  });
  await page.getByRole('button', { name: 'Write complaint' }).click();
  await expect(page.getByText('Facts from your work record')).toBeVisible();
  await expect(page.locator('.facts-box')).toContainText('₹300');
  await page.getByLabel('What happened? Include dates and amounts if you know them.').fill('Only ₹600 of ₹900 was paid.');
  await page.getByRole('button', { name: 'Get help' }).click();
  expect(sent?.earnings).toMatchObject({ pendingPaise: 30000, work: 'Swiggy' });
  expect(String(sent?.message)).toContain('Problem type: Payment not received');

  const draft = page.getByLabel('Your editable draft');
  await expect(draft).toHaveValue(/pending ₹300/);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(v => v.id)).toEqual([]);
  await expect(page.getByText('This draft has not been sent.')).toBeVisible();
  await draft.fill('Dear Support,\nPlease pay my pending ₹300. Rider ID 123.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();

  await page.getByRole('link', { name: 'Saved' }).click();
  await page.reload();
  const saved = page.locator('.saved-list textarea');
  await expect(saved).toHaveCount(1);
  await expect(saved).toHaveValue('Dear Support,\nPlease pay my pending ₹300. Rider ID 123.');
  await saved.fill('Edited after reload');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved.')).toBeVisible();
  await page.reload();
  await expect(page.locator('.saved-list textarea')).toHaveValue('Edited after reload');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: /^Delete/ }).first().click();
  await expect(page.getByText('Drafts you save from')).toBeVisible();
});

test('safety checklist saves, checks off and persists; language switch keeps saved text', async ({ page }) => {
  await page.goto('/ask');
  await stubAssistant(page, route => route.fulfill({ json: fixture({ title: 'Rain riding', checklist: ['Check brakes', 'Wear reflective jacket'] }) }));
  await page.getByRole('button', { name: /Stay safe at work/ }).click();
  await page.getByLabel('Your work').selectOption('delivery');
  await page.getByLabel('Describe your situation').fill('Heavy rain tonight on a scooter');
  await page.getByRole('button', { name: 'Get help' }).click();
  await page.getByRole('button', { name: 'Save checklist' }).click();
  await expect(page.getByRole('button', { name: 'Checklist saved on this device.' })).toBeDisabled();

  await page.getByRole('link', { name: 'Saved' }).click();
  await page.getByRole('checkbox', { name: 'Check brakes' }).click();
  await expect(page.getByRole('checkbox', { name: 'Check brakes' })).toBeChecked();
  await expect(page.getByText('1 of 2 done')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Check brakes' })).toBeChecked();

  await page.getByLabel('Language').selectOption('hi');
  await expect(page.getByRole('link', { name: 'सेव' })).toBeVisible();
  await expect(page.getByText('Check brakes')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await page.getByLabel('भाषा').selectOption('pa');
  await expect(page.getByRole('link', { name: 'ਸੰਭਾਲੇ' })).toBeVisible();
});

test('AI failure keeps the question and allows a manual retry', async ({ page }) => {
  await page.goto('/ask');
  let calls = 0;
  await stubAssistant(page, route => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 429, json: { error: 'rate_limited' } }) : route.fulfill({ json: fixture({ title: 'Retried answer' }) });
  });
  await page.getByRole('button', { name: /Rights & welfare/ }).click();
  await page.getByRole('button', { name: 'Explore welfare support' }).click();
  const box = page.getByLabel('Your question');
  await box.fill('How do I register on e-Shram?');
  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  await expect(box).toHaveValue('How do I register on e-Shram?');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Retried answer' })).toBeVisible();
  expect(calls).toBe(2);
});

test('model text is rendered as text, not HTML; sources are server links', async ({ page }) => {
  await page.goto('/ask');
  await stubAssistant(page, route => route.fulfill({ json: fixture({
    title: '<img src=x onerror=alert(1)>', answer: '<script>window.pwned=1</script>',
    sources: [{ id: 'eshram_faq', title: 'e-Shram FAQs', publisher: 'Ministry of Labour and Employment', url: 'https://eshram.gov.in/faqs' }],
  }) }));
  await page.getByRole('button', { name: /Document help/ }).click();
  await page.getByLabel('What are you preparing for?').fill('Registering on e-Shram');
  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined();
  const link = page.getByRole('link', { name: /e-Shram FAQs/ });
  await expect(link).toHaveAttribute('href', 'https://eshram.gov.in/faqs');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('offline: cached app reopens, records work, AI shows unavailable state', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cacheKeys = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.map(async k => (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname)))).flat();
    return urls;
  });
  expect(cacheKeys.some(u => u.startsWith('/api'))).toBe(false);

  await context.setOffline(true);
  await page.goto('/earnings');
  await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();
  await expect(page.getByText('Offline. Your records and saved items still work.')).toBeVisible();
  await addWork(page, '450', '0', '50');
  await expect(stat(page, 'Pending')).toHaveText('₹450');

  await page.unroute('**/api/assistant');
  await page.getByRole('link', { name: 'Ask' }).click();
  await page.getByRole('button', { name: /Stay safe at work/ }).click();
  await page.getByLabel('Describe your situation').fill('Night shift at a construction site');
  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('alert')).toContainText('You are offline');
  await expect(page.getByLabel('Describe your situation')).toHaveValue('Night shift at a construction site');
  await context.setOffline(false);
});

for (const width of [320, 360, 390]) {
  test(`no horizontal overflow at ${width}px on every tab`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    for (const path of ['/', '/earnings', '/ask', '/saved']) {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
}

test('accessibility audit (axe) passes on each tab and in Hindi/Punjabi', async ({ page }) => {
  for (const lang of ['en', 'hi', 'pa']) {
    await page.goto('/');
    await page.getByLabel(/Language|भाषा|ਭਾਸ਼ਾ/).first().selectOption(lang);
    for (const path of ['/', '/earnings', '/ask', '/saved']) {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).waitFor();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map(v => `${lang}${path}: ${v.id} ${v.nodes.map(n => n.target).join(' ')}`)).toEqual([]);
    }
  }
});

test('keyboard: tab order reaches navigation and the add-work form is operable', async ({ page }) => {
  await page.goto('/earnings');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: 'Add work' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Add work' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Work date')).toBeFocused();
});
