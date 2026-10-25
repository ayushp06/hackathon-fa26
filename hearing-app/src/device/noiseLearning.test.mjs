import test from 'node:test';
import assert from 'node:assert/strict';
import { NoiseLearning, noiseLearningMessage } from './noiseLearning.ts';

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


test('learning confirmation follows ID14 ack immediately, before target refresh', async () => {
  const correction = deferred();
  const refresh = deferred();
  const { learning, device, calls } = setup();
  device.confirmNoiseReduction = async (value) => { calls.push([14, value]); return correction.promise; };
  device.getStatus = () => refresh.promise;
  learning.change(80);
  assert.equal(noiseLearningMessage(learning.state, true), 'Adjusting');
  learning.finish(80);
  await turn();
  assert.equal(noiseLearningMessage(learning.state, true), 'Learning preference\u2026');
  assert.equal(learning.state.learnedAt, null);
  correction.resolve(ack);
  await turn();
  assert.equal(learning.state.phase, 'learned');
  const learnedAt = learning.state.learnedAt;
  assert.equal(typeof learnedAt, 'number');
  assert.equal(noiseLearningMessage(learning.state, true, learnedAt + 3999), 'Preference learned');
  assert.equal(learning.state.target, 50); // never substitute selected80 for reported target
  assert.equal(learning.state.pendingValue, 80); // no dial snap to the previous target while refreshing
  const before = calls.length;
  for (let i = 0; i < 100; ++i) learning.observe(true, i % 2 ? 30 : 80);
  assert.equal(learning.state.learnedAt, learnedAt);
  assert.equal(learning.state.phase, 'learned');
  assert.equal(noiseLearningMessage(learning.state, true, learnedAt + 4000), 'Automatic adaptation enabled.');
  assert.equal(calls.length, before); // automatic updates never train or set
  refresh.resolve({ connected: true, noiseReduction: 79 });
  await learning.settled();
  assert.equal(learning.state.target, 79);
  assert.deepEqual(calls, [[1, 80], [14, 80]]);
});

test('target refresh failure preserves accepted correction and surfaces separate warning', async () => {
  const { learning, device, calls } = setup();
  device.getStatus = async () => { throw new Error('status timeout'); };
  learning.change(76); learning.finish(76);
  await learning.settled();
  assert.equal(learning.state.phase, 'learned');
  assert.equal(noiseLearningMessage(learning.state, true, learning.state.learnedAt), 'Preference learned');
  assert.match(learning.state.error, /Preference accepted; device target refresh failed: status timeout/);
  learning.observe(true, 74);
  assert.equal(learning.state.target, 74);
  assert.deepEqual(calls, [[1, 76], [14, 76]]);
});

test('rejected correction shows actual error and never creates a success indicator', async () => {
  const { learning, device } = setup();
  device.confirmNoiseReduction = async () => ({ ...ack, accepted: false });
  learning.change(72); learning.finish(72); await learning.settled();
  assert.equal(learning.state.phase, 'error');
  assert.equal(learning.state.learnedAt, null);
  assert.match(noiseLearningMessage(learning.state, true), /did not acknowledge the preference/);
});
