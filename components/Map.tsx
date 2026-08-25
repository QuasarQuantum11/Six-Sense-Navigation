"use client"; // Tells Next.js this runs in the browser

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function Map() {

    // Initialise the map and set up event listeners for user interactions
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);

    useEffect(() => {
        // Stop immediately if the Div hasn't been rendered yet
        if (!mapContainer.current) return;

        // Prevent the map from initializing twice in React
        if (typeof window !== "undefined" && !mapInstance.current) {
        const map = L.map(mapContainer.current).setView([-37.9083, 145.1380], 16);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        mapInstance.current = map;

        let startMarker: L.Marker | null = null;
        let endMarker: L.Marker | null = null;
        let routeLayer: L.Polyline | null = null;
        
        let graphLayer = L.layerGroup().addTo(map);

        fetch("http://localhost:8000/api/graph")
            .then((response) => response.json())
            .then((data) => {
                if (data.edges) {
                    data.edges.forEach((edge: [number[], number[]]) => {
                        L.polyline(edge as L.LatLngExpression[], {
                            color: "red",
                            weight: 2,
                            opacity: 0.6
                        }).addTo(graphLayer);
                    });
                }
            })
            .catch((error) => {
                console.error("Failed to load navigation graph:", error);
            });

        // Listener logic for user clicks on the map to set start and end points, and fetch the route from the API
        map.on('click', async (e) => {
            if (startMarker && endMarker) {
            map.removeLayer(startMarker);
            map.removeLayer(endMarker);
            if (routeLayer) map.removeLayer(routeLayer);
            startMarker = null;
            endMarker = null;
            }

            if (!startMarker) {
            startMarker = L.marker(e.latlng).addTo(map);
            } else {
            endMarker = L.marker(e.latlng).addTo(map);
            
            const response = await fetch(`/api/route?start_lat=${startMarker.getLatLng().lat}&start_lon=${startMarker.getLatLng().lng}&end_lat=${endMarker.getLatLng().lat}&end_lon=${endMarker.getLatLng().lng}`);
            const data = await response.json();

            if (data.route) {
                routeLayer = L.polyline(data.route, {color: 'blue', weight: 5}).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            }
            }
        });
        }
    }, []);

    return <div ref={mapContainer} style={{ height: "100vh", width: "100vw" }} />;
}