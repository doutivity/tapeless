// Step 5: editable prompt, answer modes, AI-service buttons, sharing, opt-in persistence.
import { t } from './i18n.js';
import { h, icon } from './dom.js';
import * as S from './state.js';
import { buildPrompt } from './prompt.js';
import { resolveService, copyText } from './services.js';
import { MODE_CARDS, CLARIFY_CARDS } from './schema.js';
import { track } from './analytics.js';

export function renderResult(ctx) {
  const { profile } = ctx;
  const maxEnc = ctx.services.maxEncoded;
  let gen = null;
  let dirty = false;

  const ta = h('textarea', { id: 'prompt-text', rows: 14, spellcheck: 'false' });
  const counter = h('span', { class: 'counter', 'aria-live': 'off' });
  const toast = h('p', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  const say = (msg) => { toast.textContent = msg; clearTimeout(say.t); say.t = setTimeout(() => { toast.textContent = ''; }, 6000); };
  const count = () => { counter.textContent = t('s5.chars', { n: ta.value.length.toLocaleString('uk-UA') }); };

  function regen(keepEdits = false) {
    gen = buildPrompt(profile, { cards: ctx.labels, maxShortEncoded: maxEnc });
    if (!(keepEdits && dirty)) { ta.value = gen.full; dirty = false; }
    count(); updateLinks();
  }
  ta.addEventListener('input', () => { dirty = true; count(); updateLinks(); });

  // ---- mode cards (radio cards with icons) ----
  const radios = (name, cards, path, keyPrefix, onPick) => cards.map(([value, ic]) => {
    const input = h('input', { type: 'radio', name, value });
    input.addEventListener('change', () => { ctx.set(path, value); onPick && onPick(); regen(); });
    ctx.syncs.push(() => { input.checked = ctx.get(path) === value; });
    return h('label', { class: 'opt' }, input, h('span', { class: 'opt-body' }, icon(ic), h('span', {}, h('b', { text: t(`s5.${value}`) }), h('small', { text: t(`s5.${value}Hint`) }))));
  });

  const profField = (id, path, label, ph) => {
    const input = h('input', { id, class: 'input', type: 'text', maxlength: '240', placeholder: ph });
    input.addEventListener('input', () => { ctx.set(path, input.value); regen(); });
    ctx.syncs.push(() => { input.value = ctx.get(path) || ''; });
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), input);
  };
  const deepField = profField('prof-1', 'profession', t('s5.profession'), t('s5.professionPh'));
  const cmpField = profField('prof-n', 'professions', t('s5.professions'), t('s5.professionsPh'));
  const showFields = () => { deepField.hidden = profile.mode !== 'deep_dive'; cmpField.hidden = profile.mode !== 'compare'; };
  ctx.syncs.push(showFields);

  // ---- services ----
  const links = ctx.services.services.map((s) => {
    const hint = h('small');
    const a = h('a', { class: 'svc', target: '_blank', rel: 'noopener noreferrer', href: s.url.replace(/[?&]?[a-z]+=\{q\}$/, '') }, h('span', { class: 'svc-name' }, h('b', { text: t('s5.openIn', { name: s.name }) }), hint), icon('external'));
    a._s = s; a._hint = hint;
    // The prefilled URL (it contains the prompt) never sits in href: analytics' automatic outbound-click tracking
    // would read it. href stays the bare service address; the click handler opens the real URL itself.
    const open = (e) => {
      e.preventDefault();
      const r = update(a);
      copyText(ta.value).then((ok) => say(ok ? t(r.mode === 'short' ? 's5.toastShort' : r.mode === 'full' && s.prefill !== 'unverified' ? 's5.toastFull' : 's5.toastPaste', { name: s.name }) : t('common.copyFailed')));
      track('service_open', { service: s.id });
      window.open(r.href, '_blank', 'noopener,noreferrer');
    };
    a.addEventListener('click', open);
    a.addEventListener('auxclick', (e) => { if (e.button === 1) open(e); });
    return a;
  });
  function update(a) {
    const r = resolveService(a._s, ta.value, gen ? gen.short : ta.value, maxEnc);
    a.dataset.url = r.href;
    a._hint.textContent = r.mode === 'full' ? (a._s.prefill === 'unverified' ? t('s5.hintPaste') : t('s5.hintFull')) : r.mode === 'short' ? t('s5.hintShort') : t('s5.hintPaste');
    return r;
  }
  function updateLinks() { links.forEach(update); }

  // ---- copy / reset / share / remember / erase ----
  const copyBtn = (label, ic, getText, kind, doneKey) => h('button', {
    type: 'button', class: kind === 'full' ? 'btn btn-primary' : 'btn', onclick: async () => {
      const ok = await copyText(getText());
      say(ok ? t(doneKey) : t('common.copyFailed'));
      if (ok) track('prompt_copy', { kind });
    },
  }, icon(ic), label);

  const reset = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { regen(); say(t('s5.resetDone')); } }, icon('refresh'), t('s5.reset'));
  const share = h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
    const url = `${location.origin}${location.pathname}#${S.encodeHash(profile)}`;
    say((await copyText(url)) ? t('s5.shareDone') : t('common.copyFailed'));
  } }, icon('share'), t('s5.share'));
  const edit = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => ctx.go(1, true) }, icon('edit'), t('s5.edit'));

  const rememberBox = h('input', { type: 'checkbox', id: 'remember' });
  rememberBox.checked = ctx.remember;
  rememberBox.addEventListener('change', () => {
    ctx.remember = rememberBox.checked;
    rememberBox.checked ? S.save(profile) : S.wipe();
  });
  const erase = h('button', { type: 'button', class: 'btn btn-ghost btn-danger-quiet', onclick: () => {
    if (!confirm(t('s5.eraseConfirm'))) return;
    S.wipe();
    Object.assign(profile, S.createProfile());
    ctx.remember = false;
    history.replaceState(null, '', location.pathname + location.search);
    ctx.reached = 1; ctx.completed = false;
    ctx.go(1, true);
    document.getElementById('toast-root')?.replaceChildren();
  } }, icon('trash'), t('s5.erase'));

  const after = h('section', { class: 'after' }, h('h3', { text: t('s5.afterTitle') }), h('p', { class: 'small muted', text: t('s5.afterLead') }),
    h('div', { class: 'chips' }, t('s5.after').map((q) => h('button', { type: 'button', class: 'chip-btn', onclick: async () => { say((await copyText(q)) ? t('s5.afterCopied') : t('common.copyFailed')); } }, icon('copy'), q))));

  const nodes = [
    h('h2', { id: 'wz-title', tabindex: '-1', text: t('s5.title') }), h('p', { class: 'muted', text: t('s5.lead') }),
    h('fieldset', { class: 'opts wide' }, h('legend', { text: t('s5.answerMode') }), h('div', { class: 'opts-grid' }, radios('rm', MODE_CARDS, 'mode', 'mode', showFields))),
    deepField, cmpField,
    h('fieldset', { class: 'opts wide' }, h('legend', { text: t('s5.clarify') }), h('div', { class: 'opts-grid' }, radios('rc', CLARIFY_CARDS, 'clarify', 'clarify'))),
    h('p', { class: 'small muted', text: t('s5.changeNote') }),
    h('div', { class: 'tape-frame' }, h('div', { class: 'inner' },
      h('div', { class: 'prompt-head' }, h('label', { for: 'prompt-text', text: t('s5.promptLabel') }), counter), ta,
      h('div', { class: 'actions' }, copyBtn(t('s5.copyFull'), 'copy', () => ta.value, 'full', 's5.copiedFull'), copyBtn(t('s5.copyShort'), 'copy', () => gen.short, 'short', 's5.copiedShort'), reset))),
    h('h3', { text: t('s5.open') }), h('div', { class: 'svc-list' }, links),
    toast,
    h('p', { class: 'warn-note' }, icon('info'), t('s5.warning')),
    after,
    h('div', { class: 'actions result-tools' }, share, edit),
    h('div', { class: 'remember' }, h('label', { class: 'check', for: 'remember' }, rememberBox, h('span', {}, h('b', { text: t('s5.remember') }), h('small', { text: t('s5.rememberHint') }))), erase),
  ];
  ctx.syncs.forEach((f) => f());
  regen();
  return nodes;
}
