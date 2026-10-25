import assert from 'node:assert/strict';
import test from 'node:test';
import { angleToValue, isDialLandmark, magneticDialAngle, shortestAngleDelta, START_ANGLE, stepScale, SWEEP_ANGLE, valueToAngle } from './rotaryMath.ts';

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

test('dial landmarks align with numbered quarter marks across control ranges', () => {
  assert.equal(isDialLandmark(25, 0, 100), true);
  assert.equal(isDialLandmark(26, 0, 100), false);
  assert.equal(isDialLandmark(0, -12, 12), true);
  assert.equal(isDialLandmark(-6, -12, 12), true);
});

test('numbered marks hold more firmly while every intermediate step stays selectable', () => {
  for (let quarter = 0; quarter <= 4; quarter++) {
    const mark = START_ANGLE + quarter * SWEEP_ANGLE / 4;
    assert.equal(magneticDialAngle(mark), mark);
    assert.ok(magneticDialAngle(mark + 3) < mark + 3);
    assert.ok(magneticDialAngle(mark - 3) > mark - 3);
  }
  let previous = -Infinity;
  for (let angle = START_ANGLE; angle <= START_ANGLE + SWEEP_ANGLE; angle += 0.25) {
    const output = magneticDialAngle(angle);
    assert.ok(output > previous);
    previous = output;
  }
  assert.equal(angleToValue(magneticDialAngle(valueToAngle(37, 0, 100)), 0, 100, 1, 1), 37);
  for (let quarter = 1; quarter <= 3; quarter++) {
    const mark = START_ANGLE + quarter * SWEEP_ANGLE / 4;
    assert.equal(angleToValue(magneticDialAngle(mark + 3), 0, 100, 1, 1), quarter * 25);
    assert.equal(angleToValue(magneticDialAngle(mark - 3), 0, 100, 1, 1), quarter * 25);
  }
  for (const [min, max] of [[0, 100], [-12, 12]]) {
    const reached = new Set();
    for (let raw = START_ANGLE; raw <= START_ANGLE + SWEEP_ANGLE; raw += 0.1) {
      reached.add(angleToValue(magneticDialAngle(raw), min, max, 1, 1));
    }
    for (let value = min; value <= max; value++) assert.ok(reached.has(value), `${value} remains selectable`);
  }
});
