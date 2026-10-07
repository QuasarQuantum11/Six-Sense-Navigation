import { Temporal } from "@js-temporal/polyfill";

export const CROWD_TIME_ZONE = "Australia/Melbourne";
export const PARTICIPATION_MS = 168 * 60 * 60 * 1000;
export const DEMO_DATE = "2026-10-07";

export function localInstant(date: string, time: string): Temporal.Instant {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::00)?$/.test(time)) {
    throw new Error("Choose a valid date and time.");
  }
  const day = Temporal.PlainDate.from(date, { overflow: "reject" });
  const clock = Temporal.PlainTime.from(time, { overflow: "reject" });
  return day.toPlainDateTime(clock).toZonedDateTime(CROWD_TIME_ZONE, { disambiguation: "reject" }).toInstant();
}

export function requestInstant(mode: "real" | "demo", date: string | undefined, time: string | undefined, now: Date): Temporal.Instant {
  if ((date === undefined) !== (time === undefined)) throw new Error("Provide both a date and a time.");
  const instant = date && time ? localInstant(date, time)
    : mode === "demo" ? localInstant(DEMO_DATE, "10:00") : Temporal.Instant.from(now.toISOString());
  if (mode === "demo" && instant.toZonedDateTimeISO(CROWD_TIME_ZONE).toPlainDate().toString() !== DEMO_DATE) {
    throw new Error(`The simulation uses ${DEMO_DATE}. Choose a time on that date.`);
  }
  if (mode === "real" && (instant.epochMilliseconds < Math.floor(now.getTime() / 60_000) * 60_000 || instant.epochMilliseconds > now.getTime() + PARTICIPATION_MS)) {
    throw new Error("Real estimates are available for the current minute through the next seven days.");
  }
  return instant;
}

export function durationMinutes(value: string | null): number | null {
  if (!value?.trim()) return null;
  const text = value.trim().toLowerCase();
  const clock = text.match(/^(\d{1,2}):(\d{2})$/);
  const units = text.match(/^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?$/);
  let minutes: number;
  if (clock && Number(clock[2]) < 60) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else if (units && (units[1] || units[2])) minutes = Number(units[1] ?? 0) * 60 + Number(units[2] ?? 0);
  else return null;
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null;
}

// null means unparseable; false means valid dates that exclude this day.
export function classOccursOn(value: string | null, day: Temporal.PlainDate): boolean | null {
  if (!value?.trim()) return true;
  let occurs = false;
  try {
    for (const part of value.split(",")) {
      const tokens = part.trim().split(/\s*[-–]\s*/);
      if (tokens.length < 1 || tokens.length > 2) return null;
      const parsed = tokens.map(token => {
        const match = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
        if (!match) throw new Error("Invalid dates");
        return { explicitYear: !!match[3], date: Temporal.PlainDate.from({ year: Number(match[3] ?? day.year), month: Number(match[2]), day: Number(match[1]) }, { overflow: "reject" }) };
      });
      const start = parsed[0]; const end = parsed[1] ?? start;
      if (start.explicitYear !== end.explicitYear) return null;
      if (!start.explicitYear && Temporal.PlainDate.compare(start.date, end.date) > 0) {
        occurs ||= Temporal.PlainDate.compare(day, start.date) >= 0 || Temporal.PlainDate.compare(day, end.date) <= 0;
      } else {
        if (Temporal.PlainDate.compare(start.date, end.date) > 0) return null;
        occurs ||= Temporal.PlainDate.compare(day, start.date) >= 0 && Temporal.PlainDate.compare(day, end.date) <= 0;
      }
    }
    return occurs;
  } catch { return null; }
}
