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
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-4xl flex-col gap-6 py-16 px-6 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {student.username}
          </h1>
          <Link
            href="/students"
            className="text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Back to students
          </Link>
        </div>

        <TimetableSelector timetables={timetableOptions} />
      </main>
    </div>
  );
}
