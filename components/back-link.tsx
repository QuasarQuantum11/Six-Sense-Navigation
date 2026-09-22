"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function BackLink({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (href) {
          router.push(href);
        } else {
          router.back();
        }
      }}
      className="text-sm font-semibold text-accent hover:text-accent-dark"
    >
      {children}
    </button>
  );
}
