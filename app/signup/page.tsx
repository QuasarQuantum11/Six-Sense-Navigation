import { SignupForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function SignupPage() {
  if (await getSession()) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-panel px-6 py-12">
      <section className="w-full max-w-md rounded-xl border-2 border-primary/20 bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-primary">Create student account</h1>
        <p className="mb-7 mt-2 text-sm text-muted">
          Save your timetable and walking preferences for accessible routes.
        </p>
        <SignupForm />
      </section>
    </main>
  );
}
