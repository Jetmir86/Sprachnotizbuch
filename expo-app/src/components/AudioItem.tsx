import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { recordingUri } from '../audioFiles';
import type { Recording } from '../db';
import { durationLabel, timeLabel } from '../format';
import { colors } from '../theme';

type Props = {
  recording: Recording;
  onDelete: (rec: Recording) => void;
};

export function AudioItem({ recording, onDelete }: Props) {
  const player = useAudioPlayer(recordingUri(recording.fileName));
  const status = useAudioPlayerStatus(player);
  const imported = recording.source === 'import';

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.1)) {
      await player.seekTo(0);
    }
    player.play();
  }

  function confirmDelete() {
    Alert.alert('Sprachnachricht löschen?', 'Das kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => onDelete(recording) },
    ]);
  }

  const totalMs = status.duration > 0 ? status.duration * 1000 : recording.durationMs;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Abspielen'}
        style={[styles.play, { backgroundColor: imported ? colors.imported : colors.primary }]}
      >
        <Text style={styles.playIcon}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {imported ? '📥 ' : '🎙 '}
          {recording.label || (imported ? 'Importiert' : 'Aufnahme')}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.meta}>
          {durationLabel(status.currentTime * 1000)} / {durationLabel(totalMs)} ·{' '}
          {imported ? 'importiert' : 'aufgenommen'} {timeLabel(new Date(recording.createdAt))} Uhr
        </Text>
        {status.error ? (
          <Text style={styles.error}>Kann nicht abgespielt werden: {status.error}</Text>
        ) : null}
      </View>
      <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Sprachnachricht löschen">
        <Text style={styles.delete}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 16 },
  middle: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primary },
  meta: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  error: { fontSize: 12, color: colors.danger },
  delete: { fontSize: 18, color: colors.muted, paddingHorizontal: 4 },
});
