import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './db';

/**
 * Alle Sprachnachrichten liegen im App-eigenen Dokumentenordner.
 * In der Datenbank speichern wir nur den Dateinamen, weil sich der
 * absolute Pfad auf iOS nach App-Updates ändern kann.
 */
function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function recordingUri(fileName: string): string {
  return new File(recordingsDir(), fileName).uri;
}

function extensionOf(name: string, fallback: string): string {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name);
  return match ? match[1].toLowerCase() : fallback;
}

/** Übernimmt eine frische Aufnahme (temporäre Datei) dauerhaft in die App. */
export function keepRecording(tempUri: string): string {
  const source = new File(tempUri);
  const fileName = `${newId()}.${extensionOf(tempUri, 'm4a')}`;
  source.move(new File(recordingsDir(), fileName));
  return fileName;
}

export function removeRecordingFile(fileName: string): void {
  try {
    const file = new File(recordingsDir(), fileName);
    if (file.exists) file.delete();
  } catch {
    // Datei schon weg: nichts zu tun
  }
}

const AUDIO_EXTENSIONS = ['m4a', 'mp3', 'aac', 'wav', 'ogg', 'opus', 'amr', '3gp', 'caf', 'mp4', 'flac', 'webm'];

export type ImportedAudio = { fileName: string; label: string };

/**
 * Lässt den Nutzer eine Audiodatei auswählen (z. B. eine gespeicherte
 * WhatsApp-Sprachnachricht) und kopiert sie in die App.
 * Gibt null zurück, wenn abgebrochen wurde.
 */
export async function pickAndImportAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // "*/*", weil WhatsApp-Sprachnachrichten (.opus) auf manchen Geräten
    // nicht als Audio erkannt werden.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const ext = extensionOf(asset.name, '');
  const isAudio = asset.mimeType?.startsWith('audio/') || AUDIO_EXTENSIONS.includes(ext);
  if (!isAudio) {
    throw new Error('Die gewählte Datei ist keine Audiodatei.');
  }

  const fileName = `${newId()}.${ext || 'm4a'}`;
  await new File(asset.uri).copy(new File(recordingsDir(), fileName));
  return { fileName, label: asset.name };
}
