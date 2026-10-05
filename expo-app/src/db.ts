import * as SQLite from 'expo-sqlite';

export type Note = {
  id: string;
  title: string;
  body: string;
  /** Zeitpunkt der Notiz (ISO-String), z. B. morgen 15:00 */
  date: string;
  /** Verknüpfter Termin im Gerätekalender */
  calendarEventId: string | null;
  /** 1 = Termin wurde von der App angelegt und wird mitgepflegt, 0 = bestehender Termin */
  ownsEvent: number;
  createdAt: string;
  updatedAt: string;
};

export type Recording = {
  id: string;
  noteId: string;
  /** Dateiname im App-Ordner "recordings" */
  fileName: string;
  durationMs: number | null;
  /** 'aufnahme' = selbst aufgenommen, 'import' = von anderen erhalten */
  source: 'aufnahme' | 'import';
  label: string;
  createdAt: string;
};

export type NoteWithCount = Note & { recordingCount: number };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('sprachnotizbuch.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          calendarEventId TEXT,
          ownsEvent INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recordings (
          id TEXT PRIMARY KEY NOT NULL,
          noteId TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          fileName TEXT NOT NULL,
          durationMs INTEGER,
          source TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT '',
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
        CREATE INDEX IF NOT EXISTS idx_recordings_note ON recordings(noteId);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listNotes(): Promise<NoteWithCount[]> {
  const db = await getDb();
  return db.getAllAsync<NoteWithCount>(`
    SELECT n.*, (SELECT COUNT(*) FROM recordings r WHERE r.noteId = n.id) AS recordingCount
    FROM notes n
    ORDER BY n.date ASC
  `);
}

export async function getNote(id: string): Promise<Note | null> {
  const db = await getDb();
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', id);
}

export async function findNoteByEvent(eventId: string): Promise<Note | null> {
  const db = await getDb();
  return db.getFirstAsync<Note>('SELECT * FROM notes WHERE calendarEventId = ?', eventId);
}

export async function createNote(
  fields: Pick<Note, 'title' | 'body' | 'date'> & Partial<Pick<Note, 'calendarEventId' | 'ownsEvent'>>
): Promise<Note> {
  const db = await getDb();
  const now = new Date().toISOString();
  const note: Note = {
    id: newId(),
    title: fields.title,
    body: fields.body,
    date: fields.date,
    calendarEventId: fields.calendarEventId ?? null,
    ownsEvent: fields.ownsEvent ?? 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.runAsync(
    'INSERT INTO notes (id, title, body, date, calendarEventId, ownsEvent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    note.id,
    note.title,
    note.body,
    note.date,
    note.calendarEventId,
    note.ownsEvent,
    note.createdAt,
    note.updatedAt
  );
  return note;
}

export async function updateNote(
  id: string,
  fields: Partial<Pick<Note, 'title' | 'body' | 'date' | 'calendarEventId' | 'ownsEvent'>>
): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k] ?? null);
  await db.runAsync(
    `UPDATE notes SET ${sets}, updatedAt = ? WHERE id = ?`,
    ...values,
    new Date().toISOString(),
    id
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}

export async function listRecordings(noteId: string): Promise<Recording[]> {
  const db = await getDb();
  return db.getAllAsync<Recording>(
    'SELECT * FROM recordings WHERE noteId = ? ORDER BY createdAt ASC',
    noteId
  );
}

export async function addRecording(
  fields: Omit<Recording, 'id' | 'createdAt'>
): Promise<Recording> {
  const db = await getDb();
  const rec: Recording = { ...fields, id: newId(), createdAt: new Date().toISOString() };
  await db.runAsync(
    'INSERT INTO recordings (id, noteId, fileName, durationMs, source, label, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    rec.id,
    rec.noteId,
    rec.fileName,
    rec.durationMs,
    rec.source,
    rec.label,
    rec.createdAt
  );
  return rec;
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recordings WHERE id = ?', id);
}
