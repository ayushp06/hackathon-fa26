export type HearingPreferences = {
  vocalTones: boolean;
  backgroundNoise: boolean;
  toneEmphasis: 'softer' | 'louder' | 'neither';
};

export type PreliminaryAudioProfile = {
  status: 'pending-hardware-integration';
  vocalBoostRequested: boolean;
  backgroundNoiseBoostRequested: boolean;
  toneEmphasis: HearingPreferences['toneEmphasis'];
};

export function restoreHearingPreferences(value: unknown): HearingPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Partial<HearingPreferences> & { softerTones?: unknown };
  if (typeof saved.vocalTones !== 'boolean' || typeof saved.backgroundNoise !== 'boolean') return null;
  const toneEmphasis = saved.toneEmphasis === 'softer' || saved.toneEmphasis === 'louder' || saved.toneEmphasis === 'neither'
    ? saved.toneEmphasis
    : typeof saved.softerTones === 'boolean' ? saved.softerTones ? 'softer' : 'louder' : null;
  return toneEmphasis ? { vocalTones: saved.vocalTones, backgroundNoise: saved.backgroundNoise, toneEmphasis } : null;
}

export function toPreliminaryAudioProfile(preferences: HearingPreferences): PreliminaryAudioProfile {
  return {
    status: 'pending-hardware-integration',
    vocalBoostRequested: preferences.vocalTones,
    backgroundNoiseBoostRequested: preferences.backgroundNoise,
    toneEmphasis: preferences.toneEmphasis,
  };
}
