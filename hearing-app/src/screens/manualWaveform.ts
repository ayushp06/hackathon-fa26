import { eqBands, type EqControl } from '../state/manualValues.ts';

const plotTop = 30;
const plotHeight = 120;
const plotLeft = 38;
const plotRight = 16;
const responseMinHz = 80;
const responseMaxHz = 12000;

export function responseX(frequency: number, width: number) {
  'worklet';
  return plotLeft + Math.log10(frequency / responseMinHz) / Math.log10(responseMaxHz / responseMinHz) * (width - plotLeft - plotRight);
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
  for (let index = 0; index < eqBands.length - 1; index++) {
    if (x < (responseX(eqBands[index].frequency, width) + responseX(eqBands[index + 1].frequency, width)) / 2) return eqBands[index].control;
  }
  return 'treble';
}

export function responseDbAt(frequency: number, gains: readonly number[]) {
  'worklet';
  const anchors = [responseMinHz, ...eqBands.map((band) => band.frequency), responseMaxHz];
  const values = [0, ...gains, 0];
  for (let index = 1; index < anchors.length; index++) {
    if (frequency <= anchors[index]) {
      const t = Math.max(0, Math.log2(frequency / anchors[index - 1]) / Math.log2(anchors[index] / anchors[index - 1]));
      const smooth = t * t * (3 - 2 * t);
      return values[index - 1] + (values[index] - values[index - 1]) * smooth;
    }
  }
  return 0;
}

export function frequencyResponsePath(width: number, gains: readonly number[]) {
  'worklet';
  const points: string[] = [];
  const anchors = eqBands.map((band) => band.frequency);
  let anchorIndex = 0;
  for (let index = 0; index <= 120; index++) {
    const frequency = responseMinHz * (responseMaxHz / responseMinHz) ** (index / 120);
    if (anchorIndex < anchors.length && frequency >= anchors[anchorIndex]) {
      const anchor = anchors[anchorIndex];
      points.push(`L ${responseX(anchor, width).toFixed(1)} ${responseY(gains[anchorIndex]).toFixed(1)}`);
      anchorIndex++;
    }
    const x = responseX(frequency, width);
    const y = responseY(responseDbAt(frequency, gains));
    points.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(' ');
}

export function manualWaveformPath(bass: number, mid: number, treble: number, noiseReduction = 50, spatialFocus = 50, speechAmplification = 50, eq250 = 0, eq500 = 0, eq2000 = 0, eq4000 = 0) {
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
      + 1.5 * (Math.pow(10, eq250 / 20) - 1) * Math.sin(position * Math.PI * 10)
      + 1.5 * (Math.pow(10, eq500 / 20) - 1) * Math.sin(position * Math.PI * 14)
      + 1.5 * (Math.pow(10, eq2000 / 20) - 1) * Math.sin(position * Math.PI * 40)
      + 1.5 * (Math.pow(10, eq4000 / 20) - 1) * Math.sin(position * Math.PI * 60)
      + noiseAmplitude * Math.sin(position * Math.PI * 120)
      + offAxisAmplitude * Math.sin(position * Math.PI * 50);
    points.push(`${index === 0 ? 'M' : 'L'} ${(index * 1.25).toFixed(1)} ${(50 - envelope * wave).toFixed(1)}`);
  }
  return points.join(' ');
}
