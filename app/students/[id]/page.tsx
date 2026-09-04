import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { timetableBuildings, timetables } from "@/lib/timetables/schema";
import { TimetableSelector } from "./timetable-selector";

export const dynamic = "force-dynamic";

export default async function StudentPage({
  params,
}: PageProps<"/students/[id]">) {
  const { id } = await params;

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) {
    notFound();
  }

  const studentTimetables = await db.query.timetables.findMany({
    where: eq(timetables.studentId, id),
    orderBy: asc(timetables.createdAt),
    with: {
      timetableBuildings: {
        orderBy: asc(timetableBuildings.position),
        with: {
          building: true,
        },
      },
    },
  });

  const timetableOptions = studentTimetables.map((t) => ({
    id: t.id,
    name: t.name,
    stops: t.timetableBuildings.map((tb) => ({
      position: tb.position,
      buildingId: tb.buildingId,
      buildingName: tb.building.name,
    })),
  }));

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">
            {student.username}
          </h1>
          <Link
            href="/students"
            className="text-sm font-semibold text-accent hover:text-accent-dark"
          >
            ← Back to students
          </Link>
        </div>

        <TimetableSelector timetables={timetableOptions} />
      </main>
    </div>
  );
}
