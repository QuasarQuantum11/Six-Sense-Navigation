"use client";

import dynamic from "next/dynamic";

// Dynamically import the map, disabling Server-Side Rendering
const CampusMap = dynamic(() => import("@/components/OutdoorMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500 rounded-xl">
      Loading Monash Campus Map...
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-white w-full h-[calc(100vh-72px)] p-6">
      <div className="w-full max-w-6xl h-full rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg relative">
        <CampusMap />
      </div>
    </div>
  );
}