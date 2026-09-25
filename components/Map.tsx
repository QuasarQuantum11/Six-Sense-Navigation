"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Indoor navigation data returned by the LTB backend.
type IndoorNode = {
    floor: string;
    type: string;
    description: string;
    x_pixel: number;
    y_pixel: number;
};

type IndoorRouteNode = IndoorNode & {
    id: string;
};

type IndoorDistance = {
    outdoor_distance_m: number;
    indoor_horizontal_distance_m: number;
    estimated_vertical_distance_m: number | null;
    indoor_estimated_distance_m: number | null;
    indoor_estimate_min_m: number | null;
    indoor_estimate_max_m: number | null;
    map_straight_line_m: number | null;
    vertical_segments: number;
    lift_segments: number;
    stair_segments: number;
    distance_complete: boolean;
    total_known_distance_m: number;
    total_estimated_distance_m: number | null;
    total_estimate_min_m: number | null;
    total_estimate_max_m: number | null;
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

export default function Map() {
    // Shared Leaflet map references used by outdoor and indoor workflows.
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const startMarkerRef = useRef<L.Marker | null>(null);
    const endMarkerRef = useRef<L.Marker | null>(null);
    const routeLayerRef = useRef<L.Polyline | null>(null);
    const ltbRouteLayerRef = useRef<L.Polyline | null>(null);
    const destinationRef = useRef("");

    // Indoor navigation state: room list, selected destination, and floor route.
    const [indoorNodes, setIndoorNodes] = useState<Record<string, IndoorNode>>({});
    const [destination, setDestination] = useState("");
    const [indoorRoute, setIndoorRoute] = useState<IndoorRouteNode[]>([]);
    const [indoorDistance, setIndoorDistance] = useState<IndoorDistance | null>(null);
    const [selectedFloor, setSelectedFloor] = useState("G");
    const [startSelected, setStartSelected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"outdoor" | "indoor">("outdoor");
    const [entranceNode, setEntranceNode] = useState("");
    const [routeError, setRouteError] = useState("");
    const [nodesError, setNodesError] = useState("");

    useEffect(() => {
        if (!mapContainer.current) return;

        if (!mapInstance.current) {
            // OUTDOOR MAP: initialise the Leaflet map and OpenStreetMap tiles.
            const map = L.map(mapContainer.current).setView(
                [-37.9083, 145.1380],
                16
            );

            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 20,
            }).addTo(map);

            mapInstance.current = map;

        const graphLayer = L.layerGroup().addTo(map);
            fetch("/api/graph")
                .then((response) => response.json())
                .then((data) => {
                    if (data.edges) {
                        data.edges.forEach(
                            (edge: [[number, number], [number, number]]) => {
                                L.polyline(edge, {
                                    color: "red",
                                    weight: 2,
                                    opacity: 0.6,
                                }).addTo(graphLayer);
                            }
                        );
                    }
                })
                .catch((error) => {
                    console.error(
                        "Failed to load navigation graph:",
                        error
                    );
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

            // OUTDOOR MAP: select points and calculate an outdoor route.
            map.on("click", async (e) => {
                setRouteError("");
                if (destinationRef.current) {
                    // With an LTB room selected, every click moves the outdoor
                    // starting point instead of creating a second destination.
                    if (startMarkerRef.current) {
                        startMarkerRef.current.setLatLng(e.latlng);
                    } else {
                        startMarkerRef.current = L.marker(e.latlng).addTo(map);
                    }
                    if (endMarkerRef.current) {
                        map.removeLayer(endMarkerRef.current);
                        endMarkerRef.current = null;
                    }
                    if (routeLayerRef.current) {
                        map.removeLayer(routeLayerRef.current);
                        routeLayerRef.current = null;
                    }
                    if (ltbRouteLayerRef.current) {
                        map.removeLayer(ltbRouteLayerRef.current);
                        ltbRouteLayerRef.current = null;
                    }
                    setStartSelected(true);
                    setIndoorRoute([]);
                    setIndoorDistance(null);
                    setEntranceNode("");
                    return;
                }

                if (startMarkerRef.current && endMarkerRef.current) {
                    map.removeLayer(startMarkerRef.current);
                    map.removeLayer(endMarkerRef.current);
                    startMarkerRef.current = null;
                    endMarkerRef.current = null;
                    if (routeLayerRef.current) {
                        map.removeLayer(routeLayerRef.current);
                        routeLayerRef.current = null;
                    }
                }

                if (!startMarkerRef.current) {
                    startMarkerRef.current = L.marker(e.latlng).addTo(map);
                    setStartSelected(true);
                    return;
                }

                endMarkerRef.current = L.marker(e.latlng).addTo(map);

                try {
                    const response = await fetch(
                        `/api/route?start_lat=${startMarkerRef.current.getLatLng().lat}&start_lon=${startMarkerRef.current.getLatLng().lng}&end_lat=${endMarkerRef.current.getLatLng().lat}&end_lon=${endMarkerRef.current.getLatLng().lng}`
                    );
                    const data = await response.json();

                    if (data.route) {
                        routeLayerRef.current = L.polyline(data.route, {
                            color: "blue",
                            weight: 5,
                        }).addTo(map);
                        map.fitBounds(routeLayerRef.current.getBounds());
                    }
                } catch (error) {
                    setRouteError("Could not calculate the outdoor route.");
                    console.warn("Failed to calculate outdoor route:", error);
                }
            });
        }
    }, []);

    useEffect(() => {
        if (view === "outdoor") {
            // Leaflet needs a size refresh after its container becomes visible.
            requestAnimationFrame(() => mapInstance.current?.invalidateSize());
        }
    }, [view]);

    // INDOOR MAP: prepare selectable LTB rooms and floors in the route.
    const roomNodes = Object.entries(indoorNodes)
        .filter(
            ([, node]) =>
                node.type === "room" && node.description
        )
        .sort(([a], [b]) => a.localeCompare(b));

    const floorsInRoute = Array.from(
        new Set(indoorRoute.map((node) => node.floor))
    );

    // INDOOR MAP: calculate the outdoor-to-LTB route for the selected room.
    const routeToLTB = async () => {
        if (!mapInstance.current || !destination) return;
        if (!startMarkerRef.current) {
            setRouteError("Click the outdoor map once to choose your starting point.");
            return;
        }

        const start = startMarkerRef.current.getLatLng();

        setLoading(true);
        setRouteError("");
        setIndoorRoute([]);
        setIndoorDistance(null);

        try {
            const response = await fetch(
                `${API_URL}/api/ltb-route?start_lat=${start.lat}&start_lon=${start.lng}&end_node=${destination}`
            );
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            if (!Array.isArray(data.indoor_path) || data.indoor_path.length === 0) {
                throw new Error("The API did not return an indoor route.");
            }

            if (routeLayerRef.current) {
                mapInstance.current.removeLayer(routeLayerRef.current);
                routeLayerRef.current = null;
            }
            if (ltbRouteLayerRef.current) {
                mapInstance.current.removeLayer(ltbRouteLayerRef.current);
                ltbRouteLayerRef.current = null;
            }
            if (endMarkerRef.current) {
                mapInstance.current.removeLayer(endMarkerRef.current);
                endMarkerRef.current = null;
            }

            if (Array.isArray(data.outdoor_path) && data.outdoor_path.length > 0) {
                ltbRouteLayerRef.current = L.polyline(data.outdoor_path, {
                    color: "blue",
                    weight: 5,
                }).addTo(mapInstance.current);
                if (data.outdoor_path.length > 1) {
                    mapInstance.current.fitBounds(ltbRouteLayerRef.current.getBounds());
                }
            }

            setIndoorRoute(data.indoor_path);
            setSelectedFloor(data.indoor_path[0]?.floor || "G");
            setEntranceNode(data.entrance_node || "");
            if (
                typeof data.outdoor_distance_m === "number" &&
                typeof data.indoor_horizontal_distance_m === "number" &&
                typeof data.total_known_distance_m === "number" &&
                (data.total_estimated_distance_m === null || typeof data.total_estimated_distance_m === "number")
            ) {
                setIndoorDistance(data);
            }
        } catch (error) {
            setRouteError(error instanceof Error ? error.message : "Could not calculate the LTB route.");
            console.warn("Failed to calculate LTB route:", error);
        } finally {
            setLoading(false);
        }
    };

    // INDOOR MAP: keep only the route points for the selected floor plan.
    const floorRoute = indoorRoute.filter(
        (node) => node.floor === selectedFloor
    );

    const routePoints = floorRoute
        .map((node) => `${node.x_pixel},${node.y_pixel}`)
        .join(" ");
    const totalRouteDistance = indoorDistance?.total_estimated_distance_m ??
        (indoorDistance?.vertical_segments === 0 ? indoorDistance.total_known_distance_m : null);

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Keep the campus map mounted so its route remains available on return. */}
            <div
                ref={mapContainer}
                className="h-full w-full"
                style={{ display: view === "outdoor" ? "block" : "none" }}
            />

            {view === "outdoor" && (
                <section className="absolute left-4 top-4 z-[1000] max-h-[calc(100%-2rem)] w-[min(22rem,calc(100%-2rem))] overflow-auto rounded-xl bg-white p-5 shadow-xl" aria-label="LTB route controls">
                    <h2 className="text-xl font-semibold text-slate-900">Route to LTB</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Choose a room, click the campus map once for your starting point, then calculate the route.
                        With a room selected, another map click moves the starting point.
                    </p>

                    <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="ltb-destination">LTB room</label>
                    <select
                        id="ltb-destination"
                        value={destination}
                        onChange={(event) => {
                            const nextDestination = event.target.value;
                            destinationRef.current = nextDestination;
                            setDestination(nextDestination);
                            setIndoorRoute([]);
                            setIndoorDistance(null);
                            setEntranceNode("");
                            setRouteError("");
                            if (ltbRouteLayerRef.current && mapInstance.current) {
                                mapInstance.current.removeLayer(ltbRouteLayerRef.current);
                                ltbRouteLayerRef.current = null;
                            }
                        }}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
                    >
                        <option value="">Select LTB destination</option>
                        {roomNodes.map(([id, node]) => (
                            <option key={id} value={id}>
                                Floor {node.floor} — {node.description} ({id})
                            </option>
                        ))}
                    </select>

                    {nodesError && <p className="mt-3 text-sm text-red-700" role="alert">{nodesError}</p>}
                    {routeError && <p className="mt-3 text-sm text-red-700" role="alert">{routeError}</p>}
                    {startSelected && <p className="mt-3 text-sm text-slate-600">Starting point selected on campus map.</p>}

                    <button
                        type="button"
                        onClick={routeToLTB}
                        disabled={!destination || !startSelected || loading}
                        className="mt-4 w-full rounded-md bg-blue-700 px-4 py-2.5 font-medium text-white enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Finding route..." : "Calculate route to LTB"}
                    </button>

                    {indoorRoute.length > 0 && (
                        <div className="mt-5 border-t border-slate-200 pt-4" aria-live="polite">
                            <h3 className="font-semibold text-slate-900">Route calculated</h3>
                            {entranceNode && <p className="mt-1 text-sm text-slate-600">Outdoor route to LTB entrance {entranceNode}.</p>}
                            {indoorDistance && (
                                <>
                                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                        <p className="text-sm font-medium text-blue-900">
                                            {indoorDistance.vertical_segments > 0 ? "Estimated route distance" : "Map-based route distance"}
                                        </p>
                                        <p className="text-3xl font-bold text-blue-950">
                                            {totalRouteDistance !== null ? `${totalRouteDistance.toFixed(1)} m` : "Distance unavailable"}
                                        </p>
                                        {indoorDistance.vertical_segments > 0 &&
                                            indoorDistance.total_estimate_min_m !== null &&
                                            indoorDistance.total_estimate_max_m !== null && (
                                            <p className="text-xs text-blue-900">
                                                Stair/lift assumption range: {indoorDistance.total_estimate_min_m.toFixed(1)}–{indoorDistance.total_estimate_max_m.toFixed(1)} m
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setView("indoor")}
                                        className="mt-3 w-full rounded-md bg-orange-700 px-4 py-2.5 font-semibold text-white hover:bg-orange-800"
                                    >
                                        Enter LTB — view indoor route
                                    </button>
                                    <dl className="mt-3 space-y-1 text-sm text-slate-700">
                                        <div className="flex justify-between gap-3"><dt>Outdoor to entrance</dt><dd>{indoorDistance.outdoor_distance_m.toFixed(1)} m</dd></div>
                                        <div className="flex justify-between gap-3"><dt>Indoor floor-plan path</dt><dd>{indoorDistance.indoor_horizontal_distance_m.toFixed(1)} m</dd></div>
                                        {indoorDistance.vertical_segments > 0 && (
                                            <div className="flex justify-between gap-3"><dt>Stairs/lift estimate</dt><dd>{indoorDistance.estimated_vertical_distance_m !== null ? `${indoorDistance.estimated_vertical_distance_m.toFixed(1)} m` : "Unavailable"}</dd></div>
                                        )}
                                    </dl>
                                    <p className="mt-2 text-xs text-slate-600">Based on the mapped route, not a field measurement.</p>
                                </>
                            )}
                            {!indoorDistance && (
                                <>
                                    <p className="mt-2 text-sm text-slate-600">Distance details are unavailable from the API.</p>
                                    <button type="button" onClick={() => setView("indoor")} className="mt-3 w-full rounded-md bg-orange-700 px-4 py-2.5 font-semibold text-white hover:bg-orange-800">
                                        Enter LTB — view indoor route
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </section>
            )}

            {view === "indoor" && indoorRoute.length > 0 && (
                <section className="absolute inset-0 z-[1200] flex flex-col bg-slate-50" aria-label="LTB indoor route">
                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">LTB indoor navigation</p>
                            <h2 className="text-xl font-semibold text-slate-900">Floor {selectedFloor} → {indoorNodes[destination]?.description || destination}</h2>
                            <p className="text-sm text-slate-600">Blue line follows the route on the selected floor plan.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setView("outdoor")}
                            className="rounded-md border border-blue-700 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                            ← Back to outdoor map
                        </button>
                    </header>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-200 bg-white px-4 py-3 text-sm" aria-live="polite">
                        {indoorDistance ? (
                            <>
                                <span>Outdoor: <strong>{indoorDistance.outdoor_distance_m.toFixed(1)} m</strong></span>
                                <span>Indoor horizontal: <strong>{indoorDistance.indoor_horizontal_distance_m.toFixed(1)} m</strong></span>
                                {indoorDistance.estimated_vertical_distance_m !== null && indoorDistance.vertical_segments > 0 && (
                                    <span>Stairs/lift estimate: <strong>{indoorDistance.estimated_vertical_distance_m.toFixed(1)} m</strong></span>
                                )}
                                {indoorDistance.total_estimated_distance_m !== null && (
                                    <span>Estimated total: <strong>{indoorDistance.total_estimated_distance_m.toFixed(1)} m</strong></span>
                                )}
                            </>
                        ) : <span>Distance details are unavailable from the API.</span>}
                    </div>

                    <nav className="flex flex-wrap items-center gap-2 bg-white px-4 py-2" aria-label="LTB route floors">
                        <span className="mr-1 text-sm text-slate-600">Route floors:</span>
                        {floorsInRoute.map((floor) => (
                            <button
                                key={floor}
                                type="button"
                                onClick={() => setSelectedFloor(floor)}
                                aria-current={selectedFloor === floor ? "step" : undefined}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${selectedFloor === floor ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}
                            >
                                Floor {floor}
                            </button>
                        ))}
                    </nav>

                    <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-3">
                        <svg viewBox="0 0 1722 1188" role="img" aria-label={`LTB floor ${selectedFloor} plan and indoor route`} className="mx-auto block h-auto w-full max-w-[1400px] bg-white shadow-md">
                            <image href={floorPlans[selectedFloor]} x="0" y="0" width="1722" height="1188" />
                            {floorRoute.length > 1 && (
                                <polyline points={routePoints} fill="none" stroke="#1d4ed8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                            )}
                            {floorRoute.map((node) => (
                                <circle key={node.id} cx={node.x_pixel} cy={node.y_pixel} r="10" fill="#1d4ed8" />
                            ))}
                        </svg>
                    </div>

                    <footer className="border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
                        {indoorDistance?.vertical_segments ? (
                            <span>
                                {indoorDistance.stair_segments} stair and {indoorDistance.lift_segments} lift floor change(s).
                                {indoorDistance.total_estimate_min_m !== null && indoorDistance.total_estimate_max_m !== null && (
                                    <> Connector-assumption range for the total: {indoorDistance.total_estimate_min_m.toFixed(1)}–{indoorDistance.total_estimate_max_m.toFixed(1)} m.</>
                                )}
                                {' '}These are estimates, not measured distances; map and graph error are not included in the range.
                            </span>
                        ) : (
                            <span>Indoor floor-plan distance uses the 0–50 m scale bar (14.2 pixels per metre).</span>
                        )}
                    </footer>
                </section>
            )}
        </div>
    );
}
