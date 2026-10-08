/*
 * Versteht gesprochene Befehle wie
 *   „Erinnerung morgen um 15 Uhr Werkstatt anrufen mit Sprachnachricht“
 * und liefert Datum, Uhrzeit, Titel und ob danach eine Sprachnachricht
 * aufgenommen werden soll. Läuft komplett im Browser, ohne Server.
 */
(function (root) {
  'use strict';

  const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  const NUMBER_WORDS = {
    null: 0, ein: 1, eins: 1, eine: 1, einer: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8,
    neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17,
    achtzehn: 18, neunzehn: 19, zwanzig: 20, einundzwanzig: 21, zweiundzwanzig: 22, dreiundzwanzig: 23,
    dreißig: 30, vierzig: 40, fünfundvierzig: 45, fünfzig: 50,
  };
  const ORDINALS = {
    ersten: 1, zweiten: 2, dritten: 3, vierten: 4, fünften: 5, sechsten: 6, siebten: 7, achten: 8, neunten: 9, zehnten: 10,
    elften: 11, zwölften: 12, dreizehnten: 13, vierzehnten: 14, fünfzehnten: 15, sechzehnten: 16, siebzehnten: 17,
    achtzehnten: 18, neunzehnten: 19, zwanzigsten: 20, einundzwanzigsten: 21, zweiundzwanzigsten: 22,
    dreiundzwanzigsten: 23, vierundzwanzigsten: 24, fünfundzwanzigsten: 25, sechsundzwanzigsten: 26,
    siebenundzwanzigsten: 27, achtundzwanzigsten: 28, neunundzwanzigsten: 29, dreißigsten: 30, einunddreißigsten: 31,
  };

  // Zahlwörter in Ziffern umwandeln, damit alle Regeln nur Ziffern prüfen müssen
  function normalize(text) {
    let t = ' ' + text.toLowerCase().replace(/[„“"!?]/g, ' ').replace(/\s+/g, ' ') + ' ';
    t = t.replace(U(/(\d+)\s*h\b/g), '$1 uhr');
    t = t.replace(U(/\b([a-zäöüß]+ten)\b/g), (m) => (ORDINALS[m] ? ORDINALS[m] + '.' : m));
    t = t.replace(U(/\b([a-zäöüß]+)\b/g), (m) => (m in NUMBER_WORDS && !['ein', 'eine', 'einer', 'einem'].includes(m) ? String(NUMBER_WORDS[m]) : m));
    return t;
  }

  // \b kennt in JavaScript keine Umlaute („übermorgen“, „früh“), daher eigene Wortgrenze
  const WB = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))';
  function U(re) { return new RegExp(re.source.replace(/\\b/g, WB), re.flags.replace('u', '') + 'u'); }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

  function parseCommand(input, now) {
    now = now || new Date();
    const raw = String(input || '').trim();
    let t = normalize(raw);
    const used = []; // erkannte Stellen, die nicht in den Titel sollen
    const take = (re) => {
      const m = t.match(U(re));
      if (m) { used.push(m[0]); t = t.replace(m[0], ' '); }
      return m;
    };

    const result = { raw, day: null, hours: null, minutes: 0, title: '', withVoice: false, action: 'create' };

    // Was soll passieren?
    if (U(/^\s*(zeig|zeige|öffne|geh|gehe|spring)\b/).test(t)) result.action = 'show';
    if (take(/\b(mit|und)?\s*(einer |eine |der |meiner )?(sprach ?nachricht|sprach ?notiz|sprach ?memo|audio|aufnahme)\b(\s*(aufnehmen|dazu|anhängen))?/)) result.withVoice = true;
    if (take(/\b(nimm|nehme|aufnehmen)\b.*\b(auf)?\b/) && /nimm|nehme|aufnehmen/.test(used[used.length - 1])) result.withVoice = true;

    // Tag
    let day = null;
    let m;
    if ((m = take(/\b(heute|heut)\b/))) day = startOfDay(now);
    else if ((m = take(/\bübermorgen\b/))) day = addDays(startOfDay(now), 2);
    else if ((m = take(/\bmorgen\b(?!s)/))) day = addDays(startOfDay(now), 1);
    else if ((m = take(/\bin (\d+) (tag|tagen)\b/))) day = addDays(startOfDay(now), +m[1]);
    else if ((m = take(/\bin (einer|1) woche\b/))) day = addDays(startOfDay(now), 7);
    else if ((m = take(/\bin (\d+) wochen\b/))) day = addDays(startOfDay(now), 7 * m[1]);
    if (!day && (m = take(new RegExp('\\b(am |den )?(\\d{1,2})\\.?\\s*(' + MONTHS.join('|') + ')\\b(\\s*(\\d{4}))?')))) {
      const month = MONTHS.indexOf(m[3]);
      let year = m[5] ? +m[5] : now.getFullYear();
      let d = new Date(year, month, +m[2]);
      if (!m[5] && d < startOfDay(now)) d = new Date(year + 1, month, +m[2]);
      day = d;
    }
    if (!day && (m = take(/\b(am |den )?(\d{1,2})\.\s?(\d{1,2})\.(\s?(\d{2,4}))?/))) {
      let year = m[5] ? +m[5] : now.getFullYear();
      if (year < 100) year += 2000;
      let d = new Date(year, +m[3] - 1, +m[2]);
      if (!m[5] && d < startOfDay(now)) d = new Date(year + 1, +m[3] - 1, +m[2]);
      day = d;
    }
    if (!day && (m = take(new RegExp('\\b(am |diesen |kommenden |nächsten |nächste woche )?(' + WEEKDAYS.join('|') + ')\\b')))) {
      const target = WEEKDAYS.indexOf(m[2]);
      let diff = (target - now.getDay() + 7) % 7;
      if (/nächste woche/.test(m[1] || '')) {
        // Wochentag in der Woche nach dieser (Woche beginnt am Montag)
        const mondayThis = addDays(startOfDay(now), -((now.getDay() + 6) % 7));
        day = addDays(mondayThis, 7 + ((target + 6) % 7));
      } else if (/nächste/.test(m[1] || '') && diff === 0) diff = 7;
      day = day || addDays(startOfDay(now), diff);
    }
    if (!day && (m = take(/\bam (\d{1,2})\.(?!\s?\d)/))) {
      let d = new Date(now.getFullYear(), now.getMonth(), +m[1]);
      if (d < startOfDay(now)) d = new Date(now.getFullYear(), now.getMonth() + 1, +m[1]);
      day = d;
    }

    // Uhrzeit
    let hours = null, minutes = 0;
    if ((m = take(/\bin (\d+) (stunden|stunde)\b/))) {
      const d = new Date(now.getTime() + m[1] * 3600000);
      day = day || startOfDay(d); hours = d.getHours(); minutes = d.getMinutes();
    } else if ((m = take(/\bin (\d+) (minuten|minute)\b/))) {
      const d = new Date(now.getTime() + m[1] * 60000);
      day = day || startOfDay(d); hours = d.getHours(); minutes = d.getMinutes();
    } else if ((m = take(/\b(um )?halb (\d{1,2})\b/))) {
      hours = (+m[2] + 23) % 24; minutes = 30;
    } else if ((m = take(/\b(um )?viertel nach (\d{1,2})\b/))) {
      hours = +m[2]; minutes = 15;
    } else if ((m = take(/\b(um )?viertel vor (\d{1,2})\b/))) {
      hours = (+m[2] + 23) % 24; minutes = 45;
    } else if ((m = take(/\b(?:um )?(\d{1,2})[:.](\d{2})(?:\s?uhr)?\b/))) {
      hours = +m[1]; minutes = +m[2];
    } else if ((m = take(/\b(um )?(\d{1,2}) uhr( (\d{1,2}))?\b/))) {
      hours = +m[2]; minutes = m[4] ? +m[4] : 0;
    } else if ((m = take(/\bum (\d{1,2})\b/))) {
      hours = +m[1];
    }
    // Tageszeit
    const pm = take(/\b(am |heute |morgen )?(nachmittags?|abends?|nachts?)\b/);
    const am = take(/\b(am morgen|am vormittag|morgens|früh|vormittags|heute vormittag)\b/);
    if (hours != null) {
      if (pm && hours < 12) hours += 12;
      else if (!am && hours >= 1 && hours <= 6) hours += 12; // „um 3“ meint fast immer nachmittags
      if (hours > 23 || minutes > 59) { hours = null; minutes = 0; }
    } else if (pm) {
      hours = /abend/.test(pm[2]) ? 19 : /nacht/.test(pm[2]) ? 21 : 15;
    } else if (am) { hours = 9; }

    if (day && hours == null && startOfDay(day).getTime() === startOfDay(now).getTime()) {
      // Heute ohne Uhrzeit: nächste volle Stunde
      hours = Math.min(23, now.getHours() + 1); minutes = 0;
    }
    if (!day && hours != null) {
      day = startOfDay(now);
      if (hours * 60 + minutes <= now.getHours() * 60 + now.getMinutes()) day = addDays(day, 1);
    }
    result.day = day;
    result.hours = hours;
    result.minutes = minutes;

    // Titel: alles, was übrig bleibt, ohne Füllwörter
    let title = t
      .replace(U(/\b(bitte|ich (würde|möchte|will) (gerne |gern )?|kannst du( mir)?|mach(e)?( mir)?|erstell(e)?( mir)?|leg(e)?( mir)?|trag(e)?( mir)?|speicher(e|n)?( mir)?|notier(e)?( mir)?|merk(e)?( mir)?|erinner(e|n)? (mich|mir)( daran)?|zeig(e)?( mir)?|öffne|geh(e)? zu|spring zu)\b/g), ' ')
      .replace(U(/^\s*(eine |einen |ein |neue |neuen |neues )*(erinnerung|termin|notiz|eintrag)\b/), ' ')
      .replace(U(/\b(eine |einen |ein |neue |neuen |neues )*(erinnerung|termin|notiz|eintrag)( für| an| am| um| zu| zum| mit| über)?\b/g), ' ')
      .replace(U(/\b(ein|an|ein( |$))\s*$/g), ' ')
      .replace(U(/^\s*(für|am|um|an|zu|dass ich|das ich|daran|mit|und|,|-)\b/g), ' ')
      .replace(U(/\b(für|am|um|an|zu|dass|das|und|mit|daran|,)\s*$/g), ' ')
      .replace(U(/\s*,\s*/g), ' ')
      .replace(U(/\s+/g), ' ')
      .trim();
    title = title.replace(U(/\b(machen|eintragen|speichern|anlegen|erstellen|notieren|hinzufügen)\b/g), ' ').replace(/\s+/g, ' ').trim();
    title = title.replace(U(/^(für|am|um|an|zu|und|mit|dass ich|das ich|daran)\s+/i), '').replace(U(/\s+(für|am|um|an|zu|und|mit|eintragen|machen|speichern|anlegen|erstellen|ein|auf)$/i), '').trim();
    title = title.replace(U(/^(für|am|um|an|zu|und|mit)\s+/i), '').trim();
    title = title.replace(U(/^(die|der|das|den|dem)\s+/i), '').trim();
    // Groß-/Kleinschreibung aus dem Originalsatz übernehmen („Mama Geburtstag“)
    const original = {};
    for (const w of raw.split(/[\s,.;:!?„“"]+/)) if (w) original[w.toLowerCase()] = original[w.toLowerCase()] || w;
    title = title.split(' ').map((w) => original[w] || w).join(' ');
    if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
    result.title = result.action === 'show' ? '' : title;
    return result;
  }

  root.parseCommand = parseCommand;
  if (typeof module !== 'undefined') module.exports = { parseCommand };
})(typeof window !== 'undefined' ? window : globalThis);
