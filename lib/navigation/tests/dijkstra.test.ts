import { describe, expect, it } from "vitest";

import { findShortestPath } from "../dijkstra";
import { sampleNavigationGraph } from "../sample-graph";
import type { NavigationGraph } from "../types";

describe("findShortestPath", () => {
  it("chooses a cheaper indirect route", () => {
    const result = findShortestPath(
      sampleNavigationGraph,
      "A",
      "B",
    );

    expect(result).toEqual({
      nodeIds: ["A", "C", "B"],
      totalCost: 70,
      distanceMeters: 70,
    });
  });

  it("finds the cheapest route across several nodes", () => {
    const result = findShortestPath(
      sampleNavigationGraph,
      "A",
      "D",
    );

    expect(result).toEqual({
      nodeIds: ["A", "C", "B", "D"],
      totalCost: 90,
      distanceMeters: 90,
    });
  });

  it("returns a zero-length route when start equals destination", () => {
    const result = findShortestPath(
      sampleNavigationGraph,
      "A",
      "A",
    );

    expect(result).toEqual({
      nodeIds: ["A"],
      totalCost: 0,
      distanceMeters: 0,
    });
  });

  it("returns null when the destination is unreachable", () => {
    const result = findShortestPath(
      sampleNavigationGraph,
      "A",
      "E",
    );

    expect(result).toBeNull();
  });

  it("throws when the start node does not exist", () => {
    expect(() =>
      findShortestPath(
        sampleNavigationGraph,
        "UNKNOWN",
        "A",
      ),
    ).toThrow('Unknown start node: "UNKNOWN".');
  });

  it("throws when the destination node does not exist", () => {
    expect(() =>
      findShortestPath(
        sampleNavigationGraph,
        "A",
        "UNKNOWN",
      ),
    ).toThrow(
      'Unknown destination node: "UNKNOWN".',
    );
  });

  it("rejects a negative edge cost", () => {
    const invalidGraph: NavigationGraph = {
      A: [
        {
          to: "B",
          distanceMeters: 10,
          cost: -1,
        },
      ],
      B: [],
    };

    expect(() =>
      findShortestPath(invalidGraph, "A", "B"),
    ).toThrow(RangeError);
  });

  it("rejects an edge that points to an unknown node", () => {
    const invalidGraph: NavigationGraph = {
      A: [
        {
          to: "UNKNOWN",
          distanceMeters: 10,
          cost: 10,
        },
      ],
    };

    expect(() =>
      findShortestPath(invalidGraph, "A", "A"),
    ).toThrow(
      'Edge from "A" points to unknown node "UNKNOWN".',
    );
  });

  it("keeps route cost separate from physical distance", () => {
    const accessibilityGraph: NavigationGraph = {
      A: [
        {
          to: "B",
          distanceMeters: 50,
          cost: 100,
        },
        {
          to: "C",
          distanceMeters: 60,
          cost: 20,
        },
      ],

      B: [],

      C: [
        {
          to: "B",
          distanceMeters: 60,
          cost: 20,
        },
      ],
    };

    const result = findShortestPath(
      accessibilityGraph,
      "A",
      "B",
    );

    expect(result).toEqual({
      nodeIds: ["A", "C", "B"],
      totalCost: 40,
      distanceMeters: 120,
    });
  });
});