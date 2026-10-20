"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import BuildingSearch from "@/components/map/building-search";
import type { BuildingLocation } from "@/lib/buildings/search";
import ltbEntrances from "@/api/ltb_entrances.json";
import Link from "next/link";
import LocationControls from "@/components/map/location-controls";
import CrowdControls from "@/components/map/crowd-controls";
import { isCampusLocation, isFreshLocation, type CurrentLocation } from "@/lib/navigation/geolocation";
import {
    floorLabel,
    makeIndoorDirections,
    placeName,
    roomOptions,
    summariseIndoorRoute,
    type IndoorNode,
    type IndoorRouteNode,
    type IndoorRouteSummary,
} from "@/lib/navigation/indoor";
import {
    estimateWalkingMinutes,
    formatDistance,
    formatWalkingTime,
    walkingPaceKmh,
    type WalkingSpeed,
} from "@/lib/navigation/walking";

// Leaflet looks for its default pin images at a path that doesn't exist once
// bundled, so point every marker at copies in public/leaflet/.
L.Marker.prototype.options.icon = L.icon({
    iconUrl: "/leaflet/marker-icon.png",
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    shadowUrl: "/leaflet/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});

type WalkingRoute = {
    route: L.LatLngTuple[];
    // Missing if the API couldn't measure the route.
    distanceMeters: number | null;
};

type OutdoorDirection = {
    text: string;
    distanceMeters: number;
};

// Fetches a walking route between two points from the Next.js routing API.
async function fetchWalkingRoute(
    start: L.LatLng,
    destination: L.LatLng,
    signal?: AbortSignal,
): Promise<WalkingRoute> {
    const response = await fetch("/api/route", {
        signal,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            startLatitude: start.lat,
            startLongitude: start.lng,
            destinationLatitude: destination.lat,
            destinationLongitude: destination.lng,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || `Route request failed (${response.status})`
        );
    }

    if (!Array.isArray(data.route) || data.route.length < 2) {
        throw new Error("The API returned an invalid walking route.");
    }

    return {
        route: data.route,
        distanceMeters: data.distanceMeters,
    };
}

// Replaces any route already drawn with a new one and fits the map to it.
function drawRoute(
    map: L.Map,
    routeLayerRef: { current: L.Polyline | null },
    route: L.LatLngTuple[]
) {
    routeLayerRef.current?.remove();
    routeLayerRef.current = L.polyline(route, { color: "blue", weight: 5 }).addTo(map);
    map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
}

// Pans to a point, jumping instead of flying when reduced motion is preferred.
function panToPoint(map: L.Map, position: L.LatLngTuple) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        map.setView(position, 18);
    } else {
        map.flyTo(position, 18, { duration: 1 });
    }
}

// What the indoor route view describes: where the trip starts and ends.
type IndoorTrip = {
    from: string;
    to: string;
    // Entrance used by routes that start outside the LTB.
    entrance: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "development"
        ? "http://localhost:8000"
        : "https://six-sense-navigation-api.onrender.com");

// Indoor floor-plan images used to display the LTB route.
const floorPlans: Record<string, string> = {
    G: "/ltb/Floor-G.png",
    "1": "/ltb/Floor-1.png",
    "2": "/ltb/Floor-2.png",
    "3": "/ltb/Floor-3.png",
};

function makeOutdoorDirections(
    route: L.LatLngTuple[],
    destinationName = "the destination",
): OutdoorDirection[] {
    if (route.length < 2) return [];

    const distanceBetween = (
        a: L.LatLngTuple,
        b: L.LatLngTuple,
    ) => L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));

    const bearing = (
        a: L.LatLngTuple,
        b: L.LatLngTuple,
    ) => {
        const rad = Math.PI / 180;
        const lat1 = a[0] * rad;
        const lat2 = b[0] * rad;
        const dLon = (b[1] - a[1]) * rad;

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const segments = route.slice(1).map((point, index) => ({
        from: route[index],
        to: point,
        distance: distanceBetween(route[index], point),
        bearing: bearing(route[index], point),
    })).filter(segment => segment.distance > 1);

    if (!segments.length) {
        return [{ text: "You are already at the destination.", distanceMeters: 0 }];
    }

    const directions: OutdoorDirection[] = [];
    let groupDistance = 0;
    const groupBearing = segments[0].bearing;

    directions.push({
        text: `Start walking ${compassDirection(groupBearing)}.`,
        distanceMeters: 0,
    });

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        groupDistance += segment.distance;

        const next = segments[i + 1];
        const isLast = !next;

        if (isLast) {
            directions.push({
                text: `Continue to ${destinationName} (${compassDirection(segment.bearing)}).`,
                distanceMeters: groupDistance,
            });
            break;
        }

        const change = ((next.bearing - segment.bearing + 540) % 360) - 180;

        // Only announce a turn when the route changes direction meaningfully.
        if (Math.abs(change) >= 35) {
            directions.push({
                text: `${change > 0 ? "Turn right" : "Turn left"} and continue ${compassDirection(next.bearing)}.`,
                distanceMeters: groupDistance,
            });
            groupDistance = 0;
        }
    }

    return directions;
}

function compassDirection(bearing: number): string {
    const directions = [
        "north", "north-east", "east", "south-east",
        "south", "south-west", "west", "north-west",
    ];
    return directions[Math.round(bearing / 45) % 8];
}

// "1 floor by stairs", "3 floors by lift", or null on a single floor.
function describeFloorChanges(summary: IndoorRouteSummary | null): string | null {
    if (!summary) return null;
    const part = (count: number, how: string) =>
        count > 0 ? `${count} floor${count === 1 ? "" : "s"} by ${how}` : null;
    const parts = [part(summary.stairSegments, "stairs"), part(summary.liftSegments, "lift")].filter(Boolean);
    return parts.length ? parts.join(" and ") : null;
}

function PaceNote({ walkingSpeed, personalised }: { walkingSpeed: WalkingSpeed; personalised: boolean }) {
    return (
        <p className="mt-1 text-xs text-blue-900">
            {personalised ? (
                <>
                    At your {walkingSpeed} walking pace of about {walkingPaceKmh(walkingSpeed)} km/h.{" "}
                    <Link href="/profile" className="underline hover:text-blue-950">
                        Change pace
                    </Link>
                </>
            ) : (
                <>At a normal walking pace of about {walkingPaceKmh("normal")} km/h.</>
            )}
        </p>
    );
}

