import Link from "next/link";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const allStudents = await db.select().from(students).orderBy(students.createdAt);

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Students</h1>
          <Link
            href="/"
            className="text-sm font-semibold text-accent hover:text-accent-dark"
          >
            ← Back home
          </Link>
        </div>

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
                  Password (hashed)
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
                  <td className="px-4 py-3">
                    <Link
                      href={`/students/${student.id}`}
                      className="font-semibold text-accent hover:text-accent-dark hover:underline"
                    >
                      {student.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {student.profilePicture ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {student.password.slice(0, 24)}…
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
