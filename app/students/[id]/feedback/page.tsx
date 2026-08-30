import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { feedback } from "@/lib/feedback/schema";
import { requireStudentOrAdmin } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  new: "New",
  in_review: "In review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export default async function StudentFeedbackPage({
  params,
}: PageProps<"/students/[id]/feedback">) {
  const { id } = await params;
  await requireStudentOrAdmin(id);

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) {
    notFound();
  }

  const studentFeedback = await db.query.feedback.findMany({
    where: eq(feedback.studentId, id),
    orderBy: desc(feedback.createdAt),
  });

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">
            Feedback from {student.username}
          </h1>
          <Link
            href={`/students/${student.id}`}
            className="text-sm font-semibold text-accent hover:text-accent-dark"
          >
            ← Back to {student.username}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="px-4 py-3 font-semibold text-primary">
                  Message
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {studentFeedback.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-foreground">
                    {item.message}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {statusLabels[item.status] ?? item.status}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {studentFeedback.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">
                    No feedback submitted yet.
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
