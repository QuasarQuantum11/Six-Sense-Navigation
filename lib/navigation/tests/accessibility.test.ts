import { describe, expect, it } from "vitest";
import {
  getWheelchairRouteCost,
  isRoadHighway,
  isWheelchairAccessibleEdge,
} from "../accessibility";

describe("wheelchair access filtering", () => {
  it("treats roads as inaccessible for wheelchair routing", () => {
    expect(isRoadHighway("primary")).toBe(true);
    expect(isRoadHighway("service")).toBe(true);
    expect(isWheelchairAccessibleEdge({ highway: "primary" })).toBe(false);
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
