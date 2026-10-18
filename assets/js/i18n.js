// UI strings live in i18n/uk.json (structure ready for en.json). Paths are resolved from this module.
let dict = {};
const root = (name) => new URL(`../../${name}`, import.meta.url);

export async function loadJson(path) {
  const res = await fetch(root(path));
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}
export async function loadStrings(lang = 'uk') { dict = await loadJson(`i18n/${lang}.json`); return dict; }

// t('wizard.stepOf', { n: 2, total: 5 }); arrays/objects come back as-is.
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
  if (v == null) return path;
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return v;
}
export const asset = (name) => root(`assets/${name}`).href;