export default function Map({
    walkingSpeed = "normal",
    personalised = false,
    canViewCrowd = false,
    trackDestination,
}: {
    // The logged-in student's preferred pace, used for walking time estimates.
    walkingSpeed?: WalkingSpeed;
    // True when walkingSpeed comes from the student's profile.
    personalised?: boolean;
    canViewCrowd?: boolean;
    trackDestination?: BuildingLocation;
}) {
    // Shared Leaflet map references used by outdoor and indoor workflows.
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const startMarkerRef = useRef<L.Marker | null>(null);
    const endMarkerRef = useRef<L.Marker | null>(null);
    const routeLayerRef = useRef<L.Polyline | null>(null);
    const ltbRouteLayerRef = useRef<L.Polyline | null>(null);
    const pickingRef = useRef<"from" | "to" | null>(null);
    const revisionRef = useRef(0);
    const [classLocationAttempt, setClassLocationAttempt] = useState(0);
    const [classLocationMessage, setClassLocationMessage] = useState("");
    const [panel, setPanel] = useState<"route" | "crowd">("route");
    const [searchPanelCollapsed, setSearchPanelCollapsed] = useState(false);
    const [routeType, setRouteType] = useState<"building" | "room">("building");
    const [picking, setPicking] = useState<"from" | "to" | null>(null);
    const [mapStart, setMapStart] = useState(false);
    const [mapEnd, setMapEnd] = useState(false);
    const [graphVisible, setGraphVisible] = useState(false);
    const [crowdSource, setCrowdSource] = useState<"real" | "demo" | null>(null);
    const [completedDirections, setCompletedDirections] = useState<number[]>([]);

    // Building navigation: located campus buildings from the database, and
    // the buildings chosen as the route start (From) and end (To) pins.
    const [buildings, setBuildings] = useState<BuildingLocation[]>([]);
    const [buildingsError, setBuildingsError] = useState("");
    const [fromBuilding, setFromBuilding] = useState<BuildingLocation | null>(null);
    const [toBuilding, setToBuilding] = useState<BuildingLocation | null>(null);
    const [pinRouteLoading, setPinRouteLoading] = useState(false);
    const [pinRouteError, setPinRouteError] = useState("");
    // Walking distance of the route drawn between the pins, if any.
    const [pinRouteDistance, setPinRouteDistance] = useState<number | null>(null);
    // Bumped to empty the From/To boxes when map clicks replace their pins.
    const [buildingInputsKey, setBuildingInputsKey] = useState(0);
    const [fromLocationKey, setFromLocationKey] = useState(0);
    const [locationStart, setLocationStart] = useState(false);

    // Indoor navigation state. An LTB room trip starts either outside the
    // building (start pin) or in another LTB room (indoorStartNode).
    const [indoorNodes, setIndoorNodes] = useState<Record<string, IndoorNode>>({});
    const [ltbStart, setLtbStart] = useState<"outside" | "inside">("outside");
    const [destination, setDestination] = useState("");
    const [indoorStartNode, setIndoorStartNode] = useState("");
    const [indoorRoute, setIndoorRoute] = useState<IndoorRouteNode[]>([]);
    const [indoorSummary, setIndoorSummary] = useState<IndoorRouteSummary | null>(null);
    const [indoorTrip, setIndoorTrip] = useState<IndoorTrip | null>(null);
    const [activeStep, setActiveStep] = useState<string | null>(null);
    const [selectedFloor, setSelectedFloor] = useState("G");
    const [startSelected, setStartSelected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"outdoor" | "indoor">("outdoor");
    const [routeError, setRouteError] = useState("");
    const indoorResultRef = useRef<HTMLElement>(null);
    const [nodesError, setNodesError] = useState("");
    const [outdoorDirections, setOutdoorDirections] = useState<OutdoorDirection[]>([]);
    const [completedOutdoorDirections, setCompletedOutdoorDirections] = useState<number[]>([]);

    const invalidateRoutes = useCallback(() => {
        revisionRef.current += 1;
        routeLayerRef.current?.remove();
        routeLayerRef.current = null;
        ltbRouteLayerRef.current?.remove();
        ltbRouteLayerRef.current = null;
        setPinRouteDistance(null);
        setPinRouteError("");
        setOutdoorDirections([]);
        setCompletedOutdoorDirections([]);
        setIndoorRoute([]);
        setIndoorSummary(null);
        setIndoorTrip(null);
        setActiveStep(null);
        setCompletedDirections([]);
        setRouteError("");
    }, []);

    function beginPicking(end: "from" | "to") {
        pickingRef.current = end;
        setPicking(end);
    }

    useEffect(() => {
        if (!mapContainer.current) return;

        if (!mapInstance.current) {
            // OUTDOOR MAP: initialise the Leaflet map and OpenStreetMap tiles.
            const map = L.map(mapContainer.current).setView(
                [-37.9110, 145.1340],
                16
            );

            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 20,
            }).addTo(map);

            mapInstance.current = map;

            // OUTDOOR MAP: load buildings for the building search.
            fetch(`${API_URL}/api/buildings`)
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then((data) => {
                    setBuildings(data.buildings);
                    setBuildingsError("");
                })
                .catch((error) => {
                    setBuildingsError("Could not load buildings for search.");
                    console.warn("Failed to load buildings:", error);
                });

            // INDOOR MAP: load LTB rooms and indoor graph nodes.
            fetch(`${API_URL}/api/indoor-nodes`)
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then((data) => {
                    setIndoorNodes(data);
                    setNodesError("");
                })
                .catch((error) => {
                    setNodesError(`Could not load LTB rooms. Check that the Python API is running at ${API_URL}.`);
                    console.warn("Failed to load indoor nodes:", error);
                });

            // Pins only move after the user explicitly chooses what to pick.
            map.on("click", (event: L.LeafletMouseEvent) => {
                const end = pickingRef.current;
                if (!end) return;
                invalidateRoutes();
                const marker = end === "from" ? startMarkerRef : endMarkerRef;
                if (marker.current) marker.current.setLatLng(event.latlng);
                else marker.current = L.marker(event.latlng).addTo(map);
                marker.current.bindTooltip(end === "from" ? "Start: map point" : "Destination: map point");
                if (end === "from") {
                    setLocationStart(false);
                    setFromBuilding(null);
                    setMapStart(true);
                    setStartSelected(true);
                    setFromLocationKey(key => key + 1);
                } else {
                    setToBuilding(null);
                    setMapEnd(true);
                    setBuildingInputsKey(key => key + 1);
                }
                pickingRef.current = null;
                setPicking(null);
            });
        }
        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
            startMarkerRef.current = null;
            endMarkerRef.current = null;
            routeLayerRef.current = null;
            ltbRouteLayerRef.current = null;
        };
    }, [invalidateRoutes]);

    useEffect(() => {
        if (view === "outdoor") {
            // Refresh Leaflet when the map view or sidebar width changes.
            requestAnimationFrame(() => mapInstance.current?.invalidateSize());
        }
    }, [view, searchPanelCollapsed]);

    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !graphVisible) return;
        const controller = new AbortController();
        const group = L.layerGroup().addTo(map);
        fetch("/api/graph", { signal: controller.signal })
            .then(response => { if (!response.ok) throw new Error("Graph unavailable"); return response.json(); })
            .then(data => {
                if (controller.signal.aborted) return;
                data.edges?.forEach((edge: [L.LatLngTuple, L.LatLngTuple]) => {
                    L.polyline(edge, { color: "#64748b", weight: 1, opacity: 0.5, interactive: false }).addTo(group);
                });
            }).catch(error => { if (!controller.signal.aborted) console.warn("Could not load debug graph", error); });
        return () => { controller.abort(); group.remove(); };
    }, [graphVisible]);

    useEffect(() => {
        endMarkerRef.current?.setOpacity(routeType === "building" ? 1 : 0);
    }, [routeType]);

    // OUTDOOR MAP: put the start (From) or end (To) pin on a chosen building.
    const chooseBuilding = (end: "from" | "to", building: BuildingLocation) => {
        const map = mapInstance.current;
        if (!map) return;

        invalidateRoutes();
        pickingRef.current = null;
        setPicking(null);

        const buildingName = building.name.toLowerCase();
        const isLTB =
            buildingName.includes("ltb") ||
            buildingName.includes("learning and teaching building");

        const searchEntrance = ltbEntrances.entrances.find((entry) => entry.id === ltbEntrances.building_search_entrance)!;
        const position: L.LatLngTuple = isLTB
            ? [searchEntrance.latitude, searchEntrance.longitude]
            : [building.latitude, building.longitude];


        const markerRef = end === "from" ? startMarkerRef : endMarkerRef;

        if (markerRef.current) {
            markerRef.current.setLatLng(position);
        } else {
            markerRef.current = L.marker(position).addTo(map);
        }

        markerRef.current.bindTooltip(building.name);

        if (end === "from") {
            setLocationStart(false);
            setFromBuilding(building);
            setMapStart(false);
            setStartSelected(true);
        } else {
            setToBuilding(building);
            setMapEnd(false);
        }

        routeLayerRef.current?.remove();
        routeLayerRef.current = null;
        setPinRouteDistance(null);
        setPinRouteError("");

        panToPoint(map, position);
    };

    // OUTDOOR MAP: remove the pin of a building the user has cleared.
    const clearBuilding = (end: "from" | "to") => {
        invalidateRoutes();
        const markerRef = end === "from" ? startMarkerRef : endMarkerRef;
        markerRef.current?.remove();
        markerRef.current = null;
        routeLayerRef.current?.remove();
        routeLayerRef.current = null;
        setPinRouteDistance(null);
        if (end === "from") {
            setLocationStart(false);
            setFromBuilding(null);
            setMapStart(false);
            setStartSelected(false);
        } else {
            setToBuilding(null);
            setMapEnd(false);
        }
    };

    // OUTDOOR MAP: walking route between the From and To buildings' pins.
    const buildPinRoute = async () => {
        const map = mapInstance.current;
        const start = startMarkerRef.current;
        const end = endMarkerRef.current;

        if (!map || !start || !end) return;

        const revision = revisionRef.current;
        setPinRouteLoading(true);
        setPinRouteError("");

        try {
            const { route, distanceMeters } = await fetchWalkingRoute(
                start.getLatLng(),
                end.getLatLng()
            );

            if (mapInstance.current !== map || revision !== revisionRef.current) {
                return;
            }

            drawRoute(map, routeLayerRef, route);
            setPinRouteDistance(distanceMeters);
            setOutdoorDirections(makeOutdoorDirections(route));
            setCompletedOutdoorDirections([]);
        } catch (error) {
            if (revision !== revisionRef.current) return;

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            setPinRouteError(message);
            console.error("Failed to calculate building route:", error);
        } finally {
            setPinRouteLoading(false);
        }
    };

    // INDOOR MAP: selectable LTB rooms, labelled without internal node IDs.
    const rooms = useMemo(() => roomOptions(indoorNodes), [indoorNodes]);
    const roomLabel = (id: string) => rooms.find((room) => room.id === id)?.name ?? id;

    // Shows a freshly calculated indoor route in the sidebar.
    const showIndoorResult = (route: IndoorRouteNode[], data: Record<string, unknown>, trip: IndoorTrip) => {
        setIndoorRoute(route);
        setIndoorSummary(summariseIndoorRoute(data));
        setIndoorTrip(trip);
        setSelectedFloor(route[0]?.floor || "G");
        setActiveStep(null);
        setCompletedDirections([]);
        requestAnimationFrame(() => indoorResultRef.current?.scrollIntoView({
            block: "nearest",
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        }));
    };

    // INDOOR MAP: route from the start pin (outside) to an LTB room.
    const routeToLTB = async () => {
        if (!mapInstance.current || !destination) return;
        if (!startMarkerRef.current) {
            setRouteError("Choose a start building, current location, or map point.");
            return;
        }

        const start = startMarkerRef.current.getLatLng();
        const map = mapInstance.current;
        const startLabel = locationStart ? "your current location" : fromBuilding ? fromBuilding.name : "the selected map point";

        const revision = revisionRef.current;
        setLoading(true);
        setRouteError("");
        setIndoorRoute([]);
        setIndoorSummary(null);

        try {
            const response = await fetch("/api/ltb-route", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    start_lat: start.lat,
                    start_lon: start.lng,
                    end_node: destination,
                    walking_speed: walkingSpeed,
                }),
            });

            const data = await response.json();
            if (mapInstance.current !== map || revision !== revisionRef.current) return;
            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            if (!Array.isArray(data.indoor_path) || data.indoor_path.length === 0) {
                throw new Error("The API did not return an indoor route.");
            }

            routeLayerRef.current?.remove();
            routeLayerRef.current = null;
            setPinRouteDistance(null);
            ltbRouteLayerRef.current?.remove();
            ltbRouteLayerRef.current = null;
            endMarkerRef.current?.setOpacity(0);

            const entrance = typeof data.entrance_label === "string"
                ? placeName({ description: data.entrance_label })
                : placeName(data.indoor_path[0]);

            if (Array.isArray(data.outdoor_path) && data.outdoor_path.length > 0) {
                ltbRouteLayerRef.current = L.polyline(data.outdoor_path, {
                    color: "blue",
                    weight: 5,
                }).addTo(map);
                if (data.outdoor_path.length > 1) {
                    map.fitBounds(ltbRouteLayerRef.current.getBounds(), { padding: [40, 40] });
                }
                setOutdoorDirections(makeOutdoorDirections(data.outdoor_path, `the LTB ${entrance ?? "entrance"}`));
                setCompletedOutdoorDirections([]);
            }

            showIndoorResult(data.indoor_path, data, { from: startLabel, to: roomLabel(destination), entrance });
        } catch (error) {
            if (revision !== revisionRef.current) return;
            setRouteError(error instanceof Error ? error.message : "Could not calculate the LTB route.");
            console.warn("Failed to calculate LTB route:", error);
        } finally {
            setLoading(false);
        }
    };

    // INDOOR MAP: route between two LTB rooms.
    const routeIndoorToIndoor = async () => {
        if (!indoorStartNode || !destination) {
            setRouteError("Select both a starting room and a destination.");
            return;
        }

        if (indoorStartNode === destination) {
            setRouteError("Choose two different rooms.");
            return;
        }

        const revision = revisionRef.current;
        setLoading(true);
        setRouteError("");
        setIndoorRoute([]);
        setIndoorSummary(null);

        try {
            const response = await fetch("/api/indoor-route", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    start_node: indoorStartNode,
                    end_node: destination,
                    walking_speed: walkingSpeed,
                }),
            });

            const data = await response.json();
            if (revision !== revisionRef.current) return;

            if (!response.ok || data.error) {
                throw new Error(
                    data.error || "Could not calculate the indoor route."
                );
            }

            const path = data.indoor_path ?? data.path ?? data.route;

            if (!Array.isArray(path) || path.length === 0) {
                throw new Error("The API did not return an indoor route.");
            }

            const routeNodes: IndoorRouteNode[] = path.map(
                (item: string | IndoorRouteNode) => {
                    if (typeof item === "string") {
                        const node = indoorNodes[item];
                        if (!node) {
                            throw new Error(`Missing indoor node: ${item}`);
                        }
                        return { id: item, ...node };
                    }

                    return { ...item, id: item.id };
                }
            );

            showIndoorResult(routeNodes, data, { from: roomLabel(indoorStartNode), to: roomLabel(destination), entrance: null });
        } catch (error) {
            if (revision !== revisionRef.current) return;
            setRouteError(
                error instanceof Error
                    ? error.message
                    : "Could not calculate the indoor route."
            );
        } finally {
            setLoading(false);
        }
    };

    /**
     * Smooths the visual route with quadratic curves.
     * The actual navigation nodes and routing graph remain unchanged.
     */
    const smoothIndoorRoute = (
        nodes: IndoorRouteNode[],
        cornerCut = 18
    ): string => {
        if (nodes.length < 3) {
            return nodes
                .map((node) => `${node.x_pixel},${node.y_pixel}`)
                .join(" ");
        }

        const points = nodes.map((node) => ({
            x: node.x_pixel,
            y: node.y_pixel,
        }));

        const first = points[0];
        const last = points[points.length - 1];

        let path = `M ${first.x} ${first.y}`;

        for (let i = 1; i < points.length - 1; i++) {
            const previous = points[i - 1];
            const current = points[i];
            const next = points[i + 1];

            const incomingLength = Math.hypot(
                current.x - previous.x,
                current.y - previous.y
            );
            const outgoingLength = Math.hypot(
                next.x - current.x,
                next.y - current.y
            );

            // Avoid unstable corners when nodes are extremely close.
            const cut = Math.min(
                cornerCut,
                incomingLength / 2,
                outgoingLength / 2
            );

            if (incomingLength === 0 || outgoingLength === 0) {
                path += ` L ${current.x} ${current.y}`;
                continue;
            }

            const before = {
                x: current.x + (previous.x - current.x) * cut / incomingLength,
                y: current.y + (previous.y - current.y) * cut / incomingLength,
            };

            const after = {
                x: current.x + (next.x - current.x) * cut / outgoingLength,
                y: current.y + (next.y - current.y) * cut / outgoingLength,
            };

            path += ` L ${before.x} ${before.y}`;
            path += ` Q ${current.x} ${current.y} ${after.x} ${after.y}`;
        }

        path += ` L ${last.x} ${last.y}`;

        return path;
};


    // INDOOR MAP: split the route into same-floor stretches. Floors the route
    // only passes through inside a lift or stairwell get no plan of their own.
    const floorStretches = indoorRoute.reduce<{ floor: string; nodes: IndoorRouteNode[] }[]>((list, node) => {
        const last = list[list.length - 1];
        if (last && last.floor === node.floor) last.nodes.push(node);
        else list.push({ floor: node.floor, nodes: [node] });
        return list;
    }, []);
    const planStretches = floorStretches.filter(
        (stretch, index) => stretch.nodes.length > 1 || index === 0 || index === floorStretches.length - 1
    );
    const planIndex = Math.max(0, planStretches.findIndex((stretch) => stretch.floor === selectedFloor));
    const floorRoute = planStretches[planIndex]?.nodes ?? [];
    const previousPlan = planStretches[planIndex - 1];
    const nextPlan = planStretches[planIndex + 1];
    const routeStart = indoorRoute[0];
    const routeEnd = indoorRoute[indoorRoute.length - 1];
    const indoorSteps = makeIndoorDirections(indoorRoute);
    const routePath = smoothIndoorRoute(floorRoute, 18);
    const routeMinutes = indoorSummary?.totalMeters != null
        ? estimateWalkingMinutes(indoorSummary.totalMeters, walkingSpeed)
        : null;

    const showStep = (floor: string, nodeId: string | null) => {
        setSelectedFloor(floor);
        setActiveStep(nodeId);
    };

    const useLocationStart = (location: CurrentLocation) => {
        const map = mapInstance.current;
        if (!map || pinRouteLoading || loading) return;        invalidateRoutes();
        pickingRef.current = null;
        setPicking(null);
        setMapStart(false);
        const point: L.LatLngTuple = [location.latitude, location.longitude];
        if (startMarkerRef.current) startMarkerRef.current.setLatLng(point);
        else startMarkerRef.current = L.marker(point).addTo(map);
        startMarkerRef.current.bindTooltip("Start: current location snapshot");
        routeLayerRef.current?.remove();
        routeLayerRef.current = null;
        ltbRouteLayerRef.current?.remove();
        ltbRouteLayerRef.current = null;
        setFromBuilding(null);
        setLocationStart(true);
        setFromLocationKey((key) => key + 1);
        setStartSelected(true);
        panToPoint(map, point);
    };

    // A class route takes one browser location snapshot; coordinates stay in memory.
    useEffect(() => {
        const map = mapInstance.current;
        if (!trackDestination || !map) return;
        let active = true;
        const controller = new AbortController();
        const onVisibility = () => {
            if (!document.hidden) return;
            active = false;
            controller.abort();
            setPinRouteLoading(false);
            setClassLocationMessage("Location request stopped while the page was hidden. Retry when ready.");
        };
        document.addEventListener("visibilitychange", onVisibility);
        // Wait for Leaflet's mounted container to paint before fitting a class route.
        const frame = requestAnimationFrame(() => {
            if (!active) return;
            invalidateRoutes();
            setRouteType("building");
            setToBuilding(trackDestination);
            const entrance = trackDestination.id === "ltb"
                ? ltbEntrances.entrances.find(entry => entry.id === ltbEntrances.building_search_entrance)
                : null;
            const point: L.LatLngTuple = entrance
                ? [entrance.latitude, entrance.longitude]
                : [trackDestination.latitude, trackDestination.longitude];
            if (endMarkerRef.current) endMarkerRef.current.setLatLng(point);
            else endMarkerRef.current = L.marker(point).addTo(map);
            endMarkerRef.current.bindTooltip(trackDestination.name);
            panToPoint(map, point);
            const revision = revisionRef.current;
            const fail = (message: string) => {
                if (!active) return;
                setClassLocationMessage(message);
                setPinRouteLoading(false);
            };
            if (!window.isSecureContext || !navigator.geolocation) {
                fail("Location requires HTTPS or localhost and a supported browser. Choose your start on the map.");
                return;
            }
            setClassLocationMessage("Waiting for location permission and a current position…");
            setPinRouteLoading(true);
            navigator.geolocation.getCurrentPosition(async position => {
                if (!active) return;
                if (revision !== revisionRef.current) {
                    setPinRouteLoading(false);
                    return;
                }
                const location: CurrentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp };                if (!isFreshLocation(location)) return fail("A recent location is unavailable. Retry or choose a start on the map.");
                if (!isCampusLocation(location)) return fail("Your location is outside the campus map. Choose a start on the map.");
                const start: L.LatLngTuple = [location.latitude, location.longitude];
                if (startMarkerRef.current) startMarkerRef.current.setLatLng(start);
                else startMarkerRef.current = L.marker(start).addTo(map);
                startMarkerRef.current.bindTooltip("Start: current location snapshot");
                setFromBuilding(null);
                setLocationStart(true);
                setStartSelected(true);
                setMapStart(false);
                setFromLocationKey(key => key + 1);
                setClassLocationMessage(`Using one location reading (accuracy approximately ${Math.round(location.accuracy)} m). Route to ${trackDestination.name}.`);
                try {
                    const { route, distanceMeters } = await fetchWalkingRoute(L.latLng(start), L.latLng(point), controller.signal);
                    if (!active || revision !== revisionRef.current) return;
                    drawRoute(map, routeLayerRef, route);
                    setPinRouteDistance(distanceMeters);
                    setOutdoorDirections(makeOutdoorDirections(route, trackDestination.name));
                } catch (error) {
                    if (active && revision === revisionRef.current) setPinRouteError(error instanceof Error ? error.message : "Could not calculate the class route.");
                } finally {
                    if (active) setPinRouteLoading(false);
                }
            }, error => fail(error.code === 1
                ? "Location permission was denied. Allow access and retry, or choose a start on the map."
                : "Location is unavailable or timed out. Retry or choose a start on the map."),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
        });
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            controller.abort();
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [trackDestination, classLocationAttempt, invalidateRoutes]);

    // One "Plan route" button serves all three journeys.
    const insideStart = routeType === "room" && ltbStart === "inside";
    const canPlan = routeType === "building"
        ? startSelected && (!!toBuilding || mapEnd)
        : insideStart
            ? !!indoorStartNode && !!destination && indoorStartNode !== destination
            : startSelected && !!destination;
    const planRoute = routeType === "building" ? buildPinRoute : insideStart ? routeIndoorToIndoor : routeToLTB;
    const planHint = insideStart
        ? (indoorStartNode && indoorStartNode === destination
            ? "Choose two different rooms."
            : "Choose the room you are in and the room you want to reach.")
        : locationStart
            ? "Your start is a location snapshot; moving will not change it."
            : fromBuilding
                ? `Starting at ${fromBuilding.name}.`
                : mapStart
                    ? "Starting at your selected map point."
                    : "Choose a start and destination to plan your journey.";

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Keep the campus map mounted so its route remains available on return. */}
            <div
                ref={mapContainer}
                className={`absolute inset-0`}
                style={{ display: view === "outdoor" ? "block" : "none" }}
            />

            <aside hidden={view !== "outdoor" || searchPanelCollapsed} className="absolute left-0 top-0 z-[1000] flex max-h-[65%] w-[min(360px,100%)] lg:h-full lg:max-h-none flex-col border-r border-slate-200 bg-white shadow-lg" aria-label="Campus map controls">
                <header className="shrink-0 border-b border-slate-200 px-5 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Clayton campus</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">Explore campus</h2>
                    <button
                        type="button"
                        onClick={() => setSearchPanelCollapsed(true)}
                        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        Minimise search panel
                    </button>
                    <div className="mt-4 grid grid-cols-2 gap-1" aria-label="Map tasks">
                        {([ ["route", "Plan a route"], ["crowd", "Crowd estimates"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={panel === value} onClick={() => { setPanel(value); pickingRef.current = null; setPicking(null); }} className={`border-b-2 px-2 py-3 text-sm font-semibold ${panel === value ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}
                    </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {trackDestination && <div className="mb-4 space-y-2 rounded-lg bg-blue-50 p-3">
                        <p role="status" className="text-sm text-blue-900">{classLocationMessage}</p>
                        <button type="button" disabled={pinRouteLoading} onClick={() => setClassLocationAttempt(attempt => attempt + 1)} className="text-sm font-semibold underline disabled:opacity-50">Retry current location</button>
                    </div>}
                    <div hidden={panel !== "route"}>
                        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" aria-label="Destination type">
                            {([ ["building", "Campus building"], ["room", "LTB room"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={routeType === value} onClick={() => {
                                if (value === routeType) return;
                                invalidateRoutes(); setRouteType(value); pickingRef.current = null; setPicking(null);
                            }} className={`rounded-md px-2 py-2 text-sm font-medium ${routeType === value ? "bg-white text-blue-800 shadow-sm" : "text-slate-600"}`}>{label}</button>)}
                        </div>
                        <div className="space-y-4">
                            {routeType === "room" && (
                                <fieldset>
                                    <legend className="text-sm font-medium text-slate-800">Starting from</legend>
                                    <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1">
                                        {([ ["outside", "Outside the LTB"], ["inside", "Inside the LTB"] ] as const).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                aria-pressed={ltbStart === value}
                                                onClick={() => {
                                                    if (value === ltbStart) return;
                                                    invalidateRoutes(); setLtbStart(value); pickingRef.current = null; setPicking(null);
                                                }}
                                                className={`rounded-md px-2 py-1.5 text-sm font-medium ${ltbStart === value ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                            <div hidden={routeType === "room" && ltbStart === "inside"}>
                                <BuildingSearch key={`from-${fromLocationKey}`} label="Start" placeholder="Search a departure building" buildings={buildings} selectedLabel={locationStart ? "Current location (snapshot)" : mapStart ? "Selected map point" : undefined} onSelect={building => chooseBuilding("from", building)} onClear={() => clearBuilding("from")} />
                                <button type="button" onClick={() => beginPicking("from")} className="mt-2 text-xs font-medium text-blue-800 underline">Choose start on map</button>
                                <details className="mt-3 rounded-lg border border-slate-200 px-3 py-2"><summary className="cursor-pointer text-sm font-medium text-slate-700">Use my current location</summary>
                                    <LocationControls mapRef={mapInstance} onUse={useLocationStart} busy={pinRouteLoading || loading} />
                                </details>
                            </div>
                            <div hidden={routeType !== "room" || ltbStart !== "inside"}>
                                <BuildingSearch
                                    noun="room"
                                    label="Start room"
                                    placeholder="Search a room, e.g. G01 or toilets"
                                    buildings={rooms}
                                    onSelect={room => { invalidateRoutes(); setIndoorStartNode(room.id); }}
                                    onClear={() => { invalidateRoutes(); setIndoorStartNode(""); }}
                                />
                            </div>
                            <div hidden={routeType !== "building"}>
                                <BuildingSearch key={`to-${buildingInputsKey}`} label="Destination" placeholder="Search a destination building" buildings={buildings} selectedLabel={mapEnd ? "Selected map point" : toBuilding?.name} onSelect={building => chooseBuilding("to", building)} onClear={() => clearBuilding("to")} />
                                <button type="button" onClick={() => beginPicking("to")} className="mt-2 text-xs font-medium text-blue-800 underline">Choose destination on map</button>
                            </div>
                            <div hidden={routeType !== "room"}>
                                <BuildingSearch
                                    noun="room"
                                    label="Destination room"
                                    placeholder="Search a room, e.g. 101 or study area"
                                    buildings={rooms}
                                    onSelect={room => { invalidateRoutes(); setDestination(room.id); }}
                                    onClear={() => { invalidateRoutes(); setDestination(""); }}
                                />
                                {nodesError && <p className="mt-2 text-sm text-red-700" role="alert">{nodesError}</p>}
                            </div>
                            {buildingsError && <p className="text-sm text-red-700" role="alert">{buildingsError}</p>}
                            <button type="button" onClick={planRoute} disabled={pinRouteLoading || loading || !canPlan} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{pinRouteLoading || loading ? "Finding route…" : "Plan route"}</button>
                            <p className="text-xs text-slate-500">{planHint}</p>
                            {(pinRouteError || routeError) && <p role="alert" className="text-sm text-red-700">{pinRouteError || routeError}</p>}
                        {/* Kept mounted so screen readers announce each new estimate. */}
                        <div aria-live="polite">
                            {pinRouteDistance !== null && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                    <p className="text-sm font-medium text-blue-900">Estimated walking time</p>
                                    <p className="text-3xl font-bold text-blue-950">
                                        {formatWalkingTime(pinRouteDistance === 0 ? 0 : estimateWalkingMinutes(pinRouteDistance, walkingSpeed))}
                                    </p>
                                    <p className="text-sm text-blue-900">{formatDistance(pinRouteDistance)} walk</p>
                                    {walkingSpeed === "accessible" && <p className="mt-2 text-xs text-blue-900">Step-free route candidate. May use campus service links. Surfaces, slopes, kerbs and the short connections to the walking network are not verified.</p>}
                                    {pinRouteDistance === 0 && <p className="text-sm text-blue-900">You are already at the destination.</p>}
                                    <PaceNote walkingSpeed={walkingSpeed} personalised={personalised} />
                                </div>
                            )}
                            {indoorRoute.length > 0 && indoorTrip && (
                                <section ref={indoorResultRef} className="rounded-lg border border-blue-200 bg-blue-50 p-3" aria-label="LTB route summary">
                                    <p className="text-sm font-medium text-blue-900">Estimated walking time to {indoorTrip.to}</p>
                                    <p className="text-3xl font-bold text-blue-950">
                                        {routeMinutes !== null ? formatWalkingTime(routeMinutes) : "Time unavailable"}
                                    </p>
                                    <p className="text-sm text-blue-900">
                                        {indoorSummary?.totalMeters != null ? `About ${formatDistance(indoorSummary.totalMeters)} walk` : "Distance unavailable"}
                                        {describeFloorChanges(indoorSummary) && ` · ${describeFloorChanges(indoorSummary)}`}
                                    </p>
                                    {walkingSpeed === "accessible" && (
                                        <p className="mt-1 text-sm font-medium text-blue-900">Step-free route: lifts only, no stairs.</p>
                                    )}
                                    <PaceNote walkingSpeed={walkingSpeed} personalised={personalised} />
                                    <button
                                        type="button"
                                        onClick={() => setView("indoor")}
                                        className="mt-3 w-full rounded-md bg-orange-700 px-4 py-2.5 font-semibold text-white hover:bg-orange-800"
                                    >
                                        View indoor route
                                    </button>
                                    {indoorTrip.entrance && (
                                        <p className="mt-2 text-xs text-blue-900">
                                            Enters the LTB at the {indoorTrip.entrance}. Entrance positions are approximate.
                                        </p>
                                    )}
                                </section>
                            )}
                        </div>
                        {outdoorDirections.length > 0 && (
                            <section className="mt-5 border-t border-slate-200 pt-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-semibold text-slate-900">
                                        {routeType === "room" ? "Walking directions to the LTB" : "Walking directions"}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setCompletedOutdoorDirections([])}
                                        className="text-xs font-medium text-blue-700 underline"
                                    >
                                        Reset
                                    </button>
                                </div>

                                <ol className="mt-3 space-y-2">
                                    {outdoorDirections.map((step, index) => (
                                        <li key={`${index}-${step.text}`}>
                                            <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-slate-50">
                                                <input
                                                    type="checkbox"
                                                    checked={completedOutdoorDirections.includes(index)}
                                                    onChange={event =>
                                                        setCompletedOutdoorDirections(previous =>
                                                            event.target.checked
                                                                ? [...previous, index]
                                                                : previous.filter(item => item !== index)
                                                        )
                                                    }
                                                    className="mt-1"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-medium text-slate-900">
                                                        {index + 1}. {step.text}
                                                    </span>
                                                    {step.distanceMeters > 0 && (
                                                        <span className="text-xs text-slate-500">
                                                            Approximately {Math.round(step.distanceMeters)} m
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ol>

                                <p className="mt-2 text-xs text-slate-500">
                                    Directions are inferred from the mapped path. Follow campus signs
                                    and accessible paths where available.
                                </p>
                            </section>
                        )}
                        </div>
                    </div>
                    <div hidden={panel !== "crowd"}><CrowdControls mapRef={mapInstance} canView={canViewCrowd} onSourceChange={setCrowdSource} /></div>
                    <details className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500"><summary className="cursor-pointer">Map tools</summary>
                        <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={graphVisible} onChange={event => setGraphVisible(event.target.checked)} />Show navigation network (debug)</label>
                    </details>
                </div>
            </aside>
            {view === "outdoor" && searchPanelCollapsed && (
                <button
                    type="button"
                    onClick={() => setSearchPanelCollapsed(false)}
                    className="absolute left-4 top-4 z-[1100] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg hover:bg-slate-100"
                >
                    Show search
                </button>
            )}

            {view === "outdoor" && <div className="pointer-events-none absolute left-4 right-16 top-[67%] lg:left-[380px] lg:top-4 z-[1000] flex flex-col items-end gap-2" aria-live="polite">
                {picking && <div className="pointer-events-auto rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm text-blue-900 shadow-lg">Click the map to choose your {picking === "from" ? "start" : "destination"}. <button type="button" onClick={() => { pickingRef.current = null; setPicking(null); }} className="ml-3 font-semibold underline">Cancel</button></div>}
                {crowdSource && <p className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${crowdSource === "demo" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>{crowdSource === "demo" ? "SIMULATED DATA · fictional students" : "TIMETABLE ESTIMATES · not live counts"}</p>}
            </div>}

            {view === "indoor" && indoorRoute.length > 0 && indoorTrip && (
                <section
                    className="absolute inset-0 z-[1200] flex flex-col overflow-hidden bg-slate-50 lg:flex-row"
                    aria-label="LTB indoor route"
                >
                    {/* LEFT SIDEBAR */}
                    <aside className="flex max-h-[50%] w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-white lg:h-full lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
                        <header className="shrink-0 border-b border-slate-200 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                LTB indoor route
                            </p>
                            <h2 className="mt-1 text-xl font-semibold text-slate-900">
                                To {indoorTrip.to}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                From {indoorTrip.from}
                                {indoorTrip.entrance && <> · enter at the {indoorTrip.entrance}</>}
                            </p>
                            <button
                                type="button"
                                onClick={() => setView("outdoor")}
                                className="mt-3 rounded-md border border-blue-700 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                            >
                                ← Back to campus map
                            </button>
                        </header>

                        {/* SUMMARY */}
                        <div className="shrink-0 border-b border-slate-200 p-4" aria-live="polite">
                            <p className="text-2xl font-bold text-slate-900">
                                {routeMinutes !== null ? formatWalkingTime(routeMinutes) : "Time unavailable"}
                                {indoorSummary?.totalMeters != null && (
                                    <span className="ml-2 text-base font-medium text-slate-600">about {formatDistance(indoorSummary.totalMeters)}</span>
                                )}
                            </p>
                            {describeFloorChanges(indoorSummary) && (
                                <p className="mt-1 text-sm text-slate-700">{describeFloorChanges(indoorSummary)}</p>
                            )}
                            {walkingSpeed === "accessible" && (
                                <p className="mt-1 text-sm font-medium text-blue-800">Step-free route: lifts only, no stairs.</p>
                            )}
                            {indoorSummary && (
                                <details className="mt-2 text-sm text-slate-700">
                                    <summary className="cursor-pointer font-medium">Distance details</summary>
                                    <dl className="mt-2 space-y-1">
                                        {indoorSummary.outdoorMeters !== null && (
                                            <div className="flex justify-between gap-3"><dt>Walk to the LTB</dt><dd>{formatDistance(indoorSummary.outdoorMeters)}</dd></div>
                                        )}
                                        <div className="flex justify-between gap-3"><dt>Inside the LTB</dt><dd>{formatDistance(indoorSummary.indoorMeters)}</dd></div>
                                        {indoorSummary.verticalMeters !== null && (indoorSummary.liftSegments + indoorSummary.stairSegments) > 0 && (
                                            <div className="flex justify-between gap-3"><dt>Stairs and lifts (estimate)</dt><dd>{formatDistance(indoorSummary.verticalMeters)}</dd></div>
                                        )}
                                    </dl>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Estimated from the floor plans{indoorTrip.entrance ? "; entrance positions are approximate" : ""}.
                                    </p>
                                </details>
                            )}
                        </div>

                        {/* FLOORS */}
                        {planStretches.length > 1 && (
                            <nav className="shrink-0 border-b border-slate-200 p-3" aria-label="Floors on this route">
                                <p className="mb-2 text-sm font-medium text-slate-700">Floors on this route</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {planStretches.map((stretch, index) => (
                                        <button
                                            key={`${stretch.floor}-${index}`}
                                            type="button"
                                            onClick={() => showStep(stretch.floor, null)}
                                            aria-current={index === planIndex ? "step" : undefined}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                                index === planIndex
                                                    ? "bg-blue-700 text-white"
                                                    : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                                            }`}
                                        >
                                            {index + 1}. {floorLabel(stretch.floor)}
                                        </button>
                                    ))}
                                </div>
                            </nav>
                        )}

                        {/* WALKING DIRECTIONS, grouped by floor */}
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 p-3">
                                <h3 className="font-semibold text-slate-900">
                                    Walking directions
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setCompletedDirections([])}
                                    className="text-xs font-medium text-blue-700 underline"
                                >
                                    Reset
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                {planStretches.map((stretch, stretchIndex) => {
                                    const steps = indoorSteps
                                        .map((step, index) => ({ step, index }))
                                        .filter(({ step }) => step.floor === stretch.floor);
                                    if (steps.length === 0) return null;
                                    const current = stretchIndex === planIndex;
                                    return (
                                        <section key={`${stretch.floor}-${stretchIndex}`} className="mb-2">
                                            <h4 className={`px-2 py-1 text-xs font-semibold uppercase tracking-wide ${current ? "text-blue-700" : "text-slate-500"}`}>
                                                {floorLabel(stretch.floor)}
                                            </h4>
                                            <ol className="space-y-1">
                                                {steps.map(({ step, index }) => (
                                                    <li key={`${step.nodeId}-${index}`} className={`flex items-start gap-3 rounded-md p-2 ${activeStep === step.nodeId ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Mark step ${index + 1} as done`}
                                                            checked={completedDirections.includes(index)}
                                                            onChange={(event) => {
                                                                setCompletedDirections((previous) =>
                                                                    event.target.checked
                                                                        ? [...previous, index]
                                                                        : previous.filter((item) => item !== index)
                                                                );
                                                            }}
                                                            className="mt-1"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => showStep(step.floor, step.nodeId)}
                                                            className={`min-w-0 flex-1 text-left text-sm font-medium ${completedDirections.includes(index) ? "text-slate-400 line-through" : "text-slate-900"}`}
                                                        >
                                                            {index + 1}. {step.text}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ol>
                                        </section>
                                    );
                                })}
                            </div>
                            <p className="shrink-0 border-t border-slate-200 p-3 text-xs text-slate-500">
                                Select a step to show it on the floor plan.
                            </p>
                        </div>
                    </aside>

                    {/* RIGHT SIDE: FLOOR PLAN */}
                    <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-200 p-3">
                        <div className="mx-auto mb-2 flex max-w-full items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{floorLabel(planStretches[planIndex]?.floor ?? selectedFloor)}</p>
                            {nextPlan && (
                                <button
                                    type="button"
                                    onClick={() => showStep(nextPlan.floor, null)}
                                    className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                                >
                                    Next: {floorLabel(nextPlan.floor)} →
                                </button>
                            )}
                        </div>
                        <svg
                            viewBox="0 0 1722 1188"
                            role="img"
                            aria-label={`LTB ${floorLabel(selectedFloor)} plan with the route`}
                            className="mx-auto block h-auto w-full bg-white shadow-md"
                        >
                            <image
                                href={floorPlans[planStretches[planIndex]?.floor ?? selectedFloor]}
                                x="0"
                                y="0"
                                width="1722"
                                height="1188"
                            />
                            {/* The plan images include buttons from a print dialog in this corner. */}
                            <rect x="0" y="0" width="178" height="84" fill="white" />

                            {floorRoute.length > 1 && (
                                <path
                                    d={routePath}
                                    fill="none"
                                    stroke="#1d4ed8"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}

                            {floorRoute.length > 0 && (() => {
                                const first = floorRoute[0];
                                const last = floorRoute[floorRoute.length - 1];
                                const markers: { node: IndoorRouteNode; label: string; color: string; onSelect?: () => void }[] = [];
                                if (first.id === routeStart?.id) markers.push({ node: first, label: "Start", color: "#15803d" });
                                else if (previousPlan) markers.push({ node: first, label: `Arrive from ${floorLabel(previousPlan.floor)}`, color: "#c2410c" });
                                if (last.id === routeEnd?.id) markers.push({ node: last, label: indoorTrip.to.split(" · ")[0], color: "#b91c1c" });
                                else if (nextPlan) markers.push({
                                    node: last,
                                    label: `${placeName(last) ?? (last.type === "lift" ? "Lift" : "Stairs")} to ${floorLabel(nextPlan.floor)}`,
                                    color: "#c2410c",
                                    onSelect: () => showStep(nextPlan.floor, null),
                                });
                                const active = floorRoute.find((node) => node.id === activeStep);
                                return (
                                    <>
                                        {active && (
                                            <circle cx={active.x_pixel} cy={active.y_pixel} r="26" fill="none" stroke="#1d4ed8" strokeWidth="6" />
                                        )}
                                        {markers.map(({ node, label, color, onSelect }) => {
                                            const right = node.x_pixel > 1400;
                                            return (
                                                <g
                                                    key={`${node.id}-${label}`}
                                                    onClick={onSelect}
                                                    className={onSelect ? "cursor-pointer" : undefined}
                                                >
                                                    <circle cx={node.x_pixel} cy={node.y_pixel} r="16" fill={color} stroke="white" strokeWidth="5" />
                                                    <text
                                                        x={node.x_pixel + (right ? -26 : 26)}
                                                        y={node.y_pixel - 22}
                                                        textAnchor={right ? "end" : "start"}
                                                        fontSize="34"
                                                        fontWeight="700"
                                                        fill={color}
                                                        stroke="white"
                                                        strokeWidth="9"
                                                        paintOrder="stroke"
                                                    >
                                                        {label}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </svg>
                    </main>
                </section>
            )}

        </div>
    );
}
