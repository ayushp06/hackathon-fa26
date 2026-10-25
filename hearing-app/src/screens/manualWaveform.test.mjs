import assert from 'node:assert/strict';
import test from 'node:test';
import { manualWaveformPath } from './manualWaveform.ts';

const samples = (path) => [...path.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map(([, y]) => 50 - Number(y));
const bandEnergy = (values, cycles) => Math.abs(values.reduce((sum, value, index) =>
  sum + value * Math.sin(index / 120 * Math.PI * 2 * cycles), 0));

test('synthetic waveform changes the matching frequency band for each EQ gain', () => {
  const baseline = samples(manualWaveformPath(0, 0, 0));
  assert.equal(baseline.length, 121);
  for (const [index, cycles] of [2, 7, 17].entries()) {
    const gains = [0, 0, 0];
    gains[index] = 12;
    const boosted = samples(manualWaveformPath(...gains));
    const change = boosted.map((value, position) => value - baseline[position]);
    assert.ok(bandEnergy(change, cycles) > 3 * Math.max(...[2, 7, 17].filter((band) => band !== cycles).map((band) => bandEnergy(change, band))));
    assert.ok(boosted.every((value) => value >= -50 && value <= 50));
  }
});

test('noise reduction, spatial focus, and speech amplification change distinct synthetic bands', () => {
  const baseline = samples(manualWaveformPath(0, 0, 0, 50, 50, 50));
  for (const [settings, cycles] of [
    [[0, 0, 0, 100, 50, 50], 29],
    [[0, 0, 0, 50, 100, 50], 11],
    [[0, 0, 0, 50, 50, 100], 7],
  ]) {
    const changed = samples(manualWaveformPath(...settings));
    const difference = changed.map((value, index) => value - baseline[index]);
    assert.ok(bandEnergy(difference, cycles) > 3 * Math.max(...[7, 11, 29].filter((band) => band !== cycles).map((band) => bandEnergy(difference, band))));
  }
});
