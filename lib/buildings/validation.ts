import { z } from "zod";

// Same bounding box as scripts/navigation/generate_graph.py and
// scripts/seed-buildings.mjs. Anything outside it is almost certainly a typo
// or swapped latitude/longitude.
export const campusBounds = {
  south: -37.922,
  north: -37.905,
  west: 145.127,
  east: 145.142,
};

// Form fields arrive as strings; a blank field means "no coordinate".
const optionalCoordinate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || Number.isFinite(value), {
      message: `${label} must be a number, e.g. -37.9133`,
    });

export const buildingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a building name")
      .max(100, "Building name must be 100 characters or fewer"),
    latitude: optionalCoordinate("Latitude"),
    longitude: optionalCoordinate("Longitude"),
  })
  .superRefine(({ latitude, longitude }, ctx) => {
    if (latitude === null && longitude !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Enter a latitude too, or leave both blank",
      });
    }
    if (longitude === null && latitude !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Enter a longitude too, or leave both blank",
      });
    }
    if (
      latitude !== null &&
      Number.isFinite(latitude) &&
      (latitude < campusBounds.south || latitude > campusBounds.north)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: `Latitude must be between ${campusBounds.south} and ${campusBounds.north} (Monash Clayton). Check it isn't swapped with longitude.`,
      });
    }
    if (
      longitude !== null &&
      Number.isFinite(longitude) &&
      (longitude < campusBounds.west || longitude > campusBounds.east)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: `Longitude must be between ${campusBounds.west} and ${campusBounds.east} (Monash Clayton). Check it isn't swapped with latitude.`,
      });
    }
  });

// Google Maps copies coordinates as "latitude, longitude", so a pasted pair
// can fill both fields at once.
const coordinatePairPattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parseCoordinatePair(text: string) {
  const match = text.match(coordinatePairPattern);
  return match ? { latitude: match[1], longitude: match[2] } : null;
}

// Raw form values, before validation.
export type BuildingInput = {
  name: string;
  latitude: string;
  longitude: string;
};

export type BuildingActionState = {
  errors?: {
    name?: string[];
    latitude?: string[];
    longitude?: string[];
  };
  message?: string;
};
