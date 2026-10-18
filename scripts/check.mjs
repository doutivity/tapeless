// Static checks for the built site. Usage: node scripts/check.mjs   (exit 1 on any error)
// Links, meta tags, JSON-LD, sizes, sitemap/robots/manifest/icons, "no Google in markup", generated pages up to date.
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, loadConfig, PAGES, NOT_FOUND } from './lib.mjs';

const cfg = loadConfig();
const errors = [];
const warn = [];
const err = (m) => errors.push(m);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const LIMIT_KB = 40;
const EXTERNAL_ANCHORS = [/^https:\/\/github\.com\/doutivity\//];

// ---------- pages ----------
const all = [...PAGES, NOT_FOUND];
const attr = (tag, name) => (new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag) || [])[1];
const tags = (html, re) => [...html.matchAll(re)].map((m) => m[0]);
const metaContent = (html, key, val) => {
  const t = tags(html, /<meta\b[^>]*>/g).find((m) => attr(m, key) === val);
  return t && attr(t, 'content');
};

function checkPage(page) {
  const f = page.file;
  if (!existsSync(join(ROOT, f))) return err(`${f}: missing`);
  const html = read(f);
  const at = (m) => err(`${f}: ${m}`);
  if (!/^<!doctype html>/i.test(html)) at('no doctype');
  if (!new RegExp(`<html lang="${cfg.lang}"`).test(html)) at(`<html lang="${cfg.lang}"> missing`);
  const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1];
  if (!title || title.length < 10 || title.length > 80) at(`title missing or odd length (${title && title.length})`);
  const desc = metaContent(html, 'name', 'description');
  if (!desc || desc.length < 50 || desc.length > 320) at(`meta description missing or odd length (${desc && desc.length})`);
  const expectUrl = page.path === '404.html' ? `${cfg.siteUrl}/` : `${cfg.siteUrl}/${page.path}`;
  const canon = tags(html, /<link\b[^>]*>/g).find((l) => attr(l, 'rel') === 'canonical');
  if (!canon || attr(canon, 'href') !== expectUrl) at(`canonical must be ${expectUrl}`);
  const robots = metaContent(html, 'name', 'robots') || '';
  if (page === NOT_FOUND ? !/noindex/.test(robots) : /noindex/.test(robots)) at('robots meta wrong');
  for (const [k, v] of [['property', 'og:title'], ['property', 'og:description'], ['property', 'og:url'], ['property', 'og:image'], ['property', 'og:image:alt'], ['name', 'twitter:card'], ['name', 'twitter:image']])
    if (!metaContent(html, k, v)) at(`missing ${v}`);
  if (metaContent(html, 'property', 'og:image') !== `${cfg.siteUrl}/assets/img/og.png`) at('og:image must be absolute from siteUrl');
  if (metaContent(html, 'property', 'og:image:width') !== '1200' || metaContent(html, 'property', 'og:image:height') !== '630') at('og:image size 1200x630');
  if (metaContent(html, 'property', 'og:url') !== expectUrl) at('og:url mismatch');
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) at(`expected exactly one <h1>, found ${h1}`);
  if (!/<main\b/.test(html) || !/<nav\b/.test(html)) at('semantic <main> and <nav> required');
  if (!tags(html, /<link\b[^>]*>/g).some((l) => attr(l, 'rel') === 'manifest')) at('manifest link missing');
  for (const need of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) if (!html.includes(need)) at(`${need} not linked`);
  if (!/prefers-color-scheme: light/.test(html) || !/prefers-color-scheme: dark/.test(html)) at('theme-color for both themes missing');

  // JSON-LD
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { at('invalid JSON-LD'); return {}; } });
  const types = ld.map((j) => j['@type']);
  const want = page.path === '' ? ['WebSite', 'WebApplication', 'FAQPage'] : page === NOT_FOUND ? [] : ['BreadcrumbList'];
  for (const w of want) if (!types.includes(w)) at(`JSON-LD ${w} missing`);
  const faq = ld.find((j) => j['@type'] === 'FAQPage');
  if (faq) {
    const n = faq.mainEntity.length;
    if (n < 6 || n > 8) at(`FAQ should have 6-8 questions, has ${n}`);
    if ((html.match(/<details>/g) || []).length < n) at('FAQ in markup does not match JSON-LD');
  }

  // CSP hash of the inline theme script
  const inline = (/<script>([^<]*)<\/script>/.exec(html) || [])[1];
  const csp = metaContent(html, 'http-equiv', 'Content-Security-Policy');
  if (!csp) at('CSP meta missing');
  else if (!inline || !csp.includes(`'sha256-${createHash('sha256').update(inline).digest('base64')}'`)) at('CSP hash does not match the inline script');

  // external requests: none in markup (anchors to allowlisted hosts are navigation, not requests)
  const noGa = !cfg.analytics.measurementId;
  const body = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  if (noGa && /google|gtag|googletagmanager/i.test(body)) at('Google found in markup while analytics is off');
  for (const t of tags(body, /<(?:script|link|img|iframe|source|use|form)\b[^>]*>/g)) {
    const u = attr(t, 'src') || attr(t, 'href') || attr(t, 'action');
    if (u && /^(https?:)?\/\//.test(u)) {
      if (!(t.startsWith('<link') && attr(t, 'rel') === 'canonical' && u.startsWith(cfg.siteUrl))) at(`external resource in markup: ${u}`);
    }
  }
  for (const t of tags(body, /<a\b[^>]*>/g)) {
    const u = attr(t, 'href');
    if (u && /^https?:\/\//.test(u)) {
      if (!EXTERNAL_ANCHORS.some((r) => r.test(u))) at(`unexpected external link: ${u}`);
      if (!/rel="[^"]*noopener/.test(t)) at(`external link without rel=noopener: ${u}`);
    }
  }

  // internal links and assets exist
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const t of tags(body, /<(?:a|link|script|img|use)\b[^>]*>/g)) {
    let u = attr(t, 'href') || attr(t, 'src');
    if (!u || /^(https?:|mailto:|data:|tel:)/.test(u)) continue;
    if (t.startsWith('<link') && attr(t, 'rel') === 'canonical') continue;
    const [pathPart, frag] = u.split('#');
    if (!pathPart) { if (frag && !ids.has(frag)) at(`anchor #${frag} not found`); continue; }
    let target;
    if (pathPart.startsWith(cfg.basePath)) target = join(ROOT, pathPart.slice(cfg.basePath.length));
    else if (pathPart.startsWith('/')) { at(`root-absolute path outside basePath: ${u}`); continue; }
    else target = resolve(ROOT, dirname(f), pathPart);
    let file = target;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) at(`broken link: ${u}`);
    else if (frag && extname(file) === '.html') {
      const other = readFileSync(file, 'utf8');
      if (!new RegExp(`\\sid="${frag}"`).test(other)) at(`anchor ${u} not found`);
    }
  }
}
all.forEach(checkPage);

