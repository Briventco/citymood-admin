import { site } from "@/config/site";
import type { Article } from "@/lib/content";

// Dates are always shown in Lagos time, whatever the server's timezone.
// Month names are spelled out here because en-GB in recent ICU writes "Sept", not "Sep".

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type LagosParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: site.timeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function lagosParts(date: Date): LagosParts {
  const p = Object.fromEntries(
    partsFormatter.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  // Weekday from the Lagos calendar date, not the server's.
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, weekday };
}

/** "Monday, 12 October 2026" for the masthead. */
export function formatMastheadDate(now: Date): string {
  const p = lagosParts(now);
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

/** "12 Oct 2026" for bylines. */
export function formatArticleDate(iso: string): string {
  const p = lagosParts(new Date(iso));
  return `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

/** Latest rail: "10:42" today, "Yesterday", otherwise "12 Oct 2026". */
export function formatLatestTime(iso: string, now: Date): string {
  const p = lagosParts(new Date(iso));
  const today = lagosParts(now);
  const dayNumber = (x: LagosParts) => Date.UTC(x.year, x.month - 1, x.day) / 86_400_000;
  const diff = dayNumber(today) - dayNumber(p);
  if (diff <= 0) return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  if (diff === 1) return "Yesterday";
  return formatArticleDate(iso);
}

export function lagosYear(now: Date): number {
  return lagosParts(now).year;
}

const WORDS_PER_MINUTE = 220;

export function readingMinutes(article: Pick<Article, "readingMinutes" | "body">): number {
  if (article.readingMinutes) return article.readingMinutes;
  const words = article.body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
