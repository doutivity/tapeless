# scripts/brand

Regenerates every brand artifact from one source (`mark.mjs`, `site.config.json`, `design/og-template.html`):

| Command | Output |
|---|---|
| `node scripts/brand/build.mjs` | `assets/img/favicon.svg`, `site.webmanifest`, `robots.txt`, `sitemap.xml`, `humans.txt`, `.well-known/security.txt`; stamps `buildDate` |
| `node scripts/brand/raster.mjs` | `favicon.ico` (16/32/48), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `og.png` (1200×630) |

Run both (plus the page generator) with `make brand` from the repository root: everything runs in the `tapeless-dev`
Docker image (Node + Chromium), so nothing is installed on the host. These scripts are development tools and never run in the browser.
