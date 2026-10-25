import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePercentEqGain, normalizeEqGain, normalizeManualValue, restoreSharedVolume } from './manualValues.ts';

test('manual percentages round and stay within 0–100', () => {
  assert.equal(normalizeManualValue(-5), 0);
  assert.equal(normalizeManualValue(42.6), 43);
  assert.equal(normalizeManualValue(105), 100);
  assert.equal(normalizeManualValue(Number.NaN), null);
});

test('EQ gains use signed dB values and migrate saved percent positions', () => {
  assert.equal(normalizeEqGain(-20), -12);
  assert.equal(normalizeEqGain(3.6), 4);
  assert.equal(normalizeEqGain(20), 12);
  assert.equal(normalizeEqGain(Number.NaN), null);
  assert.deepEqual([0, 50, 100].map(migratePercentEqGain), [-12, 0, 12]);
  assert.equal(migratePercentEqGain(undefined), 0);
});

test('Home volume takes priority over old Manual volume, with a fallback for manual-only saves', () => {
  assert.equal(restoreSharedVolume(72, 34), 72);
  assert.equal(restoreSharedVolume(undefined, 34), 34);
  assert.equal(restoreSharedVolume(undefined, undefined), 50);
});
