import test from 'node:test';
import assert from 'node:assert/strict';
import { HardwareDeviceService } from './hardwareDeviceService.ts';

test('saved controls wait for connection and volume is restored last', async (t) => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const data = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, data });
    return Response.json(url.endsWith('/connect') ? { id: 'stm32-usb', name: 'STM32' }
      : { accepted: true, simulated: false, sequence: calls.length });
  };
  t.after(() => { globalThis.fetch = original; });
  const service = new HardwareDeviceService();
  assert.equal((await service.setVolume(23)).accepted, false);
  await service.setNoiseReduction(75);
  assert.equal(calls.length, 0);
  await service.connect();
  assert.deepEqual(calls.filter((item) => item.url.endsWith('/control')).map((item) => item.data), [
    { control: 'volume', value: 0 }, { control: 'noiseReduction', value: 75 }, { control: 'volume', value: 23 },
  ]);
  const before = calls.length;
  const changes = await Promise.all([service.setBass(1), service.setBass(2), service.setBass(3)]);
  assert.equal(calls.length, before + 1);
  assert.deepEqual(calls.at(-1).data, { control: 'bass', value: 3 });
  assert.ok(changes.every((ack) => ack.accepted && !ack.simulated));
  assert.equal((await service.setSpatialFocus(99)).accepted, true);
  assert.deepEqual(calls.at(-1).data, { control: 'spatialFocus', value: 99 });
  assert.equal((await service.setReduceLoudSounds(75)).accepted, true);
  assert.deepEqual(calls.at(-1).data, { control: 'reduceLoudSounds', value: 75 });
  assert.equal(calls.length, before + 3);
  await assert.rejects(service.setReduceLoudSounds(-1), RangeError);
  await assert.rejects(service.setNoiseReduction(101), RangeError);
});

test('offline and rejected commands never report an applied setting', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/connect')) return Response.json({ id: 'stm32-usb', name: 'STM32' });
    return Response.json({ error: 'No firmware acknowledgment' }, { status: 504 });
  };
  t.after(() => { globalThis.fetch = original; });
  const service = new HardwareDeviceService();
  await assert.rejects(service.connect(), /No firmware acknowledgment/);
  assert.equal((await service.setVolume(50)).accepted, false);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(service.scan(), /USB bridge unavailable/);
});

test('a deliberate correction waits for the final ordinary setter acknowledgment', async (t) => {
  const original = globalThis.fetch;
  const calls = [];
  let releaseSetter;
  globalThis.fetch = async (url, options = {}) => {
    const data = options.body ? JSON.parse(options.body) : null;
    calls.push({ route: url.slice(url.lastIndexOf('/')), data });
    if (url.endsWith('/connect')) return Response.json({ id: 'stm32-usb', name: 'STM32' });
    if (url.endsWith('/control') && data.control === 'noiseReduction') {
      await new Promise((resolve) => { releaseSetter = resolve; });
    }
    return Response.json({ accepted: true, simulated: false, sequence: calls.length });
  };
  t.after(() => { globalThis.fetch = original; });
  const service = new HardwareDeviceService();
  await service.connect();
  const correction = service.confirmNoiseReduction(68);
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(calls.slice(-1), [{ route: '/control', data: { control: 'noiseReduction', value: 68 } }]);
  releaseSetter();
  assert.equal((await correction).accepted, true);
  assert.deepEqual(calls.at(-1), { route: '/noise-feedback', data: { value: 68 } });
  assert.equal(calls.filter(({ route }) => route === '/noise-feedback').length, 1);
});
