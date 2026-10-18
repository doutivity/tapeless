import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, pageLocation, isOn, track } from '../assets/js/analytics.js';
import { mustAsk } from '../assets/js/consent.js';

test('page_location never carries the #hash (profile)', () => {
  assert.equal(pageLocation('https://doutivity.github.io/tapeless/#p=SECRET'), 'https://doutivity.github.io/tapeless/');
  assert.equal(pageLocation('https://x.test/a/?b=1#p=Z'), 'https://x.test/a/?b=1');
});

test('only whitelisted events with whitelisted values pass; extras are dropped', () => {
  assert.deepEqual(sanitize('wizard_start'), { name: 'wizard_start', params: {} });
  assert.deepEqual(sanitize('wizard_step', { step: 3, interests: 'secret' }), { name: 'wizard_step', params: { step: 3 } });
  assert.deepEqual(sanitize('wizard_complete', { mode: 'quick', age: 24 }), { name: 'wizard_complete', params: { mode: 'quick' } });
  assert.deepEqual(sanitize('prompt_copy', { kind: 'short' }).params, { kind: 'short' });
  assert.deepEqual(sanitize('service_open', { service: 'gemini' }).params, { service: 'gemini' });
  assert.deepEqual(sanitize('theme_change', { theme: 'dark' }).params, { theme: 'dark' });
  assert.deepEqual(sanitize('consent_change', { value: 'granted' }).params, { value: 'granted' });
  for (const bad of [['unknown_event', {}], ['wizard_step', { step: 9 }], ['wizard_step', {}], ['service_open', { service: 'https://evil' }], ['prompt_copy', { kind: 'Привіт, мене звати…' }], ['consent_change', { value: 'denied' }]])
    assert.equal(sanitize(...bad), null, JSON.stringify(bad));
});

test('before consent nothing is on and track() is a silent no-op', () => {
  assert.equal(isOn(), false);
  assert.doesNotThrow(() => track('wizard_start'));
  assert.equal(globalThis.dataLayer, undefined);
  assert.equal(globalThis.gtag, undefined);
});

test('consent is asked again when missing, malformed, outdated or older than 12 months', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const ok = { value: 'granted', v: 1, at: '2026-06-01T00:00:00Z' };
  assert.equal(mustAsk(ok, now, 1), false);
  assert.equal(mustAsk({ ...ok, value: 'denied' }, now, 1), false);
  assert.equal(mustAsk(null, now, 1), true);
  assert.equal(mustAsk({ ...ok, value: 'maybe' }, now, 1), true);
  assert.equal(mustAsk(ok, now, 2), true, 'new text version');
  assert.equal(mustAsk({ ...ok, at: '2025-10-01T00:00:00Z' }, now, 1), true, 'older than a year');
  assert.equal(mustAsk({ ...ok, at: 'garbage' }, now, 1), true);
});
