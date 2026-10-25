import assert from 'node:assert/strict';
import test from 'node:test';
import { frequencyResponsePath, manualWaveformPath, responseBandAtX, responseDbAt, responseGainAtY, responseX, responseY } from './manualWaveform.ts';

const samples = (path) => [...path.matchAll(/[ML] [\d.]+ ([\d.]+)/g)].map(([, y]) => 50 - Number(y));
const bandEnergy = (values, cycles) => Math.abs(values.reduce((sum, value, index) =>
  sum + value * Math.sin(index / 240 * Math.PI * 2 * cycles), 0));

test('synthetic waveform changes the matching frequency band for each EQ gain', () => {
  const baseline = samples(manualWaveformPath(0, 0, 0));
  assert.equal(baseline.length, 241);
  for (const [index, cycles] of [2, 10, 40].entries()) {
    const gains = [0, 0, 0];
    gains[index] = 12;
    const boosted = samples(manualWaveformPath(...gains));
    const change = boosted.map((value, position) => value - baseline[position]);
    assert.ok(bandEnergy(change, cycles) > 3 * Math.max(...[2, 10, 40].filter((band) => band !== cycles).map((band) => bandEnergy(change, band))));
    assert.ok(boosted.every((value) => value >= -50 && value <= 50));
  }
});

test('noise reduction, spatial focus, and speech amplification change distinct synthetic bands', () => {
  const baseline = samples(manualWaveformPath(0, 0, 0, 50, 50, 50));
  for (const [settings, cycles] of [
    [[0, 0, 0, 100, 50, 50], 60],
    [[0, 0, 0, 50, 100, 50], 25],
    [[0, 0, 0, 50, 50, 100], 10],
  ]) {
    const changed = samples(manualWaveformPath(...settings));
    const difference = changed.map((value, index) => value - baseline[index]);
    assert.ok(bandEnergy(difference, cycles) > 3 * Math.max(...[10, 25, 60].filter((band) => band !== cycles).map((band) => bandEnergy(difference, band))));
  }
});

test('frequency response uses log-spaced Hz positions and gain in dB', () => {
  const width = 360;
  assert.ok(Math.abs(responseX(80, width) - 38) < 0.01);
  assert.ok(Math.abs(responseX(12000, width) - 344) < 0.01);
  assert.ok(Math.abs(responseX(250, width) - responseX(125, width) - (responseX(500, width) - responseX(250, width))) < 0.01);
  assert.ok(responseX(125, width) > 38 + 20);
  assert.ok(responseX(8000, width) < 344 - 20);
  assert.equal(responseGainAtY(responseY(8)), 8);
  assert.equal(responseGainAtY(-50), 12);
  assert.equal(responseGainAtY(300), -12);
  assert.equal(responseBandAtX(responseX(125, width), width), 'bass');
  assert.equal(responseBandAtX(responseX(500, width), width), 'eq500');
  assert.equal(responseBandAtX(responseX(1000, width), width), 'mid');
  assert.equal(responseBandAtX(responseX(8000, width), width), 'treble');
  assert.equal(responseDbAt(1000, [0, 0, 0, 6, 0, 0, 0]), 6);
  assert.equal(responseDbAt(80, [0, 0, 0, 6, 0, 0, 0]), 0);
  assert.ok(frequencyResponsePath(width, [0, 0, 0, 0, 0, 0, 0]).includes(`${responseY(0).toFixed(1)}`));
});

test('response line passes through all seven EQ handles and fine points stay independent', () => {
  const width = 520;
  const gains = [-12, 4, -3, 6, 8, -2, 4];
  const path = frequencyResponsePath(width, gains);
  for (const [index, frequency] of [125, 250, 500, 1000, 2000, 4000, 8000].entries()) {
    assert.ok(Math.abs(responseDbAt(frequency, gains) - gains[index]) < 1e-9);
    assert.ok(path.includes(`L ${responseX(frequency, width).toFixed(1)} ${responseY(gains[index]).toFixed(1)}`));
  }
  assert.ok(responseDbAt(750, gains) >= -3 && responseDbAt(750, gains) <= 6);
  assert.notEqual(manualWaveformPath(0, 0, 0, 50, 50, 50, 6), manualWaveformPath(0, 0, 0));
});
