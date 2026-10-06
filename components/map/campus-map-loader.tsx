"use client";

import dynamic from "next/dynamic";
import type { WalkingSpeed } from "@/lib/navigation/walking";

// Leaflet needs the browser, so load the map without server rendering.
// (`ssr: false` is only allowed in Client Components.)
const CampusMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500 rounded-xl">
      Loading Monash Campus Map...
    </div>
  ),
});

export default function CampusMapLoader(props: {
  walkingSpeed: WalkingSpeed;
  personalised: boolean;
}) {
  return <CampusMap {...props} />;
}
