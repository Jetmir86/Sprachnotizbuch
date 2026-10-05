import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keepRecording, pickAndImportAudio, removeRecordingFile } from '../audioFiles';
import { deleteNoteEvent, ensureCalendarPermission, openEvent, upsertNoteEvent } from '../calendar';
import { AudioItem } from '../components/AudioItem';
import { DateTimeField } from '../components/DateTimeField';
import { RecordButton } from '../components/RecordButton';
import {
  addRecording,
  deleteNote,
  deleteRecording,
  getNote,
  listRecordings,
  updateNote,
  type Note,
  type Recording,
} from '../db';
import { timeLabel } from '../format';
import { colors } from '../theme';

type Props = {
  noteId: string;
  /** Neue Notizen werden standardmäßig in den Kalender eingetragen */
  calendarByDefault?: boolean;
  onClose: () => void;
};

export function NoteScreen({ noteId, calendarByDefault, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(new Date());
  const [syncCalendar, setSyncCalendar] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [saving, setSaving] = useState(false);

  // Aktuelle Werte für das Speichern beim Verlassen
  const latest = useRef({ title, body, date, syncCalendar, recordings, note });
  latest.current = { title, body, date, syncCalendar, recordings, note };

  useEffect(() => {
    (async () => {
      const n = await getNote(noteId);
      if (!n) {
        onClose();
        return;
      }
      setNote(n);
      setTitle(n.title);
      setBody(n.body);
      setDate(new Date(n.date));
      setSyncCalendar(!!n.calendarEventId || !!calendarByDefault);
      setRecordings(await listRecordings(noteId));
    })();
  }, [noteId]);

  /** Speichert die Notiz und gleicht den Kalendertermin ab. */
  const persist = useCallback(async () => {
    const { title, body, date, syncCalendar, recordings, note } = latest.current;
    if (!note) return;
    await updateNote(note.id, { title, body, date: date.toISOString() });

    // Bestehende Termine anderer (ownsEvent = 0) werden nie verändert.
    if (!note.ownsEvent) return;

    let eventId = note.calendarEventId;
    if (syncCalendar) {
      if (!(await ensureCalendarPermission())) {
        setSyncCalendar(false);
        Alert.alert(
          'Kein Kalenderzugriff',
          'Erlaube den Kalenderzugriff in den Einstellungen, damit Notizen als Termin erscheinen.'
        );
        return;
      }
      eventId = await upsertNoteEvent({
        eventId,
        title,
        body,
        date,
        recordingCount: recordings.length,
      });
    } else if (eventId) {
      await deleteNoteEvent(eventId);
      eventId = null;
    }
    if (eventId !== note.calendarEventId) {
      await updateNote(note.id, { calendarEventId: eventId });
      setNote({ ...note, calendarEventId: eventId });
    }
  }, []);

  const close = useCallback(async () => {
    setSaving(true);
    try {
      await persist();
    } catch (e) {
      Alert.alert('Speichern fehlgeschlagen', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
      onClose();
    }
  }, [persist, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  async function onRecorded(tempUri: string, durationMs: number) {
    const fileName = keepRecording(tempUri);
    const rec = await addRecording({
      noteId,
      fileName,
      durationMs,
      source: 'aufnahme',
      label: `Aufnahme ${timeLabel(new Date())}`,
    });
    setRecordings((r) => [...r, rec]);
  }

  async function onImport() {
    try {
      const imported = await pickAndImportAudio();
      if (!imported) return;
      const rec = await addRecording({
        noteId,
        fileName: imported.fileName,
        durationMs: null,
        source: 'import',
        label: imported.label,
      });
      setRecordings((r) => [...r, rec]);
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
    }
  }

  async function onDeleteRecording(rec: Recording) {
    await deleteRecording(rec.id);
    removeRecordingFile(rec.fileName);
    setRecordings((r) => r.filter((x) => x.id !== rec.id));
  }

  function confirmDeleteNote() {
    Alert.alert(
      'Notiz löschen?',
      note?.ownsEvent && note.calendarEventId
        ? 'Die Notiz, ihre Sprachnachrichten und der Kalendertermin werden gelöscht.'
        : 'Die Notiz und ihre Sprachnachrichten werden gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            if (note?.ownsEvent && note.calendarEventId) await deleteNoteEvent(note.calendarEventId);
            recordings.forEach((r) => removeRecordingFile(r.fileName));
            await deleteNote(noteId);
            onClose();
          },
        },
      ]
    );
  }

  if (!note) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const linkedForeignEvent = !note.ownsEvent && !!note.calendarEventId;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={close} hitSlop={10} disabled={saving}>
          <Text style={styles.headerButton}>{saving ? 'Speichert …' : '‹ Fertig'}</Text>
        </Pressable>
        <Pressable onPress={confirmDeleteNote} hitSlop={10}>
          <Text style={[styles.headerButton, { color: colors.danger }]}>Löschen</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Titel, z. B. Arzttermin"
          placeholderTextColor={colors.muted}
          style={styles.title}
        />

        <DateTimeField value={date} onChange={setDate} />

        {linkedForeignEvent ? (
          <View style={styles.calendarRow}>
            <Text style={styles.calendarText}>📆 Gehört zu einem Termin in deinem Kalender</Text>
            <Pressable onPress={() => openEvent(note.calendarEventId!)}>
              <Text style={styles.link}>Öffnen</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.calendarRow}>
            <Text style={styles.calendarText}>📆 Im Kalender eintragen</Text>
            <Switch value={syncCalendar} onValueChange={setSyncCalendar} />
          </View>
        )}
        {!linkedForeignEvent && note.calendarEventId && (
          <Pressable onPress={() => openEvent(note.calendarEventId!)}>
            <Text style={styles.link}>Termin im Kalender ansehen</Text>
          </Pressable>
        )}

        <Text style={styles.section}>Sprachnachrichten</Text>
        <View style={{ gap: 8 }}>
          {recordings.length === 0 && (
            <Text style={styles.empty}>
              Noch keine Sprachnachricht. Nimm eine auf oder importiere eine, die du bekommen hast.
            </Text>
          )}
          {recordings.map((r) => (
            <AudioItem key={r.id} recording={r} onDelete={onDeleteRecording} />
          ))}
        </View>
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <RecordButton label="Aufnehmen" onRecorded={onRecorded} />
          </View>
          <Pressable style={styles.importButton} onPress={onImport}>
            <Text style={styles.importText}>📥 Importieren</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Notiz</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Hier kannst du schreiben …"
          placeholderTextColor={colors.muted}
          style={styles.body}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerButton: { fontSize: 17, color: colors.primary, fontWeight: '600' },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, paddingVertical: 4 },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarText: { fontSize: 15, color: colors.text, flexShrink: 1 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { color: colors.muted, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  importButton: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  importText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  body: {
    minHeight: 160,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
});
