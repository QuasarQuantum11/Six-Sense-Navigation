import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { getSession } from "@/lib/auth/session";
import { UserMenu } from "@/components/auth/user-menu";

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
      <UserMenu
        username={session.username}
        role={session.role}
        userId={session.userId}
      />
      <form action={logout}>
        <button className="text-sm font-semibold text-accent hover:text-accent-dark" type="submit">
          Log out
        </button>
      </form>
    </>
  );
}
