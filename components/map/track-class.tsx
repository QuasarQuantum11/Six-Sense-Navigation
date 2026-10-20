"use client";

import Link from "next/link";
import { classBuilding, type ScheduledClass } from "@/lib/timetables/class-route";

export default function TrackClass({ entry }: { entry: ScheduledClass }) {
  const building = classBuilding(entry.buildingName);
  const buttonClass = "col-start-2 row-start-1 inline-flex h-10 w-28 items-center justify-center self-start whitespace-nowrap rounded-md bg-blue-700 text-sm font-semibold text-white";
  return <>
    {building ? <Link href={`/map?classBuilding=${encodeURIComponent(building.id)}`} prefetch={false} title="Route to the building entrance using your current location" aria-label={`Track class ${entry.subjectCode ?? ""} at ${entry.buildingName}${entry.room ? `, ${entry.room}` : ""}`} className={buttonClass}>Track class</Link>
      : <button type="button" disabled className={`${buttonClass} opacity-50`}>Track class</button>}
    {!building && <p className="col-span-full text-sm text-amber-800">This class building is not supported by the campus map.</p>}
  </>;
}
