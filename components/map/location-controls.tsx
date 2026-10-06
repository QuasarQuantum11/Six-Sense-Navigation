"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import L from "leaflet";
import Link from "next/link";
import { isCampusLocation, isFreshLocation, watchCurrentLocation, type CurrentLocation } from "@/lib/navigation/geolocation";

export default function LocationControls({ mapRef, onUse, busy }: {
  mapRef: RefObject<L.Map | null>;
  onUse: (location: CurrentLocation) => void;
  busy: boolean;
}) {
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [message, setMessage] = useState("Location is off.");
  const [fresh, setFresh] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setTracking(false);
    setLocation(null);
    setFresh(false);
    setMessage("Location stopped. The chosen route start remains until you replace it.");
  }

  useEffect(() => {
    if (!tracking) return;
    const stopWatch = watchCurrentLocation(navigator.geolocation, (next) => {
      setLocation(next);
      setFresh(true);
      setMessage(`Location updated. Accuracy approximately ${Math.round(next.accuracy)} m.`);
    }, (error) => {
      setTracking(false);
      setLocation(null);
      setFresh(false);
      setMessage(error);
    });
    stopRef.current = stopWatch;
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopWatch();
      stopRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tracking]);

  useEffect(() => {
    if (!location) return;
    const refresh = () => setFresh(isFreshLocation(location));
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [location]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location || !fresh) return;
    const point: L.LatLngTuple = [location.latitude, location.longitude];
    const circle = L.circle(point, { radius: location.accuracy, color: "#1d4ed8", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
    const marker = L.circleMarker(point, { radius: 7, color: "white", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1, interactive: false }).addTo(map);
    marker.bindTooltip("Your current location");
    return () => { circle.remove(); marker.remove(); };
  }, [location, fresh, mapRef]);

  function start() {
    if (!window.isSecureContext) {
      setMessage("Location requires HTTPS or localhost. You can still choose a start on the map.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("This browser does not support location. Choose a start on the map.");
      return;
    }
    setMessage("Waiting for location permission and a recent position…");
    setTracking(true);
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-slate-200 p-3">
      <h3 className="font-semibold text-slate-900">Your location</h3>
      <p className="text-xs text-slate-600">Optional. Updates stay in this map until you choose a route start. We do not save location history. Stops when you leave or hide this page.</p>
      <button type="button" onClick={tracking ? stop : start} className="w-full rounded-md border border-blue-700 px-3 py-2 text-sm font-medium text-blue-800">
        {tracking ? "Stop location" : "Enable location"}
      </button>
      <button type="button" disabled={busy || !tracking || !location || !fresh} onClick={() => {
        if (!location || !isFreshLocation(location)) {
          setFresh(false);
          setMessage("Location is outdated. Wait for an update or restart location.");
          return;
        }
        if (!isCampusLocation(location)) {
          setMessage("Your position is outside the Clayton campus map area. Choose a start on the campus map.");
          return;
        }
        onUse(location);
      }} className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        Use current location as start
      </button>
      <p role="status" className="text-xs text-slate-700">{location && !fresh ? "Location is outdated. Wait for an update or restart location." : message}</p>
      <p className="text-xs text-slate-600">Browser location cannot identify an indoor room or floor. <Link href="/privacy" className="underline">Privacy details</Link></p>
    </div>
  );
}
