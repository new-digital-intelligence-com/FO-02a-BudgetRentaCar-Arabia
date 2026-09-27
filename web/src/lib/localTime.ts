import { westernDigits } from "./text";

/**
 * Dates and times at a branch. Noura gives them as the branch's local date and time; they are stored in UTC. Each
 * country has its own time zone, and Egypt and Lebanon change the clock in summer, so offsets come from Intl.
 */

export type LocalDate = { year: number; month: number; day: number };

/** "2026-10-02" (also "2026/10/2"), or null. */
export function parseDate(input: unknown): LocalDate | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(westernDigits(input).trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : null;
}

/** Minutes after midnight from "14:30", "9:05", "2:30 PM" or "14", or null. */
export function parseTime(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i.exec(westernDigits(input).trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const half = match[3]?.toLowerCase().replace(/\./g, "");
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (half === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

const partsFormats = new Map<string, Intl.DateTimeFormat>();

function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let format = partsFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormats.set(timeZone, format);
  }
  return format;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The local calendar date, weekday (0 = Sunday) and minutes after midnight of a moment in a time zone. */
export function localParts(at: Date, timeZone: string) {
  const parts = Object.fromEntries(partsFormat(timeZone).formatToParts(at).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

function offsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minutes, p.seconds);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The moment a local date and time happen in a time zone. */
export function zonedToUtc(date: LocalDate, minutes: number, timeZone: string): Date {
  const wallClock = Date.UTC(date.year, date.month - 1, date.day, 0, minutes);
  const first = wallClock - offsetMs(new Date(wallClock), timeZone);
  // Near a clock change the offset at the answer can differ from the first guess.
  return new Date(wallClock - offsetMs(new Date(first), timeZone));
}

export function localDateOf(at: Date, timeZone: string): LocalDate {
  const { year, month, day } = localParts(at, timeZone);
  return { year, month, day };
}

export function minutesText(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "2026-10-02" */
export function dateText(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

const spokenFormats = new Map<string, Intl.DateTimeFormat>();

/** "Thursday 2 October 2026, 10:00" in the branch's local time, for Noura to say back. */
export function describeLocal(at: Date, timeZone: string): string {
  let format = spokenFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    spokenFormats.set(timeZone, format);
  }
  return format.format(at).replace(" at ", ", ");
}
