// The five-step wizard: shell, progress, navigation, steps 1-4. Step 5 lives in result.js.
import { t, loadJson, loadStrings } from './i18n.js';
import { h, icon } from './dom.js';
import * as S from './state.js';
import { CHOICES, STEPS } from './schema.js';
import { track } from './analytics.js';
import { renderResult } from './result.js';

const UNKNOWN_KEY = { 1: 'interests', 2: 'skills', 3: 'person', 4: 'conditions' };

export async function initWizard(root) {
  await loadStrings();
  const [interests, skills, presets, services] = await Promise.all([
    loadJson('data/interests.json'), loadJson('data/skills.json'), loadJson('data/presets.json'), loadJson('data/services.json'),
  ]);
  const labels = {
    interests: Object.fromEntries(interests.groups.flatMap((g) => g.cards.map((c) => [c.id, c.label]))),
    skills: Object.fromEntries(skills.groups.flatMap((g) => g.cards.map((c) => [c.id, c.label]))),
  };

  const ctx = {
    profile: S.createProfile(), step: 1, reached: 1, started: false, completed: false, labels, services, presets, interests, skills,
    syncs: [], remember: S.isSaved(),
  };
  const fromHash = S.decodeHash(location.hash);
  const saved = S.loadSaved();
  if (fromHash) { ctx.profile = fromHash; ctx.step = ctx.reached = STEPS; }
  else if (saved) ctx.profile = saved;

  // ---- profile access by dotted path ----
  const get = (path) => path.split('.').reduce((o, k) => o[k], ctx.profile);
  const set = (path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], ctx.profile)[last] = value;
    changed();
  };
  ctx.get = get; ctx.set = set;
  function changed() {
    if (!ctx.started) { ctx.started = true; track('wizard_start'); }
    if (ctx.remember) S.save(ctx.profile);
    updateSummary();
  }
  ctx.changed = changed;

  // ---- shell ----
  root.replaceChildren();
  const modeBox = h('div', { class: 'wz-mode' });
  const progress = h('nav', { class: 'wz-progress', 'aria-label': t('wizard.nav') });
  const stepText = h('p', { class: 'wz-steptext', 'aria-live': 'polite' });
  const card = h('section', { class: 'card wz-card' });
  const summary = h('aside', { class: 'card wz-summary', 'aria-label': t('wizard.summary') });
  const error = h('p', { class: 'wz-error', role: 'alert', hidden: true });
  const back = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(ctx.step - 1) }, icon('arrow-left'), t('wizard.back'));
  const skip = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(ctx.step + 1, true) }, t('wizard.skip'));
  const next = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => go(ctx.step + 1) }, t('wizard.next'), icon('arrow-right'));
  const nav = h('div', { class: 'wz-nav' }, back, h('span', { class: 'wz-nav-right' }, skip, next));
  root.append(stepText, progress, h('div', { class: 'wz-layout' }, h('div', { class: 'wz-main' }, card, error), summary), nav);

  function go(n, skipping = false) {
    if (n < 1 || n > STEPS) return;
    if (n > ctx.step && !skipping && !valid(ctx.step)) {
      error.textContent = t('wizard.need');
      error.hidden = false;
      return;
    }
    ctx.step = n;
    ctx.reached = Math.max(ctx.reached, n);
    if (!ctx.started) { ctx.started = true; track('wizard_start'); }
    track('wizard_step', { step: n });
    if (n === STEPS && !ctx.completed) { ctx.completed = true; track('wizard_complete', { mode: ctx.profile.quick ? 'quick' : 'detailed' }); }
    renderStep(true);
    window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  ctx.go = go;

  function valid(step) {
    if (step !== 1) return true;
    const p = ctx.profile;
    return p.unknown.interests || p.interests.cards.length > 0 || p.interests.text.trim() !== '';
  }

  // ---- progress dots, nav state ----
  function renderProgress() {
    const names = t('wizard.stepNames');
    progress.replaceChildren(h('ol', {}, names.map((name, i) => {
      const n = i + 1;
      const cls = n < ctx.step ? 'done' : n === ctx.step ? 'cur' : '';
      const b = h('button', {
        type: 'button', class: cls, disabled: n > ctx.reached || n === ctx.step, 'aria-label': `${t('wizard.stepOf', { n, total: STEPS })}: ${name}`,
        'aria-current': n === ctx.step ? 'step' : null, onclick: () => go(n, true),
      }, n < ctx.step ? icon('check') : String(n));
      return h('li', {}, b);
    })));
    stepText.textContent = `${t('wizard.stepOf', { n: ctx.step, total: STEPS })} · ${names[ctx.step - 1]}`;
  }
  function renderNav() {
    back.style.visibility = ctx.step === 1 ? 'hidden' : 'visible';
    skip.hidden = ctx.step >= STEPS;
    next.hidden = ctx.step >= STEPS;
    nav.classList.toggle('wz-nav-end', ctx.step >= STEPS);
    error.hidden = true;
  }

  // ---- summary ----
  function updateSummary() {
    const p = ctx.profile, c = p.conditions;
    const list = (title, items) => items.length ? h('div', { class: 'wz-sum-block' }, h('h3', { text: title }), h('div', { class: 'wz-sum-chips' }, items.map((x) => h('span', { class: 'badge badge-info', text: x })))) : null;
    const lv = t('wizard.levels');
    const opt = (f, v) => (v ? t(`opt.${f}.${v}`) : '');
    const facts = [
      p.person.age && `${p.person.age}`, p.person.location, c.balance && `${t('s4.balance')}: ${c.balance}/5`,
      opt('study', c.study), opt('risk', c.risk), opt('mode', c.mode),
    ].filter(Boolean);
    const blocks = [
      list(t('wizard.stepNames')[0], [...p.interests.cards.map((id) => labels.interests[id] || id), ...(p.interests.text ? [p.interests.text.slice(0, 40)] : [])]),
      list(t('wizard.stepNames')[1], p.skills.cards.map((x) => `${labels.skills[x.id] || x.id} · ${lv[x.level]}`)),
      list(t('wizard.stepNames')[2], facts),
    ].filter(Boolean);
    summary.replaceChildren(h('h2', { text: t('wizard.summary') }), h('p', { class: 'small muted', text: t('wizard.summaryNote') }),
      ...(blocks.length ? blocks : [h('p', { class: 'small muted', text: t('wizard.summaryEmpty') })]));
    summary.hidden = ctx.step === STEPS;
  }

  // ---- reusable controls (each registers a sync() so presets and resets can refresh them) ----
  const reg = (fn) => { ctx.syncs.push(fn); fn(); };
  let uid = 0;
  const nextId = (p) => `${p}-${++uid}`;

  function textField({ path, label, placeholder, max = S.MAX_TEXT, multiline = false, type = 'text', hint, quick = true, full = false }) {
    const id = nextId('f');
    const input = multiline ? h('textarea', { id, rows: 3, maxlength: max, placeholder }) : h('input', { id, class: 'input', type, maxlength: max, placeholder, autocomplete: 'off' });
    const counter = multiline ? h('span', { class: 'counter', 'aria-live': 'off' }) : null;
    input.addEventListener('input', () => { set(path, input.value); if (counter) counter.textContent = t('wizard.counter', { n: input.value.length, max }); });
    reg(() => { input.value = get(path) || ''; if (counter) counter.textContent = t('wizard.counter', { n: input.value.length, max }); });
    return h('div', { class: `field${full ? ' full-only' : ''}` }, h('label', { for: id, text: label }), input, hint && h('small', { text: hint }), counter);
  }

  // Radio cards with icons; clicking the selected one again clears it (so "not specified" stays possible).
  function choice({ path, field, legend, hint, full = false, wide = false }) {
    const name = nextId('c');
    const inputs = [];
    const items = CHOICES[field].map(([value, ic]) => {
      const input = h('input', { type: 'radio', name, value });
      input.addEventListener('click', () => {
        if (get(path) === value) { input.checked = false; set(path, ''); } else set(path, value);
      });
      inputs.push(input);
      return h('label', { class: 'opt' }, input, h('span', { class: 'opt-body' }, icon(ic), h('span', { text: t(`opt.${field}.${value}`) })));
    });
    reg(() => inputs.forEach((i) => { i.checked = get(path) === i.value; }));
    return h('fieldset', { class: `opts${full ? ' full-only' : ''}${wide ? ' wide' : ''}` }, h('legend', { text: legend }), hint && h('p', { class: 'small muted', text: hint }), h('div', { class: 'opts-grid' }, items));
  }

  // 1..5 buttons with labelled ends (balance, AI protection).
  function ladder({ path, legend, lo, hi, quickOk = false }) {
    const name = nextId('l');
    const inputs = [1, 2, 3, 4, 5].map((n) => {
      const input = h('input', { type: 'radio', name, value: String(n) });
      input.addEventListener('click', () => { if (get(path) === n) { input.checked = false; set(path, 0); } else set(path, n); });
      return input;
    });
    reg(() => inputs.forEach((i) => { i.checked = get(path) === Number(i.value); }));
    return h('fieldset', { class: `ladder${quickOk ? '' : ' full-only'}` }, h('legend', { text: legend }),
      h('div', { class: 'ladder-row' }, inputs.map((i) => h('label', { class: 'lad' }, i, h('span', { text: i.value })))),
      h('div', { class: 'ladder-ends' }, h('span', { text: lo }), h('span', { text: hi })));
  }

  function unknownBlock(step) {
    const key = UNKNOWN_KEY[step];
    const btn = h('button', { type: 'button', class: 'btn btn-ghost unk', 'aria-pressed': 'false' }, icon('help'), t('wizard.unknown'));
    const note = h('p', { class: 'small unk-note', hidden: true, text: t('wizard.unknownOn') });
    btn.addEventListener('click', () => { set(`unknown.${key}`, !ctx.profile.unknown[key]); sync(); });
    const sync = () => { const on = ctx.profile.unknown[key]; btn.setAttribute('aria-pressed', String(on)); note.hidden = !on; };
    reg(sync);
    return h('div', { class: 'unk-box' }, btn, note);
  }

  function groupsOf(data, { openCount = 2, build }) {
    return data.groups.map((g, i) => {
      const count = h('span', { class: 'badge', hidden: true });
      const det = h('details', { class: 'grp', open: i < openCount }, h('summary', {}, g.emoji ? h('span', { class: 'em', 'aria-hidden': 'true', text: g.emoji }) : null, h('span', { text: g.label }), count), h('div', { class: 'grp-body' }, g.cards.map(build)));
      det._count = count; det._group = g;
      return det;
    });
  }
  const refreshCounts = (dets, selectedIds) => dets.forEach((d) => {
    const n = d._group.cards.filter((c) => selectedIds().includes(c.id)).length;
    d._count.hidden = n === 0;
    d._count.textContent = String(n);
    if (n > 0) d.open = true;
  });

  // ---- steps ----
  function head(title, lead) { return [h('h2', { id: 'wz-title', tabindex: '-1', text: title }), h('p', { class: 'muted', text: lead })]; }

  function stepModeToggle() {
    const name = nextId('m');
    const mk = (quick, ic, label, hint) => {
      const input = h('input', { type: 'radio', name, value: String(quick) });
      input.addEventListener('change', () => { set('quick', quick); root.dataset.quick = quick ? '1' : ''; });
      return h('label', { class: 'opt' }, input, h('span', { class: 'opt-body' }, icon(ic), h('span', {}, h('b', { text: label }), h('small', { text: hint }))));
    };
    const q = mk(true, 'bolt', t('wizard.quick'), t('wizard.quickHint')), f = mk(false, 'edit', t('wizard.full'), t('wizard.fullHint'));
    reg(() => { q.querySelector('input').checked = ctx.profile.quick; f.querySelector('input').checked = !ctx.profile.quick; });
    return h('fieldset', { class: 'opts wide' }, h('legend', { text: t('wizard.modeLabel') }), h('div', { class: 'opts-grid' }, q, f));
  }

  function step1() {
    const dets = groupsOf(ctx.interests, {
      openCount: 2,
      build: (c) => {
        const input = h('input', { type: 'checkbox', value: c.id });
        input.addEventListener('change', () => {
          const cards = new Set(ctx.profile.interests.cards);
          input.checked ? cards.add(c.id) : cards.delete(c.id);
          ctx.profile.interests.cards = [...cards];
          if (input.checked) ctx.profile.unknown.interests = false;
          changed(); syncAll(); refreshCounts(dets, () => ctx.profile.interests.cards);
        });
        reg(() => { input.checked = ctx.profile.interests.cards.includes(c.id); });
        return h('label', { class: 'tile' }, input, h('span', { class: 'tile-body' }, h('span', { class: 'em', 'aria-hidden': 'true', text: c.emoji }), h('b', { text: c.label }), h('small', { text: c.hint }), icon('check', 'icon tile-check')));
      },
    });
    reg(() => refreshCounts(dets, () => ctx.profile.interests.cards));
    return [...head(t('s1.title'), t('s1.lead')), stepModeToggle(),
      textField({ path: 'interests.text', label: t('s1.free'), placeholder: t('s1.freePh'), multiline: true }),
      h('div', { class: 'groups', role: 'group', 'aria-label': t('s1.groups') }, dets), unknownBlock(1)];
  }

  function step2() {
    const dets = groupsOf(ctx.skills, {
      openCount: 2,
      build: (c) => {
        const input = h('input', { type: 'checkbox', value: c.id });
        const lname = nextId('lv');
        const radios = [1, 2, 3].map((n) => {
          const r = h('input', { type: 'radio', name: lname, value: String(n) });
          r.addEventListener('change', () => { const s = ctx.profile.skills.cards.find((x) => x.id === c.id); if (s) { s.level = n; changed(); } });
          return h('label', {}, r, h('span', { text: t('wizard.levels')[n] }));
        });
        const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('wizard.levelFor', { name: c.label }), hidden: true }, radios);
        input.addEventListener('change', () => {
          const cards = ctx.profile.skills.cards.filter((x) => x.id !== c.id);
          if (input.checked) { cards.push({ id: c.id, level: 2 }); ctx.profile.unknown.skills = false; }
          ctx.profile.skills.cards = cards;
          changed(); syncAll(); refreshCounts(dets, () => ctx.profile.skills.cards.map((x) => x.id));
        });
        reg(() => {
          const s = ctx.profile.skills.cards.find((x) => x.id === c.id);
          input.checked = !!s; seg.hidden = !s;
          radios.forEach((l) => { l.firstChild.checked = !!s && Number(l.firstChild.value) === s.level; });
        });
        return h('div', { class: 'skill' }, h('label', { class: 'chip' }, input, h('span', { class: 'chip-body' }, icon('check', 'icon chip-check'), h('span', { text: c.label }))), seg);
      },
    });
    reg(() => refreshCounts(dets, () => ctx.profile.skills.cards.map((x) => x.id)));
    const langRow = (code, label) => {
      const sel = h('select', { class: 'input', 'aria-label': label }, [h('option', { value: '0', text: t('wizard.notSet') }), ...t('s2.langLevels').slice(1).map((l, i) => h('option', { value: String(i + 1), text: l }))]);
      const name = code === 'other' ? h('input', { class: 'input', type: 'text', maxlength: '60', placeholder: t('s2.langOtherPh'), 'aria-label': t('s2.langOther') }) : null;
      const write = () => {
        const rest = ctx.profile.languages.filter((l) => l.code !== code);
        const lvl = Number(sel.value);
        if (lvl) rest.push({ code, level: lvl, name: name ? name.value : '' });
        ctx.profile.languages = rest; changed();
      };
      sel.addEventListener('change', write); if (name) name.addEventListener('input', write);
      reg(() => { const l = ctx.profile.languages.find((x) => x.code === code); sel.value = l ? String(l.level) : '0'; if (name) name.value = l ? l.name : ''; });
      return h('div', { class: 'lang-row' }, h('span', { text: label }), name, sel);
    };
    return [...head(t('s2.title'), t('s2.lead')), h('div', { class: 'groups' }, dets),
      textField({ path: 'skills.text', label: t('s2.free'), placeholder: t('s2.freePh'), multiline: true }),
      h('fieldset', { class: 'full-only langs' }, h('legend', { text: t('s2.languages') }), langRow('uk', t('s2.langUk')), langRow('en', t('s2.langEn')), langRow('other', t('s2.langOther'))),
      textField({ path: 'education', label: t('s2.education'), placeholder: t('s2.educationPh'), full: true }),
      textField({ path: 'experience', label: t('s2.experience'), placeholder: t('s2.experiencePh'), multiline: true, full: true }), unknownBlock(2)];
  }

  function step3() {
    return [...head(t('s3.title'), t('s3.lead')),
      choice({ path: 'person.gender', field: 'gender', legend: t('s3.gender'), hint: t('s3.genderWhy'), full: true }),
      h('div', { class: 'grid-2' },
        textField({ path: 'person.age', label: t('s3.age'), placeholder: t('s3.agePh'), max: 20 }),
        textField({ path: 'person.location', label: t('s3.location'), placeholder: t('s3.locationPh'), max: 120 })),
      choice({ path: 'person.relocate', field: 'relocate', legend: t('s3.relocate'), full: true }),
      choice({ path: 'person.remote', field: 'remote', legend: t('s3.remote'), full: true }),
      choice({ path: 'person.military', field: 'military', legend: t('s3.military'), hint: t('s3.militaryWhy'), full: true }), unknownBlock(3)];
  }

  function step4() {
    const presetBtns = ctx.presets.presets.map((pr) => h('button', {
      type: 'button', class: 'btn', onclick: () => {
        const c = ctx.profile.conditions;
        for (const [k, v] of Object.entries(pr.set)) { if (k === 'income') Object.assign(c.income, v); else c[k] = v; }
        changed(); syncAll();
      },
    }, icon(pr.icon), pr.label));
    const income = h('fieldset', { class: 'income full-only' }, h('legend', { text: t('s4.income') }),
      h('div', { class: 'grid-2' },
        textField({ path: 'conditions.income.min', label: t('s4.incomeMin'), placeholder: t('s4.incomePh'), max: 80 }),
        textField({ path: 'conditions.income.target', label: t('s4.incomeTarget'), placeholder: t('s4.incomePh'), max: 80 })),
      horizonChips());
    return [...head(t('s4.title'), t('s4.lead')),
      h('div', { class: 'presets full-only' }, h('p', { class: 'small muted', text: t('s4.presets') }), h('div', { class: 'preset-row' }, presetBtns)),
      h('p', { class: 'quick-only small muted', text: t('wizard.quickNote') }),
      ladder({ path: 'conditions.balance', legend: t('s4.balance'), lo: t('s4.balanceLow'), hi: t('s4.balanceHigh'), quickOk: true }),
      choice({ path: 'conditions.study', field: 'study', legend: t('s4.study'), full: true }),
      choice({ path: 'conditions.risk', field: 'risk', legend: t('s4.risk'), full: true }),
      choice({ path: 'conditions.stress', field: 'stress', legend: t('s4.stress'), full: true }),
      choice({ path: 'conditions.mode', field: 'mode', legend: t('s4.mode'), full: true }),
      choice({ path: 'conditions.team', field: 'team', legend: t('s4.team'), full: true }),
      choice({ path: 'conditions.schedule', field: 'schedule', legend: t('s4.schedule'), full: true }),
      choice({ path: 'conditions.workType', field: 'workType', legend: t('s4.workType'), full: true }),
      choice({ path: 'conditions.publicity', field: 'publicity', legend: t('s4.publicity'), full: true }),
      income,
      choice({ path: 'conditions.capital', field: 'capital', legend: t('s4.capital'), full: true }),
      choice({ path: 'conditions.blogging', field: 'blogging', legend: t('s4.blogging'), full: true }),
      ladder({ path: 'conditions.aiPriority', legend: t('s4.aiPriority'), lo: t('s4.aiLow'), hi: t('s4.aiHigh') }),
      textField({ path: 'extra', label: t('s4.extra'), placeholder: t('s4.extraPh'), multiline: true, full: true }), unknownBlock(4)];
  }

  function horizonChips() {
    const name = nextId('hz');
    const inputs = [3, 6, 12, 24].map((n) => {
      const i = h('input', { type: 'radio', name, value: String(n) });
      i.addEventListener('click', () => { if (get('conditions.income.horizonMonths') === n) { i.checked = false; set('conditions.income.horizonMonths', ''); } else set('conditions.income.horizonMonths', n); });
      return i;
    });
    reg(() => inputs.forEach((i) => { i.checked = get('conditions.income.horizonMonths') === Number(i.value); }));
    return h('fieldset', { class: 'opts wide' }, h('legend', { text: t('s4.horizon') }),
      h('div', { class: 'opts-grid' }, inputs.map((i) => h('label', { class: 'opt' }, i, h('span', { class: 'opt-body' }, icon('clock'), h('span', { text: t('s4.horizonUnit', { n: i.value }) }))))));
  }

  const syncAll = () => ctx.syncs.forEach((fn) => fn());
  ctx.syncAll = syncAll;

  function renderStep(focus) {
    ctx.syncs = [];
    ctx.syncs.length = 0;
    root.dataset.quick = ctx.profile.quick ? '1' : '';
    root.dataset.step = String(ctx.step);
    const body = ctx.step === 1 ? step1() : ctx.step === 2 ? step2() : ctx.step === 3 ? step3() : ctx.step === 4 ? step4() : renderResult(ctx, { h, icon, t, go });
    card.replaceChildren(...body);
    renderProgress(); renderNav(); updateSummary();
    if (focus) document.getElementById('wz-title')?.focus({ preventScroll: true });
  }
  renderStep(false);
}
