import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { type HearingTestDocument, validateHearingTestFile } from './document';

export async function pickHearingTestDocument(): Promise<HearingTestDocument | null> {
  const result = await getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'], copyToCacheDirectory: true, base64: Platform.OS === 'web' });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No file was selected.');
  const source = Platform.OS === 'web' ? null : new File(asset.uri);
  const sizeBytes = asset.size ?? asset.file?.size ?? source?.size ?? 0;
  const { mimeType, extension } = validateHearingTestFile(asset.name, asset.mimeType, sizeBytes, (Platform.OS === 'web' ? 2 : 20) * 1024 * 1024);
  let uri: string;
  if (Platform.OS === 'web') {
    if (!asset.base64) throw new Error('Could not read the selected file.');
    uri = asset.base64;
  } else {
    const destination = new File(Paths.document, `hearing-test-${Date.now()}.${extension}`);
    try {
      await source!.copy(destination);
    } catch (error) {
      if (destination.exists) destination.delete();
      throw error;
    }
    uri = destination.uri;
  }
  return { name: asset.name, uri, mimeType, sizeBytes, importedAt: new Date().toISOString(), analysis: { status: 'pending_analysis' } };
}

export async function removeHearingTestDocument(document: HearingTestDocument): Promise<void> {
  if (Platform.OS === 'web') return;
  const ownedPrefix = `${Paths.document.uri.replace(/\/$/, '')}/hearing-test-`;
  if (!document.uri.startsWith(ownedPrefix)) throw new Error('File is outside app storage.');
  const file = new File(document.uri);
  if (file.exists) file.delete();
}

export async function previewHearingTestDocument(document: HearingTestDocument): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Preview is available in the mobile app.');
  const file = new File(document.uri);
  if (!(await file.canPreview({ mimeType: document.mimeType }))) throw new Error('No app is available to preview this file.');
  await file.preview({ mimeType: document.mimeType, title: document.name });
}
