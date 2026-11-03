import { lagosParts } from "@/lib/format";

// Newsroom times are entered and shown in Lagos time (WAT), whatever the
// browser's or server's timezone.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const MINUTE = 60_000;

/** Lagos wall-clock date ("2026-10-14") and time ("07:00") → ISO instant. Null if either is malformed. */
export function lagosToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  // Lagos has no daylight saving, but derive the offset rather than hard-coding +1.
  const offsetAt = (ms: number) => {
    const p = lagosParts(new Date(ms));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  const guess = wall - offsetAt(wall);
  const instant = wall - offsetAt(guess);
  const back = lagosParts(new Date(instant));
  if (back.year !== y || back.month !== mo || back.day !== da || back.hour !== h || back.minute !== mi) return null;
  return new Date(instant).toISOString();
}

/** ISO instant → Lagos date and time strings for <input type="date"> and <input type="time">. */
export function isoToLagos(iso: string): { date: string; time: string } {
  const p = lagosParts(new Date(iso));
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

const dayNumber = (p: { year: number; month: number; day: number }) => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;

/** Articles list: "10:42 today", "Yesterday", "14 Oct, 07:00" (future), "11 Oct", "11 Oct 2025". */
export function formatListTime(iso: string, now: Date): string {
  const p = lagosParts(new Date(iso));
  const today = lagosParts(now);
  const diff = dayNumber(today) - dayNumber(p);
  const hm = `${pad(p.hour)}:${pad(p.minute)}`;
  if (diff === 0) return `${hm} today`;
  if (diff === 1) return "Yesterday";
  if (diff < 0) return `${p.day} ${MONTHS[p.month - 1]}, ${hm}`;
  return p.year === today.year ? `${p.day} ${MONTHS[p.month - 1]}` : `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "14 Oct" or "14 Oct 2027" when not this year. */
export function formatShortDate(iso: string, now: Date): string {
  const p = lagosParts(new Date(iso));
  const year = p.year === lagosParts(now).year ? "" : ` ${p.year}`;
  return `${p.day} ${MONTHS[p.month - 1]}${year}`;
}

/** "Today, 09:15", "Yesterday, 18:02", "11 Oct, 08:00". */
export function formatDayTime(iso: string, now: Date): string {
  const p = lagosParts(new Date(iso));
  const diff = dayNumber(lagosParts(now)) - dayNumber(p);
  const hm = `${pad(p.hour)}:${pad(p.minute)}`;
  if (diff === 0) return `Today, ${hm}`;
  if (diff === 1) return `Yesterday, ${hm}`;
  return `${formatShortDate(iso, now)}, ${hm}`;
}

export function formatClock(iso: string): string {
  const p = lagosParts(new Date(iso));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "just now", "1 minute ago", "12 minutes ago", "2 hours ago". */
export function formatAgo(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - Date.parse(iso)) / MINUTE);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "1 minute ago" : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return `on ${formatShortDate(iso, now)}`;
}

/** "5 h 48 min", "12 min". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Ad campaign dates: "1 to 31 Oct", "28 Oct to 3 Nov". */
export function formatDateRange(startIso: string, endIso: string, now: Date): string {
  const s = lagosParts(new Date(startIso));
  const e = lagosParts(new Date(endIso));
  if (s.year === e.year && s.month === e.month) {
    return `${s.day} to ${e.day} ${MONTHS[e.month - 1]}${e.year === lagosParts(now).year ? "" : ` ${e.year}`}`;
  }
  return `${formatShortDate(startIso, now)} to ${formatShortDate(endIso, now)}`;
}
