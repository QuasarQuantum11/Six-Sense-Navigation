export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export function isFreshLocation(location: CurrentLocation, now = Date.now()): boolean {
  return Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 &&
    Number.isFinite(location.accuracy) && location.accuracy >= 0 &&
    Number.isFinite(location.timestamp) && now - location.timestamp >= 0 &&
    now - location.timestamp <= 30_000;
}

export function isCampusLocation(location: CurrentLocation): boolean {
  return location.latitude >= -37.9185 && location.latitude <= -37.8990 &&
    location.longitude >= 145.1255 && location.longitude <= 145.1445;
}

// No storage or network calls: samples belong only to the current map session.
export function watchCurrentLocation(
  geolocation: Geolocation,
  onLocation: (location: CurrentLocation) => void,
  onError: (message: string) => void,
): () => void {
  let active = true;
  let watchId: number | undefined;
  const stop = () => {
    active = false;
    if (watchId !== undefined) {
      geolocation.clearWatch(watchId);
      watchId = undefined;
    }
  };
  try {
    watchId = geolocation.watchPosition((position) => {
      if (!active) return;
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      if (isFreshLocation(location)) onLocation(location);
      else {
        stop();
        onError("A recent, valid location is unavailable. Try again or choose a start on the map.");
      }
    }, (error) => {
      if (!active) return;
      stop();
      onError(error.code === 1
        ? "Location permission was denied. Allow it in browser settings, or choose a start on the map."
        : error.code === 3
          ? "Location timed out. Try again or choose a start on the map."
          : "Your location is unavailable. Try again or choose a start on the map.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    // Also handle a provider that invokes a callback synchronously.
    if (!active) stop();
  } catch {
    stop();
    onError("Location is unavailable in this browser. Choose a start on the map.");
  }
  return stop;
}
