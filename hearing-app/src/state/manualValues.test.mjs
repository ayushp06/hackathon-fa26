import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeManualValue } from './manualValues.ts';

test('manual percentages round and stay within 0–100', () => {
  assert.equal(normalizeManualValue(-5), 0);
  assert.equal(normalizeManualValue(42.6), 43);
  assert.equal(normalizeManualValue(105), 100);
  assert.equal(normalizeManualValue(Number.NaN), null);
});
