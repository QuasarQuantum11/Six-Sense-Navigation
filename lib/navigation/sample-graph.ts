import type { NavigationGraph } from "./types";

export const sampleNavigationGraph: NavigationGraph = {
  A: [
    {
      to: "B",
      distanceMeters: 100,
      cost: 100,
    },
    {
      to: "C",
      distanceMeters: 30,
      cost: 30,
    },
  ],

  B: [
    {
      to: "D",
      distanceMeters: 20,
      cost: 20,
    },
  ],

  C: [
    {
      to: "B",
      distanceMeters: 40,
      cost: 40,
    },
    {
      to: "D",
      distanceMeters: 100,
      cost: 100,
    },
  ],

  D: [],

  E: [],
};