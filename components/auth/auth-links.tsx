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
import { BaseLinks } from "@/components/nav-base-links";
import { NavLink } from "@/components/nav-link";
import { NavMenu } from "@/components/nav-menu";

// The navbar's session-dependent half: role-specific links (which collapse into
// the dropdown on small screens) and the account area (always visible).
export async function AuthNav() {
  const session = await getSession();

  if (!session) {
    return (
      <NavMenu
        links={<BaseLinks />}
        account={
          <>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:text-accent-dark">
              Log in
            </Link>
            <Link href="/signup" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
              Sign up
            </Link>
          </>
        }
      />
    );
  }

  return (
    <NavMenu
      links={
        <>
          <BaseLinks />
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
        </>
      }
      account={
        <>
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
      }
    />
  );
}
