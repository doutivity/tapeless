import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, normalize, encodeHash, decodeHash, loadSaved, save, wipe, isSaved, SCHEMA_VERSION } from '../assets/js/state.js';
import { fullProfile } from './fixtures.mjs';

test('hash round-trips a full profile, including Cyrillic', () => {
  const p = normalize(fullProfile());
  const h = encodeHash(p);
  assert.match(h, /^p=[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeHash('#' + h), p);
});

test('bad, foreign or oversized hashes give null and never throw', () => {
  for (const h of ['', '#', '#x=1', '#p=', '#p=!!!', '#p=bm90IGpzb24', '#p=' + 'A'.repeat(30000)]) assert.equal(decodeHash(h), null, h);
  const future = 'p=' + Buffer.from(JSON.stringify({ v: SCHEMA_VERSION + 1 })).toString('base64url');
  assert.equal(decodeHash(future), null, 'unknown schema version');
});

test('normalize clamps and whitelists everything', () => {
  const p = normalize({
    interests: { text: 'x'.repeat(900), cards: ['ok-id', '<bad>', 5, 'ok-id'] }, skills: { cards: [{ id: 'a', level: 9 }, { id: 'a', level: 1 }, { id: 'b', level: 3 }] },
    person: { gender: 'robot', age: 'a'.repeat(99), military: 'liable' }, conditions: { balance: 7, study: 'any', income: { horizonMonths: '12' }, aiPriority: 5 },
    mode: 'x', clarify: 'x', unknown: { interests: 'yes' },
  });
  assert.equal(p.interests.text.length, 500);
  assert.deepEqual(p.interests.cards, ['ok-id']);
  assert.deepEqual(p.skills.cards, [{ id: 'a', level: 2 }, { id: 'b', level: 3 }]);
  assert.equal(p.person.gender, 'unspecified'); assert.equal(p.person.age.length, 20); assert.equal(p.person.military, 'liable');
  assert.equal(p.conditions.balance, 0); assert.equal(p.conditions.study, 'any'); assert.equal(p.conditions.income.horizonMonths, 12); assert.equal(p.conditions.aiPriority, 5);
  assert.equal(p.mode, 'explore'); assert.equal(p.clarify, 'ask_first'); assert.equal(p.unknown.interests, false);
  assert.deepEqual(normalize(null), createProfile());
});

test('defaults: sensitive fields default to "not specified"', () => {
  const p = createProfile();
  assert.equal(p.person.gender, 'unspecified'); assert.equal(p.person.military, 'unspecified'); assert.equal(p.mode, 'explore'); assert.equal(p.clarify, 'ask_first');
});

test('persistence is opt-in and survives missing/blocked localStorage', () => {
  assert.equal(loadSaved(), null); assert.equal(isSaved(), false); save(createProfile()); wipe(); // no localStorage in Node: must not throw
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  try {
    assert.equal(mem.size, 0, 'nothing is stored by merely importing and loading');
    save(fullProfile()); assert.equal(isSaved(), true);
    assert.deepEqual(loadSaved(), normalize(fullProfile()));
    wipe(); assert.equal(mem.size, 0);
    mem.set('tapeless:profile', '{broken'); assert.equal(loadSaved(), null);
  } finally { delete globalThis.localStorage; }
});
