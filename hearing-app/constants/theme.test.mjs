import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrationDialDiameter, manualDialDiameter, theme } from './theme.ts';

test('manual dials fit two columns on common phone widths', () => {
  for (const width of [320, 375, 414, 600]) {
    const diameter = manualDialDiameter(width);
    const contentWidth = Math.min(width, theme.sizing.contentMaxWidth) - theme.spacing.lg * 2;
    assert.ok(diameter >= 56);
    assert.ok(diameter * 2 + theme.spacing.md <= contentWidth);
    assert.ok(diameter <= theme.sizing.manualDialMaxDiameter);
  }
});

test('dials shrink to fit short safe-area viewports without losing touch size', () => {
  assert.equal(manualDialDiameter(375, 500), 108);
  assert.equal(calibrationDialDiameter(375, 400), 150);
  assert.equal(manualDialDiameter(320, 300), 56);
});
