import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";

const tones = {
  primary: {
    border: "border-l-primary",
    iconBox: "bg-panel text-primary",
    arc: "bg-panel",
  },
  accent: {
    border: "border-l-accent",
    iconBox: "bg-orange-50 text-accent",
    arc: "bg-orange-50",
  },
} as const;

export function StatCard({
  title,
  value,
  detail,
  href,
  linkLabel,
  icon,
  tone = "primary",
}: {
  title: string;
  value: number;
  detail: string;
  href: string;
  /** Accessible name for the arrow link, e.g. "View students". */
  linkLabel: string;
  icon: ReactNode;
  tone?: keyof typeof tones;
}) {
  const styles = tones[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 border-l-4 ${styles.border} bg-white p-6 shadow-sm`}
    >
      {/* Decorative corner arc, as in the design. */}
      <span
        aria-hidden="true"
        className={`absolute -right-10 -top-10 h-24 w-24 rounded-full ${styles.arc}`}
      />
      <div className="relative flex items-start gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.iconBox}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-muted">{title}</h2>
          <p className="mt-1 text-3xl font-extrabold text-foreground">
            {value.toLocaleString("en-AU")}
          </p>
          <p className="mt-1 text-xs text-muted">{detail}</p>
        </div>
      </div>
      <Link
        href={href}
        className={`relative mt-2 ml-auto flex h-8 w-8 items-center justify-center rounded-full ${styles.iconBox} hover:opacity-80`}
      >
        <ChevronRightIcon size={16} />
        <span className="sr-only">{linkLabel}</span>
      </Link>
    </div>
  );
}
