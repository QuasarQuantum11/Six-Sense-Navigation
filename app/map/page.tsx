import { getSession } from "@/lib/auth/session";
import CampusMapLoader from "@/components/map/campus-map-loader";
import { getWalkingPreference } from "@/lib/students/walking-preference";
import mappedBuildings from "@/api/buildings.json";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const preference = await getWalkingPreference();
  const session = await getSession();
  const canViewCrowd = !!session;
  const { classBuilding } = await searchParams;
  const trackDestination = session?.role === "student" && typeof classBuilding === "string"
    ? mappedBuildings.find(building => building.id === classBuilding)
    : undefined;

  return (
    <div className="flex flex-1 flex-col items-center bg-white w-full h-[calc(100vh-72px)] p-3 lg:p-4">
      <div className="relative isolate min-h-0 w-full max-w-none flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <CampusMapLoader key={trackDestination?.id ?? "campus"} {...preference} canViewCrowd={canViewCrowd} trackDestination={trackDestination} />
      </div>
    </div>
  );
}
