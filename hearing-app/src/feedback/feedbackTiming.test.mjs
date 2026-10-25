import assert from 'node:assert/strict';
import test from 'node:test';
import { isReady, isSoundReady } from './feedbackTiming.ts';

test('feedback stays throttled until the interval has elapsed', () => {
  assert.equal(isReady(100, 179, 80), false);
  assert.equal(isReady(100, 180, 80), true);
});

test('a numbered dial cue can replace a tick without overlapping other cues', () => {
  assert.equal(isSoundReady('tick', 'tick', 180, 120), false);
  assert.equal(isSoundReady('tap', 'tick', 180, 120), true);
  assert.equal(isSoundReady('tick', 'tap', 180, 120), false);
  assert.equal(isSoundReady('tap', 'tap', 180, 120), false);
  assert.equal(isSoundReady('confirm', 'tap', 180, 120), true);
});
