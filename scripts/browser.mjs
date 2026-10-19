// Headless Chromium from the dev container (puppeteer-core ships inside the global lighthouse install).
import { createRequire } from 'node:module';
const req = createRequire('/usr/local/lib/node_modules/lighthouse/package.json');
export const puppeteer = req('puppeteer-core');
export const launch = () => puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser', headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
