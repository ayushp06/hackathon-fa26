import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreHearingPreferences, toPreliminaryAudioProfile } from './hearingPreferences.ts';

test('restores current and previous preference formats without losing the tone choice', () => {
  assert.deepEqual(restoreHearingPreferences({ vocalTones: true, backgroundNoise: false, softerTones: true }), {
    vocalTones: true, backgroundNoise: false, toneEmphasis: 'softer',
  });
  assert.deepEqual(restoreHearingPreferences({ vocalTones: false, backgroundNoise: true, softerTones: false }), {
    vocalTones: false, backgroundNoise: true, toneEmphasis: 'louder',
  });
  assert.deepEqual(restoreHearingPreferences({ vocalTones: false, backgroundNoise: false, toneEmphasis: 'neither' }), {
    vocalTones: false, backgroundNoise: false, toneEmphasis: 'neither',
  });
  assert.equal(restoreHearingPreferences({ vocalTones: true, backgroundNoise: false, toneEmphasis: 'invalid' }), null);
});

test('maps preferences to a pending qualitative profile', () => {
  assert.deepEqual(toPreliminaryAudioProfile({ vocalTones: true, backgroundNoise: false, toneEmphasis: 'neither' }), {
    status: 'pending-hardware-integration',
    vocalBoostRequested: true,
    backgroundNoiseBoostRequested: false,
    toneEmphasis: 'neither',
  });
});
