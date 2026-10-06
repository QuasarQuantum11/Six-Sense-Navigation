// Walking speeds in metres per second, matching the students' walking_speed
// preference. "normal" is a typical adult pace (about 5 km/h); "accessible"
// allows for a slower pace, e.g. with a mobility aid.
export const WALKING_SPEEDS_MPS = {
  accessible: 1.0,
  normal: 1.4,
  fast: 1.8,
} as const;

export type WalkingSpeed = keyof typeof WALKING_SPEEDS_MPS;

// Whole minutes to walk a distance, rounded up and at least 1 minute.
export function estimateWalkingMinutes(
  distanceMeters: number,
  speed: WalkingSpeed = "normal",
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new RangeError("Distance must be a non-negative number.");
  }
  const minutes = distanceMeters / WALKING_SPEEDS_MPS[speed] / 60;
  return Math.max(1, Math.ceil(minutes));
}

export function formatWalkingTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}
