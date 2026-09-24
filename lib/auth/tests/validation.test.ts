import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "../validation";

describe("student sign-up validation", () => {
  const validSignup = {
    username: "student_1",
    email: "STUDENT@example.com",
    password: "safe-password-123",
    walkingSpeed: "normal",
  };

  it("normalizes an email and accepts a valid account", () => {
    const result = signupSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("student@example.com");
    }
  });

  it.each([
    { username: "x" },
    { username: "student name" },
    { email: "not-an-email" },
    { password: "short" },
    { password: "letters-only" },
    { walkingSpeed: "flying" },
  ])("rejects invalid sign-up data: %j", (change) => {
    expect(signupSchema.safeParse({ ...validSignup, ...change }).success).toBe(false);
  });
});

describe("login validation", () => {
  it("requires a supported account role and a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "", role: "student" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "pass", role: "guest" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "pass", role: "admin" }).success).toBe(true);
  });
});
