import { Suspense } from "react";
import Link from "next/link";
import { AuthNav } from "@/components/auth/auth-links";
import { RouteIcon } from "@/components/icons";
import { BaseLinks } from "@/components/nav-base-links";
import { NavMenu } from "@/components/nav-menu";

export function Navbar() {
  return (
    <header className="relative z-20 border-b-4 border-accent bg-white">
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 sm:px-10">
        <Link href="/" className="flex items-center gap-3 text-xl text-primary">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <RouteIcon size={22} />
          </span>
          <span>
            Six-Sense <strong>Navigation</strong>
          </span>
        </Link>
        <Suspense
          fallback={
            <NavMenu
              links={<BaseLinks />}
              account={<span className="text-sm text-muted">Checking account…</span>}
            />
          }
        >
          <AuthNav />
        </Suspense>
      </div>
    </header>
  );
}
