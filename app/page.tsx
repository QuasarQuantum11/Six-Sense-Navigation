import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center sm:px-16">
        <h1 className="text-4xl font-bold text-primary">
          Six-Sense Navigation
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Accessible indoor and outdoor navigation for the Monash University
          Clayton campus, with routing that respects your accessibility
          preferences.
        </p>
        <div className="flex gap-4 mt-4">
          <Link
            href="/map"
            className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-white hover:bg-accent-dark"
          >
            Open Map
          </Link>
          <Link
            href="/students"
            className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-white hover:bg-accent-dark"
          >
            View Students
          </Link>
          <Link
            href="/admins"
            className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-white hover:bg-accent-dark"
          >
            View Admins
          </Link>
        </div>
      </main>
    </div>
  );
}