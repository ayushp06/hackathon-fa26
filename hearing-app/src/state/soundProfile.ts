import type { DeviceTransport } from '../device/types';
import { normalizeEqGain, normalizeManualValue } from './manualValues.ts';

export const profileControls = [
  'volume', 'noiseReduction', 'reduceLoudSounds', 'spatialFocus', 'speechAmplification',
  'bass', 'mid', 'treble', 'eq250', 'eq500', 'eq2000', 'eq4000',
] as const;

export type SoundProfile = Record<(typeof profileControls)[number], number>;

export function soundProfileFrom(state: SoundProfile): SoundProfile {
  return Object.fromEntries(profileControls.map((control) => [control, state[control]])) as SoundProfile;
}

export function validSoundProfile(value: unknown): value is SoundProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return profileControls.every((control) => {
    const number = profile[control];
    return typeof number === 'number' && (control === 'bass' || control === 'mid' || control === 'treble' || control.startsWith('eq')
      ? normalizeEqGain(number) : normalizeManualValue(number)) === number;
  });
}

export async function applySoundProfile(profile: SoundProfile, device: DeviceTransport) {
  await device.setVolume(0);
  await Promise.all([
    device.setNoiseReduction(profile.noiseReduction),
    device.setReduceLoudSounds(profile.reduceLoudSounds),
    device.setSpatialFocus(profile.spatialFocus),
    device.setSpeechAmplification(profile.speechAmplification),
    device.setBass(profile.bass),
    device.setMid(profile.mid),
    device.setTreble(profile.treble),
    device.setFineEq(250, profile.eq250),
    device.setFineEq(500, profile.eq500),
    device.setFineEq(2000, profile.eq2000),
    device.setFineEq(4000, profile.eq4000),
  ]);
  await device.setVolume(profile.volume);
}
