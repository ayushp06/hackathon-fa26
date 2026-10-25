import type { EqControl } from '../state/manualValues';

const plotTop = 30;
const plotHeight = 120;
const plotLeft = 38;
const plotRight = 16;
const adjacentOverlap = Math.exp(-0.5 * (3 / 1.1) ** 2);
const outerOverlap = Math.exp(-0.5 * (6 / 1.1) ** 2);

export function responseX(frequency: number, width: number) {
  'worklet';
  return plotLeft + Math.log10(frequency / 20) / 3 * (width - plotLeft - plotRight);
}

export function responseY(gain: number) {
  'worklet';
  return plotTop + (15 - gain) / 30 * plotHeight;
}

export function responseGainAtY(y: number) {
  'worklet';
  return Math.max(-12, Math.min(12, Math.round(15 - (y - plotTop) / plotHeight * 30)));
}

export function responseBandAtX(x: number, width: number): EqControl {
  'worklet';
  if (x < (responseX(125, width) + responseX(1000, width)) / 2) return 'bass';
  return x < (responseX(1000, width) + responseX(8000, width)) / 2 ? 'mid' : 'treble';
}

function responseCoefficients(bass: number, mid: number, treble: number) {
  'worklet';
  const center = (mid * (1 + outerOverlap) - adjacentOverlap * (bass + treble)) / (1 + outerOverlap - 2 * adjacentOverlap ** 2);
  const outerSum = (bass + treble - 2 * adjacentOverlap * center) / (1 + outerOverlap);
  const outerDifference = (bass - treble) / (1 - outerOverlap);
  return [(outerSum + outerDifference) / 2, center, (outerSum - outerDifference) / 2] as const;
}

function responseDbWithCoefficients(frequency: number, bass: number, mid: number, treble: number) {
  'worklet';
  const low = Math.log2(frequency / 125) / 1.1;
  const middle = Math.log2(frequency / 1000) / 1.1;
  const high = Math.log2(frequency / 8000) / 1.1;
  return bass * Math.exp(-0.5 * low * low)
    + mid * Math.exp(-0.5 * middle * middle)
    + treble * Math.exp(-0.5 * high * high);
}

export function responseDbAt(frequency: number, bass: number, mid: number, treble: number) {
  'worklet';
  const coefficients = responseCoefficients(bass, mid, treble);
  return responseDbWithCoefficients(frequency, ...coefficients);
}

export function frequencyResponsePath(width: number, bass: number, mid: number, treble: number) {
  'worklet';
  const points: string[] = [];
  const coefficients = responseCoefficients(bass, mid, treble);
  const anchors = [125, 1000, 8000];
  let anchorIndex = 0;
  for (let index = 0; index <= 120; index++) {
    const frequency = 20 * 1000 ** (index / 120);
    if (anchorIndex < anchors.length && frequency >= anchors[anchorIndex]) {
      const anchor = anchors[anchorIndex];
      points.push(`L ${responseX(anchor, width).toFixed(1)} ${responseY(responseDbWithCoefficients(anchor, ...coefficients)).toFixed(1)}`);
      anchorIndex++;
    }
    const x = responseX(frequency, width);
    const y = responseY(responseDbWithCoefficients(frequency, ...coefficients));
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export function manualWaveformPath(bass: number, mid: number, treble: number, noiseReduction = 50, spatialFocus = 50, speechAmplification = 50) {
  'worklet';
  const points: string[] = [];
  const bassAmplitude = 2.6 * Math.pow(10, bass / 20);
  const midAmplitude = 2.6 * Math.pow(10, mid / 20) * (0.8 + speechAmplification / 100 * 0.7);
  const trebleAmplitude = 2.6 * Math.pow(10, treble / 20);
  const noiseAmplitude = 4 * (1 - noiseReduction / 100);
  const offAxisAmplitude = 3 * (1 - spatialFocus / 100);
  for (let index = 0; index <= 240; index += 1) {
    const position = index / 240;
    const envelope = Math.sin(Math.PI * position) ** 2;
    const wave = bassAmplitude * Math.sin(position * Math.PI * 4)
      + midAmplitude * Math.sin(position * Math.PI * 20)
      + trebleAmplitude * Math.sin(position * Math.PI * 80)
      + noiseAmplitude * Math.sin(position * Math.PI * 120)
      + offAxisAmplitude * Math.sin(position * Math.PI * 50);
    points.push(`${index === 0 ? 'M' : 'L'} ${(index * 1.25).toFixed(1)} ${(50 - envelope * wave).toFixed(1)}`);
  }
  return points.join(' ');
}
