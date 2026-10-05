const LOCALE = 'de-DE';

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(d: Date): string {
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  if (diffDays === -1) return 'Gestern';
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function timeLabel(d: Date): string {
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function dateTimeLabel(d: Date): string {
  return `${dayLabel(d)}, ${timeLabel(d)} Uhr`;
}

export function durationLabel(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '–:––';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}