// ---------- generated pages are up to date ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'tapeless-pages-'));
  execFileSync('node', [join(ROOT, 'scripts/pages.mjs'), '--out', dir], { stdio: 'pipe', env: { ...process.env, TAPELESS_GA: cfg.analytics.measurementId } });
  for (const p of all) if (existsSync(join(ROOT, p.file)) && read(p.file) !== readFileSync(join(dir, p.file), 'utf8')) err(`${p.file}: out of date, run \`make pages\``);
}

// ---------- sizes ----------
const walk = (dir, ext) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), ext) : e.name.endsWith(ext) ? [join(dir, e.name)] : []));
const sum = (files) => files.reduce((s, f) => s + readFileSync(join(ROOT, f)).length, 0);
const gz = (files) => gzipSync(Buffer.concat(files.map((f) => readFileSync(join(ROOT, f)))), { level: 9 }).length;
const js = walk('assets/js', '.js'), css = walk('assets/css', '.css');
const kb = (n) => (n / 1024).toFixed(1);
// The JS limit is applied to the compressed size: Cyrillic prompt text is 2 bytes per letter raw. Raw size is reported.
if (gz(js) > LIMIT_KB * 1024) err(`JS gzip ${kb(gz(js))} KB exceeds ${LIMIT_KB} KB`);
if (sum(css) > LIMIT_KB * 1024) err(`CSS ${kb(sum(css))} KB exceeds ${LIMIT_KB} KB`);
if (sum(js) > 100 * 1024) err('JS raw is over 100 KB');

