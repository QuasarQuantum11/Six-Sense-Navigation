import { Suspense } from "react";
import Link from "next/link";
import { AuthLinks } from "@/components/auth/auth-links";
import { HomeIcon, MapIcon, RouteIcon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";

export function Navbar() {
  return (
    <header className="relative z-20 border-b-4 border-accent bg-white">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3 text-xl text-primary">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <RouteIcon size={22} />
          </span>
          <span>
            Six-Sense <strong>Navigation</strong>
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1 sm:gap-2">
          <NavLink href="/" icon={<HomeIcon size={18} />}>
            Home
          </NavLink>
          <NavLink href="/map" icon={<MapIcon size={18} />}>
            Map
          </NavLink>
          <Suspense fallback={<span className="text-sm text-muted">Checking account…</span>}>
            <AuthLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
