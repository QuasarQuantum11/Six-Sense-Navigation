import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  new: "New",
  in_review: "In review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export default async function AllFeedbackPage() {
  await requireAdmin();

  const allFeedback = await db.query.feedback.findMany({
    orderBy: desc(feedback.createdAt),
    with: { student: true },
  });

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">All feedback</h1>
          <BackLink fallbackHref="/admins">← Back to admins</BackLink>
        </div>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="px-4 py-3 font-semibold text-primary">
                  Submitted by
                </th>
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
              {allFeedback.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-muted">
                    {item.student ? (
                      <span className="font-semibold text-accent">
                        {item.student.username}
                      </span>
                    ) : (
                      "Guest"
                    )}
                  </td>
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
              {allFeedback.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
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
