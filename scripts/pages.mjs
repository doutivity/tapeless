// Generates the static pages (index, how-it-works, about, privacy, 404) from site.config.json.
// Usage: node scripts/pages.mjs [--out DIR]   (env TAPELESS_GA overrides analytics.measurementId, used by e2e only)
// Output is committed; canonical, og:*, JSON-LD and the CSP are derived from the config, never typed by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { ROOT, loadConfig, PAGES, NOT_FOUND } from './lib.mjs';
import { logoSvg } from './brand/mark.mjs';

const cfg = loadConfig();
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : ROOT;
const GA = process.env.TAPELESS_GA ?? cfg.analytics.measurementId;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => `${cfg.siteUrl}/${p}`;

// Inline, tiny, runs before first paint so there is no theme flash.
const THEME_JS = `try{var t=localStorage.getItem('tapeless:theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;
const THEME_HASH = "'sha256-" + createHash('sha256').update(THEME_JS).digest('base64') + "'";

const FAQ = [
  ['Що таке Tapeless?', 'Це безкоштовний сайт, який складає якісний запит (промпт) до ШІ за Вашим профілем: інтереси, уміння, обставини, умови. Назва — відсилка до оповідання Азімова «Фах», де професію людині «записують» на стрічку. Tapeless робить навпаки: не призначає фах, а допомагає обрати його самому.'],
  ['Чи безкоштовно?', 'Так. Сайт без реєстрації, реклами й платних функцій. Сервіси ШІ, які Ви відкриваєте, мають власні тарифи й обмеження.'],
  ['Чи зберігаєте мої дані?', 'У нас немає сервера, тож зберігати нічого. Відповіді живуть лише в пам’яті сторінки; у браузері вони залишаються тільки якщо Ви самі ввімкнете «Запам’ятати відповіді на цьому пристрої». Коли Ви відкриваєте ШІ, текст промпта потрапляє до цього сервісу за його правилами.' + (GA ? ' Якщо Ви погодились на аналітику, Google отримує лише знеособлені події (без Ваших відповідей).' : '')],
  ['Який ШІ обрати?', 'Підійде будь-який із чотирьох: Claude, ChatGPT, Gemini, Perplexity. Якщо сервіс уміє шукати в інтернеті й показувати джерела, вмикайте це: так легше перевірити імена, цифри й приклади людей.'],
  ['Чому відповіді різняться?', 'ШІ складає відповідь щоразу наново. Різні моделі мають різні дати знань і режими пошуку. Тому порівняйте дві відповіді, а все, що важливо для рішення, перевірте за джерелами.'],
  ['Чи можна довіряти зарплатам?', 'Лише як орієнтиру. ШІ дає діапазони, які можуть бути застарілими. Перевіряйте на сайтах вакансій (Work.ua, Robota.ua, DOU, Djinni, LinkedIn) і в розмовах із людьми, які вже працюють у цій сфері.'],
  ['Навіщо питати про стать, вік і військовий облік?', 'Це необов’язково й типово не вказується. Стать потрібна лише щоб звертатись до Вас у потрібному роді, військовий облік — щоб ШІ врахував бронювання й обмеження виїзду. Промпт прямо забороняє підбирати професію за статтю чи віком.'],
  ['Що значить «Не знаю»?', 'Це відповідь, а не пропуск. Якщо Ви позначили «Не знаю», у промпті з’явиться прохання до ШІ допомогти Вам розібратись із цим питанням.'],
];

const MANUAL = `Допоможи мені обрати професію. Відповідай українською, чесно відрізняй факти від припущень і нічого не вигадуй (імена, цифри, посилання — лише якщо впевнений(на), інакше дай запит для пошуку).

Я: [вік], [стать], [місто]; цікавить: [мої інтереси]; вмію: [мої уміння].
Умови: баланс життя й роботи [1–5], навчання — [без навчання / курси / диплом], ризик — [лише безпечне / помірний], режим — [офіс / віддалено / поле], дохід від [сума], блогерство — [так / ні / цікаво], захист від ШІ — [1–5].

