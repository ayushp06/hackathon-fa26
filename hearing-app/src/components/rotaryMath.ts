export const START_ANGLE = 135;
export const SWEEP_ANGLE = 270;

export function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function pointerAngle(x: number, y: number, radius: number) {
  'worklet';
  return Math.atan2(y - radius, x - radius) * 180 / Math.PI;
}

export function shortestAngleDelta(previous: number, current: number) {
  'worklet';
  return ((current - previous + 540) % 360) - 180;
}

export function valueToAngle(value: number, min: number, max: number) {
  'worklet';
  return START_ANGLE + (clamp(value, min, max) - min) / (max - min) * SWEEP_ANGLE;
}

export function magneticDialAngle(angle: number) {
  'worklet';
  const landmark = START_ANGLE + Math.round((angle - START_ANGLE) / (SWEEP_ANGLE / 4)) * (SWEEP_ANGLE / 4);
  const offset = angle - landmark;
  const distance = Math.abs(offset);
  if (distance <= 4) return landmark;
  if (distance >= 11) return angle;
  const progress = (distance - 4) / 7;
  const released = 26 * progress * progress - 15 * progress * progress * progress;
  return landmark + Math.sign(offset) * released;
}

export function isDialLandmark(value: number, min: number, max: number) {
  const quarter = (value - min) * 4 / (max - min);
  return Math.abs(quarter - Math.round(quarter)) < 1e-6;
}

export function stepScale(min: number, step: number) {
  const places = (value: number) => {
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
  };
  return 10 ** Math.max(places(min), places(step));
}

export function angleToValue(angle: number, min: number, max: number, step: number, scale: number) {
  'worklet';
  const raw = min + (clamp(angle, START_ANGLE, START_ANGLE + SWEEP_ANGLE) - START_ANGLE) / SWEEP_ANGLE * (max - min);
  const snapped = min + Math.round((raw - min) / step) * step;
  return clamp(Math.round(snapped * scale) / scale, min, max);
}
