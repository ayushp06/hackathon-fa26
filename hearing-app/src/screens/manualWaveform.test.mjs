import assert from 'node:assert/strict';
import test from 'node:test';
import { manualWaveformPath } from './manualWaveform.ts';

test('preview responds independently to bass, mid, and treble while staying within its view box', () => {
  const flat = manualWaveformPath(0, 0, 0);
  assert.match(flat, /^M 0 50\.0/);
  assert.equal(new Set(flat.match(/(?:M|L) \d+ 50\.0/g)).size, 61);
  for (const settings of [[100, 0, 0], [0, 100, 0], [0, 0, 100]]) {
    const path = manualWaveformPath(...settings);
    assert.notEqual(path, flat);
    assert.ok([...path.matchAll(/[ML] \d+ ([\d.]+)/g)].every(([, y]) => Number(y) >= 0 && Number(y) <= 100));
  }
});
