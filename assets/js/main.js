// Entry point: theme toggle on every page, wizard on the home page, consent banner when analytics is configured.
import { initConsent } from './consent.js';
import { track } from './analytics.js';

const KEY = 'tapeless:theme';
const effective = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const paint = () => btn.setAttribute('aria-pressed', String(effective() === 'dark'));
  paint();
  btn.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    paint();
    track('theme_change', { theme: next });
  });
}

initTheme();
const app = document.getElementById('app');
if (app) {
  import('./wizard.js').then((m) => m.initWizard(app)).catch((e) => {
    app.textContent = 'Не вдалося завантажити майстер. Оновіть сторінку або скористайтесь ручним шаблоном нижче.';
    console.error(e);
  });
}
initConsent().catch(console.error);
