import { AdminSignupForm } from "@/components/auth/admin-signup-form";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminSignupPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "admin" ? "/admins/feedback" : "/");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-panel px-6 py-12">
      <section className="w-full max-w-md rounded-xl border-2 border-primary/20 bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-primary">Create admin account</h1>
        <p className="mb-7 mt-2 text-sm text-muted">
          An invitation code is required to register as an administrator.
        </p>
        <AdminSignupForm />
      </section>
    </main>
  );
}
