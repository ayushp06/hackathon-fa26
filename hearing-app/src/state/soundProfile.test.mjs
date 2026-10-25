import assert from 'node:assert/strict';
import test from 'node:test';
import { applySoundProfile, profileControls, soundProfileFrom, validSoundProfile } from './soundProfile.ts';

test('a saved profile copies all sound controls and rejects damaged saved values', () => {
  const current = Object.fromEntries(profileControls.map((control) => [control, control.startsWith('eq') || ['bass', 'mid', 'treble'].includes(control) ? 2 : 40]));
  const saved = soundProfileFrom({ ...current, soundFeedbackEnabled: true });
  assert.deepEqual(Object.keys(saved), [...profileControls]);
  assert.equal(validSoundProfile(saved), true);
  current.volume = 80;
  assert.equal(saved.volume, 40);
  assert.equal(validSoundProfile({ ...saved, eq4000: 99 }), false);
  assert.equal(validSoundProfile({ ...saved, volume: '40' }), false);
  assert.equal(validSoundProfile({ ...saved, spatialFocus: undefined }), false);
});

test('restoring a profile mutes first and restores saved volume after all controls', async () => {
  const profile = Object.fromEntries(profileControls.map((control) => [control, 0]));
  profile.volume = 63;
  const calls = [];
  let finishEq;
  const device = Object.fromEntries([
    'setVolume', 'setNoiseReduction', 'setReduceLoudSounds', 'setSpatialFocus',
    'setSpeechAmplification', 'setBass', 'setMid', 'setTreble',
  ].map((method) => [method, async (value) => { calls.push([method, value]); }]));
  device.setFineEq = async (frequency, value) => {
    calls.push(['setFineEq', frequency, value]);
    if (frequency === 4000) await new Promise((resolve) => { finishEq = resolve; });
  };
  const restoration = applySoundProfile(profile, device);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls[0], ['setVolume', 0]);
  assert.equal(calls.filter(([method]) => method === 'setVolume').length, 1);
  finishEq();
  await restoration;
  assert.deepEqual(calls.at(-1), ['setVolume', 63]);
  assert.equal(calls.length, 13);
});
