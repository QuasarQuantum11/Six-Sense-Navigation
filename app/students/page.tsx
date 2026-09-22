import Link from "next/link";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  await requireAdmin();
  const allStudents = await db.select().from(students).orderBy(students.createdAt);

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Students</h1>
          <BackLink href="/">← Back home</BackLink>
        </div>

        <Link
          href="/admins/feedback"
          className="self-start rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          View all feedback
        </Link>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="px-4 py-3 font-semibold text-primary">
                  Username
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Profile Picture
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Walking Speed
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Created At
                </th>
                <th className="px-4 py-3 font-semibold text-primary">ID</th>
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
