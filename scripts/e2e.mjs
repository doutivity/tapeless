// Browser checks in headless Chromium (run via `make e2e`). Serves the site under /tapeless/ like GitHub Pages.
//  1. analytics OFF (committed config): the wizard makes no external request, no cookies, empty localStorage, no banner.
//  2. analytics ON (generated copy with a test id): without consent / after "reject" / after "accept" / after withdrawal.
//  3. wizard behaviour: keyboard, prompt content, share link, opt-in storage, service buttons and clipboard, long URLs.
// Requests to Google are intercepted and stubbed, so no real data leaves the container; the stub does not set cookies,
// so the cookie-withdrawal check plants a fake _ga cookie and verifies it is removed.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { serve } from './static.mjs';
import { launch } from './browser.mjs';

const results = [];
const ok = (cond, name, detail = '') => { results.push([!!cond, name, detail]); console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : detail ? `  → ${detail}` : ''}`); };
const GA_ID = 'G-TEST123456';
const isGoogle = (u) => /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(u);

// site copy with analytics enabled
const tmp = mkdtempSync(join(tmpdir(), 'tapeless-ga-'));
const skip = new Set(['.git', '.idea', '.shots', '.scratch', 'node_modules', 'design', 'design-source', 'tests', 'scripts']);
cpSync(ROOT, tmp, { recursive: true, filter: (src) => !skip.has(src.slice(ROOT.length + 1).split('/')[0]) });
execFileSync('node', [join(ROOT, 'scripts/pages.mjs'), '--out', tmp], { env: { ...process.env, TAPELESS_GA: GA_ID }, stdio: 'pipe' });

// "analytics off" copy: the committed config may carry a real id, so force it empty for the no-analytics scenarios
const tmpOff = mkdtempSync(join(tmpdir(), 'tapeless-off-'));
cpSync(ROOT, tmpOff, { recursive: true, filter: (src) => !skip.has(src.slice(ROOT.length + 1).split('/')[0]) });
execFileSync('node', [join(ROOT, 'scripts/pages.mjs'), '--out', tmpOff], { env: { ...process.env, TAPELESS_GA: '' }, stdio: 'pipe' });
const off = await serve(tmpOff, { prefix: '/tapeless/' });
const on = await serve(tmp, { prefix: '/tapeless/' });
const browser = await launch();

async function open(base, { width = 390, height = 844, ctx } = {}) {
  const context = ctx || (await browser.createBrowserContext());
  const page = await context.newPage();
  const log = { requests: [], pageErrors: [] };
  await page.setViewport({ width, height });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    log.requests.push(r.url());
    if (isGoogle(r.url())) return r.respond({ status: 200, contentType: r.url().includes('/gtag/js') ? 'text/javascript' : 'text/plain', body: '' });
    r.continue();
  });
  page.on('pageerror', (e) => log.pageErrors.push(e.message));
  await page.evaluateOnNewDocument(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); return null; }; });
  await context.overridePermissions(new URL(base).origin, ['clipboard-read', 'clipboard-write']);
  await page.goto(base, { waitUntil: 'networkidle0' });
  return { page, context, log, base };
}
const external = (log, base) => log.requests.filter((u) => !u.startsWith(new URL(base).origin) && !u.startsWith('data:'));
const googleReqs = (log) => log.requests.filter(isGoogle);
const cookies = async (page) => { const c = await page.createCDPSession(); return (await c.send('Network.getAllCookies')).cookies; };
const lsKeys = (page) => page.evaluate(() => Object.keys(localStorage));
const step = (page) => page.$eval('#app', (a) => a.dataset.step);
const pick = async (page, n = 3) => { for (let i = 0; i < n; i++) await (await page.$$('.grp-body .tile input'))[i].evaluate((e) => e.click()); };
const next = (page) => page.$eval('.wz-nav .btn-primary', (b) => b.click());
const toResult = async (page) => { for (let i = 0; i < 4; i++) await next(page); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ───── 1. analytics off ─────
  console.log('\n── Analytics off (id forced empty) ──');
  {
    const { page, log, base } = await open(off.url);
    ok(log.pageErrors.length === 0, 'no JS errors on load', log.pageErrors.join('; '));
    ok(await page.$('#app .wz-card'), 'wizard renders');
    ok(!(await page.$('#consent')), 'no consent banner');
    ok(!(await page.$('[data-consent-open]')), 'no analytics link in the footer');
    await pick(page); await page.type('#app textarea', 'розбиратись у людях');
    const sum = await page.$eval('.wz-summary', (e) => e.textContent);
    ok(sum.includes('навчати') && !sum.includes('[object') && !sum.includes('undefined'), 'live summary lists the chosen cards', sum);
    await toResult(page);
    ok(await step(page) === '5', 'reached step 5');
    ok(external(log, base).length === 0, 'filling the form made no external request', external(log, base).join(', '));
    ok((await cookies(page)).length === 0, 'no cookies');
    ok((await lsKeys(page)).length === 0, 'localStorage is empty', JSON.stringify(await lsKeys(page)));
    const prompt = await page.$eval('#prompt-text', (t) => t.value);
    ok(prompt.includes('навчати') && prompt.includes('розбиратись у людях'), 'prompt contains chosen cards and free text');
    ok(!/undefined|null|NaN/.test(prompt), 'prompt has no undefined/null');
    ok(!(await page.evaluate(() => 'dataLayer' in window)), 'no dataLayer');
  }

  // ───── 2. analytics on ─────
  console.log('\n── Analytics on: no consent yet ──');
  {
    const { page, log, base, context } = await open(on.url);
    const banner = await page.$('#consent');
    ok(banner, 'banner shown on first visit');
    ok(await page.$eval('#consent', (e) => e.getAttribute('role') === 'dialog' && !!document.getElementById(e.getAttribute('aria-labelledby'))), 'banner has role=dialog and aria-labelledby');
    const boxes = await page.$$eval('#consent .consent-actions .btn', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return [Math.round(r.width), Math.round(r.height), s.backgroundColor, s.color, s.fontWeight]; }));
    ok(boxes.length === 3 && boxes.every((b) => b.join() === boxes[0].join()), 'three buttons are identical in size and style', JSON.stringify(boxes));
    ok(await page.$$eval('#consent input:checked', (a) => a.length === 0), 'nothing preselected');
    ok(await page.$eval('#consent', (e) => e === document.activeElement), 'focus moves to the banner without trapping');
    const bh = await page.$eval('#consent', (e) => e.getBoundingClientRect().height);
    ok(bh <= 844 * 0.7 + 1, `banner is compact on 390px (${Math.round(bh)}px)`);
    await pick(page); await toResult(page);
    ok(googleReqs(log).length === 0, 'zero requests to Google before consent', googleReqs(log).join(', '));
    ok((await cookies(page)).length === 0, 'zero cookies before consent');
    ok(!(await page.evaluate(() => 'dataLayer' in window || 'gtag' in window)), 'dataLayer/gtag do not exist before consent');
    ok(!(await page.$('script[src*="googletagmanager"]')), 'gtag.js script is not in the DOM');
    ok((await lsKeys(page)).length === 0, 'localStorage still empty before a choice', JSON.stringify(await lsKeys(page)));

    console.log('\n── Reject ──');
    await page.$$eval('#consent .consent-actions .btn', (bs) => bs.find((b) => b.textContent.trim() === 'Відхилити').click());
    await wait(200);
    ok(!(await page.$('#consent')), 'banner closed');
    ok(JSON.parse(await page.evaluate(() => localStorage.getItem('tapeless:consent'))).value === 'denied', 'choice stored (denied, with date and version)');
    ok(googleReqs(log).length === 0, 'still zero Google requests after reject');
    await page.reload({ waitUntil: 'networkidle0' });
    ok(!(await page.$('#consent')), 'no banner on the next visit');
    ok(googleReqs(log).length === 0 && (await cookies(page)).length === 0, 'reload after reject: no Google requests, no cookies');
    await context.close();
  }

  console.log('\n── Accept ──');
  {
    const { page, log, base, context } = await open(on.url);
    await page.$$eval('#consent .consent-actions .btn', (bs) => bs.find((b) => b.textContent.trim() === 'Прийняти').click());
    await wait(400);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('tapeless:consent')));
    ok(stored.value === 'granted' && stored.v === 1 && !Number.isNaN(Date.parse(stored.at)), 'choice stored (granted, date, version)');
    ok(googleReqs(log).some((u) => u.includes(`googletagmanager.com/gtag/js?id=${GA_ID}`)), 'gtag.js requested after accept');
    const dl0 = await page.evaluate(() => [...window.dataLayer].map((a) => [...a]));
    const def = dl0.find((a) => a[0] === 'consent' && a[1] === 'default')?.[2];
    const upd = dl0.find((a) => a[0] === 'consent' && a[1] === 'update')?.[2];
    ok(def && ['analytics_storage', 'ad_storage', 'ad_user_data', 'ad_personalization'].every((k) => def[k] === 'denied'), 'Consent Mode v2: all four signals default to denied', JSON.stringify(def));
    ok(upd && upd.analytics_storage === 'granted' && Object.keys(upd).length === 1, 'after accept only analytics_storage is granted', JSON.stringify(upd));
    ok(dl0.findIndex((a) => a[1] === 'default') < dl0.findIndex((a) => a[1] === 'update'), 'default is set before update');
    ok(!JSON.stringify(dl0).includes('"ad_storage":"granted"'), 'ads stay denied');

    await page.evaluate(() => { location.hash = ''; });
    await page.$eval('textarea', (t) => { t.focus(); });
    await page.type('#app textarea', 'ТАЄМНИЙ_ТЕКСТ_ВІДПОВІДІ');
    await pick(page); await toResult(page);
    await page.click('#theme-toggle');
    await page.click('.svc'); await wait(150);
    await page.$$eval('.actions .btn', (bs) => bs.find((b) => b.textContent.includes('Копіювати коротку')).click()); await wait(150);
    const events = await page.evaluate(() => [...window.dataLayer].map((a) => [...a]).filter((a) => a[0] === 'event'));
    const names = events.map((e) => e[1]);
    for (const n of ['wizard_start', 'wizard_step', 'wizard_complete', 'theme_change', 'service_open', 'prompt_copy', 'consent_change']) ok(names.includes(n), `event sent: ${n}`);
    const dump = JSON.stringify(await page.evaluate(() => [...window.dataLayer].map((a) => [...a])));
    ok(!dump.includes('ТАЄМНИЙ') && !dump.includes('навчати') && !dump.includes('Працювати'), 'no form answers in analytics data');
    ok(!/#p=|"page_location":"[^"]*#/.test(dump), 'page_location has no #fragment');
    ok(!dump.includes('user_id'), 'no user_id');
    ok(events.every((e) => Object.keys(e[2]).every((k) => ['page_location', 'step', 'mode', 'kind', 'service', 'theme', 'value'].includes(k))), 'event params are within the whitelist');
    const svcEvt = events.find((e) => e[1] === 'service_open');
    ok(['claude', 'chatgpt', 'gemini', 'perplexity'].includes(svcEvt[2].service), 'service_open carries only the service id');

    console.log('\n── Withdrawal ──');
    await page.evaluate(() => { document.cookie = '_ga=GA1.1.111.222; path=/'; document.cookie = `_ga_TEST123456=GS1.1.1; path=/`; });
    ok((await cookies(page)).filter((c) => c.name.startsWith('_ga')).length === 2, '(planted fake _ga cookies)');
    await page.$eval('footer [data-consent-open]', (a) => a.click());
    await page.waitForSelector('#consent-sw');
    ok(await page.$eval('#consent-sw', (s) => s.checked), 'settings show the current state (on)');
    await page.$eval('#consent-sw', (s) => s.click());
    await page.$$eval('#consent .btn', (bs) => bs.find((b) => b.textContent.includes('Зберегти вибір')).click());
    await wait(200);
    ok((await cookies(page)).filter((c) => c.name.startsWith('_ga')).length === 0, '_ga* cookies removed after withdrawal');
    ok(JSON.parse(await page.evaluate(() => localStorage.getItem('tapeless:consent'))).value === 'denied', 'withdrawal stored');
    const before = await page.evaluate(() => window.dataLayer.length);
    const reqBefore = googleReqs(log).length;
    await page.click('#theme-toggle');
    await page.$eval('.wz-nav-end ~ *, .wz-nav', () => {});
    await page.$$eval('.actions .btn', (bs) => bs.find((b) => b.textContent.includes('Копіювати промпт')).click()); await wait(150);
    ok(await page.evaluate(() => window.dataLayer.length) === before, 'no new analytics events after withdrawal');
    ok(googleReqs(log).length === reqBefore, 'no new Google requests after withdrawal');
    await page.reload({ waitUntil: 'networkidle0' });
    ok(!(await page.$('#consent')), 'withdrawal persists across reloads (no banner, denied)');
    ok(!(await page.evaluate(() => 'dataLayer' in window)), 'after withdrawal + reload there is no dataLayer');
    await context.close();
  }

  console.log('\n── Privacy page ──');
  {
    const { page, context } = await open(on.url + 'privacy/');
    ok(await page.$eval('#analytics', (e) => e.textContent.includes('Google Analytics 4')), 'privacy explains GA when enabled');
    ok(!!(await page.$('#consent')), 'banner also shown on inner pages');
    await context.close();
  }
  {
    const { page, context } = await open(off.url + 'privacy/');
    ok(!(await page.evaluate(() => document.body.textContent.includes('Google'))), 'privacy does not mention GA when disabled');
    await context.close();
  }

  // ───── 3. wizard behaviour ─────
  console.log('\n── Wizard ──');
  {
    const { page, log, base, context } = await open(off.url);
    // keyboard: reach the first interest tile with Tab, select with Space
    await page.focus('#app textarea');
    await page.keyboard.press('Tab');
    const focusKind = await page.evaluate(() => document.activeElement.tagName + ':' + (document.activeElement.type || ''));
    ok(focusKind.startsWith('SUMMARY') || focusKind.startsWith('INPUT:checkbox'), `Tab reaches the groups (${focusKind})`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    ok((await page.$$eval('.grp-body .tile input:checked', (a) => a.length)) === 1, 'Space selects a card from the keyboard');
    ok(await page.$eval('.tile input:checked + .tile-body .tile-check', (e) => getComputedStyle(e).display !== 'none'), 'selected state is visible beyond colour (check mark)');
    const small = await page.$$eval('.tile-body, .opt-body, .chip-body, .lad span, .btn', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).length);
    ok(small === 0, 'all visible interactive targets are at least 44px tall', String(small));

    // quick mode hides the detailed fields
    await page.$eval('input[name^="m-"][value="true"], fieldset.opts.wide input[value="true"]', (e) => e.click());
    ok(await page.$eval('#app', (a) => a.dataset.quick === '1'), 'quick mode switches on');
    await page.$eval('input[value="false"]', (e) => e.click());
    ok(await page.$eval('#app', (a) => a.dataset.quick === ''), 'detailed mode switches back');

    // validation + progress
    await page.$eval('.grp-body .tile input:checked', (e) => e.click());
    await next(page);
    ok(await step(page) === '1' && !(await page.$eval('.wz-error', (e) => e.hidden)), 'step 1 requires something (or "Не знаю")');
    await page.click('.unk');
    await next(page);
    ok(await step(page) === '2', '"Не знаю" lets the person continue');
    ok((await page.$eval('.wz-steptext', (e) => e.textContent)).startsWith('Крок 2 з 5'), 'progress text updates ("Крок 2 з 5")');
    ok(await page.$eval('.wz-steptext', (e) => e.getAttribute('aria-live') === 'polite'), 'progress is an aria-live region');
    // skills + level
    await page.evaluate(() => document.querySelector('[data-step="2"] .skill .chip input').click());
    ok(await page.$eval('.skill .seg', (e) => !e.hidden), 'level control appears for a chosen skill');
    await page.evaluate(() => document.querySelectorAll('.skill .seg input')[2].click());
    // skip through 3, set quick-relevant fields
    await page.$eval('.wz-nav .btn-ghost:not([style])', () => {}).catch(() => {});
    await next(page);
    ok(await step(page) === '3', 'step 3');
    ok(await page.evaluate(() => [...document.querySelectorAll('.opts')].slice(0, 1).every((o) => o.querySelector('input[value="unspecified"]').checked)) && await page.evaluate(() => [...document.querySelectorAll('input[value="unspecified"]')].every((i) => i.checked)), 'sensitive choices (gender, military) default to "not specified"');
    await page.type('#app .grid-2 input', '24');
    await next(page); await next(page);
    ok(await step(page) === '5', 'reached the result');
    const text = await page.$eval('#prompt-text', (t) => t.value);
    ok(text.includes('Що мене цікавить: не знаю, допоможи мені з цим розібратись'), 'unknown interests are passed as a request for help');
    ok(/\(сильно\)/.test(text) && text.includes('Вік: 24'), 'skill level and age reach the prompt');
    ok(text.length < 12000 && text.length > 3000, `prompt length is sane (${text.length})`);

    // edit + reset + modes
    await page.$eval('#prompt-text', (t) => { t.value += '\nМОЯ ПРАВКА'; t.dispatchEvent(new Event('input')); });
    ok((await page.$eval('#prompt-text', (t) => t.value.length)) > 0 && (await page.$$eval('.counter', (c) => c.some((e) => /символів/.test(e.textContent)))), 'character counter is shown');
    await page.$$eval('.btn-ghost', (bs) => bs.find((b) => b.textContent.includes('Скинути зміни')).click());
    ok(!(await page.$eval('#prompt-text', (t) => t.value)).includes('МОЯ ПРАВКА'), '"Скинути зміни" restores the generated prompt');
    await page.$eval('input[name="rm"][value="deep_dive"]', (e) => e.click());
    ok(!(await page.$eval('#prof-1', (e) => e.closest('.field').hidden)), 'deep-dive shows the profession field');
    await page.type('#prof-1', 'UX-дослідник');
    ok((await page.$eval('#prompt-text', (t) => t.value)).includes('Розбери професію **UX-дослідник**'), 'deep-dive prompt uses the profession');
    await page.$eval('input[name="rm"][value="compare"]', (e) => e.click());
    ok(!(await page.$eval('#prof-n', (e) => e.closest('.field').hidden)) && (await page.$eval('#prof-1', (e) => e.closest('.field').hidden)), 'compare shows the professions field only');
    await page.$eval('input[name="rc"][value="assume"]', (e) => e.click());
    ok((await page.$eval('#prompt-text', (t) => t.value)).includes('Не став уточнювальних питань'), 'assume mode');
    await page.$eval('input[name="rm"][value="explore"]', (e) => e.click());

    // services: href, clipboard first, long prompts
    const hrefs = await page.$$eval('.svc', (a) => a.map((x) => [x.textContent, x.dataset.url, x.target, x.rel, x.getAttribute('href')]));
    ok(hrefs.every((h) => !/[?&]q=/.test(h[4]) && h[4].length < 60), 'the prompt never sits in an href (analytics outbound-click tracking would read it)', hrefs.map((h) => h[4]).join(' '));
    ok(hrefs.length === 4 && hrefs.every((h) => h[2] === '_blank' && /noopener/.test(h[3]) && /noreferrer/.test(h[3])), 'four service links with target=_blank rel=noopener noreferrer');
    ok(hrefs[0][1].startsWith('https://claude.ai/new') && hrefs[1][1].startsWith('https://chatgpt.com/') && hrefs[2][1] === 'https://gemini.google.com/app' && hrefs[3][1].startsWith('https://www.perplexity.ai/search'), 'service URLs follow services.json');
    ok(hrefs.every((h) => !/ref=|utm_|aff/.test(h[1])), 'no referral or tracking parameters');
    await page.click('.svc:nth-child(3)'); await wait(200);
    ok(JSON.stringify((await page.evaluate(() => window.__opened)).at(-1)) === JSON.stringify(['https://gemini.google.com/app', '_blank', 'noopener,noreferrer']), 'click opens the service in a new tab via window.open (noopener)');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok(clip === (await page.$eval('#prompt-text', (t) => t.value)), 'clicking a service copies the full prompt first (Gemini)');
    ok((await page.$eval('.toast', (e) => e.textContent)).includes('вставте'), 'Gemini: tells the person to paste');
    const longText = 'я'.repeat(3000);
    await page.$eval('#prompt-text', (t, v) => { t.value = v; t.dispatchEvent(new Event('input')); }, longText);
    const longHref = await page.$eval('.svc', (a) => a.dataset.url);
    ok(longHref.length < 8000 && longHref.includes('claude.ai/new?q=') && !longHref.includes(encodeURIComponent(longText)), 'too-long prompt: the URL carries the short version', String(longHref.length));
    await page.click('.svc'); await wait(200);
    ok((await page.evaluate(() => window.__opened)).at(-1)[0] === longHref, 'the URL that opens is the short-version one');
    ok((await page.evaluate(() => navigator.clipboard.readText())) === longText, 'long prompt is still copied in full');
    ok((await page.$eval('.toast', (e) => e.textContent)).includes('вставте'), 'long prompt: "full version copied, paste it" message');
    await page.$$eval('.btn', (bs) => bs.find((b) => b.textContent.includes('Копіювати коротку')).click()); await wait(150);
    const shortClip = await page.evaluate(() => navigator.clipboard.readText());
    ok(shortClip.length < 2500 && shortClip.startsWith('Допоможи обрати професію'), 'short version copied');

    // share link + restore
    await page.$$eval('.btn', (bs) => bs.find((b) => b.textContent.includes('Поділитись')).click()); await wait(150);
    const share = await page.evaluate(() => navigator.clipboard.readText());
    ok(/#p=[A-Za-z0-9_-]+$/.test(share) && share.startsWith(off.url), 'share link is the page URL plus #p=…');
    const { page: p2, context: c2 } = await open(share);
    ok(await step(p2) === '5', 'opening a share link restores the result step');
    ok((await p2.$eval('#prompt-text', (t) => t.value)).includes('Вік: 24'), 'shared profile restored (age)');
    await c2.close();
    const bad = await open(off.url + '#p=%%%broken');
    ok(await step(bad.page) === '1' && bad.log.pageErrors.length === 0, 'a broken #hash is ignored without errors');
    await bad.context.close();

    // opt-in storage
    ok((await lsKeys(page)).length === 0, 'nothing in localStorage until opt-in');
    await page.click('#remember');
    ok((await lsKeys(page)).includes('tapeless:profile'), 'remember on: profile stored');
    await page.reload({ waitUntil: 'networkidle0' });
    ok(await page.evaluate(() => document.querySelectorAll('.tile input:checked').length) > 0 || (await page.$eval('.unk', (b) => b.getAttribute('aria-pressed') === 'true')), 'saved profile is restored after reload');
    page.on('dialog', (d) => d.accept());
    await toResult(page);
    await page.$$eval('.btn', (bs) => bs.find((b) => b.textContent.includes('Стерти все')).click()); await wait(200);
    ok((await lsKeys(page)).length === 0, '"Стерти все" empties localStorage');
    ok(await step(page) === '1', 'after erasing the wizard restarts');
    ok(external(log, base).length === 0, 'the whole session made no external request', external(log, base).join(', '));
    await context.close();
  }

  // ───── layout ─────
  console.log('\n── Layout ──');
  for (const [w, label] of [[360, '360'], [390, '390'], [768, 'tablet'], [1280, 'desktop']]) {
    const { page, context } = await open(off.url, { width: w, height: 800 });
    const overflow = [];
    for (const path of ['', 'how-it-works/', 'about/', 'privacy/', 'nope/']) {
      await page.goto(off.url + path, { waitUntil: 'networkidle0' });
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) overflow.push(`${path || '/'}:+${o}`);
    }
    // wizard steps too
    await page.goto(off.url, { waitUntil: 'networkidle0' });
    await pick(page);
    for (let i = 1; i <= 5; i++) {
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) overflow.push(`step${i}:+${o}`);
      // text must stay inside its card (e.g. a long word in a narrow option)
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.opt-body, .tile-body, .chip-body, .lad span, .btn, .svc')].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 24)));
      if (clipped.length) overflow.push(`step${i} clipped: ${clipped.join(' | ')}`);
      if (i < 5) await next(page);
    }
    ok(overflow.length === 0, `no horizontal scroll at ${label}px (all pages and steps)`, overflow.join(' '));
    await context.close();
  }
  {
    const { page, context } = await open(off.url);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(12, 18, 24)', 'dark theme follows prefers-color-scheme');
    await page.click('#theme-toggle');
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'toggle switches to light');
    ok(await page.evaluate(() => localStorage.getItem('tapeless:theme')) === 'light', 'theme choice stored');
    await page.reload({ waitUntil: 'networkidle0' });
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'theme restored without flash (inline script)');
    await context.close();
  }
  {
    const { page, context } = await open(off.url);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    ok(await page.evaluate(() => { const e = document.createElement('div'); e.style.transition = 'opacity 5s'; document.body.append(e); const d = getComputedStyle(e).transitionDuration; e.remove(); return d; }) !== '5s', 'prefers-reduced-motion disables transitions');
    await context.close();
  }
  {
    // without JavaScript the home page still reads and offers the manual template
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setJavaScriptEnabled(false);
    await page.goto(off.url, { waitUntil: 'networkidle0' });
    const txt = await page.evaluate(() => document.body.innerText);
    ok(txt.includes('Обери фах сам') && txt.includes('Що це') && txt.includes('Часті питання'), 'no-JS: home page content is readable');
    ok(txt.includes('потрібен JavaScript') && txt.includes('[мої інтереси]'), 'no-JS: explanation and the manual prompt template are shown');
    await context.close();
  }
} finally {
  await browser.close();
  off.server.close(); on.server.close();
  rmSync(tmp, { recursive: true, force: true });
  rmSync(tmpOff, { recursive: true, force: true });
}

const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => ` ✖ ${f[1]} ${f[2]}`).join('\n')); process.exit(1); }
