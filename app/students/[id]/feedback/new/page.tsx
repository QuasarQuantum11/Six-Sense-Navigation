import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { submitFeedback } from "./actions";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function NewFeedbackPage({
  params,
}: PageProps<"/students/[id]/feedback/new">) {
  const { id } = await params;

  const student = await db.query.students.findFirst({
    where: eq(students.id, id),
  });

  if (!student) {
    notFound();
  }

  const submitFeedbackForStudent = submitFeedback.bind(null, id);

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Submit feedback</h1>
          <BackLink href={`/students/${student.id}/feedback`}>
            ← Back to feedback
          </BackLink>
        </div>

        <form
          action={submitFeedbackForStudent}
          className="flex flex-col gap-4"
        >
          <label
            htmlFor="message"
            className="text-sm font-semibold text-primary"
          >
            Description
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            className="w-full rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground"
            placeholder="Describe your feedback..."
          />
          <button
            type="submit"
            className="self-start rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
