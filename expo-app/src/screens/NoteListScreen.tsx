import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keepRecording, pickAndImportAudio } from '../audioFiles';
import { ensureCalendarPermission, listUpcomingEvents, type UpcomingEvent } from '../calendar';
import { RecordButton } from '../components/RecordButton';
import {
  addRecording,
  createNote,
  findNoteByEvent,
  listNotes,
  type NoteWithCount,
} from '../db';
import { dayLabel, sameDay, timeLabel } from '../format';
import { colors } from '../theme';
import * as Calendar from 'expo-calendar/legacy';

type Props = {
  onOpenNote: (id: string, opts?: { calendarByDefault?: boolean }) => void;
};

const EVENTS_PREVIEW = 4;

function nextFullHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function NoteListScreen({ onOpenNote }: Props) {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<NoteWithCount[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null);
  const [calendarAllowed, setCalendarAllowed] = useState<boolean | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNotes(await listNotes());
    const perm = await Calendar.getCalendarPermissionsAsync();
    setCalendarAllowed(perm.granted);
    if (perm.granted) {
      try {
        setEvents(await listUpcomingEvents());
      } catch {
        setEvents([]);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function connectCalendar() {
    const ok = await ensureCalendarPermission();
    if (!ok) {
      Alert.alert('Kein Kalenderzugriff', 'Du kannst den Zugriff in den Einstellungen erlauben.');
    }
    await load();
  }

  async function quickRecorded(tempUri: string, durationMs: number) {
    const now = new Date();
    const note = await createNote({
      title: `Sprachnotiz ${timeLabel(now)}`,
      body: '',
      date: now.toISOString(),
    });
    await addRecording({
      noteId: note.id,
      fileName: keepRecording(tempUri),
      durationMs,
      source: 'aufnahme',
      label: `Aufnahme ${timeLabel(now)}`,
    });
    setJustSaved(note.id);
    await load();
  }

  async function newNote() {
    const note = await createNote({ title: '', body: '', date: nextFullHour().toISOString() });
    onOpenNote(note.id, { calendarByDefault: true });
  }

  async function importAudio() {
    try {
      const imported = await pickAndImportAudio();
      if (!imported) return;
      const note = await createNote({
        title: 'Erhaltene Sprachnachricht',
        body: '',
        date: new Date().toISOString(),
      });
      await addRecording({
        noteId: note.id,
        fileName: imported.fileName,
        durationMs: null,
        source: 'import',
        label: imported.label,
      });
      onOpenNote(note.id);
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
    }
  }

  async function openForEvent(ev: UpcomingEvent) {
    const existing = await findNoteByEvent(ev.id);
    if (existing) {
      onOpenNote(existing.id);
      return;
    }
    const note = await createNote({
      title: ev.title,
      body: '',
      date: ev.startDate.toISOString(),
      calendarEventId: ev.id,
      ownsEvent: 0,
    });
    onOpenNote(note.id);
  }

  const now = new Date();
  const upcoming = notes.filter((n) => new Date(n.date) >= startOfToday());
  const past = notes.filter((n) => new Date(n.date) < startOfToday()).reverse();
  const linkedEventIds = new Set(notes.map((n) => n.calendarEventId).filter(Boolean));
  const visibleEvents = (events ?? []).filter((e) => e.endDate >= now);
  const shownEvents = showAllEvents ? visibleEvents : visibleEvents.slice(0, EVENTS_PREVIEW);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.appTitle}>Sprachnotizbuch</Text>

      <RecordButton big label="Schnell aufnehmen" onRecorded={quickRecorded} />
      {justSaved && (
        <Pressable onPress={() => onOpenNote(justSaved)}>
          <Text style={styles.saved}>✓ Gespeichert. Tippe hier, um Text oder einen Termin hinzuzufügen.</Text>
        </Pressable>
      )}

      <View style={styles.row}>
        <Pressable style={[styles.secondary, { flex: 1 }]} onPress={newNote}>
          <Text style={styles.secondaryText}>＋ Neue Notiz</Text>
        </Pressable>
        <Pressable style={[styles.secondary, { flex: 1 }]} onPress={importAudio}>
          <Text style={styles.secondaryText}>📥 Sprachnachricht importieren</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Termine aus deinem Kalender</Text>
      {calendarAllowed === false && (
        <Pressable style={styles.secondary} onPress={connectCalendar}>
          <Text style={styles.secondaryText}>📆 Kalender verbinden</Text>
        </Pressable>
      )}
      {calendarAllowed && visibleEvents.length === 0 && (
        <Text style={styles.empty}>Keine Termine in den nächsten zwei Wochen.</Text>
      )}
      {shownEvents.map((ev, i) => {
        const showDay = i === 0 || !sameDay(ev.startDate, shownEvents[i - 1].startDate);
        const hasNote = linkedEventIds.has(ev.id);
        return (
          <View key={`${ev.id}-${ev.startDate.getTime()}`}>
            {showDay && <Text style={styles.day}>{dayLabel(ev.startDate)}</Text>}
            <Pressable style={styles.card} onPress={() => openForEvent(ev)}>
              <View style={[styles.colorDot, { backgroundColor: ev.calendarColor }]} />
              <Text style={styles.time}>{ev.allDay ? 'ganztägig' : timeLabel(ev.startDate)}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {ev.title}
              </Text>
              <Text style={styles.link}>{hasNote ? 'Notiz' : '＋ Notiz'}</Text>
            </Pressable>
          </View>
        );
      })}
      {visibleEvents.length > EVENTS_PREVIEW && (
        <Pressable onPress={() => setShowAllEvents((s) => !s)}>
          <Text style={styles.link}>
            {showAllEvents ? 'Weniger anzeigen' : `Alle ${visibleEvents.length} Termine anzeigen`}
          </Text>
        </Pressable>
      )}

      <Text style={styles.section}>Meine Notizen</Text>
      {notes.length === 0 && (
        <Text style={styles.empty}>
          Noch keine Notizen. Tippe auf „Schnell aufnehmen“ oder lege eine neue Notiz an.
        </Text>
      )}
      <NoteGroup notes={upcoming} onOpen={onOpenNote} highlight={justSaved} />
      {past.length > 0 && <Text style={styles.section}>Vergangen</Text>}
      <NoteGroup notes={past} onOpen={onOpenNote} highlight={justSaved} />
    </ScrollView>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function NoteGroup({
  notes,
  onOpen,
  highlight,
}: {
  notes: NoteWithCount[];
  onOpen: (id: string) => void;
  highlight: string | null;
}) {
  return (
    <>
      {notes.map((n, i) => {
        const d = new Date(n.date);
        const showDay = i === 0 || !sameDay(d, new Date(notes[i - 1].date));
        return (
          <View key={n.id}>
            {showDay && <Text style={styles.day}>{dayLabel(d)}</Text>}
            <Pressable
              style={[styles.card, n.id === highlight && styles.highlight]}
              onPress={() => onOpen(n.id)}
            >
              <Text style={styles.time}>{timeLabel(d)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {n.title || 'Ohne Titel'}
                </Text>
                {n.body ? (
                  <Text style={styles.preview} numberOfLines={1}>
                    {n.body}
                  </Text>
                ) : null}
              </View>
              {n.recordingCount > 0 && <Text style={styles.badge}>🎙 {n.recordingCount}</Text>}
              {n.calendarEventId && <Text style={styles.badge}>📆</Text>}
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10 },
  appTitle: { fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: 6 },
  saved: { color: '#15803D', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  secondary: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  section: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  day: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6, marginBottom: 6 },
  empty: { color: colors.muted, fontSize: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  highlight: { borderWidth: 2, borderColor: '#15803D' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 15, color: colors.muted, fontVariant: ['tabular-nums'], minWidth: 48 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  preview: { fontSize: 14, color: colors.muted, marginTop: 2 },
  badge: { fontSize: 14, color: colors.muted },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
