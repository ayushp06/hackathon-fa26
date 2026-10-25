import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHardwareServer, replaceFile } from '../scripts/hardware-server.mjs';

test('loopback bridge requires live hardware and firmware acknowledgment', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wavelength-bridge-'));
  const statusPath = path.join(directory, 'hardware-status.json');
  const commandPath = path.join(directory, 'hardware-command.txt');
  const values = { volume: 50, noiseReduction: 100, speechAmplification: 0, bass: 0, mid: 0, treble: 0, eq250: 0, eq500: 0, eq2000: 0, eq4000: 0 };
  const state = { timestampMs: Date.now(), streaming: true, protocol: 3, port: 'COM8', referenceRms: 20, values, commandSequence: 0, commandStatus: 0 };
  let acknowledge = true;
  let rejectId = -1;
  const commands = [];
  let publication=Promise.resolve();
  const publish = () => publication=publication.then(async () => {
    await writeFile(statusPath + '.tmp', JSON.stringify(state));
    await replaceFile(statusPath + '.tmp', statusPath);
  });
  await publish();
  const server = createHardwareServer({ directory, commandTimeout: 1000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}/api`;
  let stopped = false;
  const emulate = async () => {
    while (!stopped) {
      if (acknowledge) {
        try {
          const [id, value, sequence] = (await readFile(commandPath, 'utf8')).split(' ').map(Number);
          if (state.commandSequence !== sequence) commands.push({ id, value, sequence });
          state.commandSequence = sequence;
          state.commandStatus = id === rejectId ? 1 : 0;
          if (id < 10 || id === 12 || id === 13) state.values[id===12?'reduceLoudSounds':id===13?'spatialFocus':Object.keys(values)[id]] = value;
        } catch { /* No pending command yet. */ }
      }
      state.timestampMs = Date.now();
      await publish();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  let emulationFailure;
  const emulation = emulate().catch((failure) => { emulationFailure = failure; });
  t.after(async () => {
    stopped = true; await emulation;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(directory).startsWith('wavelength-bridge-'));
    await rm(directory, { recursive: true });
    if (emulationFailure) throw emulationFailure;
  });
  const post = (route, data, origin = 'http://localhost:8081') => fetch(address + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data),
  });
  assert.equal((await post('/control', { control: 'volume', value: 20 })).status, 503);
  assert.equal((await post('/connect', { id: 'stm32-usb' }, 'https://untrusted.example')).status, 403);
  assert.equal((await post('/connect', { id: 'stm32-usb' })).status, 200);
  assert.equal((await post('/control', { control: 'spatialFocus', value: 50 })).status, 422);
  assert.equal((await post('/control', { control: 'volume', value: 101 })).status, 400);
  const applied = await (await post('/control', { control: 'volume', value: 27 })).json();
  assert.equal(applied.accepted, true, JSON.stringify(applied)); assert.equal(applied.simulated, false);
  assert.equal(applied.sequence, state.commandSequence); assert.equal(state.values.volume, 27);
  state.protocol=4; state.referenceClock=true;
  await publish();
  for (const control of ['reduceLoudSounds','spatialFocus']) {
    const extended=await (await post('/control',{control,value:80})).json();
    assert.equal(extended.accepted,true,JSON.stringify(extended));
    assert.equal(state.values[control],80);
    assert.equal((await post('/control',{control,value:101})).status,400);
  }
  state.referenceClock=false; await publish();
  assert.equal((await post('/control',{control:'spatialFocus',value:50})).status,422);
  state.referenceClock=true; await publish();
  assert.equal((await post('/noise-feedback',{value:101})).status,400);
  assert.equal((await post('/noise-adaptation',{enabled:1})).status,400);
  assert.equal((await post('/noise-feedback',{value:68})).status,200);
  assert.equal((await post('/noise-adaptation',{enabled:true})).status,200);
  assert.equal((await post('/noise-adaptation',{enabled:false})).status,200);
  assert.equal((await post('/noise-preferences',{})).status,200);
  assert.deepEqual(commands.slice(-4).map(({id,value})=>[id,value]),[[14,68],[15,1],[15,0],[16,0]]);
  rejectId=14;
  assert.equal((await post('/noise-feedback',{value:68})).status,422);
  rejectId=-1;
  acknowledge = false;
  assert.equal((await post('/control', { control: 'volume', value: 12 })).status, 504);
  assert.equal(state.values.volume, 27);
  acknowledge = true;
  assert.equal((await post('/disconnect', {})).status, 200);
  assert.equal(state.values.volume, 0);
  assert.equal((await (await fetch(address + '/status')).json()).connected, false);
});
