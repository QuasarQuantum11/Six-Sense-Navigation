import { describe, expect, it } from "vitest";
import { buildingSchema } from "../validation";

describe("building validation", () => {
  const validBuilding = {
    name: "  Learning and Teaching Building ",
    latitude: "-37.913296",
    longitude: "145.132781",
  };

  it("trims the name and converts coordinates to numbers", () => {
    const result = buildingSchema.safeParse(validBuilding);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Learning and Teaching Building",
        latitude: -37.913296,
        longitude: 145.132781,
      });
    }
  });

  it("accepts a building without coordinates", () => {
    const result = buildingSchema.safeParse({
      ...validBuilding,
      latitude: " ",
      longitude: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBeNull();
      expect(result.data.longitude).toBeNull();
    }
  });

  it.each([
    { name: "   " },
    { name: "x".repeat(101) },
    { latitude: "abc" },
    { latitude: "" },
    { longitude: "" },
    { latitude: "145.132781", longitude: "-37.913296" },
    { latitude: "-33.8688" },
  ])("rejects invalid building data: %j", (change) => {
    expect(buildingSchema.safeParse({ ...validBuilding, ...change }).success).toBe(false);
  });

  it("reports swapped coordinates on both fields", () => {
    const result = buildingSchema.safeParse({
      ...validBuilding,
      latitude: "145.132781",
      longitude: "-37.913296",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const { fieldErrors } = result.error.flatten();
      expect(fieldErrors.latitude?.[0]).toMatch(/swapped/);
      expect(fieldErrors.longitude?.[0]).toMatch(/swapped/);
    }
  });
});
