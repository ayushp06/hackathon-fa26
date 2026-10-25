import test from 'node:test';
import assert from 'node:assert/strict';
import { HardwareDeviceService } from './hardwareDeviceService.ts';

test('reconnect does not replay saved controls or noise reduction', async (t) => {
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
  assert.deepEqual(calls.filter((item) => item.url.endsWith('/control')), []);
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
  await service.disconnect();
  await service.connect();
  assert.equal(calls.filter((item) => item.url.endsWith('/control') && item.data.control === 'noiseReduction').length, 0);
  await assert.rejects(service.setReduceLoudSounds(-1), RangeError);
  await assert.rejects(service.setNoiseReduction(101), RangeError);
});

test('reset waits for pending setter and blocks corrections until refreshed', async (t) => {
  const original = globalThis.fetch;
  const calls = [];
  let releaseSetter;
  globalThis.fetch = async (url, options = {}) => {
    const data = options.body ? JSON.parse(options.body) : null;
    calls.push({ route: url.slice(url.lastIndexOf('/')), data });
    if (url.endsWith('/connect')) return Response.json({ id: 'stm32-usb', name: 'STM32' });
    if (url.endsWith('/control')) await new Promise((resolve) => { releaseSetter = resolve; });
    return Response.json(url.endsWith('/status') ? { connected: true, values: { noiseReduction: 50 } } : { accepted: true });
  };
  t.after(() => { globalThis.fetch = original; });
  const service = new HardwareDeviceService();
  await service.connect();
  const setter = service.setNoiseReduction(80);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const reset = service.resetLearning();
  await assert.rejects(service.confirmNoiseReduction(80), /current learning action/);
  await assert.rejects(service.setNoiseReduction(30), /current learning action/);
  assert.equal(calls.some(({ route }) => route === '/reset-learning'), false);
  releaseSetter();
  await setter;
  await reset;
  assert.equal((await service.getStatus()).noiseReduction, 50);
  await assert.rejects(service.confirmNoiseReduction(80), /Adjust the noise reduction dial/);
  assert.deepEqual(calls.map(({ route }) => route), ['/connect', '/control', '/reset-learning', '/status']);
  assert.equal(calls.some(({ route }) => route === '/noise-feedback'), false);
});

test('offline and rejected commands never report an applied setting', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/connect')) return Response.json({ id: 'stm32-usb', name: 'STM32' });
    return Response.json({ error: 'No firmware acknowledgment' }, { status: 504 });
  };
  t.after(() => { globalThis.fetch = original; });
  const service = new HardwareDeviceService();
  await service.connect();
  await assert.rejects(service.setVolume(50), /No firmware acknowledgment/);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(service.scan(), /USB bridge unavailable/);
});

test('a deliberate correction waits for the ordinary setter acknowledgment without repeating it', async (t) => {
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
  await assert.rejects(service.confirmNoiseReduction(68), /Adjust the noise reduction dial/);
  const setter = service.setNoiseReduction(68);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const correction = service.confirmNoiseReduction(68);
  assert.deepEqual(calls.slice(-1), [{ route: '/control', data: { control: 'noiseReduction', value: 68 } }]);
  releaseSetter();
  await setter;
  assert.equal((await correction).accepted, true);
  assert.deepEqual(calls.at(-1), { route: '/noise-feedback', data: { value: 68 } });
  assert.equal(calls.filter(({ route }) => route === '/noise-feedback').length, 1);
  assert.equal(calls.filter(({ route, data }) => route === '/control' && data.control === 'noiseReduction').length, 1);
  await assert.rejects(service.confirmNoiseReduction(68), /Adjust the noise reduction dial/);
});
