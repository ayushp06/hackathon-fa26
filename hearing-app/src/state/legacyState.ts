import { normalizeManualValue, restoreSharedVolume } from './manualValues.ts';

function savedState(raw: string | null): Record<string, unknown> {
  try {
    const state = JSON.parse(raw ?? '')?.state;
    return state && typeof state === 'object' ? state : {};
  } catch {
    return {};
  }
}
export function migrateLegacyState(values: (string | null)[]) {
  const calibration = savedState(values[0]);
  const manual = savedState(values[1]);
  const feedback = savedState(values[2]);
  return {
    volume: restoreSharedVolume(calibration.volume, manual.baseVolume),
    noiseReduction: typeof manual.noiseReduction === 'number' ? normalizeManualValue(manual.noiseReduction) ?? 50 : 50,
    spatialFocus: typeof manual.spatialFocus === 'number' ? normalizeManualValue(manual.spatialFocus) ?? 50 : 50,
    hapticsEnabled: typeof feedback.hapticsEnabled === 'boolean' ? feedback.hapticsEnabled : true,
    soundFeedbackEnabled: typeof feedback.soundEnabled === 'boolean' ? feedback.soundEnabled : false,
    lastResult: calibration.lastResult && typeof calibration.lastResult === 'object' ? calibration.lastResult : null,
  };
}
