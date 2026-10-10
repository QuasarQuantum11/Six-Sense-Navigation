// Monash Clayton's local time. Daily figures are bucketed by campus day, so a
// day only "closes" at midnight here rather than at midnight UTC.
export const CAMPUS_TIME_ZONE = "Australia/Melbourne";

export const SIGNUP_CHART_DAYS = 30;

export type Weekday =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

/** Calendar date in the campus time zone, as YYYY-MM-DD. */
export function campusDateString(date: Date): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function campusWeekday(date: Date): Weekday {
  const name = new Intl.DateTimeFormat("en-AU", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "long",
  }).format(date);
  return name as Weekday;
}

export function campusHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export function greetingFor(date: Date): string {
  const hour = campusHour(date);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Adds whole days to a YYYY-MM-DD string. Date maths is done in UTC, so DST can't shift it. */
export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export type DailyCount = { date: string; count: number };

/**
 * Builds one entry per day for the `days` days ending at `endDate` (inclusive),
 * filling days with no sign-ups with zero.
 */
export function buildDailySeries(
  rows: readonly DailyCount[],
  endDate: string,
  days: number,
): DailyCount[] {
  const counts = new Map(rows.map((row) => [row.date, row.count]));
  const series: DailyCount[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = addDays(endDate, -offset);
    series.push({ date, count: counts.get(date) ?? 0 });
  }
  return series;
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: CAMPUS_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
