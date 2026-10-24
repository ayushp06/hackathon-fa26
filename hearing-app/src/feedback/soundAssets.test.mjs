import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('bundled cues are short, quiet PCM WAV files', () => {
  for (const name of ['tick', 'tap', 'confirm']) {
    const data = readFileSync(new URL(`../assets/sounds/${name}.wav`, import.meta.url));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WAVE');
    assert.equal(data.readUInt16LE(20), 1);
    assert.equal(data.readUInt16LE(34), 16);
    assert.ok((data.length - 44) / data.readUInt32LE(28) < 0.2);
    let peak = 0;
    for (let offset = 44; offset < data.length; offset += 2) peak = Math.max(peak, Math.abs(data.readInt16LE(offset)));
    assert.ok(peak / 32767 <= 0.13);
  }
});
