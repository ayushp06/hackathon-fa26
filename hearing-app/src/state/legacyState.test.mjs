import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateLegacyState } from './legacyState.ts';

test('previously saved controls and feedback preferences migrate independently', () => {
  const state = migrateLegacyState([
    JSON.stringify({ state: { volume: 72, lastResult: { simulated: true, completedAt: '2026-01-01', volumePercent: 72 } } }),
    JSON.stringify({ state: { baseVolume: 34, noiseReduction: 66, spatialFocus: 18 } }),
    JSON.stringify({ state: { hapticsEnabled: false, soundEnabled: true } }),
  ]);
  assert.deepEqual(state, {
    volume: 72, noiseReduction: 66, spatialFocus: 18,
    hapticsEnabled: false, soundFeedbackEnabled: true,
    lastResult: { simulated: true, completedAt: '2026-01-01', volumePercent: 72 },
  });
});

test('missing or damaged saved state falls back to safe defaults', () => {
  const state = migrateLegacyState(['bad json', null, JSON.stringify({ state: { soundEnabled: 'yes' } })]);
  assert.equal(state.volume, 50);
  assert.equal(state.volume, 50);
  assert.equal(state.soundFeedbackEnabled, false);
});
