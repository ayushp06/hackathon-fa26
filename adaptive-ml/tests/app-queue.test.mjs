import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHardwareServer, replaceFile } from '../../scripts/hardware-server.mjs';
import { HardwareDeviceService } from '../../hearing-app/src/device/hardwareDeviceService.ts';

test('real service + HTTP queue publish adaptive IDs and require matching acknowledgments', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wavelength-ml-'));
  const statusPath = path.join(directory, 'hardware-status.json');
  const commandPath = path.join(directory, 'hardware-command.txt');
  const state = { streaming: true, protocol: 4, commandSequence: 0, commandStatus: 0,
    values: { noiseReduction: 50 }, referenceClock: true };
  const commands = [];
  let reject = false, stopped = false, holdSetter = false;
  let setterSeen;
  const pendingSetter = new Promise(resolve => { setterSeen = resolve; });
  async function publish() {
    await writeFile(statusPath+'.tmp', JSON.stringify({ ...state, timestampMs: Date.now() }));
    await replaceFile(statusPath+'.tmp', statusPath);
  }
  await publish();
  const server = createHardwareServer({ directory, commandTimeout: 1000 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const original = globalThis.fetch;
  // Redirect only the address; real HTTP, real service and production queue execute.
  globalThis.fetch = (url, options) => original(String(url).replace('127.0.0.1:8765',
    `127.0.0.1:${server.address().port}`), options);
  const emulation = (async () => {
    while (!stopped) {
      let fields;
      try { fields = (await readFile(commandPath, 'utf8')).trim().split(' ').map(Number); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (fields && fields[2] !== state.commandSequence) {
        const [id, value, sequence] = fields;
        if (id === 1 && holdSetter) {
          setterSeen();
          await new Promise(resolve => setTimeout(resolve, 10));
          continue; // Publish no acknowledgment until explicitly released below.
        }
        commands.push({ id, value, sequence });
        state.commandSequence = sequence;
        state.commandStatus = reject ? 1 : 0;
        if (!reject && (id === 1 || id === 14)) state.values.noiseReduction = value;
      }
      await publish();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  })();
  t.after(async () => {
    globalThis.fetch = original; stopped = true; await emulation;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.ok(directory.startsWith(path.join(os.tmpdir(), 'wavelength-ml-')));
    await rm(directory, { recursive: true });
  });
  const service = new HardwareDeviceService();
  assert.equal((await service.setNoiseReduction(60)).accepted, false);
  await service.connect();
  assert.deepEqual(commands, []); // saved/offline desired values are not replayed
  await assert.rejects(service.confirmNoiseReduction(60), /Adjust the noise reduction dial/);
  holdSetter = true;
  const setters = Promise.all([service.setNoiseReduction(70), service.setNoiseReduction(80)]);
  await pendingSetter;
  const confirmation = service.confirmNoiseReduction(80);
  await assert.rejects(service.setNoiseReduction(30), /current learning action/);
  await assert.rejects(service.confirmNoiseReduction(80), /current learning action/);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(commands, []); // ID 14 cannot precede the final setter's ack
  holdSetter = false;
  await setters;
  await confirmation;
  assert.deepEqual(commands.map(c => [c.id,c.value]), [[1,80],[14,80]]);
  await assert.rejects(service.confirmNoiseReduction(80), /Adjust the noise reduction dial/);
  assert.equal(commands.filter(c => c.id===14).length,1); // no duplicate confirmation
  await service.setNoiseAdaptation(true);
  await service.setNoiseAdaptation(false);
  await service.clearNoisePreferences();
  assert.deepEqual(commands.map(c => [c.id,c.value]), [[1,80],[14,80],[15,1],[15,0],[16,0]]);
  assert.equal(new Set(commands.map(c => c.sequence)).size, commands.length);
  const before = commands.length;
  assert.equal((await service.getStatus()).noiseReduction,80);
  await new Promise(resolve => setTimeout(resolve,80));
  assert.equal(commands.length,before); // telemetry emits no setters
  await service.disconnect();
  const afterDisconnect = commands.length; // disconnect may mute; never trains
  await service.connect();
  await assert.rejects(service.confirmNoiseReduction(80), /Adjust the noise reduction dial/);
  assert.equal(commands.length,afterDisconnect); // reconnect never replays controls
  reject = true;
  await assert.rejects(service.setNoiseReduction(30), /rejected/);
  await assert.rejects(service.confirmNoiseReduction(30), /Adjust the noise reduction dial/);
  assert.equal(commands.filter(c => c.id===14).length,1); // failed setter never trains
});
