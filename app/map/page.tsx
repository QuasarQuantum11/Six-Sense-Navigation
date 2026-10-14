import { getSession } from "@/lib/auth/session";
import CampusMapLoader from "@/components/map/campus-map-loader";
import { getWalkingPreference } from "@/lib/students/walking-preference";

export default async function MapPage() {
  const preference = await getWalkingPreference();
  const canViewCrowd = !!await getSession();

  return (
    <div className="flex flex-1 flex-col items-center bg-white w-full h-[calc(100vh-72px)] p-3 lg:p-4">
      <div className="relative isolate min-h-0 w-full max-w-none flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <CampusMapLoader {...preference} canViewCrowd={canViewCrowd} />
      </div>
    </div>
  );
}
