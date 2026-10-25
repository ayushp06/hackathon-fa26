// Read-only MIC4 status observer. No command writes, HTTP, serial or child processes.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const counters = ['packets', 'missing', 'crc', 'firmwareDrops', 'underruns', 'overflow'];
const unobservable = ['ML build capability', 'autonomy mode', 'normalized context',
  'prediction value', 'model examples', 'correction count', 'foreground cycles'];
const integer = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const percent = (value) => integer(value) !== null && value <= 100 ? value : null;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function summarizeStatus(status, { now = Date.now(), previous = null } = {}) {
  if (!object(status)) return { sampledAtMs: now, health: 'invalid', error: 'Status must be an object', unobservable };
  const ageMs = typeof status.timestampMs === 'number' && Number.isFinite(status.timestampMs)
    ? now - status.timestampMs : null;
  const error = typeof status.error === 'string' && status.error ? status.error : null;
  const health = ageMs === null || typeof status.streaming !== 'boolean' ? 'invalid'
    : ageMs < -1000 || ageMs >= 1500 ? 'stale'
    : error ? 'fault' : !status.streaming ? 'stopped'
    : status.protocol !== 4 ? 'incompatible' : 'live';
  const appliedStrength = percent(status.values?.noiseReduction);
  const spatialFocus = percent(status.values?.spatialFocus);
  const primaryRms = integer(status.primaryRms), referenceRms = integer(status.referenceRms);
  const maxCycles = integer(status.maxCycles);
  const warnings = [];
  if (status.referenceClock !== true) warnings.push('Reference clock not confirmed');
  if (!(primaryRms > 0 && referenceRms > 0)) warnings.push('Nonzero microphone inputs not confirmed');
  if (spatialFocus !== 0) warnings.push('Spatial focus is enabled or unknown');
  if (appliedStrength === null) warnings.push('Applied strength unavailable');
  if (maxCycles === null) warnings.push('Callback timing unavailable');
  else if (maxCycles >= 384000) warnings.push('Callback maximum reaches 4 ms at nominal 96 MHz');
  const observedCounters = {}, counterDeltas = {}, counterResets = [];
  for (const key of counters) {
    observedCounters[key] = integer(status[key]);
    const before = object(previous) ? integer(previous[key]) : null;
    const after = observedCounters[key];
    counterDeltas[key] = before === null || after === null || after < before ? null : after - before;
    if (before !== null && after !== null && after < before) counterResets.push(key);
    if (key !== 'packets' && counterDeltas[key] > 0) warnings.push(`${key} increased`);
  }
  return {
    sampledAtMs: now, statusTimestampMs: status.timestampMs ?? null, ageMs, health, error,
    protocol: status.protocol ?? null, appliedStrength, spatialFocus, primaryRms, referenceRms,
    outputRms: integer(status.outputRms), referenceClock: typeof status.referenceClock === 'boolean' ? status.referenceClock : null,
    filter: typeof status.filter === 'string' ? status.filter : null, maxCycles,
    commandSequence: integer(status.commandSequence), commandStatus: integer(status.commandStatus),
    counters: observedCounters, counterDeltas, counterResets, warnings, unobservable,
  };
}

export async function readSnapshot(file, options) {
  try {
    const status = JSON.parse(await readFile(file, 'utf8'));
    return { status, summary: summarizeStatus(status, options) };
  } catch (failure) {
    return { status: null, summary: { sampledAtMs: options?.now ?? Date.now(), health: 'unavailable',
      error: failure instanceof SyntaxError ? 'Invalid JSON; no cached values used' : `Cannot read status (${failure.code ?? 'unknown'})`,
      unobservable } };
  }
}

export function optionsFor(args) {
  const { values } = parseArgs({ args, options: { file: { type: 'string' },
    samples: { type: 'string', default: '1' }, interval: { type: 'string', default: '250' },
    json: { type: 'boolean', default: false }, help: { type: 'boolean', default: false } } });
  const samples = Number(values.samples), interval = Number(values.interval);
  if (!Number.isInteger(samples) || samples < 1 || samples > 100000
      || !Number.isInteger(interval) || interval < 50 || interval > 60000) {
    throw new Error('samples must be 1..100000; interval must be 50..60000 milliseconds');
  }
  return { ...values, samples, interval, file: values.file
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../build/hardware-status.json') };
}

async function main() {
  const options = optionsFor(process.argv.slice(2));
  if (options.help) {
    console.log('Read-only: node adaptive-ml/tools/status-summary.mjs [--file PATH] [--samples N] [--interval MS] [--json]');
    console.log('Reads existing status only. ML context/counters/mode are not externally observable. No serial connection.');
    return;
  }
  let previous = null;
  for (let i = 0; i < options.samples; ++i) {
    const { status, summary } = await readSnapshot(options.file, { previous });
    if (status !== null) previous = status;
    console.log(options.json ? JSON.stringify(summary) :
      `${summary.health}: age=${summary.ageMs ?? '?'}ms appliedStrength=${summary.appliedStrength ?? '?'} `
      + `ack=${summary.commandSequence ?? '?'}/${summary.commandStatus ?? '?'} `
      + `maxCycles=${summary.maxCycles ?? '?'} ${summary.error ?? ''} ${(summary.warnings ?? []).join('; ')} `
      + '[ML context/mode/counters unavailable in status]');
    if (summary.health !== 'live') process.exitCode = 1;
    if (i + 1 < options.samples) await new Promise((resolve) => setTimeout(resolve, options.interval));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((failure) => { console.error(failure.message); process.exitCode = 2; });
}
