# Sprachnotizbuch (Web-App)

Läuft im Browser auf iPhone und Android und lässt sich als App auf dem Startbildschirm speichern.
Alle Notizen und Sprachnachrichten bleiben nur auf dem Handy (im Speicher des Browsers).

## Online stellen
Der Ordner muss auf einer https-Adresse liegen (Mikrofon und „Als App speichern“ gehen nur über https), z. B.:
- GitHub Pages: Dateien in ein Repo legen, unter Settings → Pages „Deploy from branch“ wählen.
- Netlify Drop: https://app.netlify.com/drop öffnen und diesen Ordner hineinziehen.

## Als App speichern
- iPhone (Safari): Teilen → „Zum Home-Bildschirm“.
- Android (Chrome): Menü ⋮ → „App installieren“. Danach taucht das Sprachnotizbuch auch im „Teilen“-Menü auf, z. B. bei WhatsApp-Sprachnachrichten.

## Kalender
Browser dürfen den Kalender nicht direkt lesen oder ändern. „Zum Kalender hinzufügen“ erzeugt einen Termin mit Erinnerung, den das Handy in den Apple- bzw. Gerätekalender übernimmt. Nach Änderungen erneut tippen.

## Ordner `expo-app`
Die native Version (Expo / React Native) mit direkter Kalenderanbindung. Sie wird für diese Webseite nicht gebraucht.
