import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/students", label: "Students" },
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
        </nav>
      </div>
    </header>
  );
}
