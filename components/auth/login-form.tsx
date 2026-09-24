"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/auth/actions";
import type { AuthActionState } from "@/lib/auth/validation";

const initialState: AuthActionState = {};

export function LoginForm({ role }: { role: "student" | "admin" }) {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input name="role" type="hidden" value={role} />

      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Email
        <input
          className="rounded-md border-2 border-primary/30 px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      {state.errors?.email?.map((error) => (
        <p key={error} className="text-sm text-red-700">{error}</p>
      ))}

      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Password
        <input
          className="rounded-md border-2 border-primary/30 px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.errors?.password?.map((error) => (
        <p key={error} className="text-sm text-red-700">{error}</p>
      ))}

      {state.message && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <button
        className="rounded-md bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>

      {role === "student" ? (
        <>
          <p className="text-center text-sm text-muted">
            New student?{" "}
            <Link href="/signup" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </p>
          <p className="text-center text-sm text-muted">
            Administrator?{" "}
            <Link href="/admin/login" className="font-semibold text-accent hover:underline">
              Admin log in
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-muted">
            Have an invitation code?{" "}
            <Link href="/admin/signup" className="font-semibold text-accent hover:underline">
              Create an admin account
            </Link>
          </p>
          <p className="text-center text-sm text-muted">
            Student?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Student log in
            </Link>
          </p>
        </>
      )}
    </form>
  );
}
