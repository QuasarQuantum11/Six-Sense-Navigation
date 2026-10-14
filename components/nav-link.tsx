"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// "/" and "/admin" are parents of other routes, so they only match exactly.
const EXACT_ONLY = new Set(["/", "/admin"]);

export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = EXACT_ONLY.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-panel text-primary"
          : "text-muted hover:bg-slate-100 hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
