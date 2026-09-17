"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function BackLink({
  fallbackHref,
  children,
}: {
  fallbackHref: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="text-sm font-semibold text-accent hover:text-accent-dark"
    >
      {children}
    </button>
  );
}
