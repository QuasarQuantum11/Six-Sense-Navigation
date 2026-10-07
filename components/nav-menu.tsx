"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";

// Rendered as direct children of the navbar's flex row (a fragment), so the
// `order-*` classes below place everything:
//   below md : brand + menu button, then the account area on its own row
//   md to xl : brand + account + menu button
//   xl and up: brand, links, divider, account (menu button hidden)
// The links collapse into a dropdown panel below xl.
export function NavMenu({
  links,
  account,
}: {
  links: ReactNode;
  account: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <nav
        id={panelId}
        ref={panelRef}
        aria-label="Main"
        // Choosing a link closes the dropdown.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`xl:static xl:order-1 xl:ml-auto xl:flex xl:flex-row xl:items-center xl:gap-2 xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none ${
          open
            ? "absolute inset-x-0 top-full z-30 flex flex-col gap-1 border-b-4 border-accent bg-white p-4 shadow-lg"
            : "hidden"
        }`}
      >
        {links}
      </nav>

      <span aria-hidden="true" className="hidden h-6 w-px bg-slate-300 xl:order-2 xl:block" />

      <div className="order-3 flex basis-full items-center justify-end gap-2 md:order-2 md:ml-auto md:basis-auto xl:order-3 xl:ml-0">
        {account}
      </div>

      <button
        ref={rootRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="order-2 ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-slate-100 md:order-3 md:ml-0 xl:hidden"
      >
        {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        <span className="sr-only">{open ? "Close main menu" : "Open main menu"}</span>
      </button>
    </>
  );
}
