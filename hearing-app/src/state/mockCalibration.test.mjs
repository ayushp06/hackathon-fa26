import assert from 'node:assert/strict';
import test from 'node:test';
import { mockCalibrate } from './mockCalibration.ts';

test('mock calibration returns a clearly simulated result for the selected volume', async () => {
  const result = await mockCalibrate(42);
  assert.equal(result.simulated, true);
  assert.equal(result.volumePercent, 42);
  assert.ok(Number.isFinite(Date.parse(result.completedAt)));
  await assert.rejects(mockCalibrate(101), RangeError);
});
