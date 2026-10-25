export const frequenciesHz = [500, 1000, 2000, 4000] as const;
export const referenceGain = 0.3;
export const quieterGain = 0.15;

export type ToneTrial = {
  frequencyHz: (typeof frequenciesHz)[number];
  relativeLevel: 'reference' | 'quieter';
  playerGain: number;
  scenario: 'quiet' | 'background_noise';
};

export type TonePresentation = ToneTrial & {
  trialIndex: number;
  playedAt: string;
  heardAt: string | null;
  endedAt: string;
  interrupted: boolean;
};

export type PreliminaryProfile = {
  status: 'experimental';
  suggestedFocusHz: number[];
  backgroundNoiseChallenge: boolean;
};

export type ToneTestResult = {
  mode: 'audio' | 'simulation';
  experimental: true;
  completedAt: string;
  backgroundNoiseEnabled: boolean;
  presentations: TonePresentation[];
  profile: PreliminaryProfile | null;
};

export function createTonePlan(backgroundNoise: boolean): ToneTrial[] {
  return [
    ...frequenciesHz.map((frequencyHz) => ({ frequencyHz, relativeLevel: 'reference' as const, playerGain: referenceGain, scenario: 'quiet' as const })),
    ...frequenciesHz.map((frequencyHz) => ({ frequencyHz, relativeLevel: 'quieter' as const, playerGain: quieterGain, scenario: 'quiet' as const })),
    ...(backgroundNoise ? frequenciesHz.map((frequencyHz) => ({ frequencyHz, relativeLevel: 'quieter' as const, playerGain: quieterGain, scenario: 'background_noise' as const })) : []),
  ];
}

export function finishToneTest(mode: ToneTestResult['mode'], plan: ToneTrial[], presentations: TonePresentation[]): ToneTestResult {
  const heard = (index: number) => presentations.some((presentation) => presentation.trialIndex === index && !presentation.interrupted && presentation.heardAt !== null);
  const profile = mode === 'simulation' ? null : {
    status: 'experimental' as const,
    suggestedFocusHz: frequenciesHz.filter((frequencyHz) => plan.some((trial, index) => trial.frequencyHz === frequencyHz && trial.scenario === 'quiet' && !heard(index))),
    backgroundNoiseChallenge: plan.some((trial, index) => trial.scenario === 'background_noise' && !heard(index)
      && plan.some((quiet, quietIndex) => quiet.frequencyHz === trial.frequencyHz && quiet.relativeLevel === trial.relativeLevel && quiet.scenario === 'quiet' && heard(quietIndex))),
  };
  return {
    mode,
    experimental: true,
    completedAt: new Date().toISOString(),
    backgroundNoiseEnabled: plan.some((trial) => trial.scenario === 'background_noise'),
    presentations,
    profile,
  };
}

export function restoreToneTestResult(value: unknown): ToneTestResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Partial<ToneTestResult>;
  if ((result.mode !== 'audio' && result.mode !== 'simulation') || result.experimental !== true || typeof result.completedAt !== 'string' || !Array.isArray(result.presentations)) return null;
  if (!result.presentations.every((item) => frequenciesHz.includes(item.frequencyHz) && (item.relativeLevel === 'reference' || item.relativeLevel === 'quieter')
    && item.playerGain === (item.relativeLevel === 'reference' ? referenceGain : quieterGain)
    && (item.scenario === 'quiet' || item.scenario === 'background_noise') && Number.isInteger(item.trialIndex)
    && typeof item.playedAt === 'string' && (item.heardAt === null || typeof item.heardAt === 'string')
    && typeof item.endedAt === 'string' && typeof item.interrupted === 'boolean')) return null;
  if (result.mode === 'simulation' && result.profile !== null) return null;
  if (result.mode === 'audio' && (result.profile?.status !== 'experimental' || !Array.isArray(result.profile.suggestedFocusHz)
    || typeof result.profile.backgroundNoiseChallenge !== 'boolean')) return null;
  return result as ToneTestResult;
}
