// Records real KaamSet sessions (live public URL, real Gemini) as one mobile clip per scene.
// Usage: node video/capture/capture.mjs <outDir> [baseUrl]
// Every AI answer shown is a genuine response to the input typed on screen. Latencies go to manifest.json.
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const out = process.argv[2];
const base = process.argv[3] ?? 'https://kaamset.shashwat-5f0.workers.dev';
mkdirSync(out, { recursive: true });

// Playwright records at CSS-pixel size, so the phone layout (390×844 CSS px) is rendered at 2× in a
// 780×1688 mobile viewport by rewriting the viewport meta to width=390, initial-scale=2 at capture time.
const VIEWPORT = { width: 390, height: 844 };
const FRAME = { width: 780, height: 1688 };
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: FRAME, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
  recordVideo: { dir: out, size: FRAME },
});
await context.addInitScript(() => {
  const fix = node => { if (node.nodeName === 'META' && node.name === 'viewport') node.content = 'width=390, initial-scale=2, viewport-fit=cover'; };
  new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(fix))).observe(document, { childList: true, subtree: true });
});
if (process.env.REHEARSE) {
  // Selector rehearsal only: stub answers so no quota is spent. Rehearsal footage must be discarded.
  await context.route('**/api/assistant', async route => {
    const req = JSON.parse(route.request().postData());
    const lang = req.language;
    const text = { en: 'Rehearsal stub.', hi: 'रिहर्सल।', pa: 'ਰਿਹਰਸਲ।' }[lang];
    await route.fulfill({ json: { status: 'answered', language: lang, title: text, answer: text, steps: [text], checklist: [text, text], sourceIds: [], draft: req.mode === 'grievance' ? text : '', missingDetails: [], caveat: '', sources: [] } });
  });
}
// Headless Chromium has no microphone, so dictation uses a scripted recogniser: the app's real
// recording sheet shows for ~2.6 s, then the scene's `window.__dictation` text arrives as the transcript.
// Everything downstream (Ask, Gemini, sources) is the real app. Real dictation was tested on an Android phone.
await context.addInitScript(() => {
  class ScriptedRecognition {
    start() {
      this.timer = setTimeout(() => {
        this.onresult?.({ results: [[{ transcript: window.__dictation ?? '' }]] });
        this.onend?.();
      }, 2600);
    }
    abort() { clearTimeout(this.timer); this.onerror?.({ error: 'aborted' }); this.onend?.(); }
  }
  window.SpeechRecognition = ScriptedRecognition;
  window.webkitSpeechRecognition = ScriptedRecognition;
});
// Capture-only tap indicator: drawn on genuine pointer events via CSSOM (the app's CSP blocks inline <style>).
await context.addInitScript(() => {
  addEventListener('pointerdown', e => {
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      position: 'fixed', left: `${e.clientX - 22}px`, top: `${e.clientY - 22}px`, width: '44px', height: '44px',
      borderRadius: '50%', background: 'rgba(185,71,37,0.35)', border: '2px solid rgba(185,71,37,0.9)',
      pointerEvents: 'none', zIndex: '9999', transition: 'opacity 450ms, transform 450ms',
    });
    document.documentElement.append(dot);
    requestAnimationFrame(() => { dot.style.opacity = '0'; dot.style.transform = 'scale(1.6)'; });
    setTimeout(() => dot.remove(), 500);
  }, true);
});

const manifest = {
  app: base, cssViewport: VIEWPORT, frame: FRAME, renderScale: 2, locale: 'en-IN', timezone: 'Asia/Kolkata',
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  capturedAt: new Date().toISOString(), note: 'Demonstration inputs typed through the real form; no seeded data or intercepted requests.',
  scenes: [],
};

const pause = (page, ms) => page.waitForTimeout(ms);
async function tap(page, locator) { await locator.scrollIntoViewIfNeeded(); await pause(page, 250); await locator.tap(); await pause(page, 500); }
async function type(page, locator, text) { await tap(page, locator); await locator.pressSequentially(text, { delay: 45 }); await pause(page, 400); }
async function scrollThrough(page, steps = 6, dy = 260) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await pause(page, 900); }
}
async function ask(page, buttonName) {
  const started = Date.now();
  const response = page.waitForResponse(r => r.url().endsWith('/api/assistant'), { timeout: 60_000 });
  await tap(page, page.getByRole('button', { name: buttonName }));
  const res = await response;
  await page.locator('.answer').last().waitFor();
  const body = await res.json();
  return { status: res.status(), latencyMs: Date.now() - started, answerStatus: body.status ?? body.error, title: body.title, sources: (body.sources ?? []).map(s => s.id) };
}

