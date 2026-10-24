import assert from 'node:assert/strict';
import test from 'node:test';
import { mockDeviceService } from './mockDeviceService.ts';

test('mock device can be scanned, connected, and disconnected', async () => {
  const [device] = await mockDeviceService.scan();
  assert.equal((await mockDeviceService.connect(device.id)).id, device.id);
  await mockDeviceService.disconnect();
  await assert.rejects(mockDeviceService.connect('unknown'), /Device not found/);
});
