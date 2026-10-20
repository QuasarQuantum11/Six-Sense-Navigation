import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { verifySession } from "@/lib/auth/dal";
import ProfileForm from "./profile-form";
import { timetableBuildings, timetables } from "@/lib/timetables/schema";
import { TimetableSelector } from "@/app/students/[id]/timetable-selector";

export default async function ProfilePage() {
  const session = await verifySession();

  if (session.role !== "student") {
    return null;
  }

  const student = await db.query.students.findFirst({
    columns: { id: true, username: true, email: true, walkingSpeed: true, createdAt: true, emailVerified: true },
    where: eq(students.id, session.userId),
  });

  if (!student) {
    return null;
  }

  const savedTimetables = await db.query.timetables.findMany({
    where: eq(timetables.studentId, session.userId),
    orderBy: asc(timetables.createdAt),
    with: { timetableBuildings: { orderBy: asc(timetableBuildings.position), with: { building: true } } },
  });
  const timetableOptions = savedTimetables.map(t => ({
    id: t.id,
    name: t.name,
    stops: t.timetableBuildings.map(stop => ({ ...stop, buildingName: stop.building.name })),
  }));

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="mt-2 text-muted">
            View and update your account details and navigation preferences.
          </p>
        </div>

        <ProfileForm
          username={student.username}
          email={student.email}
          walkingSpeed={student.walkingSpeed}
          createdAt={student.createdAt.toISOString()}
          emailVerified={student.emailVerified}
        />
        <div className="mt-8">
          <TimetableSelector studentId={student.id} timetables={timetableOptions} canTrack />
        </div>
      </div>
    </main>
  );
}
