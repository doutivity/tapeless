// Lighthouse (mobile preset, default throttling) for the home page and one inner page, served under /tapeless/ like GitHub Pages.
// Usage: node scripts/lighthouse.mjs   (run `make lighthouse`)
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { serve } from './static.mjs';

mkdirSync(`${ROOT}/.shots`, { recursive: true });
const { server, url } = await serve(ROOT, { prefix: '/tapeless/' });
let failed = false;
for (const [name, path] of [['home', ''], ['how-it-works', 'how-it-works/']]) {
  const out = `${ROOT}/.shots/lighthouse-${name}.json`;
  // async spawn: a synchronous one would block this process, and with it the static server Lighthouse is loading from
  const code = await new Promise((resolve) => spawn('lighthouse', [url + path, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage'], { stdio: 'inherit', env: { ...process.env, CHROME_PATH: '/usr/bin/chromium-browser' } }).on('exit', resolve));
  if (code !== 0) { console.error('lighthouse failed'); failed = true; continue; }
  const j = JSON.parse(readFileSync(out, 'utf8'));
  const sc = Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  const a = j.audits;
  console.log(`${name}: performance ${sc.performance} · accessibility ${sc.accessibility} · best-practices ${sc['best-practices']} · seo ${sc.seo}`);
  console.log(`   LCP ${a['largest-contentful-paint'].displayValue} · FCP ${a['first-contentful-paint'].displayValue} · TBT ${a['total-blocking-time'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · transfer ${a['total-byte-weight'].displayValue}`);
  for (const [id, au] of Object.entries(a)) if (au.score !== null && au.score < 1 && au.scoreDisplayMode === 'binary') console.log(`   ✖ ${id}: ${au.title}`);
  if (Object.values(sc).some((v) => v < 95)) failed = true;
}
server.close();
process.exit(failed ? 1 : 0);
