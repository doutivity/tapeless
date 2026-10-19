// Text brand artifacts from site.config.json: favicon.svg, site.webmanifest, robots.txt, humans.txt, sitemap.xml, security.txt.
// Also stamps buildDate. Raster images (favicon set, og.png) come from raster.mjs. Run both with `make brand`.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadConfig, PAGES } from '../lib.mjs';
import { faviconSvg } from './mark.mjs';

const cfgPath = join(ROOT, 'site.config.json');
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const raw = readFileSync(cfgPath, 'utf8');
writeFileSync(cfgPath, raw.replace(/"buildDate":\s*"[^"]*"/, `"buildDate": "${today}"`));
const cfg = loadConfig();
const out = (p, s) => { mkdirSync(join(ROOT, p, '..'), { recursive: true }); writeFileSync(join(ROOT, p), s); };

out('assets/img/favicon.svg', faviconSvg());

out('site.webmanifest', JSON.stringify({
  name: `${cfg.name}: ${cfg.tagline}`, short_name: cfg.name, description: PAGES[0].description, lang: cfg.lang, dir: 'ltr',
  start_url: cfg.basePath, scope: cfg.basePath, id: cfg.basePath, display: 'standalone',
  theme_color: '#eef3f8', background_color: '#eef3f8',
  icons: [
    { src: `${cfg.basePath}assets/img/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${cfg.basePath}assets/img/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${cfg.basePath}assets/img/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');

// Crawlers read only the host root, so on a project site this file is not authoritative (see README); it is ready for a custom domain.
out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);

out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url>\n    <loc>${cfg.siteUrl}/${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`);

out('humans.txt', `/* TEAM */
  Author: ${cfg.author}
  Contact: https://github.com/doutivity/tapeless/issues
  Site: ${cfg.siteUrl}/

/* THANKS */
  Onest typeface: SIL Open Font License 1.1
  Style: Poklych "Soft Silence"
  Idea: Isaac Asimov, "Profession"

/* SITE */
  Last update: ${today}
  Language: Ukrainian (uk)
  Standards: HTML5, CSS3, ES2022
  Components: vanilla JS (ES modules), no frameworks, no CDN
  Hosting: GitHub Pages
`);

const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
out('.well-known/security.txt', `Contact: https://github.com/doutivity/tapeless/security/advisories/new\nExpires: ${expires}\nPreferred-Languages: uk, en\nCanonical: ${cfg.siteUrl}/.well-known/security.txt\n`);
console.log(`brand text artifacts written (buildDate ${today})`);
