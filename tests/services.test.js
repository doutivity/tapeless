import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveService } from '../assets/js/services.js';

const cfg = JSON.parse(readFileSync(new URL('../data/services.json', import.meta.url), 'utf8'));
const svc = (id) => cfg.services.find((s) => s.id === id);

test('services.json is complete and honest about verification', () => {
  assert.deepEqual(cfg.services.map((s) => s.id), ['claude', 'chatgpt', 'gemini', 'perplexity']);
  for (const s of cfg.services) {
    assert.ok(['yes', 'unverified', 'none'].includes(s.prefill), s.id);
    assert.ok(s.url.startsWith('https://'), s.id);
    if (s.prefill !== 'none') assert.ok(s.url.includes('{q}'), s.id);
    if (s.prefill === 'yes') assert.ok(s.verifiedAt, `${s.id}: "yes" requires verifiedAt`);
  }
  assert.equal(svc('gemini').prefill, 'none');
});

test('short text goes into the URL, encoded', () => {
  const r = resolveService(svc('chatgpt'), 'Привіт, світ & ?', 'коротко');
  assert.equal(r.mode, 'full');
  assert.equal(r.href, 'https://chatgpt.com/?q=' + encodeURIComponent('Привіт, світ & ?'));
});

test('a long prompt falls back to the short version, then to a plain open', () => {
  const full = 'я'.repeat(2000), short = 'ю'.repeat(100);
  const r = resolveService(svc('claude'), full, short);
  assert.equal(r.mode, 'short'); assert.ok(r.href.endsWith(encodeURIComponent(short)));
  const none = resolveService(svc('claude'), full, 'ю'.repeat(2000));
  assert.deepEqual(none, { href: 'https://claude.ai/new', mode: 'paste' });
});

test('Gemini never prefills: copy and open the app', () => {
  assert.deepEqual(resolveService(svc('gemini'), 'x', 'y'), { href: 'https://gemini.google.com/app', mode: 'paste' });
});

test('the per-service threshold is honoured', () => {
  const tight = { ...svc('perplexity'), maxEncoded: 120 };
  assert.equal(resolveService(tight, 'a'.repeat(50), 'b').mode, 'full');
  assert.equal(resolveService(tight, 'a'.repeat(200), 'b').mode, 'short');
});
