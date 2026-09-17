import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { getSession } from "@/lib/auth/session";

export async function AuthLinks() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <Link href="/login" className="text-sm font-semibold text-accent hover:text-accent-dark">
          Log in
        </Link>
        <Link href="/signup" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
          Sign up
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href={session.role === "admin" ? "/students" : `/students/${session.userId}`}
        className="text-sm font-semibold text-accent hover:text-accent-dark"
      >
        {session.role === "admin" ? "Students" : "My timetable"}
      </Link>
      {session.role === "admin" && (
        <Link href="/admins" className="text-sm font-semibold text-accent hover:text-accent-dark">
          Admins
        </Link>
      )}
      <span className="text-sm text-muted">
        {session.username} ({session.role})
      </span>
      <form action={logout}>
        <button className="text-sm font-semibold text-accent hover:text-accent-dark" type="submit">
          Log out
        </button>
      </form>
    </>
  );
}
