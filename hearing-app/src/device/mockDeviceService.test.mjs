import assert from 'node:assert/strict';
import test from 'node:test';
import { MockDeviceTransport, mockDeviceService } from './mockDeviceService.ts';

test('mock device can be scanned, connected, and disconnected', async () => {
  const [device] = await mockDeviceService.scan();
  assert.equal((await mockDeviceService.connect()).id, device.id);
  assert.equal((await mockDeviceService.getStatus()).connected, true);
  assert.equal((await mockDeviceService.connect(device.id)).id, device.id);
  await mockDeviceService.disconnect();
  assert.equal((await mockDeviceService.getStatus()).connected, false);
  await assert.rejects(mockDeviceService.connect('unknown'), /Device not found/);
});

test('mock transport acknowledges independent controls and reports simulated status', async () => {
  const transport = new MockDeviceTransport();
  const automatic = await transport.setVolume(72, 'automatic');
  const manual = await transport.setVolume(31, 'manual');
  await transport.setNoiseReduction(64);
  await transport.setSpatialFocus(28);
  await transport.setSpeechAmplification(81);
  await transport.setBass(25);
  await transport.setMid(46);
  await transport.setTreble(73);
  assert.deepEqual([automatic.sequence, manual.sequence], [1, 2]);
  assert.equal(automatic.simulated, true);
  assert.equal(automatic.accepted, true);
  assert.deepEqual(await transport.getStatus(), {
    simulated: true, connected: false, volume: 72, baseVolume: 31,
    noiseReduction: 64, spatialFocus: 28, speechAmplification: 81,
    bass: 25, mid: 46, treble: 73, calibrationStatus: 'idle',
  });
  await assert.rejects(transport.setNoiseReduction(101), /0 to 100/);
  await assert.rejects(transport.setSpeechAmplification(-1), /0 to 100/);
  await assert.rejects(transport.setBass(100.5), /0 to 100/);
  assert.equal((await transport.getStatus()).noiseReduction, 64);
  assert.equal((await transport.getStatus()).bass, 25);
});

test('mock transport calibration reports progress and a saved-result shape', async () => {
  const transport = new MockDeviceTransport();
  const pending = transport.startCalibration(40);
  assert.equal((await transport.getStatus()).calibrationStatus, 'loading');
  assert.equal((await pending).volumePercent, 40);
  assert.equal((await transport.getStatus()).calibrationStatus, 'complete');
});
