import assert from 'node:assert/strict';
import test from 'node:test';
import { angleToValue, shortestAngleDelta, START_ANGLE, stepScale, SWEEP_ANGLE, valueToAngle } from './rotaryMath.ts';

test('270 degree sweep increases clockwise and clamps at both ends', () => {
  assert.equal(valueToAngle(0, 0, 100), START_ANGLE);
  assert.equal(valueToAngle(100, 0, 100), START_ANGLE + SWEEP_ANGLE);
  assert.equal(angleToValue(START_ANGLE - 10, 0, 100, 1, 1), 0);
  assert.equal(angleToValue(START_ANGLE + SWEEP_ANGLE + 10, 0, 100, 1, 1), 100);
  assert.equal(angleToValue(START_ANGLE + SWEEP_ANGLE / 2, 0, 100, 1, 1), 50);
});

test('wraparound keeps drag direction and decimal steps stay readable', () => {
  assert.equal(shortestAngleDelta(179, -179), 2);
  assert.equal(shortestAngleDelta(-179, 179), -2);
  assert.equal(angleToValue(valueToAngle(0.3, 0, 1), 0, 1, 0.1, stepScale(0, 0.1)), 0.3);
  assert.equal(stepScale(0, 1e-7), 1e7);
  assert.equal(angleToValue(START_ANGLE + SWEEP_ANGLE, 0, 95, 10, 1), 95);
});
