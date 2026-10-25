import test from 'node:test';
import assert from 'node:assert/strict';
import { NoiseLearning } from './noiseLearning.ts';

const ack = { accepted: true, sequence: 1, simulated: false };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const turn = () => new Promise((resolve) => setImmediate(resolve));
function setup(overrides = {}) {
  const calls = [];
  let target = 50;
  const device = {
    setNoiseReduction: async (n) => { calls.push([1, n]); target = n; return ack; },
    confirmNoiseReduction: async (n) => { calls.push([14, n]); return ack; },
    resetLearning: async () => { calls.push([16, 0], [15, 1]); target = 50; },
    getStatus: async () => ({ connected: true, noiseReduction: target }),
    ...overrides,
  };
  const states = [];
  const learning = new NoiseLearning(device, (state) => states.push(state));
  learning.observe(true, 50);
  return { learning, calls, states, device };
}

test('one completed adjustment learns only its final acknowledged value', async () => {
  const { learning, calls } = setup();
  learning.begin(50);
  learning.change(61);
  await turn();
  learning.change(83);
  await turn();
  assert.deepEqual(calls, [[1, 61], [1, 83]]);
  learning.finish(83);
  learning.finish(83);
  await learning.settled();
  assert.deepEqual(calls, [[1, 61], [1, 83], [14, 83]]);
  assert.equal(learning.state.phase, 'learned');
  assert.equal(learning.state.target, 83);
});

test('rapid edits wait for the final setter ack and stale feedback cannot overwrite the next selection', async () => {
  const setter = deferred();
  const feedback = deferred();
  const { learning, calls, device } = setup();
  device.setNoiseReduction = async (n) => { calls.push([1, n]); if (n === 81) await setter.promise; return ack; };
  device.confirmNoiseReduction = async (n) => { calls.push([14, n]); if (n === 81) await feedback.promise; return ack; };
  learning.begin(50); learning.change(60); learning.change(81); learning.finish(81);
  await turn();
  assert.deepEqual(calls, [[1, 81]]);
  setter.resolve(); await turn();
  assert.deepEqual(calls, [[1, 81], [14, 81]]);
  learning.begin(81); learning.change(40); learning.change(27); learning.finish(27);
  learning.observe(true, 81);
  assert.equal(learning.state.pendingValue, 27);
  assert.equal(learning.state.target, 81);
  assert.deepEqual(calls, [[1, 81], [14, 81]]);
  feedback.resolve();
  await learning.settled();
  assert.deepEqual(calls, [[1, 81], [14, 81], [1, 27], [14, 27]]);
  assert.equal(learning.state.phase, 'learned');
});

test('setter failure prevents training and correction rejection is never silently retried', async () => {
  const { learning, calls, device } = setup();
  device.setNoiseReduction = async (n) => { calls.push([1, n]); throw new Error('setter rejected'); };
  learning.change(71); learning.finish(71); await learning.settled();
  assert.deepEqual(calls, [[1, 71]]);
  assert.match(learning.state.error, /setter rejected/);
  device.setNoiseReduction = async (n) => { calls.push([1, n]); return ack; };
  device.confirmNoiseReduction = async (n) => { calls.push([14, n]); throw new Error('context unstable'); };
  learning.change(73); learning.finish(73); await learning.settled();
  learning.finish(73); learning.observe(true, 73); await learning.settled();
  assert.match(learning.state.error, /context unstable/);
  assert.deepEqual(calls, [[1, 71], [1, 73], [14, 73]]);
});

test('mount, reconnect, autonomous telemetry, and taps produce no setters or corrections', async () => {
  const { learning, calls } = setup();
  learning.observe(true, 80);
  learning.observe(false, null);
  learning.observe(true, 30);
  learning.begin(30); learning.finish(30);
  await learning.settled();
  assert.equal(learning.state.target, 30);
  assert.deepEqual(calls, []);
});

test('reset waits for in-flight feedback, cancels queued adjustments, and leaves no stale success', async () => {
  const feedback = deferred();
  const { learning, calls, device } = setup();
  device.confirmNoiseReduction = async (n) => { calls.push([14, n]); await feedback.promise; return ack; };
  learning.change(80); learning.finish(80); await turn();
  learning.change(30); learning.finish(30);
  const reset = learning.reset();
  learning.change(99); learning.finish(99);
  await turn();
  assert.equal(learning.state.phase, 'resetting');
  assert.deepEqual(calls, [[1, 80], [14, 80]]);
  feedback.resolve(); await reset;
  assert.deepEqual(calls, [[1, 80], [14, 80], [16, 0], [15, 1]]);
  assert.equal(learning.state.phase, 'automatic');
  assert.equal(learning.state.pendingValue, null);
  assert.equal(learning.state.target, 50);
});

test('disconnect cancels unfinished training and reset failures show errors', async () => {
  const setter = deferred();
  const { learning, calls, device } = setup();
  device.setNoiseReduction = async (n) => { calls.push([1, n]); await setter.promise; return ack; };
  learning.change(68); learning.finish(68); await turn();
  learning.observe(false, null); learning.observe(true, 68);
  setter.resolve(); await learning.settled();
  assert.deepEqual(calls, [[1, 68]]);
  device.resetLearning = async () => { throw new Error('enable rejected'); };
  await assert.rejects(learning.reset(), /enable rejected/);
  assert.equal(learning.state.phase, 'error');
});

test('reset cancels an unfinished gesture without waiting for release or submitting feedback', async () => {
  const { learning, calls } = setup();
  learning.begin(50); learning.change(79); await turn();
  await learning.reset();
  learning.finish(79);
  await learning.settled();
  assert.deepEqual(calls, [[1, 79], [16, 0], [15, 1]]);
  assert.equal(learning.state.phase, 'automatic');
});

test('an older rejected correction cannot replace the status of a newer edit', async () => {
  const response = deferred();
  const { learning, device, calls } = setup();
  device.confirmNoiseReduction = async (n) => {
    calls.push([14, n]);
    if (n === 81) { await response.promise; throw new Error('old correction rejected'); }
    return ack;
  };
  learning.change(81); learning.finish(81); await turn();
  learning.change(29); learning.finish(29);
  response.resolve(); await learning.settled();
  assert.equal(learning.state.phase, 'learned');
  assert.equal(learning.state.error, null);
  assert.equal(learning.state.target, 29);
  assert.deepEqual(calls, [[1, 81], [14, 81], [1, 29], [14, 29]]);
});
