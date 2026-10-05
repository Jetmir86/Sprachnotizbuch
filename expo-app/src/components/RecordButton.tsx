import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { durationLabel } from '../format';
import { colors } from '../theme';

type Props = {
  /** Wird nach dem Stoppen mit der temporären Datei aufgerufen. */
  onRecorded: (tempUri: string, durationMs: number) => Promise<void> | void;
  label: string;
  /** Großer Knopf für die Schnellaufnahme auf der Startseite */
  big?: boolean;
};

export function RecordButton({ onRecorded, label, big }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const recording = state.isRecording;

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Mikrofon nicht freigegeben',
        'Bitte erlaube den Zugriff aufs Mikrofon in den Einstellungen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Einstellungen', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    const durationMs = state.durationMillis;
    await recorder.stop();
    // Zurück auf Lautsprecher-Wiedergabe (iOS spielt sonst über die Hörmuschel)
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri) {
      Alert.alert('Aufnahme fehlgeschlagen', 'Es wurde keine Datei erzeugt.');
      return;
    }
    await onRecorded(uri, durationMs);
  }

  async function onPress() {
    if (busy) return;
    setBusy(true);
    try {
      if (recording) await stop();
      else await start();
    } catch (e) {
      Alert.alert('Fehler bei der Aufnahme', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Aufnahme stoppen und speichern' : label}
      style={({ pressed }) => [
        styles.button,
        big && styles.big,
        recording && styles.recording,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.dot, recording && styles.square]} />
      <View style={{ flexShrink: 1 }}>
        <Text style={[styles.text, big && styles.bigText]}>
          {recording ? 'Stopp & speichern' : label}
        </Text>
        {recording && (
          <Text style={styles.timer}>● {durationLabel(state.durationMillis)}</Text>
        )}
      </View>
      {busy && <ActivityIndicator color="#fff" style={{ marginLeft: 8 }} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.record,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  big: { paddingVertical: 20, borderRadius: 20 },
  recording: { backgroundColor: '#7F1D1D' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  square: { borderRadius: 3 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bigText: { fontSize: 19 },
  timer: { color: '#FECACA', fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] },
});
