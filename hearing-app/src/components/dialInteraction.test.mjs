import test from 'node:test';
import assert from 'node:assert/strict';
import { DialInteraction } from './dialInteraction.ts';

function input() {
  const events = [];
  const dial = new DialInteraction({ start: () => events.push('start'), change: (n) => events.push(['change', n]), finish: (n) => events.push(['finish', n]), cancel: () => events.push('cancel') });
  return { dial, events };
}

test('a long gesture commits exactly once on release, never on a timer or cancellation', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { dial, events } = input();
  dial.begin(50);
  dial.change(72);
  t.mock.timers.tick(10000);
  assert.equal(events.some((event) => event[0] === 'finish'), false);
  dial.change(83);
  dial.finish(83);
  dial.finish(83);
  assert.deepEqual(events.filter((event) => event[0] === 'finish'), [['finish', 83]]);
  dial.begin(83);
  dial.change(30);
  dial.cancel();
  t.mock.timers.tick(10000);
  assert.equal(events.filter((event) => event[0] === 'finish').length, 1);
});

test('keyboard commits after key release and accessibility edits debounce the final value', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { dial, events } = input();
  dial.discrete(51, true);
  t.mock.timers.tick(1000);
  assert.equal(events.some((event) => event[0] === 'finish'), false);
  dial.keyUp();
  t.mock.timers.tick(200);
  dial.discrete(52, true);
  dial.keyUp();
  t.mock.timers.tick(400);
  dial.discrete(53);
  t.mock.timers.tick(200);
  dial.discrete(54);
  t.mock.timers.tick(400);
  assert.deepEqual(events.filter((event) => event[0] === 'finish'), [['finish', 52], ['finish', 54]]);
});

test('a gesture cancels a pending discrete timer and unmount/reset cancellation cannot commit', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { dial, events } = input();
  dial.discrete(55);
  dial.keyUp();
  dial.begin(55);
  t.mock.timers.tick(1000);
  assert.equal(events.some((event) => event[0] === 'finish'), false);
  dial.cancel();
  dial.change(99);
  dial.finish(99);
  t.mock.timers.tick(1000);
  assert.equal(events.some((event) => event[0] === 'finish'), false);
});
