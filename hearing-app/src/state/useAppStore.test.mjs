import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('hydration, profile restoration and autonomous telemetry never issue device commands', async (t) => {
  const calls = [];
  let target = 50;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, body: options.body && JSON.parse(options.body) });
    if (url.endsWith('/connect')) return Response.json({ id: 'stm32-usb', name: 'STM32' });
    if (url.endsWith('/control')) target = JSON.parse(options.body).value;
    if (url.endsWith('/reset-learning')) target = 50;
    if (url.endsWith('/status')) return Response.json({ connected: true, values: { noiseReduction: target } });
    return Response.json({ accepted: true, sequence: 1 });
  };
  const saved = { volume: 65, noiseReduction: 91, spatialFocus: 0, savedProfile: {
    volume: 22, noiseReduction: 88, reduceLoudSounds: 0, spatialFocus: 0, speechAmplification: 50,
    bass: 0, mid: 0, treble: 0, eq250: 0, eq500: 0, eq2000: 0, eq4000: 0,
  } };
  globalThis.wavelengthTestStorage = JSON.stringify({ state: saved, version: 4 });
  const serviceUrl = new URL('../device/hardwareDeviceService.ts', import.meta.url).href;
  const dataModule = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@react-native-async-storage/async-storage') return dataModule('export default {getItem: async () => globalThis.wavelengthTestStorage, setItem: async () => {}, removeItem: async () => {}}');
      if (specifier.endsWith('/deviceService')) return dataModule(`export { hardwareDeviceService as deviceService } from ${JSON.stringify(serviceUrl)}; export const hardwareMode = true;`);
      if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return nextResolve(specifier + '.ts', context);
      return nextResolve(specifier, context);
    },
  });
  t.after(() => { hooks.deregister(); globalThis.fetch = originalFetch; delete globalThis.wavelengthTestStorage; });
  const { useAppStore } = await import('./useAppStore.ts');
  const { hardwareDeviceService } = await import('../device/hardwareDeviceService.ts');
  await useAppStore.persist.rehydrate();
  assert.equal(useAppStore.getState().hydrated, true);
  assert.equal(useAppStore.getState().noiseReduction, 91);
  assert.deepEqual(calls, []);
  await hardwareDeviceService.connect();
  calls.length = 0;
  useAppStore.getState().syncNoiseStatus(true, 80);
  assert.equal(useAppStore.getState().noiseReduction, 80);
  assert.equal(await useAppStore.getState().restoreProfile(), true);
  assert.equal(useAppStore.getState().volume, 22);
  assert.equal(useAppStore.getState().noiseReduction, 80);
  useAppStore.getState().syncNoiseStatus(true, 30);
  assert.equal(useAppStore.getState().noiseReduction, 30);
  assert.equal(useAppStore.getState().appliedNoiseReduction, 30);
  useAppStore.getState().syncNoiseStatus(false, null);
  await hardwareDeviceService.connect();
  useAppStore.getState().syncNoiseStatus(true, 80);
  assert.deepEqual(calls.map(({ url }) => url.slice(url.lastIndexOf('/'))), ['/connect']);
  calls.length = 0;
  useAppStore.getState().beginNoiseAdjustment();
  useAppStore.getState().setValue('noiseReduction', 77);
  useAppStore.getState().syncNoiseStatus(true, 30);
  await useAppStore.getState().restoreProfile();
  assert.equal(useAppStore.getState().noiseReduction, 77);
  assert.equal(useAppStore.getState().appliedNoiseReduction, 30);
  useAppStore.getState().finishNoiseAdjustment(77);
  const deadline = Date.now() + 1000;
  while (useAppStore.getState().noiseLearning.phase === 'saving' && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(useAppStore.getState().noiseLearning.phase, 'learned');
  assert.deepEqual(calls.filter(({ url }) => !url.endsWith('/status')).map(({ url, body }) => [url.slice(url.lastIndexOf('/')), body]), [
    ['/control', { control: 'noiseReduction', value: 77 }], ['/noise-feedback', { value: 77 }],
  ]);
  calls.length = 0;
  await useAppStore.getState().resetNoiseLearning();
  useAppStore.getState().syncNoiseStatus(true, 50);
  assert.equal(useAppStore.getState().noiseLearning.phase, 'automatic');
  assert.equal(calls.filter(({ url }) => url.endsWith('/control') || url.endsWith('/noise-feedback')).length, 0);
});
