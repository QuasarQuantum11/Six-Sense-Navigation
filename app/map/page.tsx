import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { getSession } from "@/lib/auth/session";
import CampusMapLoader from "@/components/map/campus-map-loader";
import type { WalkingSpeed } from "@/lib/navigation/walking";

// Logged-in students get walking times at their own pace, read fresh from the
// database so a change on their profile applies straight away. Guests and
// admins get the normal pace.
async function getWalkingPreference(): Promise<{
  walkingSpeed: WalkingSpeed;
  personalised: boolean;
}> {
  const session = await getSession();
  if (session?.role !== "student") {
    return { walkingSpeed: "normal", personalised: false };
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, session.userId),
    columns: { walkingSpeed: true },
  });
  return student
    ? { walkingSpeed: student.walkingSpeed, personalised: true }
    : { walkingSpeed: "normal", personalised: false };
}

export default async function MapPage() {
  const preference = await getWalkingPreference();
  const canViewCrowd = !!await getSession();

  return (
    <div className="flex flex-1 flex-col items-center bg-white w-full h-[calc(100vh-72px)] p-6">
      <div className="relative isolate min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-xl border-2 border-gray-200 shadow-lg">
        <CampusMapLoader {...preference} canViewCrowd={canViewCrowd} />
      </div>
    </div>
  );
}
