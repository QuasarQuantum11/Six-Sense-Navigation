import { describe, expect, it } from "vitest";
import {
  getWheelchairRouteCost,
  isRoadHighway,
  isWheelchairAccessibleEdge,
} from "../accessibility";

describe("wheelchair access filtering", () => {
  it("keeps major roads excluded while identifying service roads separately", () => {
    expect(isRoadHighway("primary")).toBe(true);
    expect(isRoadHighway("service")).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "primary" })).toBe(false);
  });

  it("allows campus service links as unverified candidates, not fast service roads", () => {
    expect(isWheelchairAccessibleEdge({ highway: "service" })).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "service", maxspeed: "20" })).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "service", maxspeed: "30" })).toBe(false);
    expect(isWheelchairAccessibleEdge({ highway: "service", maxspeed: "20 mph" })).toBe(false);
    expect(isWheelchairAccessibleEdge({ highway: "service", wheelchairAccessible: false })).toBe(false);
  });

  it("requires explicit wheelchair access on residential and unclassified roads", () => {
    for (const highway of ["residential", "unclassified", "road"]) {
      expect(isWheelchairAccessibleEdge({ highway })).toBe(false);
      expect(isWheelchairAccessibleEdge({ highway, wheelchairAccessible: true })).toBe(true);
    }
    expect(isWheelchairAccessibleEdge({ highway: "primary", wheelchairAccessible: true })).toBe(false);
  });

  it("handles merged highway tags conservatively and never infers unknown paths", () => {
    expect(isWheelchairAccessibleEdge({ highway: "['service', 'footway']" })).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "['steps', 'footway']" })).toBe(false);
    expect(isWheelchairAccessibleEdge({ highway: "steps", hasSteps: false })).toBe(false);
    expect(isWheelchairAccessibleEdge({ highway: "footway", wheelchairAccessible: false })).toBe(false);
    expect(isWheelchairAccessibleEdge({})).toBe(false);
  });

  it("allows footpaths and non-road campus links", () => {
    expect(isWheelchairAccessibleEdge({ highway: "footway" })).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "path" })).toBe(true);
  });

  it("rejects stair edges even when they are not roads", () => {
    expect(isWheelchairAccessibleEdge({ highway: "steps", hasSteps: true })).toBe(false);
  });

  it("keeps the wheelchair route cost equal to the normal distance for valid edges", () => {
    const baseDistance = 55;
    expect(getWheelchairRouteCost({ highway: "footway" }, baseDistance)).toBe(baseDistance);
  });
});
