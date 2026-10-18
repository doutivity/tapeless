// Raster brand images rendered by headless Chromium: favicon.ico (16/32/48), apple-touch-icon (180), icon-192/512,
// icon-maskable-512, and og.png (1200x630) from design/og-template.html.
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../lib.mjs';
import { launch } from '../browser.mjs';
import { faviconSvg } from './mark.mjs';

const svg = faviconSvg().replace(/<style>.*?<\/style>/s, '');
const img = (p) => join(ROOT, 'assets/img', p);

const browser = await launch();
const page = await browser.newPage();

// size: icon edge; pad: fraction of the canvas left around the mark; bg: fill behind it (maskable icons need a full-bleed tile colour)
async function png(size, pad = 0, bg = 'transparent') {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const inner = Math.round(size * (1 - 2 * pad));
  await page.setContent(`<body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  return page.screenshot({ type: 'png', omitBackground: bg === 'transparent' });
}

// ICO container with embedded PNGs (supported by all current browsers).
function ico(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size; e[1] = size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.data)]);
}

writeFileSync(img('favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })))));
writeFileSync(img('apple-touch-icon.png'), await png(180, 0, '#1f1f1f'));
writeFileSync(img('icon-192.png'), await png(192));
writeFileSync(img('icon-512.png'), await png(512));
writeFileSync(img('icon-maskable-512.png'), await png(512, 0.2, '#1f1f1f'));

await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(ROOT, 'design/og-template.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(img('og.png'), await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } }));
await browser.close();
console.log('raster images written: favicon.ico, apple-touch-icon.png, icon-192/512, icon-maskable-512, og.png');
