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
  const volume = await transport.setVolume(72);
  await transport.setNoiseReduction(64);
  await transport.setReduceLoudSounds(70);
  await transport.setSpatialFocus(28);
  await transport.setSpeechAmplification(81);
  await transport.setBass(-8);
  await transport.setMid(0);
  await transport.setTreble(12);
  await transport.setFineEq(250, 4);
  await transport.setFineEq(500, -3);
  await transport.setFineEq(2000, 6);
  await transport.setFineEq(4000, -2);
  assert.equal(volume.sequence, 1);
  assert.equal(volume.simulated, true);
  assert.equal(volume.accepted, true);
  assert.deepEqual(await transport.getStatus(), {
    simulated: true, connected: false, volume: 72,
    noiseReduction: 64, reduceLoudSounds: 70, spatialFocus: 28, speechAmplification: 81,
    bass: -8, mid: 0, treble: 12, eq250: 4, eq500: -3, eq2000: 6, eq4000: -2, calibrationStatus: 'idle',
  });
  await assert.rejects(transport.setNoiseReduction(101), /0 to 100/);
  await assert.rejects(transport.setReduceLoudSounds(-1), /0 to 100/);
  await assert.rejects(transport.setSpeechAmplification(-1), /0 to 100/);
  await assert.rejects(transport.setBass(13), /-12 to \+12 dB/);
  await assert.rejects(transport.setMid(-13), /-12 to \+12 dB/);
  await assert.rejects(transport.setFineEq(250, 13), /-12 to \+12 dB/);
  await assert.rejects(transport.setFineEq(123, 1), /Unsupported EQ frequency/);
  assert.equal((await transport.getStatus()).noiseReduction, 64);
  assert.equal((await transport.getStatus()).bass, -8);
});

test('mock transport calibration reports progress and a saved-result shape', async () => {
  const transport = new MockDeviceTransport();
  const pending = transport.startCalibration(40);
  assert.equal((await transport.getStatus()).calibrationStatus, 'loading');
  assert.equal((await pending).volumePercent, 40);
  assert.equal((await transport.getStatus()).calibrationStatus, 'complete');
});
