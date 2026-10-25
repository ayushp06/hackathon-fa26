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
