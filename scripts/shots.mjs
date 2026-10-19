// Screenshots of the key screens into .shots/ (light/dark, 390 and 1280). Usage: node scripts/shots.mjs
import { mkdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { serve } from './static.mjs';
import { launch } from './browser.mjs';

const dir = `${ROOT}/.shots`;
mkdirSync(dir, { recursive: true });
const { server, url } = await serve(ROOT);
const browser = await launch();
const sizes = [['390', 390, 844], ['1280', 1280, 900]];

for (const [label, width, height] of sizes) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: `${dir}/home-${label}-${theme}.png` });
    await page.screenshot({ path: `${dir}/home-${label}-${theme}-full.png`, fullPage: true });
    // walk the wizard: step 1 selection, then every step
    await page.evaluate(() => document.getElementById('wizard').scrollIntoView());
    for (const i of [0, 3]) await (await page.$$('.grp-body .tile'))[i].click();
    for (let n = 1; n <= 5; n++) {
      await page.evaluate(() => document.getElementById('wizard').scrollIntoView());
      await page.screenshot({ path: `${dir}/wizard-${label}-${theme}-step${n}.png` });
      if (n < 5) await page.click('.wz-nav .btn-primary');
    }
    await page.close();
  }
}

// the consent banner needs a copy of the site with a (fake) measurement id
const tmp = mkdtempSync(join(tmpdir(), 'tapeless-ga-'));
const skip = new Set(['.git', '.idea', '.shots', '.scratch', 'node_modules', 'design', 'design-source', 'tests', 'scripts']);
cpSync(ROOT, tmp, { recursive: true, filter: (src) => !skip.has(src.slice(ROOT.length + 1).split('/')[0]) });
execFileSync('node', [join(ROOT, 'scripts/pages.mjs'), '--out', tmp], { env: { ...process.env, TAPELESS_GA: 'G-TEST123456' }, stdio: 'pipe' });
const ga = await serve(tmp);
for (const [label, width, height] of sizes.concat([['360', 360, 740]])) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.goto(ga.url, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: `${dir}/consent-${label}-${theme}.png` });
    await page.$$eval('#consent .btn', (bs) => bs[1].click());
    await page.screenshot({ path: `${dir}/consent-settings-${label}-${theme}.png` });
    await page.close();
  }
}
ga.server.close();
rmSync(tmp, { recursive: true, force: true });
await browser.close();
server.close();
console.log('screenshots in .shots/');
