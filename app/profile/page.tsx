import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { verifySession } from "@/lib/auth/dal";
import ProfileForm from "./profile-form";

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
      </div>
    </main>
  );
}
