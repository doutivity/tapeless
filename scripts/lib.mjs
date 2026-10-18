// Shared by the page generator, the brand scripts and check.mjs. Dev tooling only: never shipped to the browser.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const loadConfig = () => JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));

// Public pages. `path` is relative to the site root; the home page is ''.
export const PAGES = [
  { path: '', file: 'index.html', title: 'Tapeless: обери фах сам — без касети', priority: '1.0',
    description: 'Покроковий майстер складає готовий промпт для ШІ (Claude, ChatGPT, Gemini, Perplexity), щоб визначитись із професією: стереотипи, конкуренція, захист від ШІ, люди з цього шляху.' },
  { path: 'how-it-works/', file: 'how-it-works/index.html', title: 'Як це працює: Tapeless', priority: '0.8', crumb: 'Як це працює',
    description: 'Як Tapeless складає промпт для ШІ: п’ять кроків, режими «Дослідити», «Заглибитись», «Порівняти», чесні межі й що робити після відповіді.' },
  { path: 'about/', file: 'about/index.html', title: 'Про ідею: оповідання Азімова «Фах» і Tapeless', priority: '0.6', crumb: 'Про ідею',
    description: 'Чому сайт називається Tapeless: коротко про оповідання Айзека Азімова «Фах» (Profession) і про те, чому сайт не призначає професію, а допомагає обрати її самому.' },
  { path: 'privacy/', file: 'privacy/index.html', title: 'Конфіденційність: Tapeless', priority: '0.4', crumb: 'Конфіденційність',
    description: 'Що Tapeless робить із Вашими даними: відповіді лишаються у браузері, що саме зберігається на пристрої, як змінити вибір і стерти дані.' },
];
export const NOT_FOUND = { path: '404.html', file: '404.html', title: 'Сторінку не знайдено: Tapeless', description: 'Такої сторінки немає. Поверніться на головну й складіть промпт для ШІ.' };
