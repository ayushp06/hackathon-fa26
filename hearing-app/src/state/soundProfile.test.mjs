import assert from 'node:assert/strict';
import test from 'node:test';
import { profileControls, soundProfileFrom, validSoundProfile } from './soundProfile.ts';

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
