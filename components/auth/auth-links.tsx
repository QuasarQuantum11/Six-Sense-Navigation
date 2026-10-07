import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { getSession } from "@/lib/auth/session";
import { UserMenu } from "@/components/auth/user-menu";
import {
  BuildingIcon,
  GridIcon,
  TableIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { NavLink } from "@/components/nav-link";

export async function AuthLinks() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:text-accent-dark">
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
      {session.role === "admin" ? (
        <>
          <NavLink href="/admin" icon={<GridIcon size={18} />}>
            Dashboard
          </NavLink>
          <NavLink href="/students" icon={<UsersIcon size={18} />}>
            Students
          </NavLink>
          <NavLink href="/admin/admins" icon={<UserIcon size={18} />}>
            Admins
          </NavLink>
          <NavLink href="/admins/buildings" icon={<BuildingIcon size={18} />}>
            Buildings
          </NavLink>
        </>
      ) : (
        <NavLink href={`/students/${session.userId}`} icon={<TableIcon size={18} />}>
          My timetable
        </NavLink>
      )}
      <UserMenu
        username={session.username}
        role={session.role}
        userId={session.userId}
      />
      <form action={logout}>
        <button className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:text-accent-dark" type="submit">
          Log out
        </button>
      </form>
    </>
  );
}