const ONLY = process.env.ONLY?.split(',');

async function scene(name, inputs, run) {
  if (ONLY && !ONLY.includes(name)) return;
  const page = await context.newPage();
  const t0 = Date.now();
  const ai = await run(page);
  await pause(page, 1200);
  const video = page.video();
  await page.close();
  const file = `${name}.webm`;
  renameSync(await video.path(), `${out}/${file}`);
  manifest.scenes.push({ file, name, inputs, durationMs: Date.now() - t0, ai: ai ?? null });
  console.log(file, ai ? `${ai.status} ${ai.answerStatus} ${ai.latencyMs}ms` : '');
}

if (ONLY) {
  // Retake mode: recreate the state later scenes depend on (work record, one saved checklist). Footage discarded.
  const page = await context.newPage();
  await page.goto(`${base}/earnings`);
  await page.getByRole('button', { name: 'Add work' }).tap();
  await page.getByLabel('Amount earned (₹)').fill('900');
  await page.getByLabel('Amount received (₹)').fill('600');
  await page.getByLabel('Work expenses (₹)').fill('180');
  await page.getByLabel('Work or platform').fill('Food delivery');
  await page.getByRole('button', { name: 'Save work' }).tap();
  await page.getByText('Work saved on this device.').waitFor();
  await page.goto(`${base}/ask`);
  await page.getByRole('button', { name: /Document help/ }).tap();
  await page.getByLabel('What are you preparing for?').fill('Registering on e-Shram as a delivery partner');
  await page.getByRole('button', { name: 'Get help' }).tap();
  await page.getByRole('button', { name: 'Save checklist' }).tap();
  await page.getByText('Checklist saved on this device.').first().waitFor();
  const video = page.video();
  await page.close();
  await video.delete();
}

await scene('home-languages', 'Fresh profile; switch language hi → pa → en', async page => {
  await page.goto(base);
  await pause(page, 1800);
  await tap(page, page.getByRole('button', { name: 'हिन्दी' }));
  await pause(page, 1500);
  await tap(page, page.getByRole('button', { name: 'ਪੰਜਾਬੀ' }));
  await pause(page, 1500);
  await tap(page, page.getByRole('button', { name: 'English' }));
  await tap(page, page.getByRole('button', { name: 'OK' }));
  await scrollThrough(page, 3, 300);
  await pause(page, 800);
});

await scene('earnings', 'Food delivery: earned ₹900, received ₹600, expenses ₹180; explain last 30 days', async page => {
  await page.goto(`${base}/earnings`);
  await pause(page, 1000);
  await tap(page, page.getByRole('button', { name: 'Add work' }));
  await type(page, page.getByLabel('Amount earned (₹)'), '900');
  await type(page, page.getByLabel('Amount received (₹)'), '600');
  await type(page, page.getByLabel('Work expenses (₹)'), '180');
  await type(page, page.getByLabel('Work or platform'), 'Food delivery');
  await tap(page, page.getByRole('button', { name: 'Save work' }));
  await pause(page, 2500);
  await tap(page, page.getByRole('button', { name: 'Explain this period' }));
  await pause(page, 1500);
  const ai = await ask(page, 'Get help');
  await pause(page, 1000);
  await scrollThrough(page, 5);
  return ai;
});

await scene('safety-punjabi', 'Punjabi UI; daily-wage worker; heat and dizziness at a construction site; save checklist', async page => {
  await page.goto(`${base}/ask`);
  await page.getByLabel('Language').selectOption('pa');
  await pause(page, 1200);
  await tap(page, page.getByRole('button', { name: /ਕੰਮ ’ਤੇ ਸੁਰੱਖਿਆ/ }));
  await page.getByLabel('ਤੁਹਾਡਾ ਕੰਮ').selectOption('daily');
  await pause(page, 600);
  await type(page, page.getByLabel('ਆਪਣੀ ਹਾਲਤ ਦੱਸੋ'), 'ਗਰਮੀ ਵਿੱਚ ਉਸਾਰੀ ਵਾਲੀ ਥਾਂ ’ਤੇ ਇੱਟਾਂ ਚੁੱਕ ਰਿਹਾ ਹਾਂ, ਸਿਰ ਘੁੰਮ ਰਿਹਾ ਹੈ');
  const ai = await ask(page, 'ਮਦਦ ਲਓ');
  await scrollThrough(page, 4);
  await tap(page, page.getByRole('button', { name: 'ਸੂਚੀ ਸੰਭਾਲੋ' }));
  await pause(page, 1500);
  return ai;
});

