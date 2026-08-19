import { describe, expect, it } from "vitest";

import {
  calculateRouteDistance,
  haversineDistanceMeters,
} from "../distance";

import { sampleNavigationGraph } from "../sample-graph";

describe("haversineDistanceMeters", () => {
  it("returns zero for the same coordinate", () => {
    const coordinate = {
      latitude: 0,
      longitude: 0,
    };

    const distance = haversineDistanceMeters(
      coordinate,
      coordinate,
    );

    expect(distance).toBe(0);
  });

  it("calculates a known distance at the equator", () => {
    const from = {
      latitude: 0,
      longitude: 0,
    };

    const to = {
      latitude: 0,
      longitude: 1,
    };

    const distance = haversineDistanceMeters(from, to);

    expect(distance).toBeCloseTo(111_195, 0);
  });

  it("returns approximately the same distance in both directions", () => {
    const pointA = {
      latitude: -37.9105,
      longitude: 145.1362,
    };

    const pointB = {
      latitude: -37.9115,
      longitude: 145.1372,
    };

    const forwardDistance =
      haversineDistanceMeters(pointA, pointB);

    const reverseDistance =
      haversineDistanceMeters(pointB, pointA);

    expect(forwardDistance).toBeCloseTo(
      reverseDistance,
      10,
    );
  });

  it("rejects a latitude outside the valid range", () => {
    const invalidCoordinate = {
      latitude: 91,
      longitude: 0,
    };

    const validCoordinate = {
      latitude: 0,
      longitude: 0,
    };

    expect(() =>
      haversineDistanceMeters(
        invalidCoordinate,
        validCoordinate,
      ),
    ).toThrow(RangeError);
  });

  it("rejects a non-finite coordinate", () => {
    const invalidCoordinate = {
      latitude: Number.NaN,
      longitude: 0,
    };

    const validCoordinate = {
      latitude: 0,
      longitude: 0,
    };

    expect(() =>
      haversineDistanceMeters(
        invalidCoordinate,
        validCoordinate,
      ),
    ).toThrow(TypeError);
  });
});

describe("calculateRouteDistance", () => {
  it("returns zero for an empty route", () => {
    expect(
      calculateRouteDistance(
        sampleNavigationGraph,
        [],
      ),
    ).toBe(0);
  });

  it("returns zero for a single-node route", () => {
    expect(
      calculateRouteDistance(
        sampleNavigationGraph,
        ["A"],
      ),
    ).toBe(0);
  });

  it("adds the distance of every edge in a route", () => {
    const distance = calculateRouteDistance(
      sampleNavigationGraph,
      ["A", "C", "B", "D"],
    );

    expect(distance).toBe(90);
  });

  it("throws when a route contains an unknown node", () => {
    expect(() =>
      calculateRouteDistance(
        sampleNavigationGraph,
        ["A", "UNKNOWN"],
      ),
    ).toThrow('Unknown route node: "UNKNOWN".');
  });

  it("throws when consecutive nodes have no connecting edge", () => {
    expect(() =>
      calculateRouteDistance(
        sampleNavigationGraph,
        ["B", "A"],
      ),
    ).toThrow(
      'No graph edge exists from "B" to "A".',
    );
  });
});