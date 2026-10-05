// Die "legacy"-API von expo-calendar läuft auch in Expo Go.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

const EVENT_DURATION_MS = 30 * 60 * 1000;
const APP_CALENDAR_TITLE = 'Sprachnotizbuch';

export type UpcomingEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  calendarColor: string;
};

export async function ensureCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Calendar.requestCalendarPermissionsAsync();
  return requested.granted;
}

/**
 * Sucht den Kalender, in den neue Termine geschrieben werden:
 * iOS: der Standardkalender aus den Einstellungen (Apple-Kalender / iCloud).
 * Android: der Hauptkalender des Google-Kontos, sonst ein beschreibbarer,
 * sonst ein eigener lokaler Kalender "Sprachnotizbuch".
 */
async function getTargetCalendarId(): Promise<string> {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def.allowsModifications) return def.id;
    } catch {
      // Kein Standardkalender gesetzt: unten weitersuchen
    }
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const preferred =
    writable.find((c) => c.isPrimary) ??
    writable.find((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER) ??
    writable[0];
  if (preferred) return preferred.id;

  const existingOwn = calendars.find((c) => c.title === APP_CALENDAR_TITLE);
  if (existingOwn) return existingOwn.id;

  const source =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: APP_CALENDAR_TITLE, type: Calendar.SourceType.LOCAL };

  return Calendar.createCalendarAsync({
    title: APP_CALENDAR_TITLE,
    color: '#4F46E5',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: source.id,
    source,
    name: 'sprachnotizbuch',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

function eventDetails(title: string, body: string, date: Date, recordingCount: number) {
  const lines = [body.trim()];
  if (recordingCount > 0) {
    lines.push(
      recordingCount === 1
        ? '🎙 1 Sprachnachricht im Sprachnotizbuch'
        : `🎙 ${recordingCount} Sprachnachrichten im Sprachnotizbuch`
    );
  }
  return {
    title: title.trim() || 'Notiz',
    startDate: date,
    endDate: new Date(date.getTime() + EVENT_DURATION_MS),
    notes: lines.filter(Boolean).join('\n\n'),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Erinnerung genau zum Termin
    alarms: [{ relativeOffset: 0 }],
  };
}

/** Legt einen Termin an oder aktualisiert ihn. Gibt die Termin-ID zurück. */
export async function upsertNoteEvent(params: {
  eventId: string | null;
  title: string;
  body: string;
  date: Date;
  recordingCount: number;
}): Promise<string> {
  const details = eventDetails(params.title, params.body, params.date, params.recordingCount);
  if (params.eventId) {
    try {
      await Calendar.updateEventAsync(params.eventId, details);
      return params.eventId;
    } catch {
      // Termin wurde im Kalender gelöscht: neu anlegen
    }
  }
  const calendarId = await getTargetCalendarId();
  return Calendar.createEventAsync(calendarId, details);
}

export async function deleteNoteEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // schon gelöscht
  }
}

export async function openEvent(eventId: string): Promise<void> {
  await Calendar.openEventInCalendarAsync({ id: eventId });
}

/** Termine aus allen Kalendern des Geräts für die nächsten Tage. */
export async function listUpcomingEvents(days = 14): Promise<UpcomingEvent[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return [];
  const colorById = new Map(calendars.map((c) => [c.id, c.color]));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const events = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end
  );
  return events
    .map((e) => ({
      id: e.id,
      title: e.title || '(ohne Titel)',
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      allDay: e.allDay,
      calendarColor: colorById.get(e.calendarId) ?? '#888',
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}