// ---------- module hygiene ----------
for (const f of js) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  if (/\bimport\s*[^;]*from\s*['"]https?:/.test(src) || /import\(['"]https?:/.test(src)) err(`${f}: remote import`);
  if (/googletagmanager|google-analytics/.test(src) && !f.endsWith('analytics.js')) err(`${f}: Google referenced outside analytics.js`);
  if (/\beval\(|new Function\(|innerHTML\s*=/.test(src)) err(`${f}: eval/innerHTML is not allowed (CSP, XSS)`);
}
// every literal t('a.b') key used in the code must exist in i18n/uk.json
{
  const dict = JSON.parse(read('i18n/uk.json'));
  for (const f of js) {
    for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) {
      const v = m[1].split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
      if (v == null) err(`${f}: i18n key missing: ${m[1]}`);
    }
  }
}

// ---------- data ----------
for (const f of ['interests', 'skills']) {
  const d = JSON.parse(read(`data/${f}.json`));
  const ids = d.groups.flatMap((g) => g.cards.map((c) => c.id));
  if (new Set(ids).size !== ids.length) err(`data/${f}.json: duplicate ids`);
  if (ids.some((i) => !/^[a-z0-9-]+$/.test(i))) err(`data/${f}.json: ids must be kebab-case`);
  if (d.groups.some((g) => g.cards.some((c) => !c.label))) err(`data/${f}.json: card without label`);
}
{
  const pr = JSON.parse(read('data/presets.json')).presets;
  if (pr.length !== 6) err('presets.json: expected the 6 presets from content-seed.md');
  const sprite = read('assets/img/icons.svg');
  for (const p of pr) if (!sprite.includes(`id="i-${p.icon}"`)) err(`preset icon missing in sprite: ${p.icon}`);
}
{
  const schema = readFileSync(join(ROOT, 'assets/js/schema.js'), 'utf8');
  const sprite = read('assets/img/icons.svg');
  const dict = JSON.parse(read('i18n/uk.json'));
  for (const m of schema.matchAll(/\['([a-z-_]+)', '([a-z-]+)'\]/g)) if (!sprite.includes(`id="i-${m[2]}"`)) err(`schema.js icon missing in sprite: ${m[2]}`);
  for (const m of schema.matchAll(/^\s{2}(\w+): \[(.*)\],$/gm)) for (const v of m[2].matchAll(/\['([a-z-_]+)'/g)) if (!(dict.opt[m[1]] || {})[v[1]]) err(`i18n opt.${m[1]}.${v[1]} missing`);
}

// ---------- brand artifacts ----------
const png = (p) => { const b = readFileSync(join(ROOT, p)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
const exists = (p) => existsSync(join(ROOT, p)) || (err(`missing ${p}`), false);
if (exists('assets/img/og.png') && png('assets/img/og.png') !== '1200x630') err(`og.png must be 1200x630, is ${png('assets/img/og.png')}`);
for (const [p, s] of [['apple-touch-icon.png', '180x180'], ['icon-192.png', '192x192'], ['icon-512.png', '512x512'], ['icon-maskable-512.png', '512x512']]) if (exists(`assets/img/${p}`) && png(`assets/img/${p}`) !== s) err(`${p} must be ${s}`);
if (exists('assets/img/favicon.ico')) { const b = readFileSync(join(ROOT, 'assets/img/favicon.ico')); if (b.readUInt16LE(2) !== 1 || b.readUInt16LE(4) !== 3) err('favicon.ico must hold 3 sizes (16/32/48)'); }
if (exists('assets/img/favicon.svg') && !/prefers-color-scheme/.test(read('assets/img/favicon.svg'))) err('favicon.svg must adapt to prefers-color-scheme');
if (exists('site.webmanifest')) {
  const m = JSON.parse(read('site.webmanifest'));
  if (m.start_url !== cfg.basePath || m.scope !== cfg.basePath) err('manifest start_url/scope must equal basePath');
  for (const k of ['name', 'short_name', 'theme_color', 'background_color']) if (!m[k]) err(`manifest.${k} missing`);
  for (const i of m.icons) if (!existsSync(join(ROOT, i.src.replace(cfg.basePath, '')))) err(`manifest icon missing: ${i.src}`);
}
if (exists('sitemap.xml')) {
  const sm = read('sitemap.xml');
  for (const p of PAGES) if (!sm.includes(`<loc>${cfg.siteUrl}/${p.path}</loc>`)) err(`sitemap lacks ${p.path || '/'}`);
  if (sm.includes('404')) err('sitemap must not list 404');
  if ((sm.match(/<lastmod>/g) || []).length !== PAGES.length) err('sitemap: every URL needs lastmod');
}
if (exists('robots.txt')) { const r = read('robots.txt'); if (!/User-agent: \*/.test(r) || !/Allow: \//.test(r) || !r.includes(`Sitemap: ${cfg.siteUrl}/sitemap.xml`)) err('robots.txt incomplete'); }
if (exists('humans.txt')) { const h = read('humans.txt'); for (const s of ['/* TEAM */', '/* THANKS */', '/* SITE */', 'Onest', 'Poklych', 'Last update']) if (!h.includes(s)) err(`humans.txt lacks ${s}`); }
if (cfg.siteUrl !== 'https://doutivity.github.io/tapeless' || cfg.basePath !== '/tapeless/') err('site.config.json: siteUrl/basePath changed');
if (exists('.github/workflows/pages.yml')) {
  const wf = read('.github/workflows/pages.yml');
  if (!/path:\s*_site/.test(wf)) err('pages workflow must upload the curated _site folder, not the repository root');
  for (const dev of ['design', 'design-source', 'tests', 'scripts']) if (new RegExp(`cp[^\\n]*\\b${dev}\\b`).test(wf)) err(`pages workflow copies dev folder ${dev}`);
}

// ---------- report ----------
const line = `pages ${all.length} · JS ${kb(sum(js))} KB raw / ${kb(gz(js))} KB gzip (limit ${LIMIT_KB}) · CSS ${kb(sum(css))} KB raw / ${kb(gz(css))} KB gzip (limit ${LIMIT_KB})`;
if (errors.length) { console.error(errors.map((e) => `✖ ${e}`).join('\n')); console.error(`\n${errors.length} error(s). ${line}`); process.exit(1); }
console.log(`✔ all checks passed. ${line}`);
