"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function UserMenu({
  username,
  role,
  userId,
}: {
  username: string;
  role: "student" | "admin";
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-dark"
      >
        {username} ({role})
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-40 rounded-md border-2 border-primary/20 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            disabled
            role="menuitem"
            className="block w-full cursor-not-allowed px-4 py-2 text-left text-sm text-muted"
          >
            Profile
          </button>
          <Link
            href={
              role === "admin"
                ? "/admins/feedback"
                : `/students/${userId}/feedback`
            }
            role="menuitem"
            className="block px-4 py-2 text-sm text-foreground hover:bg-panel"
            onClick={() => setOpen(false)}
          >
            Feedback
          </Link>
        </div>
      )}
    </div>
  );
}
