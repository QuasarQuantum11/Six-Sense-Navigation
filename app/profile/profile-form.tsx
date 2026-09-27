"use client";

import { useState } from "react";
import { updateProfile } from "@/app/profile-actions";

type WalkingSpeed = "accessible" | "normal" | "fast";

export default function ProfileForm({
  username: initialUsername,
  email: initialEmail,
  walkingSpeed: initialWalkingSpeed,
  createdAt,
  emailVerified,
}: {
  username: string;
  email: string;
  walkingSpeed: WalkingSpeed;
  createdAt: string;
  emailVerified: boolean;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [walkingSpeed, setWalkingSpeed] =
    useState<WalkingSpeed>(initialWalkingSpeed);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPasswordError("");

    if (password) {
      if (password.length < 8) {
        setPasswordError("Password must be at least 8 characters.");
        setPassword("");
        return;
      }

      if (!/[A-Za-z]/.test(password)) {
        setPasswordError("Password must contain a letter.");
        setPassword("");
        return;
      }

      if (!/[0-9]/.test(password)) {
        setPasswordError("Password must contain a number.");
        setPassword("");
        return;
      }
    }

    setSaving(true);

    try {
      await updateProfile(username, email, walkingSpeed, password);
      setPassword("");
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border-2 border-primary/20 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-md border border-primary/20 px-3 py-2 text-sm outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-primary/20 px-3 py-2 text-sm outline-none focus:border-accent"
              required
            />
            <p className="mt-1 text-xs text-muted">
              {emailVerified ? "Email verified" : "Email not verified"}
            </p>
          </div>

          <div>
            <label
              htmlFor="walkingSpeed"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              Walking speed
            </label>
            <select
              id="walkingSpeed"
              value={walkingSpeed}
              onChange={(event) =>
                setWalkingSpeed(event.target.value as WalkingSpeed)
              }
              className="w-full rounded-md border border-primary/20 bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="accessible">Accessible</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
            <p className="mt-1 text-xs text-muted">
              This preference can be used to personalise your navigation
              routes.
            </p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-semibold text-foreground"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError("");
              }}
              placeholder="Leave blank to keep your current password"
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-accent ${
                passwordError ? "border-red-500" : "border-primary/20"
              }`}
            />
            {passwordError ? (
              <p className="mt-1 text-xs text-red-600">{passwordError}</p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                Must be at least 8 characters and contain a letter and a number.
              </p>
            )}
          </div>

          {message && (
            <p className="rounded-md bg-panel px-3 py-2 text-sm text-foreground">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border-2 border-primary/20 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">
          Account information
        </h2>
        <p className="mt-2 text-sm text-muted">
          Account created{" "}
          {new Date(createdAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
