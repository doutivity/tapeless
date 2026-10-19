import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, createProfile } from '../assets/js/state.js';

const { presets } = JSON.parse(readFileSync(new URL('../data/presets.json', import.meta.url), 'utf8'));
const byId = (id) => presets.find((p) => p.id === id).set;

// Scale: 1 = almost all life, 5 = ready to work all-out. content-seed.md words these presets in the opposite direction, which was a seed bug.
test('preset balance values follow the scale (1 = more life, 5 = more work)', () => {
  assert.ok(byId('calm-remote').balance <= 2, 'calm and remote leans to life');
  assert.ok(byId('fast-growth').balance >= 4, 'fast growth leans to work');
});

test('every preset survives normalization unchanged (no invalid values)', () => {
  for (const { id, set } of presets) {
    const p = createProfile();
    for (const [k, v] of Object.entries(set)) { if (k === 'income') Object.assign(p.conditions.income, v); else p.conditions[k] = v; }
    const n = normalize(p).conditions;
    for (const [k, v] of Object.entries(set)) {
      if (k === 'income') { for (const [ik, iv] of Object.entries(v)) assert.equal(n.income[ik], iv, `${id}.income.${ik}`); } else assert.equal(n[k], v, `${id}.${k}`);
    }
  }
});
