import { describe, expect, it } from "vitest";
import {
  addDays,
  buildDailySeries,
  campusDateString,
  campusWeekday,
  formatRelativeTime,
  greetingFor,
} from "../dates";

describe("campus time", () => {
  it("uses the Melbourne calendar day, not UTC", () => {
    // 14:30 UTC on 6 Oct is already 7 Oct (AEDT, UTC+11) in Melbourne.
    const instant = new Date("2026-10-06T14:30:00Z");
    expect(campusDateString(instant)).toBe("2026-10-07");
    expect(campusWeekday(instant)).toBe("Wednesday");
  });

  it("picks a greeting from the campus hour", () => {
    expect(greetingFor(new Date("2026-10-06T21:00:00Z"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-10-07T03:00:00Z"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-10-07T09:00:00Z"))).toBe("Good evening");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("buildDailySeries", () => {
  it("returns one entry per day ending at endDate and fills gaps with zero", () => {
    const series = buildDailySeries(
      [
        { date: "2026-10-04", count: 3 },
        { date: "2026-10-06", count: 1 },
      ],
      "2026-10-06",
      4,
    );
    expect(series).toEqual([
      { date: "2026-10-03", count: 0 },
      { date: "2026-10-04", count: 3 },
      { date: "2026-10-05", count: 0 },
      { date: "2026-10-06", count: 1 },
    ]);
  });

  it("ignores rows outside the window", () => {
    const series = buildDailySeries([{ date: "2026-01-01", count: 9 }], "2026-10-06", 2);
    expect(series.every((day) => day.count === 0)).toBe(true);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  it("describes recent times", () => {
    expect(formatRelativeTime(new Date("2026-10-07T11:42:00Z"), now)).toBe("18 min ago");
    expect(formatRelativeTime(new Date("2026-10-07T11:00:00Z"), now)).toBe("1 hr ago");
    expect(formatRelativeTime(new Date("2026-10-04T12:00:00Z"), now)).toBe("3 days ago");
  });
});
