// Profile model, URL-hash sharing and opt-in persistence. No DOM access at import time.
export const SCHEMA_VERSION = 1;
export const MAX_TEXT = 500;
export const STORE_KEY = 'tapeless:profile';

const ENUMS = {
  gender: ['male', 'female', 'other', 'unspecified'],
  relocate: ['no', 'ukraine', 'abroad'],
  remote: ['yes', 'no', 'either'],
  military: ['liable', 'not-liable', 'unspecified'],
  study: ['none', 'short', 'degree', 'any'],
  risk: ['safe', 'moderate', 'acceptable'],
  stress: ['low', 'medium', 'high'],
  mode: ['office', 'remote', 'field', 'mixed'],
  team: ['team', 'solo', 'either'],
  schedule: ['stable', 'shift', 'either'],
  workType: ['mental', 'physical', 'mixed'],
  publicity: ['yes', 'no', 'maybe'],
  blogging: ['yes', 'no', 'curious'],
  capital: ['none', 'small', 'medium', 'large'],
};
export const MODES = ['explore', 'deep_dive', 'compare'];
export const CLARIFY = ['ask_first', 'assume'];
export const LANG_CODES = ['uk', 'en', 'other'];

export function createProfile() {
  return {
    v: SCHEMA_VERSION,
    interests: { text: '', cards: [] },
    skills: { text: '', cards: [] },
    languages: [],
    education: '',
    experience: '',
    person: { gender: 'unspecified', age: '', location: '', relocate: '', remote: '', military: 'unspecified' },
    conditions: {
      balance: 0, study: '', risk: '', stress: '', mode: '', team: '', schedule: '', workType: '', publicity: '',
      income: { min: '', target: '', horizonMonths: '' }, capital: '', blogging: '', aiPriority: 0,
    },
    extra: '',
    profession: '',
    professions: '',
    mode: 'explore',
    clarify: 'ask_first',
    unknown: { interests: false, skills: false, person: false, conditions: false },
    quick: false,
  };
}

const str = (x, max = MAX_TEXT) => (typeof x === 'string' ? x.slice(0, max) : '');
const pick = (x, list, dflt = '') => (list.includes(x) ? x : dflt);
const int = (x, lo, hi) => (Number.isInteger(x) && x >= lo && x <= hi ? x : 0);
const ids = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 80) : []);

// Accepts anything (hash, localStorage, tests) and returns a complete, safe profile.
export function normalize(raw) {
  const p = createProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw, i = r.interests || {}, s = r.skills || {}, pe = r.person || {}, c = r.conditions || {}, inc = c.income || {}, u = r.unknown || {};
  p.interests = { text: str(i.text), cards: [...new Set(ids(i.cards))] };
  const seen = new Set();
  p.skills = {
    text: str(s.text),
    cards: (Array.isArray(s.cards) ? s.cards : []).flatMap((x) => {
      const id = x && ids([x.id])[0];
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ id, level: int(x.level, 1, 3) || 2 }];
    }).slice(0, 80),
  };
  p.languages = (Array.isArray(r.languages) ? r.languages : []).flatMap((l) => {
    if (!l || !LANG_CODES.includes(l.code)) return [];
    return [{ code: l.code, level: int(l.level, 1, 4) || 1, name: l.code === 'other' ? str(l.name, 60) : '' }];
  }).slice(0, 6);
  p.education = str(r.education);
  p.experience = str(r.experience);
  p.person = {
    gender: pick(pe.gender, ENUMS.gender, 'unspecified'), age: str(pe.age, 20), location: str(pe.location, 120),
    relocate: pick(pe.relocate, ENUMS.relocate), remote: pick(pe.remote, ENUMS.remote), military: pick(pe.military, ENUMS.military, 'unspecified'),
  };
  p.conditions = {
    balance: int(c.balance, 1, 5), study: pick(c.study, ENUMS.study), risk: pick(c.risk, ENUMS.risk), stress: pick(c.stress, ENUMS.stress),
    mode: pick(c.mode, ENUMS.mode), team: pick(c.team, ENUMS.team), schedule: pick(c.schedule, ENUMS.schedule),
    workType: pick(c.workType, ENUMS.workType), publicity: pick(c.publicity, ENUMS.publicity),
    income: { min: str(inc.min, 80), target: str(inc.target, 80), horizonMonths: int(Number(inc.horizonMonths), 1, 120) || '' },
    capital: pick(c.capital, ENUMS.capital), blogging: pick(c.blogging, ENUMS.blogging), aiPriority: int(c.aiPriority, 1, 5),
  };
  p.extra = str(r.extra);
  p.profession = str(r.profession, 120);
  p.professions = str(r.professions, 240);
  p.mode = pick(r.mode, MODES, 'explore');
  p.clarify = pick(r.clarify, CLARIFY, 'ask_first');
  p.unknown = { interests: u.interests === true, skills: u.skills === true, person: u.person === true, conditions: u.conditions === true };
  p.quick = r.quick === true;
  return p;
}

// ---- #hash sharing: base64url(JSON), schema version inside ----
const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

export function encodeHash(profile) {
  return 'p=' + b64.enc(JSON.stringify(normalize(profile)));
}

// Returns a normalized profile or null (bad/foreign hash). Never throws.
export function decodeHash(hash) {
  try {
    const m = /^#?p=([A-Za-z0-9_-]+)$/.exec(hash || '');
    if (!m || m[1].length > 20000) return null;
    const obj = JSON.parse(b64.dec(m[1]));
    if (!obj || obj.v !== SCHEMA_VERSION) return null;
    return normalize(obj);
  } catch { return null; }
}

// ---- opt-in persistence (localStorage is empty until the person turns this on) ----
const safeStore = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export const loadSaved = () => {
  const ls = safeStore();
  try { const raw = ls && ls.getItem(STORE_KEY); return raw ? normalize(JSON.parse(raw)) : null; } catch { return null; }
};
export const save = (profile) => { const ls = safeStore(); try { ls && ls.setItem(STORE_KEY, JSON.stringify(profile)); } catch { /* quota or blocked */ } };
export const wipe = () => { const ls = safeStore(); try { ls && ls.removeItem(STORE_KEY); } catch { /* ignore */ } };
export const isSaved = () => { const ls = safeStore(); try { return !!(ls && ls.getItem(STORE_KEY)); } catch { return false; } };
