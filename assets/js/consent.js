// Consent banner for analytics. Shown only when a measurementId is configured. Three equal buttons, nothing preselected.
import { enable, revoke, track } from './analytics.js';
import { t, loadStrings } from './i18n.js';

export const KEY = 'tapeless:consent';
const YEAR_MS = 365 * 24 * 3600 * 1000;

// Pure: should we ask (again)? stored = parsed JSON or null.
export function mustAsk(stored, now, version) {
  if (!stored || (stored.value !== 'granted' && stored.value !== 'denied')) return true;
  if (stored.v !== version) return true;
  const at = Date.parse(stored.at);
  return !Number.isFinite(at) || now - at > YEAR_MS;
}

const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(value, version) { try { localStorage.setItem(KEY, JSON.stringify({ value, at: new Date().toISOString(), v: version })); } catch { /* blocked */ } },
};

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? (n.textContent = v) : n.setAttribute(k, v);
  n.append(...kids);
  return n;
};

export async function initConsent() {
  const meta = document.querySelector('meta[name="tapeless:ga4"]');
  if (!meta) return;
  const gaId = meta.content;
  const version = Number(document.querySelector('meta[name="tapeless:consent-version"]')?.content) || 1;
  await loadStrings();
  const saved = store.get();
  const ask = mustAsk(saved, Date.now(), version);
  if (!ask && saved.value === 'granted') enable(gaId);

  const apply = (value) => {
    store.set(value, version);
    if (value === 'granted') { if (enable(gaId)) track('consent_change', { value: 'granted' }); } else revoke();
  };

  for (const link of document.querySelectorAll('[data-consent-open]')) link.addEventListener('click', (e) => { e.preventDefault(); open(true); });
  if (ask) open(false);

  function open(settings) {
    document.getElementById('consent')?.remove();
    const current = store.get();
    const on = !!current && current.value === 'granted' && !mustAsk(current, Date.now(), version);
    const box = el('section', { id: 'consent', class: 'consent', role: 'dialog', 'aria-labelledby': 'consent-t', 'aria-describedby': 'consent-d', tabindex: '-1' });
    const close = () => box.remove();
    const btn = (label, value) => {
      const b = el('button', { type: 'button', class: 'btn', text: label });
      b.addEventListener('click', () => { apply(value); close(); });
      return b;
    };
    box.append(el('h2', { id: 'consent-t', text: t('consent.title') }), el('p', { id: 'consent-d', text: t('consent.text') }));
    const privacy = document.querySelector('a[data-privacy]');
    if (privacy) box.append(el('p', { class: 'small' }, el('a', { href: privacy.getAttribute('href'), text: t('consent.more') })));
    const actions = el('div', { class: 'consent-actions' });
    if (!settings) {
      const set = el('button', { type: 'button', class: 'btn', text: t('consent.settings') });
      set.addEventListener('click', () => open(true));
      actions.append(btn(t('consent.reject'), 'denied'), set, btn(t('consent.accept'), 'granted'));
    } else {
      const sw = el('input', { type: 'checkbox', role: 'switch', id: 'consent-sw' });
      sw.checked = on;
      const row = el('label', { class: 'consent-row', for: 'consent-sw' }, sw, el('span', {}, el('b', { text: t('consent.toggle') }), el('small', { text: t('consent.toggleHint') })));
      const save = el('button', { type: 'button', class: 'btn', text: t('consent.save') });
      save.addEventListener('click', () => { apply(sw.checked ? 'granted' : 'denied'); close(); });
      box.append(row);
      actions.append(btn(t('consent.reject'), 'denied'), save, btn(t('consent.accept'), 'granted'));
    }
    box.append(actions);
    document.body.append(box);
    box.focus({ preventScroll: true });
  }
}
