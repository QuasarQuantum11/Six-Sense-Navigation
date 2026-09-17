import { Suspense } from "react";
import Link from "next/link";
import { AuthLinks } from "@/components/auth/auth-links";

const links = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
];

export function Navbar() {
  return (
    <header className="border-b-4 border-accent bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 sm:px-16">
        <Link href="/" className="text-xl font-bold text-primary">
          Six-Sense Navigation
        </Link>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-accent hover:text-accent-dark"
            >
              {link.label}
            </Link>
          ))}
          <Suspense fallback={<span className="text-sm text-muted">Checking account…</span>}>
            <AuthLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
