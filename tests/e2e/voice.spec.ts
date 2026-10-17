import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Test-only fakes for the browser speech APIs and Gemini; real devices are checked manually.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [];
    w.__micMode = 'ok';
    w.__transcript = 'Riding in heavy rain tonight';
    class FakeRecognition {
      lang = ''; interimResults = false; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          w.__lastLang = this.lang;
          if (w.__micMode === 'deny') this.onerror?.({ error: 'not-allowed' });
          else this.onresult?.({ results: [[{ transcript: w.__transcript }]] });
          this.onend?.();
        }, 50);
      }
      abort() { this.onend?.(); }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    class FakeUtterance { text: string; voice: unknown = null; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(text: string) { this.text = text; } }
    w.SpeechSynthesisUtterance = FakeUtterance;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false, pending: false,
        getVoices: () => [{ lang: 'en-IN', name: 'Fake English' }],
        speak: (u: FakeUtterance) => { (w.__spoken as string[]).push(u.text); setTimeout(() => u.onend?.(), 20); },
        cancel: () => undefined,
      },
    });
  });
  await page.route('**/api/assistant', route => route.fulfill({ json: {
    status: 'answered', language: 'en', title: 'Riding in rain', answer: 'Slow down and keep your lights on.',
    steps: ['Check brakes.'], checklist: [], sourceIds: [], draft: '', missingDetails: [], caveat: '', sources: [],
  } }));
});

test('dictation fills the question, the answer is spoken once, and Stop/quiet controls work', async ({ page }) => {
  await page.goto('/ask');
  await page.getByRole('button', { name: /Stay safe at work/ }).click();
  await page.getByRole('button', { name: 'Speak instead' }).click();
  await expect(page.getByLabel('Describe your situation')).toHaveValue('Riding in heavy rain tonight');
  expect(await page.evaluate(() => (window as unknown as { __lastLang: string }).__lastLang)).toBe('en-IN');

  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { name: 'Riding in rain' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(['Riding in rain. Slow down and keep your lights on.']);

  const toggle = page.getByRole('button', { name: 'Read answers aloud' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Read answers aloud' })).toHaveAttribute('aria-pressed', 'false');

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);
});

test('mic denied shows an error and typing still works; Hindi UI listens in hi-IN', async ({ page }) => {
  await page.goto('/ask');
  await page.evaluate(() => { (window as unknown as { __micMode: string }).__micMode = 'deny'; });
  await page.getByRole('button', { name: /Rights & welfare/ }).click();
  await page.getByRole('button', { name: 'Speak instead' }).click();
  await expect(page.getByText('Microphone permission was denied. You can type instead.')).toBeVisible();
  await page.getByLabel('Your question').fill('How do I register on e-Shram?');
  await page.getByRole('button', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { name: 'Riding in rain' })).toBeVisible();

  await page.getByLabel('Language').selectOption('hi');
  await page.evaluate(() => { const w = window as unknown as Record<string, string>; w.__micMode = 'ok'; w.__transcript = 'आज नौ सौ कमाए'; });
  await page.getByRole('link', { name: 'आज' }).click();
  await page.getByRole('button', { name: 'बोलकर पूछें' }).click();
  await expect(page.getByText('“आज नौ सौ कमाए”')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __lastLang: string }).__lastLang)).toBe('hi-IN');
  await page.getByRole('button', { name: /कमाई समझें/ }).click();
  await expect(page.getByLabel(/इस पैसे के बारे में/)).toHaveValue('आज नौ सौ कमाए');
});
