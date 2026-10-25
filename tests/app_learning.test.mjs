import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHardwareServer, replaceFile } from '../scripts/hardware-server.mjs';
import { HardwareDeviceService } from '../hearing-app/src/device/hardwareDeviceService.ts';
import { NoiseLearning } from '../hearing-app/src/device/noiseLearning.ts';

test('app → HTTP queue → command-file emulator learns A/B and observes recall without writing', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wavelength-learning-'));
  const statusPath = path.join(directory, 'hardware-status.json');
  const commandPath = path.join(directory, 'hardware-command.txt');
  const state = { timestampMs: Date.now(), streaming: true, protocol: 4, referenceClock: true,
    commandSequence: 0, commandStatus: 0, values: { noiseReduction: 50 } };
  const commands = [];
  // Protocol emulator only: A/B stand in for firmware acoustic measurements, not app scene logic.
  const preferences = new Map();
  let environment = 'A';
  let automatic = false;
  let rejectId = -1;
  let stopped = false;
  const publish = async () => {
    state.timestampMs = Date.now();
    await writeFile(statusPath + '.tmp', JSON.stringify(state));
    await replaceFile(statusPath + '.tmp', statusPath);
  };
  await publish();
  const server = createHardwareServer({ directory, commandTimeout: 500 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => originalFetch(String(url).replace('http://127.0.0.1:8765', address), options);
  const emulation = (async () => {
    while (!stopped) {
      let command;
      try { command = (await readFile(commandPath, 'utf8')).trim().split(' ').map(Number); }
      catch { /* Nothing pending. */ }
      if (command && command[2] !== state.commandSequence) {
        const [id, value, sequence] = command;
        commands.push([id, value, sequence]);
        state.commandSequence = sequence;
        state.commandStatus = id === rejectId ? 1 : 0;
        if (!state.commandStatus) {
          if (id === 1) { state.values.noiseReduction = value; automatic = false; }
          if (id === 14) { preferences.set(environment, value); automatic = true; }
          if (id === 15) automatic = value === 1;
          if (id === 16) { preferences.clear(); automatic = false; }
        }
      }
      if (automatic) state.values.noiseReduction = preferences.get(environment) ?? 50;
      await publish();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  })();
  t.after(async () => {
    globalThis.fetch = originalFetch;
    stopped = true;
    await emulation;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true });
  });
  const service = new HardwareDeviceService();
  const learning = new NoiseLearning(service, () => {});
  await service.connect();
  learning.observe(true, (await service.getStatus()).noiseReduction);
  assert.deepEqual(commands, []);
  await learning.reset();
  assert.deepEqual(commands.map(([id, value]) => [id, value]), [[16, 0], [15, 1]]);
  for (const [scene, value] of [['A', 83], ['B', 27]]) {
    environment = scene;
    learning.begin(learning.state.target);
    learning.change(value - 5); learning.change(value); learning.finish(value);
    await learning.settled();
    assert.equal(learning.state.phase, 'learned');
    assert.equal(preferences.get(scene), value);
  }
  assert.deepEqual(commands.map(([id, value]) => [id, value]), [[16, 0], [15, 1], [1, 83], [14, 83], [1, 27], [14, 27]]);
  const beforeRecall = commands.length;
  for (const [scene, value] of [['A', 83], ['B', 27], ['A', 83], ['B', 27]]) {
    environment = scene;
    await new Promise((resolve) => setTimeout(resolve, 15));
    const status = await service.getStatus();
    learning.observe(status.connected, status.noiseReduction);
    assert.equal(learning.state.target, value);
  }
  assert.equal(commands.length, beforeRecall);
  await service.disconnect();
  const beforeReconnect = commands.length;
  await service.connect();
  learning.observe(true, (await service.getStatus()).noiseReduction);
  assert.equal(commands.length, beforeReconnect);
  rejectId = 14;
  learning.change(64); learning.finish(64); await learning.settled();
  assert.equal(learning.state.phase, 'error');
  const afterReject = commands.length;
  learning.observe(true, 64); learning.finish(64); await learning.settled();
  assert.equal(commands.length, afterReject);
  rejectId = 15;
  await assert.rejects(learning.reset(), /rejected/);
  assert.equal(learning.state.phase, 'error');
  rejectId = -1;
  await learning.reset();
  assert.equal(preferences.size, 0);
  assert.equal(automatic, true);
  assert.equal(learning.state.target, 50);
  assert.equal(new Set(commands.map(([, , sequence]) => sequence)).size, commands.length);
});
