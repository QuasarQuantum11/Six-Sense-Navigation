import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";
import { SortableHeader } from "@/components/sortable-header";
import { orderByFor, parseSort } from "@/lib/table-sort";

export const dynamic = "force-dynamic";

const PATH = "/students";

// Walking speed sorts slowest to fastest (the order of the database enum).
const sortColumns = {
  username: sql`lower(${students.username})`,
  profilePicture: sql`${students.profilePicture}`,
  walkingSpeed: sql`${students.walkingSpeed}`,
  createdAt: sql`${students.createdAt}`,
  id: sql`${students.id}`,
};
const sortKeys = Object.keys(sortColumns) as (keyof typeof sortColumns)[];

export default async function StudentsPage({
  searchParams,
}: PageProps<"/students">) {
  await requireAdmin();

  const params = await searchParams;
  const sort = parseSort(params, sortKeys);

  const allStudents = await db
    .select({
      id: students.id,
      username: students.username,
      profilePicture: students.profilePicture,
      walkingSpeed: students.walkingSpeed,
      createdAt: students.createdAt,
    })
    .from(students)
    .orderBy(...orderByFor(sortColumns, sort, [asc(students.createdAt)]));

  const header = (label: string, sortKey: (typeof sortKeys)[number]) => (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      path={PATH}
      params={params}
    />
  );

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Students</h1>
          <BackLink href="/">← Back home</BackLink>
        </div>

        <Link
          href="/admin/feedback"
          className="self-start rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          View all feedback
        </Link>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {header("Username", "username")}
                {header("Profile Picture", "profilePicture")}
                {header("Walking Speed", "walkingSpeed")}
                {header("Created At", "createdAt")}
                {header("ID", "id")}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {allStudents.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {student.username}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {student.profilePicture ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted capitalize">
                    {student.walkingSpeed}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(student.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {student.id}
                  </td>
                </tr>
              ))}
              {allStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No students yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
