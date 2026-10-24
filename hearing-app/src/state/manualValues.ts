export type ManualControl = 'baseVolume' | 'noiseReduction' | 'spatialFocus';

export function normalizeManualValue(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}