Дай 5–7 професій. Для кожної: суть без романтики, стереотипи проти реальності, складнощі, шлях входу (строк і гроші), конкуренція, дохід, ризик, баланс, блогерство й відомі блогери, захищеність від ШІ за задачами, люди з цього шляху і як їх знайти. Далі — таблиця порівняння, топ-3, експерименти на тиждень, план 30/90/180 днів, ризики.
Перш ніж відповідати, постав 5–7 уточнювальних питань.`;

// ---------- page chrome ----------
function head(page, rel, { jsonld = [], noindex = false, base = rel } = {}) {
  const url = abs(page.path === '404.html' ? '' : page.path);
  const img = abs('assets/img/og.png');
  const ga = GA ? ` https://www.googletagmanager.com` : '';
  const gaConn = GA ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com' : '';
  const csp = `default-src 'self'; script-src 'self' ${THEME_HASH}${ga}; style-src 'self'; img-src 'self' data:${GA ? ' https://*.google-analytics.com https://*.googletagmanager.com' : ''}; font-src 'self'; connect-src 'self'${gaConn}; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  const R = (p) => base + p;
  return `<!doctype html>
<html lang="${cfg.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${url}">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="theme-color" content="#eef3f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1218" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${R('assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="${R('assets/img/favicon.ico')}" sizes="48x48">
<link rel="apple-touch-icon" href="${R('assets/img/apple-touch-icon.png')}">
<link rel="manifest" href="${R('site.webmanifest')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${cfg.name}">
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Tapeless: ${esc(cfg.tagline)}. Літера T зі жовто-чорної стрічки.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${img}">
${page.path === '' && cfg.verification?.google ? `<meta name="google-site-verification" content="${esc(cfg.verification.google)}">\n` : ''}${page.path === '' && cfg.verification?.bing ? `<meta name="msvalidate.01" content="${esc(cfg.verification.bing)}">\n` : ''}${GA ? `<meta name="tapeless:ga4" content="${esc(GA)}">\n<meta name="tapeless:consent-version" content="${cfg.consentVersion}">\n` : ''}<script>${THEME_JS}</script>
<link rel="preload" href="${R('assets/fonts/onest-400-cyrillic.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${R('assets/fonts/onest-700-cyrillic.woff2')}" as="font" type="font/woff2" crossorigin>
${['tokens', 'base', 'components', 'wizard', 'pages'].map((n) => `<link rel="stylesheet" href="${R(`assets/css/${n}.css`)}">`).join('\n')}
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
`;
}

function chrome(page, rel, main, opts = {}) {
  const R = (p) => (opts.base ?? rel) + p;
  const home = opts.base ?? (rel || './');
  const cur = (p) => (page.path === p ? ' aria-current="page"' : '');
  const poklych = cfg.poklychUrl ? `<a href="${esc(cfg.poklychUrl)}" rel="noopener">Poklych</a>` : 'Poklych';
  return `${head(page, rel, opts)}<body>
<a class="skip-link" href="#main">До основного змісту</a>
<header class="site-header">
  <a class="logo" href="${home}">${logoSvg()}<span>${cfg.name}</span></a>
  <nav class="header-nav" aria-label="Основна навігація">
    <a class="header-link" href="${R('how-it-works/')}"${cur('how-it-works/')}>Як це працює</a>
    <a class="header-link" href="${R('about/')}"${cur('about/')}>Про ідею</a>
    <button type="button" class="theme-btn" id="theme-toggle" aria-label="Змінити тему" aria-pressed="false">
      <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
  </nav>
</header>
<div class="tape" role="presentation"></div>
${main}
<footer class="site-footer">
  <a href="${R('how-it-works/')}">Як це працює</a>
  <a href="${R('privacy/')}" data-privacy>Конфіденційність</a>
  <a href="${R('about/')}">Про ідею</a>
  ${GA ? `<a href="${R('privacy/')}#analytics" data-consent-open>Налаштування аналітики</a>` : ''}
  <span>Зроблено в стилі ${poklych}</span>
</footer>
<script type="module" src="${R('assets/js/main.js')}"></script>
</body>
</html>
`;
}

const crumbLd = (page) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: cfg.name, item: abs('') },
    { '@type': 'ListItem', position: 2, name: page.crumb, item: abs(page.path) },
  ],
});
const crumbs = (page) => `<nav class="crumbs" aria-label="Хлібні крихти"><a href="../">${cfg.name}</a> › <span>${esc(page.crumb)}</span></nav>`;

// ---------- pages ----------
const write = (file, html) => { const p = join(OUT, file); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); };

function home() {
  const page = PAGES[0];
  const faq = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ');
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.name, url: abs(''), inLanguage: cfg.lang, description: page.description },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: cfg.name, url: abs(''), applicationCategory: 'LifestyleApplication', operatingSystem: 'Any', inLanguage: cfg.lang,
      description: page.description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH' }, browserRequirements: 'Потрібен JavaScript' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const main = `<main id="main" class="page app">
  <section class="hero" aria-labelledby="h1">
    <span class="badge badge-info eyebrow">Безкоштовно · без реєстрації · відповіді лишаються у Вас</span>
    <h1 id="h1">Обери фах сам — без касети</h1>
    <p class="lead">Відповідайте на п’ять коротких кроків. Tapeless складе готовий промпт для ШІ, який допоможе визначитись із професією: розбере стереотипи, складнощі, конкуренцію, захист від заміни ШІ й покаже, як знайти людей, що вже пройшли цей шлях.</p>
  </section>
  <section id="wizard" class="wizard-section" aria-label="Майстер: складання промпта">
    <noscript>
      <div class="noscript-box">
        <p><strong>Для майстра потрібен JavaScript.</strong> Увімкніть його в браузері, або скористайтесь ручним шаблоном: скопіюйте текст нижче, підставте свої дані замість квадратних дужок і вставте в улюблений ШІ.</p>
      </div>
      <pre class="card" style="white-space:pre-wrap">${esc(MANUAL)}</pre>
    </noscript>
    <div id="app"><p class="muted">Завантажуємо майстер…</p></div>
  </section>
  <div class="tape-divider" role="presentation"></div>
  <div class="prose col">
    <section aria-labelledby="what"><h2 id="what">Що це</h2>
      <p>Tapeless — не база професій і не тест, що «призначає» Вам фах. Це конструктор запиту: Ви розповідаєте про себе, а сайт складає структурований промпт, у якому ШІ просять чесно відрізняти факти від припущень і нічого не вигадувати.</p></section>
    <section aria-labelledby="who"><h2 id="who">Для кого</h2>
      <p>Для школярів і студентів, які обирають напрям; для тих, хто міняє сферу; для всіх, хто не знає, з чого почати розмову з ШІ про роботу.</p></section>
    <section aria-labelledby="how"><h2 id="how">Як користуватись</h2>
      <ol class="steps3">
        <li><b>Розкажіть про себе</b><span>Інтереси, уміння, обставини. Є швидкий режим на п’ять полів.</span></li>
        <li><b>Оберіть умови</b><span>Баланс життя й роботи, навчання, ризик, дохід, захист від ШІ.</span></li>
        <li><b>Відкрийте промпт у ШІ</b><span>Claude, ChatGPT, Gemini чи Perplexity. Промпт можна відредагувати.</span></li>
      </ol></section>
    <section aria-labelledby="what-in"><h2 id="what-in">Що розбере ШІ</h2>
      <ul><li>суть роботи без романтики, стереотипи проти реальності, складнощі;</li><li>шлях входу, конкуренція, діапазон доходу з застереженнями;</li><li>поєднання з блогерством і відомі блогери (лише ті, у кого ШІ впевнений);</li><li>захищеність від заміни ШІ за задачами;</li><li>люди, які вже побудували в цьому кар’єру, і як їх знайти;</li><li>плани на 30/90/180 днів, ризики й дешеві експерименти на тиждень.</li></ul></section>
    <section aria-labelledby="limits"><h2 id="limits">Чесні межі</h2>
      <p>ШІ помиляється: імена, цифри й джерела перевіряйте. Це не порада юриста чи психолога. Сайт нічого не стверджує про професії, зарплати чи людей: це робить ШІ за Вашим промптом, із застереженнями. Докладніше — на сторінці <a href="how-it-works/">«Як це працює»</a>.</p></section>
    <section aria-labelledby="faq-h"><h2 id="faq-h">Часті питання</h2>
      <div class="faq">
      ${faq}
      </div></section>
  </div>
</main>`;
  write(page.file, chrome(page, '', main, { jsonld }));
}

function howItWorks() {
  const page = PAGES[1];
  const main = `<main id="main" class="page wide">
  ${crumbs(page)}
  <article class="prose">
    <h1>Як це працює</h1>
    <p class="lead muted">Tapeless нічого не вирішує за Вас. Він збирає Ваші відповіді в один чіткий запит до ШІ й просить відповідати чесно.</p>
    <h2>П’ять кроків</h2>
    <ol>
      <li><b>Що цікавить.</b> Оберіть картки (можна кілька) або напишіть своїми словами.</li>
      <li><b>Що вмієте.</b> Позначте уміння й рівень: трохи, добре, сильно. Додайте мови, освіту й досвід.</li>
      <li><b>Про Вас.</b> Вік, місто, готовність переїжджати, віддалена робота. Стать і військовий облік необов’язкові.</li>
      <li><b>Умови.</b> Баланс життя й роботи, навчання, ризик, темп, режим, дохід, блогерство, захист від ШІ. Є готові набори.</li>
      <li><b>Результат.</b> Готовий промпт, який можна відредагувати, і кнопки відкриття в ШІ.</li>
    </ol>
    <p>На кожному кроці є «Пропустити» й «Не знаю». «Не знаю» — це відповідь: у промпті з’явиться прохання до ШІ допомогти Вам з цим. У швидкому режимі лишається п’ять полів: інтерес, уміння, вік, місто, баланс.</p>
    <h2>Режими відповіді</h2>
    <ul>
      <li><b>Дослідити</b> (типово): 5–7 професій, таблиця порівняння й топ-3 з поясненням.</li>
      <li><b>Заглибитись:</b> одна професія, яку Ви вже обрали, докладніше й із планом на 30, 90 і 180 днів.</li>
      <li><b>Порівняти:</b> 2–3 професії, які Ви називаєте.</li>
      <li><b>Спершу питання</b> (типово): ШІ ставить 5–7 уточнювальних питань і чекає. <b>Без питань:</b> ШІ робить припущення й називає їх.</li>
    </ul>
    <h2>Що у промпті</h2>
    <p>Роль ШІ, Ваш профіль, перелік того, що треба розібрати по кожній професії, правила чесності (позначати факти, оцінки й думки; не вигадувати імена та цифри; давати пошукові запити замість сумнівних прикладів) і режим відповіді. Є повна й коротка версії: коротка потрібна, коли сервіс не вміє прийняти довгий запит через посилання.</p>
    <h2>Кнопки сервісів</h2>
    <p>Спершу сайт копіює повний промпт у буфер обміну. Далі відкриває сервіс. Якщо сервіс не приймає запит через посилання (Gemini) або запит надто довгий, у посилання йде коротка версія чи нічого, а повну версію Ви вставляєте самі (Ctrl/⌘+V). Схеми посилань сервісів можуть змінюватись, тому кнопка підписана «Відкрити й вставити», коли передзаповнення не гарантоване.</p>
    <h2>Чесні межі</h2>
    <ul>
      <li>ШІ помиляється: імена, цифри й джерела перевіряйте.</li>
      <li>Сайт не має власних даних про професії, зарплати чи людей і не підбирає професію за статтю чи віком.</li>
      <li>Це не порада юриста, лікаря чи психолога.</li>
    </ul>
    <h2>Що робити після відповіді</h2>
    <p>Попросіть у тому ж чаті розписати план на 90 днів для обраного варіанта, знайти 10 людей для інформаційних інтерв’ю й перевірити цифри за джерелами. Готові запити є на кроці «Результат».</p>
    <p><a class="btn btn-primary" href="../#wizard">Скласти промпт</a></p>
  </article>
</main>`;
  write(page.file, chrome(page, '../', main, { jsonld: [crumbLd(page)] }));
}

function about() {
  const page = PAGES[2];
  const main = `<main id="main" class="page wide">
  ${crumbs(page)}
  <article class="prose">
    <h1>Про ідею</h1>
    <p class="lead muted">Назва — відсилка до оповідання Айзека Азімова «Фах» (<i>Profession</i>, 1957).</p>
    <h2>Оповідання</h2>
    <p>В оповіданні професію людині не обирають: її «записують» на спеціальну стрічку в день, коли настає дорослість, і кожен отримує призначене місце. Головний герой, Джордж Платен, мріє про інше. Решту не розкриваємо, бо оповідання варте того, щоб прочитати його самому.</p>
    <h2>Чому Tapeless</h2>
    <p><i>Tapeless</i> — «без касети» (стрічки). Сайт робить протилежне до книжкового світу: <b>не призначає фах, а допомагає обрати його самому</b>. Тому він не видає вердикт, а складає запит до ШІ, у якому є Ви, Ваші обставини й питання, про які легко забути: конкуренція, складнощі, захищеність від ШІ, люди, що вже пройшли цей шлях.</p>
    <p>Жовто-чорна стрічка в оформленні — те саме «пам’ятай про обережність»: ШІ може помилятись, тож перевіряйте.</p>
    <p>Слоган: <b>«${esc(cfg.tagline)}»</b>. Англійською: <i>Choose a profession. Don’t get assigned one.</i></p>
    <p><a class="btn btn-primary" href="../#wizard">Обрати самому</a></p>
  </article>
</main>`;
  write(page.file, chrome(page, '../', main, { jsonld: [crumbLd(page)] }));
}

function privacy() {
  const page = PAGES[3];
  const date = cfg.buildDate;
  const ga = GA ? `
    <h2 id="analytics">Аналітика Google Analytics 4</h2>
    <p>Щоб розуміти, чи доходять люди до результату, ми використовуємо Google Analytics 4 <b>лише після Вашої явної згоди</b>. Обробник даних — Google. До згоди сторінка не звертається до Google, не завантажує його скрипт і не ставить cookie.</p>
    <ul>
      <li><b>Що отримує GA:</b> знеособлені події (<code>wizard_start</code>, <code>wizard_step</code>, <code>wizard_complete</code>, <code>prompt_copy</code>, <code>service_open</code>, <code>theme_change</code>, <code>consent_change</code>) і cookie <code>_ga</code>, <code>_ga_*</code>.</li>
      <li><b>Чого не отримує:</b> Ваші відповіді, текст промпта, інтереси, вік, стать, локацію, військовий облік, адресу з налаштуваннями (<code>#…</code>). Ідентифікатори користувачів не використовуються, реклама вимкнена.</li>
      <li><b>Строк зберігання</b> у налаштуваннях ресурсу GA — 2 місяці.</li>
      <li><b>Вибір</b> зберігається в браузері (<code>tapeless:consent</code>: значення, дата, версія тексту) і запитується знову через 12 місяців або при новій версії тексту.</li>
    </ul>
    <p><button type="button" class="btn" data-consent-open>Змінити вибір або відкликати згоду</button> Відкликання видаляє cookie аналітики й припиняє надсилання подій.</p>` : `
    <h2 id="analytics">Аналітика</h2>
    <p>Зараз на сайті немає аналітики, cookie й запитів до сторонніх сервісів.</p>`;
  const main = `<main id="main" class="page wide">
  ${crumbs(page)}
  <article class="prose">
    <h1>Конфіденційність</h1>
    <p class="lead muted">Коротко: відповіді лишаються у Вашому браузері.</p>
    <h2>Що відбувається, коли Ви заповнюєте форму</h2>
    <p>Нічого не надсилається в мережу. Майстер працює у Вашому браузері, а промпт складається на Вашому пристрої. У нас немає сервера, акаунтів і бази даних.</p>
    <h2>Що зберігається на пристрої</h2>
    <ul>
      <li><code>tapeless:theme</code>: обрана тема, лише якщо Ви перемкнули її вручну;</li>
      ${GA ? '<li><code>tapeless:consent</code>: Ваш вибір щодо аналітики;</li>' : ''}
      <li><code>tapeless:profile</code>: Ваші відповіді, <b>лише</b> якщо Ви ввімкнули «Запам’ятати відповіді на цьому пристрої». Кнопка «Стерти все» видаляє їх.</li>
    </ul>
    <h2>Куди потрапляють дані</h2>
    <p>Коли Ви натискаєте «Відкрити в Claude / ChatGPT / Gemini / Perplexity», Ви самі переходите до стороннього сервісу, і текст промпта (або його коротка версія в посиланні) потрапляє до нього за його правилами. Тому не вписуйте в поля нічого, чим не готові ділитись із цим сервісом. Копіювання в буфер обміну відбувається лише на Вашому пристрої.</p>
    <h2>Посилання «Поділитись налаштуваннями»</h2>
    <p>Вона кладе Ваші відповіді в адресу після знака <code>#</code>. Фрагмент адреси не надсилається серверам, але той, кому Ви передасте посилання, побачить Ваші відповіді.</p>${ga}
    <h2>Контакт</h2>
    <p>Питання чи прохання щодо даних: відкрийте <a href="https://github.com/doutivity/tapeless/issues" rel="noopener">обговорення в репозиторії проєкту</a>.</p>
    <p class="small muted">Версія тексту ${cfg.consentVersion} · оновлено ${date}</p>
  </article>
</main>`;
  write(page.file, chrome(page, '../', main, { jsonld: [crumbLd(page)] }));
}

function notFound() {
  const page = NOT_FOUND;
  const base = cfg.basePath; // 404.html is served from any depth, so it needs absolute paths
  const main = `<main id="main" class="page wide">
  <article class="prose">
    <h1>Сторінку не знайдено</h1>
    <p>Такої сторінки немає або її перенесли. Поверніться на головну й складіть промпт для ШІ.</p>
    <p><a class="btn btn-primary" href="${base}">На головну</a></p>
  </article>
</main>`;
  write(page.file, chrome(page, '', main, { noindex: true, base }));
}

home(); howItWorks(); about(); privacy(); notFound();
console.log(`pages: ${PAGES.length + 1} written to ${OUT}${GA ? ' (analytics ON: ' + GA + ')' : ''}`);
