import { describe, expect, it } from "vitest";

import {
  estimateWalkingMinutes,
  formatDistance,
  formatWalkingTime,
  walkingPaceKmh,
} from "../walking";

describe("walkingPaceKmh", () => {
  it("shows each walking speed as whole km/h", () => {
    expect(walkingPaceKmh("accessible")).toBe(4);
    expect(walkingPaceKmh("normal")).toBe(5);
    expect(walkingPaceKmh("fast")).toBe(6);
  });
});

describe("estimateWalkingMinutes", () => {
  it("uses a normal pace of 1.4 m/s by default, rounding up", () => {
    // 830 m / 1.4 m/s ≈ 9.9 min; 850 m ≈ 10.1 min.
    expect(estimateWalkingMinutes(830)).toBe(10);
    expect(estimateWalkingMinutes(850)).toBe(11);
  });

  it("adjusts for the walking speed preference", () => {
    // 590 m: ≈ 9.8 min at 1.0 m/s, ≈ 5.5 min at 1.8 m/s.
    expect(estimateWalkingMinutes(590, "accessible")).toBe(10);
    expect(estimateWalkingMinutes(590, "fast")).toBe(6);
  });

  it("never estimates less than a minute", () => {
    expect(estimateWalkingMinutes(0)).toBe(1);
    expect(estimateWalkingMinutes(20)).toBe(1);
  });

  it.each([-1, Number.NaN, Infinity])("rejects an invalid distance (%s)", (distance) => {
    expect(() => estimateWalkingMinutes(distance)).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it.each([
    [5, "5 min"],
    [60, "1 h"],
    [75, "1 h 15 min"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatWalkingTime(minutes)).toBe(expected);
  });

  it.each([
    [0, "0 m"],
    [449.6, "450 m"],
    [999.4, "999 m"],
    [1000, "1.0 km"],
    [1260, "1.3 km"],
  ])("formats %d m as %s", (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });
});
