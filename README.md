# Tapeless — вибір фаху без «касети»

Статичний сайт для GitHub Pages у стилі Poklych («М'яка Тиша»). Людина проходить п'ять кроків (що цікавить, що вміє, про себе, умови),
а сайт складає готовий **промпт** для Claude / ChatGPT / Gemini / Perplexity, щоб вибрати діяльність чи професію: стереотипи,
складнощі, конкуренція, зв'язок із блогерством, захищеність від ШІ, люди, що вже побудували в цьому кар'єру, плани й ризики.

**Адреса:** <https://doutivity.github.io/tapeless/> — проєктний сайт у підкаталозі, тож усі шляхи відносні, а канонічні адреси,
`og:*`, `sitemap.xml`, `manifest` і JSON-LD будуються з `site.config.json` (`siteUrl`, `basePath`).

## Назва

Книга Азімова «Фах» (*Profession*, 1957): у світі, де професію людині «записують» стрічкою, герой не вписується в призначення.
Сайт робить протилежне: **не призначає фах, а допомагає обрати його самому.** Слоган: *«Обери фах сам — без касети»*
(*Choose a profession. Don't get assigned one.*). Запасні назви: Platen, Unassigned, Higher House, Registration Day.

## Принципи

- Лише HTML, CSS і vanilla JS (ES-модулі): без каркасів, збирача, CDN та `npm`-залежностей у браузері. Шрифт Onest — локальні файли.
- Відповіді форми не покидають пристрій, доки людина сама не натисне «Відкрити в …» чи «Копіювати». Єдиний виняток —
  **Google Analytics 4 лише після явної згоди**; відповіді форми, текст промпта й `#hash` в аналітику не потрапляють.
- Чесно про межі: ШІ помиляється; промпт вимагає розрізняти факти, оцінки й думки та не вигадувати імена й цифри.

## Усе, що не в браузері, працює в Docker

На хості потрібен лише Docker. Образ `tapeless-dev` (Node, Chromium, Lighthouse) збирається з `Dockerfile`:

```sh
make image        # одноразово: зібрати образ
make test         # node --test: промпт-білдер (golden-файли), стан, сервіси, аналітика, згода
make check        # scripts/check.mjs: посилання, мета, JSON-LD, розміри, sitemap, «жодного Google в розмітці»
make e2e          # браузерні перевірки: мережа й cookie без згоди / зі згодою / після відкликання, майстер, клавіатура, розкладка
make lighthouse   # Lighthouse (мобільний) для головної й «Як це працює»
make brand        # знак, favicon-набір, OG-картинка, robots/humans/sitemap/manifest і сторінки
make shots        # скріншоти в .shots/ (не комітяться)
make serve        # локальний перегляд на http://localhost:8080
```

Сайт працює й з кореня, і з підкаталогу (`/tapeless/`): шляхи відносні. `404.html` — виняток: GitHub Pages віддає її з будь-якої
глибини, тож вона користується абсолютним `basePath`.

## Структура

```
index.html, how-it-works/, about/, privacy/, 404.html   сторінки (генеруються: scripts/pages.mjs, результат комітиться)
site.config.json     siteUrl, basePath, analytics.measurementId, consentVersion, buildDate
assets/css           tokens, base, components, wizard, pages (з design-source/, адаптовано)
assets/js            main, wizard, result, state, prompt, services, i18n, consent, analytics, schema, dom
assets/img, fonts    знак, favicon-набір, OG, sprite іконок; Onest (OFL)
data/                interests, skills, presets, services (JSON)
i18n/uk.json         усі рядки інтерфейсу
tests/               node --test; tests/prompts/ — golden-файли
scripts/             pages, check, e2e, lighthouse, shots; scripts/brand/ — знак і артефакти бренду
design/              макети-галереї й шаблон OG (лишаються в репозиторії; на сайт не потрапляють)
```

## Налаштування

### Аналітика (GA4)
У `site.config.json` лишіть `analytics.measurementId` **порожнім**, доки не матимете справжнього ідентифікатора `G-…`: порожній
означає, що аналітики, банера й згадок GA немає. Коли вставите ідентифікатор: `make pages`, закомітьте, і на сайті з'являться
банер згоди, посилання «Налаштування аналітики» у підвалі й розділ у «Конфіденційності». У налаштуваннях ресурсу GA вкажіть
зберігання даних 2 місяці й вимкніть Google signals. Зміна тексту згоди: підніміть `consentVersion`, і всіх запитають знову.

### Деплой
`.github/workflows/pages.yml` на кожен push у `main` копіює в `_site` лише потрібні файли (без `design/`, `design-source/`,
`tests/`, `scripts/`, документації) і публікує. Увімкнути: **Settings → Pages → Source: GitHub Actions**.

### Пошукові системи
`robots.txt` у підкаталозі роботи **ігнорують**: вони читають лише корінь хоста (`doutivity.github.io/robots.txt`, це чужий
репозиторій `doutivity.github.io`). Тож індексацією керують `<meta name="robots">` і `sitemap.xml`. Подайте
`https://doutivity.github.io/tapeless/sitemap.xml` у **Google Search Console** (властивість «Префікс URL»
`https://doutivity.github.io/tapeless/`, підтвердження мета-тегом чи HTML-файлом) і в **Bing Webmaster Tools**. За бажання додайте
рядок `Sitemap:` у `robots.txt` кореневого репозиторію `doutivity.github.io`.

### Власний домен
Змініть `siteUrl` і `basePath` у `site.config.json`, додайте `CNAME`, виконайте `make brand`.

### Посилання на сервіси ШІ
Схеми в `data/services.json`. Жодну з них не підтверджено на живому сервісі: `verifiedAt: null`, `prefill: "unverified"`,
тож кнопка завжди **спершу копіює повний промпт** і підписана «Відкрити й вставити». Перевірте кожну вручну перед релізом і впишіть
дату та `prefill: "yes"`.

### Знак і бренд
Знак — літера «T» зі стрічки (`scripts/brand/mark.mjs`). Змінили знак чи дані: `make brand` перегенерує `favicon.svg`, `favicon.ico`,
`apple-touch-icon`, `icon-192/512`, `icon-maskable-512`, `og.png`, `site.webmanifest`, `robots.txt`, `humans.txt`, `sitemap.xml`,
`.well-known/security.txt`. Растрові картинки рендерить Chromium у Docker (у браузер це не потрапляє).

## Рішення й обмеження
Усе, що вирішено без запитання, — у [`DECISIONS.md`](DECISIONS.md). Джерела концепту: `PLAN.md`, `PROMPT.md`,
`llm-prompt-template.md`, `content-seed.md`, `design-source/`.

## Ліцензія
MIT; шрифт Onest — SIL OFL 1.1 (`assets/fonts/OFL.txt`).
