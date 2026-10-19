// Google Analytics 4, loaded only after explicit consent. Before that nothing is requested and no globals exist.
// Only anonymous events with a fixed parameter whitelist are sent: never form answers, prompt text or the #hash.
const EVENTS = {
  wizard_start: [], wizard_step: ['step'], wizard_complete: ['mode'], prompt_copy: ['kind'],
  service_open: ['service'], theme_change: ['theme'], consent_change: ['value'],
};
const ENUM = { mode: ['quick', 'detailed'], kind: ['full', 'short'], service: ['claude', 'chatgpt', 'gemini', 'perplexity'], theme: ['light', 'dark'], value: ['granted'] };

export const pageLocation = (href) => { const u = new URL(href); u.hash = ''; return u.href; };

// Returns the sanitized { name, params } or null for anything outside the whitelist.
export function sanitize(name, params = {}) {
  const allowed = EVENTS[name];
  if (!allowed) return null;
  const out = {};
  for (const k of allowed) {
    const v = params[k];
    if (k === 'step') { if (Number.isInteger(v) && v >= 1 && v <= 5) out.step = v; else return null; }
    else if (ENUM[k] && ENUM[k].includes(v)) out[k] = v;
    else return null;
  }
  return { name, params: out };
}

let id = '';
let on = false;

export function isOn() { return on; }

export function enable(measurementId) {
  if (on || !/^G-[A-Z0-9]{4,}$/.test(measurementId || '')) return false;
  id = measurementId;
  on = true;
  window['ga-disable-' + id] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  // Consent Mode v2: everything denied, then only analytics storage granted (there are no ads).
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', id, { page_location: pageLocation(location.href), allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
  return true;
}

export function track(name, params) {
  if (!on) return;
  const e = sanitize(name, params);
  if (!e) return;
  e.params.page_location = pageLocation(location.href);
  window.gtag('event', e.name, e.params);
}

// Withdraw: stop sending, deny storage and delete the _ga* cookies on every host variant.
export function revoke() {
  if (id) window['ga-disable-' + id] = true;
  if (on && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
  on = false;
  const host = location.hostname.split('.');
  const domains = ['', ...host.map((_, i) => '; domain=' + host.slice(i).join('.')), ...host.map((_, i) => '; domain=.' + host.slice(i).join('.'))];
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
  }
}
