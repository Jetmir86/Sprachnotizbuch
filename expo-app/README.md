# Sprachnotizbuch

Ein Notizbuch fürs Handy (iPhone und Android), in dem jede Notiz an einen Zeitpunkt gebunden ist, mit dem Kalender des Handys verbunden werden kann und neben Text auch Sprachnachrichten enthält.

## Was die App kann

- **Schnell aufnehmen:** Ein Tipp auf der Startseite startet die Aufnahme, ein zweiter speichert sie sofort als neue Notiz (mit Datum und Uhrzeit).
- **Notizen mit Termin:** Jede Notiz hat Datum und Uhrzeit (z. B. morgen 15:00). Mit dem Schalter „Im Kalender eintragen“ erscheint sie als Termin im Kalender des Handys (iPhone: Apple-Kalender bzw. dein Standardkalender, Android: Gerätekalender/Google-Kalender), mit Erinnerung zur Uhrzeit. Änderungen an der Notiz aktualisieren den Termin, beim Löschen verschwindet er wieder.
- **Notiz zu einem bestehenden Termin:** Die Startseite zeigt deine Kalendertermine der nächsten zwei Wochen. Ein Tipp darauf öffnet eine Notiz zu genau diesem Termin, in die du sofort eine Sprachnachricht aufnehmen kannst, bevor du etwas schreibst. Bestehende Termine werden dabei nicht verändert.
- **Mehrere Sprachnachrichten pro Notiz:** aufnehmen, abspielen, löschen.
- **Sprachnachrichten von anderen importieren:** z. B. eine WhatsApp-Sprachnachricht, die du vorher über „Teilen → In Dateien sichern“ (iPhone) bzw. „Teilen → In Dateien/Drive speichern“ (Android) gespeichert hast. Über „Sprachnachricht importieren“ auf der Startseite entsteht eine neue Notiz, über „Importieren“ in einer Notiz wird sie dieser Notiz zugeordnet.
- Alles wird nur lokal auf dem Handy gespeichert (SQLite-Datenbank + Audiodateien im App-Ordner).

## Ausprobieren mit Expo Go

1. Node.js (Version 20 oder neuer) auf dem Computer installieren: https://nodejs.org
2. Auf dem Handy die App **Expo Go** aus dem App Store bzw. Play Store installieren.
3. Im Ordner dieses Projekts im Terminal:
   ```bash
   npm install
   npx expo start
   ```
4. Es erscheint ein QR-Code. iPhone: mit der Kamera scannen. Android: in Expo Go auf „Scan QR code“ tippen. Handy und Computer müssen im selben WLAN sein (sonst `npx expo start --tunnel`).
5. Beim ersten Aufnehmen bzw. beim Kalender fragt das Handy nach der Erlaubnis für Mikrofon und Kalender.

## Technik

- Expo SDK 57 / React Native, TypeScript, eine Codebasis für iOS und Android
- `expo-audio` (Aufnahme/Wiedergabe), `expo-calendar` (Gerätekalender), `expo-sqlite` (Notizen), `expo-file-system` + `expo-document-picker` (Audiodateien)

| Datei | Inhalt |
| --- | --- |
| `App.tsx` | Wechsel zwischen Startseite und Notiz |
| `src/screens/NoteListScreen.tsx` | Startseite: Schnellaufnahme, Kalendertermine, Notizliste |
| `src/screens/NoteScreen.tsx` | Eine Notiz: Titel, Zeitpunkt, Kalender, Sprachnachrichten, Text |
| `src/calendar.ts` | Kalenderzugriff (Termine lesen, anlegen, ändern, löschen) |
| `src/db.ts` | Datenbank für Notizen und Sprachnachrichten |
| `src/audioFiles.ts` | Speichern und Importieren von Audiodateien |

## Nächste Schritte (brauchen einen eigenen App-Build statt Expo Go)

- **Direkt aus WhatsApp „Teilen → Sprachnotizbuch“:** Dafür muss die App sich im Teilen-Menü des Handys anmelden (iOS Share Extension, Android Intent-Filter). Das geht nicht in Expo Go, sondern nur mit einem eigenen Build (`npx eas-cli build --profile development`).
- **WhatsApp-Sprachnachrichten auf dem iPhone abspielen:** WhatsApp verschickt Sprachnachrichten als `.opus`. Android spielt das ab, das iPhone meist nicht. Lösung wäre eine Umwandlung beim Import.
- In den App Store / Play Store: mit EAS Build und EAS Submit (Apple-Entwicklerkonto nötig).