await scene('voice-welfare-hindi', 'Hindi UI; tap centre nav mic on Today; dictate the e-Shram question (scripted recogniser); real Gemini answer', async page => {
  await page.goto(`${base}/`);
  await page.getByLabel('ਭਾਸ਼ਾ').selectOption('hi');
  await page.evaluate(() => { window.__dictation = 'ई-श्रम पर पंजीकरण कैसे करूँ, क्या पैसे लगते हैं?'; });
  await pause(page, 1500);
  await tap(page, page.getByRole('navigation').getByRole('button', { name: 'बोलकर पूछें' }));
  await page.getByText('आपकी आवाज़ रिकॉर्ड हो रही है').waitFor();
  await pause(page, 2600);
  await pause(page, 1600);
  await tap(page, page.getByRole('button', { name: /अधिकार और योजनाएँ/ }));
  await tap(page, page.getByRole('button', { name: 'सरकारी मदद खोजें' }));
  await pause(page, 1200);
  const ai = await ask(page, 'मदद लें');
  await scrollThrough(page, 6);
  await pause(page, 1500);
  return ai;
});

await scene('cannot-verify', 'English; unsupported state-specific benefit question', async page => {
  await page.goto(`${base}/ask`);
  await page.getByLabel('भाषा').selectOption('en');
  await pause(page, 800);
  await tap(page, page.getByRole('button', { name: /Rights & welfare/ }));
  await tap(page, page.getByRole('button', { name: 'Explore welfare support' }));
  await type(page, page.getByLabel('Your question'), 'How much does the Punjab government pay gig workers every month, and what is the last date?');
  const ai = await ask(page, 'Get help');
  await scrollThrough(page, 4);
  return ai;
});

await scene('documents', 'English; prepare checklist for e-Shram registration; save checklist', async page => {
  await page.goto(`${base}/ask`);
  await tap(page, page.getByRole('button', { name: /Document help/ }));
  await type(page, page.getByLabel('What are you preparing for?'), 'Registering on e-Shram as a delivery partner');
  const ai = await ask(page, 'Get help');
  await scrollThrough(page, 5);
  await tap(page, page.getByRole('button', { name: 'Save checklist' }));
  await pause(page, 1500);
  return ai;
});

await scene('grievance', 'From the ₹300 pending record; confirm facts; edit and save the draft', async page => {
  await page.goto(`${base}/earnings`);
  await pause(page, 1200);
  await page.mouse.wheel(0, 600);
  await pause(page, 800);
  await tap(page, page.getByRole('button', { name: 'Write complaint' }));
  await pause(page, 1800);
  await type(page, page.getByLabel('Who is this for?'), 'Platform support team');
  await type(page, page.getByLabel('What happened? Include dates and amounts if you know them.'), 'Only ₹600 of ₹900 was paid for today’s deliveries.');
  const ai = await ask(page, 'Get help');
  await scrollThrough(page, 3);
  const draft = page.getByLabel('Your editable draft');
  await draft.scrollIntoViewIfNeeded();
  await pause(page, 2500);
  await tap(page, draft);
  await draft.evaluate(el => { el.setSelectionRange(el.value.length, el.value.length); el.scrollTop = el.scrollHeight; });
  await page.keyboard.type('\nThank you.', { delay: 60 });
  await pause(page, 800);
  await tap(page, page.getByRole('button', { name: 'Save draft' }));
  await pause(page, 2000);
  return ai;
});

await scene('saved-offline', 'Saved: tick checklist, reload; then offline reload and an AI attempt', async page => {
  await page.goto(`${base}/saved`);
  await pause(page, 1500);
  await page.mouse.wheel(0, 500);
  await pause(page, 800);
  await tap(page, page.getByRole('checkbox').first());
  await pause(page, 1200);
  await page.reload();
  await pause(page, 1500);
  await page.mouse.wheel(0, 500);
  await pause(page, 1500);
  await context.setOffline(true);
  await page.goto(`${base}/earnings`);
  await pause(page, 2500);
  await tap(page, page.getByRole('link', { name: 'Ask' }));
  await tap(page, page.getByRole('button', { name: /Stay safe at work/ }));
  await type(page, page.getByLabel('Describe your situation'), 'Night delivery in fog');
  await tap(page, page.getByRole('button', { name: 'Get help' }));
  await pause(page, 2500);
  await context.setOffline(false);
});

writeFileSync(`${out}/manifest${ONLY ? '-retake' : ''}.json`, JSON.stringify(manifest, null, 2));
await context.close();
await browser.close();
