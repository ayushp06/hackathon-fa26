import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createTonePlan, finishToneTest, frequenciesHz, restoreToneTestResult } from './toneTest.ts';

test('plan starts at the checked reference level and only gets quieter', () => {
  const plan = createTonePlan(true);
  assert.equal(plan.length, 12);
  assert.deepEqual(plan.map((trial) => trial.frequencyHz).slice(0, 4), frequenciesHz);
  assert.deepEqual(plan.map((trial) => trial.relativeLevel), [...Array(4).fill('reference'), ...Array(8).fill('quieter')]);
  assert.deepEqual(plan.map((trial) => trial.playerGain), [...Array(4).fill(0.3), ...Array(8).fill(0.15)]);
  assert.deepEqual(plan.map((trial) => trial.scenario), [...Array(8).fill('quiet'), ...Array(4).fill('background_noise')]);
  assert.equal(createTonePlan(false).length, 8);
});

test('experimental profile uses actual recorded taps, while simulation has no inferred profile', () => {
  const plan = createTonePlan(true);
  const presentations = plan.map((trial, trialIndex) => ({ ...trial, trialIndex, playedAt: '2026-01-01T00:00:00Z', heardAt: trialIndex === 5 || trialIndex === 9 ? null : '2026-01-01T00:00:01Z', endedAt: '2026-01-01T00:00:02Z', interrupted: false }));
  const result = finishToneTest('audio', plan, presentations);
  assert.deepEqual(result.profile, { status: 'experimental', suggestedFocusHz: [1000], backgroundNoiseChallenge: false });
  assert.equal(restoreToneTestResult(result)?.presentations.length, 12);
  const simulation = finishToneTest('simulation', plan, presentations);
  assert.equal(simulation.profile, null);
  assert.equal(restoreToneTestResult(simulation)?.mode, 'simulation');
});

test('bundled prompts are bounded short audio clips', () => {
  for (const frequency of frequenciesHz) for (const scenario of ['', 'noise-']) {
    const wav = readFileSync(new URL(`../assets/sounds/test-${scenario}${frequency}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.ok(wav.length < 32000);
    let peak = 0;
    for (let index = 44; index < wav.length; index += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(index)));
    assert.ok(peak <= 10000);
  }
});
