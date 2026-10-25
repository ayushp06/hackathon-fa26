export const eqBands = [
  { control: 'bass', frequency: 125 },
  { control: 'eq250', frequency: 250 },
  { control: 'eq500', frequency: 500 },
  { control: 'mid', frequency: 1000 },
  { control: 'eq2000', frequency: 2000 },
  { control: 'eq4000', frequency: 4000 },
  { control: 'treble', frequency: 8000 },
] as const;
export type EqControl = (typeof eqBands)[number]['control'];
export type ManualControl = 'noiseReduction' | 'reduceLoudSounds' | 'spatialFocus' | 'speechAmplification' | EqControl;

export function isEqControl(control: ManualControl): control is EqControl {
  return eqBands.some((band) => band.control === control);
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
