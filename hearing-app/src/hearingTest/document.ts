export type HearingTestDocument = {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes: number | null;
  importedAt: string | null;
  analysis: { status: 'pending_analysis' };
};

const types: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

export function validateHearingTestFile(name: string, mimeType: string | undefined, sizeBytes: number, limitBytes: number) {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const expectedType = types[extension];
  if (!expectedType || (mimeType && mimeType !== expectedType && !(expectedType === 'image/heic' && mimeType === 'image/heif'))) {
    throw new Error('Choose a PDF, JPG, PNG, or HEIC file.');
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > limitBytes) {
    throw new Error(`Choose a file smaller than ${Math.round(limitBytes / 1024 / 1024)} MB.`);
  }
  return { mimeType: expectedType, extension };
}

export function restoreHearingTestDocument(value: unknown): HearingTestDocument | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Partial<HearingTestDocument>;
  if (typeof saved.name !== 'string' || typeof saved.uri !== 'string') return null;
  return {
    name: saved.name,
    uri: saved.uri,
    mimeType: typeof saved.mimeType === 'string' ? saved.mimeType : types[saved.name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream',
    sizeBytes: typeof saved.sizeBytes === 'number' && saved.sizeBytes >= 0 ? saved.sizeBytes : null,
    importedAt: typeof saved.importedAt === 'string' ? saved.importedAt : null,
    analysis: { status: 'pending_analysis' },
  };
}
