import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreHearingTestDocument, validateHearingTestFile } from './document.ts';

test('accepts supported reports within the size limit', () => {
  for (const [name, type] of [['report.pdf', 'application/pdf'], ['a.JPG', 'image/jpeg'], ['b.png', 'image/png'], ['c.heic', 'image/heic']]) {
    assert.equal(validateHearingTestFile(name, type, 1024, 20 * 1024 * 1024).mimeType, type);
  }
});

test('rejects unsupported, mismatched, empty, and oversized files', () => {
  assert.throws(() => validateHearingTestFile('report.txt', 'text/plain', 100, 1000));
  assert.throws(() => validateHearingTestFile('report.pdf', 'image/png', 100, 1000));
  assert.throws(() => validateHearingTestFile('report.pdf', 'application/pdf', 0, 1000));
  assert.throws(() => validateHearingTestFile('report.pdf', 'application/pdf', 1001, 1000));
});

test('preserves an existing import without implying it was analyzed', () => {
  assert.deepEqual(restoreHearingTestDocument({ name: 'old.pdf', uri: 'file:///old.pdf' }), {
    name: 'old.pdf', uri: 'file:///old.pdf', mimeType: 'application/pdf', sizeBytes: null, importedAt: null, analysis: { status: 'pending_analysis' },
  });
});
