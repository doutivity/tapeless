// Pure prompt builder: buildPrompt(profile, options) -> { full, short, missing }. No DOM, no network.
// Wording follows llm-prompt-template.md; section headings are stable because golden tests rely on them.
import { normalize, MAX_TEXT } from './state.js';

const NS = 'не вказано';
const UNK = 'не знаю, допоможи мені з цим розібратись';

// Free text: no control chars or HTML, single line (so it cannot fake a "## Heading"), capped length.
export function clean(s, max = MAX_TEXT) {
  return String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

const LABELS = {
  gender: { male: 'чоловік', female: 'жінка', other: 'інше' },
  relocate: { no: 'ні', ukraine: 'так, в Україні', abroad: 'так, за кордон' },
  remote: { yes: 'так', no: 'ні', either: 'байдуже' },
  military: { liable: 'військовозобов’язаний(а)', 'not-liable': 'не військовозобов’язаний(а)' },
  study: { none: 'без навчання', short: 'короткі курси', degree: 'диплом', any: 'на будь-що' },
  risk: { safe: 'лише безпечне', moderate: 'помірний', acceptable: 'ризик припустимий' },
  stress: { low: 'спокійний темп', medium: 'помірний', high: 'швидкий і напружений' },
  mode: { office: 'офіс', remote: 'віддалено', field: 'поле, вулиця', mixed: 'змішано' },
  team: { team: 'у команді', solo: 'самостійно', either: 'байдуже' },
  schedule: { stable: 'стабільний', shift: 'змінний', either: 'байдуже' },
  workType: { mental: 'розумова', physical: 'фізична', mixed: 'змішана' },
  publicity: { yes: 'так', no: 'ні', maybe: 'можливо' },
  blogging: { yes: 'так', no: 'ні', curious: 'цікаво' },
  capital: { none: 'немає', small: 'невеликий', medium: 'помірний', large: 'є що вкласти' },
};
const LEVEL = ['', 'трохи', 'добре', 'сильно'];
const LANG = { uk: 'українська', en: 'англійська' };
const LANG_LEVEL = ['', 'початковий', 'середній', 'високий', 'рідна'];
const AI_PRIORITY = ['', '1: неважливо', '2: радше неважливо', '3: помірно важливо', '4: важливо', '5: головна умова'];
const BALANCE = ['', '1: майже все життя', '2: більше життя', '3: порівну', '4: більше роботи', '5: готовий(а) повністю працювати'];

// Gendered forms follow the stated gender, otherwise stay neutral ("готовий(а)").
const form = (p, m, f, n) => (p.person.gender === 'male' ? m : p.person.gender === 'female' ? f : n);

const lbl = (field, v) => (LABELS[field] && LABELS[field][v]) || '';
function genderGo(p, text) {
  // adapt the two gendered participles used in condition labels
  return text.replace('готовий(а)', form(p, 'готовий', 'готова', 'готовий(а)'));
}

const ITEMS = [
  'Суть роботи без романтики: що роблять щодня.',
  'Стереотипи проти реальності: що про цю професію думають і що насправді.',
  'Складнощі: що найважче, чим закінчується вигорання, на що не готують.',
  'Шлях входу: що вчити, скільки часу й грошей, чи потрібен диплом, перша робота чи перший клієнт.',
  'Конкуренція: попит і пропозиція, насиченість, відмінність між Україною й віддаленим ринком; чи є порогові вимоги, що відсікають новачків.',
  'Дохід: діапазони на старті, через 2–3 роки і в сильній позиції — з поясненням, від чого залежить.',
  'Безпека й ризик: фізична небезпека, юридичні ризики, нестабільність.',
  'Баланс життя й роботи: як це виглядає в реальності (аврали, сезонність, змінний графік).',
  'Блогерство: чи поєднується; які формати працюють; чи є відомі блогери (українські й світові) у цій сфері — назви лише тих, у кого впевнений(на), з платформою й темою; решту — запитами для пошуку.',
  'Захищеність від заміни ШІ: які саме задачі професії автоматизуються за 2, 5 і 10 років, які — ні, і як зробити себе незамінним(ою). Познач невизначеність.',
  'Люди, які вже побудували тут кар’єру: як їх знайти (де шукати, які запити), що саме вивчати в їхньому шляху (з чого починали, скільки йшло, переломи, помилки, як змінювали напрям) і шаблон короткого повідомлення для «інформаційного інтерв’ю» (3 питання, без прохання про роботу).',
];
const numbered = () => ITEMS.map((t, i) => `${i + 1}. ${t}`).join('\n');

const RULES = `## Правила
- Розрізняй: [факт] / [оцінка] / [думка]. Не вигадуй імена, цифри, посилання. Якщо не впевнений(на) — так і скажи й дай пошуковий запит або критерій перевірки.
- Якщо ти можеш шукати в інтернеті — шукай і давай джерела; якщо ні — скажи, що дані можуть бути застарілими, і вкажи дату свого знання.
- Не підбирай професії за моєю статтю чи віком як такими; враховуй лише реальні обмеження (здоров’я, закон, умови).
- Не обіцяй результатів і не лести. Краще чесне «не підходить», ніж красива відповідь.
- Структуруй відповідь заголовками й таблицями, пиши коротко й конкретно.`;

const UA_REALITIES = 'Окремо врахуй українські реалії: воєнний стан, мобілізація й бронювання, переїзд за кордон, ФОП і податки, державні й приватні програми навчання.';

function cardList(ids, map) {
  return ids.map((id) => clean(map && map[id] ? map[id] : id, 80)).filter(Boolean);
}

// Collects everything the prompt needs, already cleaned, plus the list of unanswered fields.
function gather(raw, options) {
  const p = normalize(raw);
  const maps = (options && options.cards) || {};
  const U = p.unknown;
  const missing = [];
  const unknown = [];
  const take = (section, name, value, label) => {
    if (U[section]) return UNK;
    if (value === '' || value === 0 || value == null) { missing.push(label); return NS; }
    return value;
  };
  if (U.interests) unknown.push('що мене цікавить');
  if (U.skills) unknown.push('що я вмію');
  if (U.person) unknown.push('дані про мене');
  if (U.conditions) unknown.push('мої умови');

  const iCards = cardList(p.interests.cards, maps.interests);
  const iText = clean(p.interests.text);
  const sCards = p.skills.cards.map((c) => `${clean(maps.skills && maps.skills[c.id] ? maps.skills[c.id] : c.id, 80)} (${LEVEL[c.level]})`);
  const sText = clean(p.skills.text);
  const langs = p.languages.map((l) => `${l.code === 'other' ? clean(l.name, 60) || 'інша' : LANG[l.code]} (${LANG_LEVEL[l.level]})`);

  const d = {
    p, iCards, iText, sCards, sText, langs, missing, unknown,
    education: clean(p.education), experience: clean(p.experience), extra: clean(p.extra),
    age: clean(p.person.age, 20), location: clean(p.person.location, 120),
    gender: lbl('gender', p.person.gender), relocate: lbl('relocate', p.person.relocate), remote: lbl('remote', p.person.remote),
    military: lbl('military', p.person.military),
    profession: clean(p.profession, 120), professions: clean(p.professions, 240),
  };
  d.interests = [iCards.join(', '), iText].filter(Boolean).join('; ');
  d.skills = [sCards.join(', '), sText].filter(Boolean).join('; ');

  const c = p.conditions;
  d.cond = {
    balance: BALANCE[c.balance] || '', study: lbl('study', c.study), risk: lbl('risk', c.risk), stress: lbl('stress', c.stress),
    mode: lbl('mode', c.mode), team: lbl('team', c.team), schedule: lbl('schedule', c.schedule), workType: lbl('workType', c.workType),
    publicity: lbl('publicity', c.publicity), capital: lbl('capital', c.capital), blogging: lbl('blogging', c.blogging),
    horizon: c.income.horizonMonths ? String(c.income.horizonMonths) : '', min: clean(c.income.min, 80), target: clean(c.income.target, 80),
    aiPriority: AI_PRIORITY[c.aiPriority] || '',
  };

  // missing[] order = order of lines in the prompt; unknown sections are reported separately
  const m = (section, label, v) => take(section, label, v, label);
  d.v = {
    interests: U.interests ? UNK : d.interests || (missing.push('інтереси'), NS),
    skills: U.skills ? UNK : d.skills || (missing.push('уміння'), NS),
    languages: d.langs.length ? d.langs.join(', ') : (missing.push('мови'), NS),
    education: d.education || (missing.push('освіта'), NS),
    experience: d.experience || (missing.push('досвід'), NS),
    // gender is optional by design: "not specified" is a choice, so the AI is never told to ask about it
    gender: U.person ? UNK : d.gender || NS,
    age: U.person ? UNK : d.age || (missing.push('вік'), NS),
    location: U.person ? UNK : d.location || (missing.push('місце проживання'), NS),
    relocate: U.person ? UNK : d.relocate || (missing.push('готовність переїжджати'), NS),
    remote: U.person ? UNK : d.remote || (missing.push('віддалена робота'), NS),
  };
  const cm = {
    balance: 'баланс життя й роботи', study: 'навчання', horizon: 'строк виходу на дохід', risk: 'ризик', stress: 'стрес і темп',
    mode: 'режим роботи', team: 'команда чи самостійно', schedule: 'графік', workType: 'тип праці', publicity: 'публічність',
    min: 'мінімальний дохід', target: 'бажаний дохід', capital: 'стартовий капітал', blogging: 'блогерство', aiPriority: 'захист від ШІ',
  };
  d.c = {};
  for (const k of Object.keys(cm)) d.c[k] = m('conditions', cm[k], d.cond[k]);
  return d;
}

function modeTask(d) {
  const p = d.p;
  if (p.mode === 'deep_dive') {
    const name = d.profession || `${NS} (запитай мене, яку саме професію розібрати)`;
    return `## Що зробити
Розбери професію **${name}** для мого профілю (за інтересами, уміннями й умовами, а не за статтю чи віком). Дай докладно, одну за одною:
${numbered()}

Після розбору:
- Два-три дешеві експерименти на тиждень для цієї професії (інформаційне інтерв’ю, мініпроєкт, день на практиці) і що я зрозумію з результату.
- План на 30 / 90 / 180 днів.
- Ризики плану й що робити, якщо не вийде.
- Що мені перевірити самому(ій) і де.
- ${UA_REALITIES}`;
  }
  if (p.mode === 'compare') {
    const names = d.professions || `${NS} (запитай мене, які 2–3 професії порівняти)`;
    return `## Що зробити
Порівняй професії **${names}** для мого профілю (за інтересами, уміннями й умовами, а не за статтю чи віком). Для кожної скорочено:
${numbered()}

Після цього:
- Обов’язкова порівняльна таблиця (професії × критерії, оцінка 1–5 з одним рядком обґрунтування).
- Рекомендація: що найкраще для мене і чому; що б змусило змінити вибір.
- Два-три дешеві експерименти на тиждень для найкращого варіанта.
- Ризики вибору й що робити, якщо не вийде.
- ${UA_REALITIES}`;
  }
  return `## Що зробити
Запропонуй 5–7 професій чи видів діяльності, які найкраще пасують до мого профілю (за інтересами, уміннями й умовами, а не за статтю чи віком). Для кожної:
${numbered()}

Після списку:
- Порівняльна таблиця (професії × критерії, оцінка 1–5 з одним рядком обґрунтування).
- Топ-3 для мене і чому саме вони; що б змусило змінити вибір.
- Два-три дешеві експерименти на тиждень для кожної з топ-3 (інформаційне інтерв’ю, мініпроєкт, день на практиці) і що я зрозумію з результату.
- План на 30 / 90 / 180 днів для найкращого варіанта.
- Ризики плану й що робити, якщо не вийде.
- ${UA_REALITIES}`;
}

const MODE_ASK = 'Перш ніж відповідати, постав мені 5–7 найважливіших уточнювальних питань (там, де мої дані неповні або суперечливі) і дочекайся моїх відповідей. Потім дай відповідь за структурою вище.';
const MODE_ASSUME = 'Не став уточнювальних питань: зроби розумні припущення, випиши їх списком на початку й дай відповідь за структурою вище.';

function buildFull(d) {
  const p = d.p, v = d.v, c = d.c;
  const gen = (t) => genderGo(p, t);
  const lines = [];
  lines.push('Ти — досвідчений кар’єрний консультант і дослідник ринку праці, який чесно розрізняє факти, оцінки й припущення.');
  lines.push('Допоможи мені обрати професію чи діяльність. Відповідай українською мовою.', '');
  lines.push('## Хто я');
  lines.push(`- Що мене цікавить: ${v.interests}`);
  lines.push(`- Що я вмію (рівень «трохи / добре / сильно»): ${v.skills}`);
  lines.push(`- Мови: ${v.languages}. Освіта: ${v.education}. Досвід: ${v.experience}`);
  lines.push(`- Стать: ${v.gender}. Вік: ${v.age}. Де живу: ${v.location}.`);
  lines.push(`  ${form(p, 'Готовий', 'Готова', 'Готовий(а)')} переїжджати: ${v.relocate}. Віддалена робота: ${v.remote}`);
  if (d.military) lines.push(`- Військовий облік (враховуй лише реальні обмеження й закони, не підбирай за цим професію): ${d.military}`);
  lines.push('', '## Мої умови');
  lines.push(`- Баланс життя й роботи (від «більше життя» до «більше роботи», 1–5): ${c.balance}`);
  lines.push(`- Навчання: ${gen(c.study)}. Строк, за який хочу вийти на дохід: ${c.horizon === NS || c.horizon === UNK ? c.horizon : c.horizon + ' міс.'}`);
  lines.push(`- Небезпека й ризик: ${c.risk}. Стрес і темп: ${c.stress}`);
  lines.push(`- Режим: ${c.mode}. Команда чи самостійно: ${c.team}. Графік: ${c.schedule}`);
  lines.push(`- Розумова чи фізична праця: ${c.workType}. ${form(p, 'Готовий', 'Готова', 'Готовий(а)')} бути ${form(p, 'публічним', 'публічною', 'публічним(ою)')}: ${c.publicity}`);
  lines.push(`- Дохід: мінімум ${c.min}, бажаний ${c.target}. Стартовий капітал: ${c.capital}`);
  lines.push(`- Поєднання з блогерством: ${c.blogging}`);
  lines.push(`- Наскільки важлива захищеність від заміни ШІ (1–5): ${c.aiPriority}`);
  if (d.extra) lines.push(`- Ще: ${d.extra}`);
  lines.push('');
  const ask = p.clarify === 'ask_first';
  if (d.unknown.length) lines.push(`Я не знаю: ${d.unknown.join(', ')}. Допоможи мені з цим розібратись.`);
  if (d.missing.length) {
    const who = form(p, 'вказав', 'вказала', 'вказав(ла)');
    lines.push(`Я не ${who}: ${d.missing.join(', ')}. ${ask ? 'Якщо це суттєво для висновку — запитай мене про це.' : 'Зроби припущення й назви їх.'}`);
  }
  if (d.unknown.length || d.missing.length) lines.push('');
  lines.push(modeTask(d), '', RULES, '', '## Режим', ask ? MODE_ASK : MODE_ASSUME);
  return lines.join('\n');
}

// Short variant for URLs: only what was filled in; card lists are trimmed to the first N ("…і ще K").
function buildShort(d, n) {
  const p = d.p;
  const trim = (arr) => (arr.length > n ? [...arr.slice(0, n), `…і ще ${arr.length - n}`] : arr);
  const interests = [...trim(d.iCards), ...(d.iText ? [d.iText.slice(0, 160)] : [])].join(', ');
  const skills = [...trim(d.sCards), ...(d.sText ? [d.sText.slice(0, 160)] : [])].join(', ');
  const who = [d.age, d.gender, d.location].filter(Boolean).join(', ');
  const cd = d.cond;
  const cond = [
    cd.balance && `баланс ${cd.balance.split(':')[0]}/5`, cd.study && `навчання — ${cd.study}`, cd.risk && `ризик — ${cd.risk}`,
    cd.mode && `режим — ${cd.mode}`, cd.min && `дохід від ${cd.min}`, cd.blogging && `блогерство — ${cd.blogging}`,
    cd.aiPriority && `захист від ШІ — ${cd.aiPriority.split(':')[0]}/5`, d.extra && d.extra.slice(0, 200),
  ].filter(Boolean).join(', ');
  const head = p.mode === 'deep_dive'
    ? `Розбери професію «${d.profession || 'яку я назву у відповідь'}» для мене.`
    : p.mode === 'compare' ? `Порівняй професії «${d.professions || 'які я назву у відповідь'}» для мене.` : 'Допоможи обрати професію.';
  const ask = p.clarify === 'ask_first' ? 'Перш ніж відповідати, постав 5–7 уточнювальних питань.' : 'Не став питань, зроби припущення й назви їх.';
  const task = p.mode === 'explore'
    ? 'Дай 5–7 професій. Для кожної: суть без романтики, стереотипи проти реальності, складнощі, шлях входу (строк і гроші), конкуренція, дохід, ризик, баланс, блогерство й відомі блогери, захищеність від ШІ за задачами, люди з цього шляху і як їх знайти. Далі — таблиця порівняння, топ-3, експерименти на тиждень, план 30/90/180 днів, ризики.'
    : 'Для кожної: суть без романтики, стереотипи проти реальності, складнощі, шлях входу, конкуренція, дохід, ризик, баланс, блогерство, захищеність від ШІ, люди з цього шляху. Далі — таблиця, рекомендація, експерименти на тиждень, план 30/90/180 днів, ризики.';
  const unk = d.unknown.length ? `Не знаю: ${d.unknown.join(', ')} — допоможи з цим.` : '';
  return [
    `${head} Відповідай українською, чесно відрізняй факти від припущень, нічого не вигадуй (імена, цифри, посилання — лише якщо впевнений(на), інакше дай запит для пошуку).`,
    '',
    `Я: ${who || 'дані не вказано'}${interests ? `; цікавить: ${interests}` : ''}${skills ? `; вмію: ${skills}` : ''}.`,
    cond ? `Умови: ${cond}.` : '',
    unk, '', task, ask,
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').trim();
}

export function buildPrompt(profile, options = {}) {
  const d = gather(profile, options);
  const full = buildFull(d);
  const max = options.maxShortEncoded || 7500;
  const longest = Math.max(d.iCards.length, d.sCards.length);
  let short = buildShort(d, longest);
  for (let n = longest - 1; encodeURIComponent(short).length > max && n >= 0; n--) short = buildShort(d, n);
  return { full, short, missing: d.missing.slice() };
}
