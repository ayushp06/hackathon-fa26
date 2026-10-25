import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { summarizeStatus, readSnapshot, optionsFor } from '../tools/status-summary.mjs';

// Synthetic status fixtures only; these are not board measurements.
const fixture = () => ({ timestampMs: 9950, streaming: true, protocol: 4, error: null,
  primaryRms: 328, referenceRms: 656, outputRms: 100, referenceClock: true,
  values: { noiseReduction: 75, spatialFocus: 0 }, filter: 'nlms', maxCycles: 200000,
  commandSequence: 42, commandStatus: 0, packets: 100, missing: 0, crc: 0,
  firmwareDrops: 0, underruns: 0, overflow: 0 });
const now = 10000;

test('summarizes only observed applied values and explicitly marks hidden ML state', () => {
  const result = summarizeStatus(fixture(), { now });
  assert.equal(result.health, 'live'); assert.equal(result.ageMs, 50);
  assert.equal(result.appliedStrength, 75); assert.equal(result.commandSequence, 42);
  assert.equal(result.warnings.length, 0);
  assert.ok(result.unobservable.includes('correction count'));
  assert.equal(result.mlEnabled, undefined); assert.equal(result.prediction, undefined);
  assert.equal(result.counterDeltas.packets, null);
  assert.deepEqual(result, summarizeStatus(fixture(), { now }));
});

test('freshness, faults, stopped streams and incompatible protocol are distinct', () => {
  for (const [patch, expected] of [
    [{ timestampMs: 8500 }, 'stale'], [{ timestampMs: 11001 }, 'stale'],
    [{ timestampMs: '9950' }, 'invalid'], [{ error: 'Firmware fault' }, 'fault'],
    [{ streaming: false }, 'stopped'], [{ protocol: 2 }, 'incompatible'],
  ]) assert.equal(summarizeStatus({ ...fixture(), ...patch }, { now }).health, expected);
  assert.equal(summarizeStatus(null, { now }).health, 'invalid');
  assert.equal(summarizeStatus([], { now }).health, 'invalid');
});

test('missing values are unknown rather than fabricated zeroes or readiness', () => {
  const raw = fixture(); delete raw.values; delete raw.maxCycles;
  raw.primaryRms = Number.NaN; raw.referenceRms = -1; raw.referenceClock = false;
  const result = summarizeStatus(raw, { now });
  assert.equal(result.appliedStrength, null); assert.equal(result.maxCycles, null);
  assert.equal(result.primaryRms, null); assert.equal(result.referenceRms, null);
  assert.ok(result.warnings.length >= 4);
  delete raw.referenceClock;
  assert.equal(summarizeStatus(raw, { now }).referenceClock, null);
  raw.values = { noiseReduction: 101, spatialFocus: 10 }; raw.maxCycles = 384000;
  assert.ok(summarizeStatus(raw, { now }).warnings.some((v) => v.includes('4 ms')));
});

test('counter increments and resets are reported without claiming stability', () => {
  const previous = fixture(), raw = fixture(); raw.packets = 120; raw.crc = 2;
  let result = summarizeStatus(raw, { now, previous });
  assert.equal(result.counterDeltas.packets, 20); assert.equal(result.counterDeltas.crc, 2);
  assert.ok(result.warnings.includes('crc increased'));
  result = summarizeStatus(previous, { now, previous: raw });
  assert.equal(result.counterDeltas.crc, null); assert.ok(result.counterResets.includes('crc'));
});

test('reader never writes commands and never substitutes cached live data on read failure', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wavelength-status-'));
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('wavelength-status-'));
  try {
    const file = path.join(directory, 'hardware-status.json');
    const command = path.join(directory, 'hardware-command.txt');
    await writeFile(file, JSON.stringify(fixture())); await writeFile(command, 'existing command');
    const first = await readSnapshot(file, { now }); assert.equal(first.summary.health, 'live');
    await writeFile(file, '{');
    assert.equal((await readSnapshot(file, { now, previous: first.status })).summary.health, 'unavailable');
    assert.equal((await readSnapshot(path.join(directory, 'missing'), { now })).summary.health, 'unavailable');
    assert.equal(await readFile(command, 'utf8'), 'existing command');
    assert.equal(await readFile(file, 'utf8'), '{');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CLI options constrain observation duration and reject unknown commands', () => {
  assert.equal(optionsFor([]).samples, 1);
  assert.equal(optionsFor(['--file', 'fixture.json', '--json']).file, 'fixture.json');
  for (const args of [['--samples', '0'], ['--interval', '1'], ['--samples', 'NaN'], ['--send']])
    assert.throws(() => optionsFor(args));
});
