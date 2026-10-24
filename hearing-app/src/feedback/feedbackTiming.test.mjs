import assert from 'node:assert/strict';
import test from 'node:test';
import { isReady } from './feedbackTiming.ts';

test('feedback stays throttled until the interval has elapsed', () => {
  assert.equal(isReady(100, 179, 80), false);
  assert.equal(isReady(100, 180, 80), true);
});
