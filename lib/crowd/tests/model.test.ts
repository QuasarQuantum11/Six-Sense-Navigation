import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { estimateCrowd } from "../model";
import { demoDataset } from "../demo";
import { classOccursOn, durationMinutes, localInstant, requestInstant, PARTICIPATION_MS } from "../time";

const now = new Date("2026-10-06T22:00:00Z");
const run = (time = "10:00", change: Partial<Parameters<typeof estimateCrowd>[0]> = {}) => estimateCrowd({ ...demoDataset(), mode: "real", now, at: localInstant("2026-10-07", time), ...change });

describe("crowd model", () => {
  it("computes three peak levels from classes rather than preassigned map colours", () => {
    expect(run().buildings.map(b => [b.id, b.level])).toEqual([["ltb", "high"], ["campus-centre", "medium"], ["menzies", "low"]]);
    expect(run("09:55").buildings.map(b => b.level)).toEqual(["medium", "medium", "low"]);
    expect(run("09:45").buildings.every(b => b.level === "unknown")).toBe(true);
  });
  it("computes departures and reports missing durations without inventing an end", () => {
    expect(run("11:00").buildings[0].level).toBe("high");
    const data = demoDataset(); data.classes = data.classes.map(c => ({ ...c, duration: null }));
    const result = run("11:00", data);
    expect(result.buildings.every(b => b.level === "unknown")).toBe(true);
    expect(result.notices.join(" ")).toContain("arrival activity only");
  });
  it("caps duplicate rows and coincident activities to one contribution per student", () => {
    const data = demoDataset();
    const original = run();
    const result = run("10:00", { ...data, classes: [...data.classes, ...data.classes, ...data.classes.map(c => ({ ...c, startTime: "09:00" }))] });
    expect(result.buildings).toEqual(original.buildings);
  });
  it.each([0, 1, 4])("withholds grades below the five-participant cohort threshold (%s)", count => {
    expect(run("10:00", { participants: demoDataset().participants.slice(0, count) }).buildings.every(b => b.level === "unknown")).toBe(true);
  });
  it("requires three distinct contributing students per building", () => {
    const data = demoDataset();
    const result = run("10:00", { ...data, classes: data.classes.filter(c => c.buildingId !== "menzies" || c.studentId.endsWith("-1") || c.studentId.endsWith("-2")) });
    expect(result.buildings.find(b => b.id === "menzies")?.level).toBe("unknown");
    expect(result.buildings.find(b => b.id === "ltb")?.level).toBe("high");
  });
  it("stops at the exact expiration and excludes forecast times beyond participation", () => {
    const data = demoDataset();
    const at = localInstant("2026-10-07", "10:00");
    data.participants = data.participants.map(p => ({ ...p, expiresAt: new Date(at.epochMilliseconds) }));
    expect(run("10:00", data).buildings.every(b => b.level === "unknown")).toBe(true);
  });
  it("excludes non-Clayton, invalid schedules and unlocated buildings", () => {
    const data = demoDataset();
    data.classes = data.classes.map(c => ({ ...c, campus: "CA" }));
    expect(run("10:00", data).buildings.every(b => b.level === "unknown")).toBe(true);
    data.classes = demoDataset().classes.map(c => ({ ...c, startTime: "25:00" }));
    expect(run("10:00", data).notices.join(" ")).toContain("excluded");
    data.buildings[0].longitude = 0;
    expect(run("10:00", data).buildings.map(b => b.id)).not.toContain("ltb");
  });
  it("does not count a course during an excluded date interval", () => {
    const data = demoDataset();
    data.classes = data.classes.map(c => ({ ...c, classDates: "29/7-16/9, 8/10-21/10" }));
    expect(run("10:00", data).buildings.every(b => b.level === "unknown")).toBe(true);
  });
  it("includes previous-day departures across midnight", () => {
    const data = demoDataset();
    data.classes = data.classes.map(c => ({ ...c, dayOfWeek: "Tuesday", startTime: "23:00", duration: "2 hrs", classDates: "6/10" }));
    expect(run("01:00", data).buildings[0].level).toBe("high");
  });
  it("keeps the fixed demo reproducible even when the real clock has moved on", () => {
    const result = run("10:00", { mode: "demo", now: new Date("2028-01-01T00:00:00Z") });
    expect(result.buildings[0].level).toBe("high");
    expect(result.notices.join(" ")).toContain("SIMULATED DATA");
    expect(result.generatedAt).toBe("2028-01-01T00:00:00.000Z");
  });
  it("does not publish identities, exact counts, classes or scores", () => {
    const encoded = JSON.stringify(run());
    expect(encoded).not.toContain("fictional-");
    for (const field of ["studentId", "consentedAt", "expiresAt", "score", "contributors", "startTime"]) expect(encoded).not.toContain(`"${field}"`);
  });
  it.each([[4, "low"], [5, "medium"], [9, "medium"], [10, "high"]])("handles score boundary %s", (count, level) => {
    const data = demoDataset();
    data.classes = data.classes.filter(c => c.buildingId !== "ltb" || Number(c.studentId.split("-").at(-1)) <= count);
    expect(run("10:00", data).buildings[0].level).toBe(level);
  });
});

describe("schedule interpretation", () => {
  it.each([["3 hrs", 180], ["1 hr 30 mins", 90], ["1.5 hours", 90], ["90 mins", 90], ["01:30", 90], ["0 hrs", null], ["unknown", null], ["25 hours", null]])("reads duration %s", (value, minutes) => expect(durationMinutes(value)).toBe(minutes));
  it.each([
    ["29/7-16/9, 30/9-21/10", "2026-10-07", true],
    ["29/7-16/9, 30/9-21/10", "2026-09-23", false],
    ["7/10/2025", "2026-10-07", false],
    ["7/10", "2026-10-07", true],
    ["20/12-10/1", "2027-01-05", true],
    ["20/12-10/1", "2026-11-05", false],
    ["31/2", "2026-10-07", null],
    ["bad", "2026-10-07", null],
  ])("interprets dates %s at %s", (dates, date, expected) => expect(classOccursOn(dates, Temporal.PlainDate.from(date))).toBe(expected));
  it("treats blank dates as weekly during the confirmed participation period", () => expect(classOccursOn(null, Temporal.PlainDate.from("2026-10-07"))).toBe(true));
  it("uses Melbourne time instead of the machine timezone", () => expect(localInstant("2026-10-07", "10:00").toString()).toBe("2026-10-06T23:00:00Z"));
  it.each([["2026-10-04", "02:30"], ["2026-04-05", "02:30"], ["2026-02-30", "10:00"], ["2026-10-07", "25:00"]])("rejects invalid or ambiguous local time %s %s", (date, time) => expect(() => localInstant(date, time)).toThrow());
  it("bounds real forecasts and requires paired date/time", () => {
    expect(requestInstant("real", undefined, undefined, now).epochMilliseconds).toBe(now.getTime());
    expect(() => requestInstant("real", "2026-10-16", "10:00", now)).toThrow();
    expect(() => requestInstant("real", "2026-10-01", "10:00", now)).toThrow();
    expect(() => requestInstant("real", "2026-10-07", undefined, now)).toThrow();
    expect(PARTICIPATION_MS).toBe(168 * 3600_000);
  });
});
