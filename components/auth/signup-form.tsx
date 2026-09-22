"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import type { AuthActionState } from "@/lib/auth/validation";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Username
        <input
          className="rounded-md border-2 border-primary/30 px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none"
          name="username"
          autoComplete="username"
          required
        />
      </label>
      {state.errors?.username?.map((error) => (
        <p key={error} className="text-sm text-red-700">{error}</p>
      ))}

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
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="font-normal text-muted">
          At least 8 characters with a letter and a number.
        </span>
      </label>
      {state.errors?.password?.map((error) => (
        <p key={error} className="text-sm text-red-700">{error}</p>
      ))}

      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Walking speed preference
        <select
          className="rounded-md border-2 border-primary/30 bg-white px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none"
          name="walkingSpeed"
          defaultValue="normal"
        >
          <option value="accessible">Accessible pace</option>
          <option value="normal">Normal pace</option>
          <option value="fast">Fast pace</option>
        </select>
      </label>

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
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
