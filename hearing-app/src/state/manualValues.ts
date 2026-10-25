export type ManualControl = 'noiseReduction' | 'spatialFocus' | 'speechAmplification' | 'bass' | 'mid' | 'treble';
export type EqControl = 'bass' | 'mid' | 'treble';

export function isEqControl(control: ManualControl): control is EqControl {
  return control === 'bass' || control === 'mid' || control === 'treble';
}

export function normalizeManualValue(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function restoreSharedVolume(home: unknown, manual: unknown, fallback = 50) {
  const homeValue = typeof home === 'number' ? normalizeManualValue(home) : null;
  const manualValue = typeof manual === 'number' ? normalizeManualValue(manual) : null;
  return homeValue ?? manualValue ?? fallback;
}

export function normalizeEqGain(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.min(12, Math.max(-12, Math.round(value)));
}

export function migratePercentEqGain(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? normalizeEqGain((value - 50) * 24 / 100) ?? 0
    : 0;
}
