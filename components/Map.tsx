"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const API_URL = "https://six-sense-navigation-api.onrender.com";

const floorPlans: Record<string, string> = {
    G: "/ltb/Floor-G.png",
    "1": "/ltb/Floor-1.png",
    "2": "/ltb/Floor-2.png",
    "3": "/ltb/Floor-3.png",
};

export default function Map() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);

    const [indoorNodes, setIndoorNodes] = useState<Record<string, IndoorNode>>({});
    const [destination, setDestination] = useState("");
    const [indoorRoute, setIndoorRoute] = useState<IndoorRouteNode[]>([]);
    const [selectedFloor, setSelectedFloor] = useState("G");
    const [startSelected, setStartSelected] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!mapContainer.current) return;

        if (!mapInstance.current) {
            const map = L.map(mapContainer.current).setView(
                [-37.9083, 145.1380],
                16
            );

            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 20,
            }).addTo(map);

            mapInstance.current = map;

            let startMarker: L.Marker | null = null;
            let endMarker: L.Marker | null = null;
            let routeLayer: L.Polyline | null = null;

            const graphLayer = L.layerGroup().addTo(map);

            fetch(`${API_URL}/api/graph`)
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

            fetch(`${API_URL}/api/indoor-nodes`)
                .then((response) => response.json())
                .then((data) => {
                    setIndoorNodes(data);
                })
                .catch((error) => {
                    console.error(
                        "Failed to load indoor nodes:",
                        error
                    );
                });

            map.on("click", async (e) => {
                if (startMarker && endMarker) {
                    map.removeLayer(startMarker);
                    map.removeLayer(endMarker);

                    if (routeLayer) {
                        map.removeLayer(routeLayer);
                    }

                    startMarker = null;
                    endMarker = null;
                    setStartSelected(false);
                    setIndoorRoute([]);
                }

                if (!startMarker) {
                    startMarker = L.marker(e.latlng).addTo(map);
                    setStartSelected(true);
                    return;
                }

                endMarker = L.marker(e.latlng).addTo(map);

                try {
                    console.log("ROUTE REQUEST STARTING");

                    const response = await fetch(
                        `${API_URL}/api/route?start_lat=${startMarker.getLatLng().lat}&start_lon=${startMarker.getLatLng().lng}&end_lat=${endMarker.getLatLng().lat}&end_lon=${endMarker.getLatLng().lng}`
                    );

                    console.log(
                        "ROUTE RESPONSE STATUS:",
                        response.status
                    );

                    const data = await response.json();

                    console.log(
                        "ROUTE RESPONSE DATA:",
                        data
                    );

                    if (data.route) {
                        routeLayer = L.polyline(data.route, {
                            color: "blue",
                            weight: 5,
                        }).addTo(map);

                        map.fitBounds(routeLayer.getBounds());
                    }
                } catch (error) {
                    console.error(
                        "Failed to calculate outdoor route:",
                        error
                    );
                }
            });
        }
    }, []);

    const roomNodes = Object.entries(indoorNodes)
        .filter(
            ([, node]) =>
                node.type === "room" && node.description
        )
        .sort(([a], [b]) => a.localeCompare(b));

    const floorsInRoute = Array.from(
        new Set(indoorRoute.map((node) => node.floor))
    );

    const routeToLTB = async () => {
        if (!mapInstance.current || !destination) return;

        const markers: L.Layer[] = [];

        mapInstance.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            }
        });

        if (markers.length === 0) {
            alert("Please click the outdoor map first to choose your starting point.");
            return;
        }

        const startMarker = markers[markers.length - 1] as L.Marker;
        const start = startMarker.getLatLng();

        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/api/ltb-route?start_lat=${start.lat}&start_lon=${start.lng}&end_node=${destination}`
            );

            const data = await response.json();

            if (data.error) {
                alert(data.error);
                return;
            }

            if (data.outdoor_path) {
                const route = L.polyline(data.outdoor_path, {
                    color: "blue",
                    weight: 5,
                }).addTo(mapInstance.current);

                mapInstance.current.fitBounds(route.getBounds());
            }

            if (data.indoor_path) {
                setIndoorRoute(data.indoor_path);
                setSelectedFloor(data.indoor_path[0]?.floor || "G");
            }
        } catch (error) {
            console.error(
                "Failed to calculate LTB route:",
                error
            );
            alert("Could not calculate the LTB route.");
        } finally {
            setLoading(false);
        }
    };

    const floorRoute = indoorRoute.filter(
        (node) => node.floor === selectedFloor
    );

    const routePoints = floorRoute
        .map((node) => `${node.x_pixel},${node.y_pixel}`)
        .join(" ");

    return (
        <div
            style={{
                position: "relative",
                height: "100vh",
                width: "100vw",
            }}
        >
            <div
                ref={mapContainer}
                style={{
                    height: "100%",
                    width: "100%",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    zIndex: 1000,
                    background: "white",
                    padding: 16,
                    borderRadius: 8,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                    width: 300,
                }}
            >
                <h3 style={{ marginTop: 0 }}>
                    LTB Indoor Navigation
                </h3>

                <p style={{ fontSize: 14 }}>
                    1. Click the outdoor map to choose your starting point.
                    <br />
                    2. Choose an LTB room.
                    <br />
                    3. Click Route to LTB.
                </p>

                <select
                    value={destination}
                    onChange={(e) =>
                        setDestination(e.target.value)
                    }
                    style={{
                        width: "100%",
                        padding: 8,
                        marginBottom: 10,
                    }}
                >
                    <option value="">
                        Select LTB destination
                    </option>

                    {roomNodes.map(([id, node]) => (
                        <option key={id} value={id}>
                            Floor {node.floor} — {node.description} ({id})
                        </option>
                    ))}
                </select>

                <button
                    onClick={routeToLTB}
                    disabled={!destination || !startSelected || loading}
                    style={{
                        width: "100%",
                        padding: 10,
                        cursor:
                            !destination || !startSelected || loading
                                ? "not-allowed"
                                : "pointer",
                    }}
                >
                    {loading ? "Finding route..." : "Route to LTB"}
                </button>
            </div>

            {indoorRoute.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 1000,
                        background: "white",
                        padding: 12,
                        borderRadius: 8,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                        maxWidth: "90vw",
                        maxHeight: "85vh",
                    }}
                >
                    <h3 style={{ marginTop: 0 }}>
                        LTB Indoor Route
                    </h3>

                    {floorsInRoute.length > 1 && (
                        <div style={{ marginBottom: 10 }}>
                            {floorsInRoute.map((floor) => (
                                <button
                                    key={floor}
                                    onClick={() =>
                                        setSelectedFloor(floor)
                                    }
                                    style={{
                                        marginRight: 5,
                                        padding: "6px 10px",
                                        fontWeight:
                                            selectedFloor === floor
                                                ? "bold"
                                                : "normal",
                                    }}
                                >
                                    Floor {floor}
                                </button>
                            ))}
                        </div>
                    )}

                    <div
                        style={{
                            overflow: "auto",
                            maxHeight: "70vh",
                            maxWidth: "80vw",
                        }}
                    >
                        <svg
                            viewBox="0 0 1722 1188"
                            style={{
                                display: "block",
                                width: "min(80vw, 900px)",
                                height: "auto",
                            }}
                        >
                            <image
                                href={floorPlans[selectedFloor]}
                                x="0"
                                y="0"
                                width="1722"
                                height="1188"
                            />

                            {floorRoute.length > 1 && (
                                <polyline
                                    points={routePoints}
                                    fill="none"
                                    stroke="blue"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}

                            {floorRoute.map((node) => (
                                <circle
                                    key={node.id}
                                    cx={node.x_pixel}
                                    cy={node.y_pixel}
                                    r="10"
                                    fill="blue"
                                />
                            ))}
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
}
