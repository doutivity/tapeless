// AI-service links. Schemes live in data/services.json; the full prompt is always copied first.
// resolveService() is pure; copyText() touches the DOM only when called.

// -> { href, mode: 'full' | 'short' | 'paste' }
//   full  : the whole prompt fits into the URL
//   short : the URL carries the short version, the person pastes the full one
//   paste : nothing is prefilled (no official parameter, or even the short version is too long)
export function resolveService(service, full, short, defaultMax = 7500) {
  const base = service.url.replace(/[?&]?[a-z]+=\{q\}$/, '');
  if (service.prefill === 'none' || !service.url.includes('{q}')) return { href: base, mode: 'paste' };
  const max = service.maxEncoded || defaultMax;
  const build = (text) => service.url.replace('{q}', encodeURIComponent(text));
  const f = build(full);
  if (f.length <= max) return { href: f, mode: 'full' };
  const s = build(short);
  if (s.length <= max) return { href: s, mode: 'short' };
  return { href: base, mode: 'paste' };
}

// Clipboard API first, then the selection fallback for old browsers or insecure contexts.
export async function copyText(text, doc = document) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  doc.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = doc.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
