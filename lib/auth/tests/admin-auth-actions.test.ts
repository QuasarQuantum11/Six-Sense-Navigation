import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type CookieOptions = { httpOnly?: boolean; sameSite?: string; path?: string; expires?: Date };
const cookieJar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  options: new Map<string, unknown>(),
  deleted: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) => {
      cookieJar.values.set(name, value);
      cookieJar.options.set(name, options);
    },
    get: (name: string) => (cookieJar.values.has(name) ? { value: cookieJar.values.get(name) } : undefined),
    delete: (name: string) => {
      cookieJar.values.delete(name);
      cookieJar.deleted.push(name);
    },
  }),
}));
vi.mock("@/lib/db/client", async () => ({
  db: (await import("@/lib/test-utils/test-database")).currentDatabaseProxy,
}));

import { adminSignup, login, logout } from "../../../app/auth/actions";
import { admins } from "@/lib/admins/schema";
import { students } from "@/lib/students/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { verifySessionToken } from "@/lib/auth/token";
import {
  createTestDatabase,
  resetTables,
  setCurrentDatabase,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const INVITE = "invitation-code-long-enough-1";
const COOKIE = "six_sense_session";
const PASSWORD = "Secret123";

let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
let db: TestDatabase;

beforeAll(async () => {
  ({ client, db } = await createTestDatabase());
  setCurrentDatabase(db);
}, 30_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetTables(client);
  cookieJar.values.clear();
  cookieJar.options.clear();
  cookieJar.deleted.length = 0;
  process.env.SESSION_SECRET = SECRET;
  process.env.ADMIN_INVITE_CODES = `${INVITE}, another-invitation-code-long-2`;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const signupForm = (overrides: Record<string, string> = {}) =>
  form({ username: "newadmin", email: "New.Admin@Example.com", password: PASSWORD, inviteCode: INVITE, ...overrides });

const loginForm = (overrides: Record<string, string> = {}) =>
  form({ email: "someone@example.com", password: PASSWORD, role: "admin", ...overrides });

async function sessionFromCookie() {
  const token = cookieJar.values.get(COOKIE);
  return token ? verifySessionToken(token, SECRET) : null;
}

async function seedAdmin(email = "boss@example.com", username = "boss") {
  const [row] = await db
    .insert(admins)
    .values({ username, email, passwordHash: await hashPassword(PASSWORD) })
    .returning();
  return row;
}

async function seedStudent(email = "student@example.com", username = "student") {
  const [row] = await db
    .insert(students)
    .values({ username, email, passwordHash: await hashPassword(PASSWORD) })
    .returning();
  return row;
}

describe("adminSignup", () => {
  it("creates an admin, signs them in with an admin session, and lands on the dashboard", async () => {
    await expect(adminSignup({}, signupForm())).rejects.toThrow("redirect:/admin");

    const [row] = await db.select().from(admins);
    expect(row.username).toBe("newadmin");
    expect(row.email).toBe("new.admin@example.com");
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, row.passwordHash)).toBe(true);

    expect(await sessionFromCookie()).toEqual({ userId: row.id, username: "newadmin", role: "admin" });
    expect(cookieJar.options.get(COOKIE)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" } satisfies CookieOptions);
  });

  it("accepts any configured code, ignoring surrounding spaces", async () => {
    await expect(adminSignup({}, signupForm({ inviteCode: "  another-invitation-code-long-2  " }))).rejects.toThrow("redirect:/admin");
    expect(await db.select().from(admins)).toHaveLength(1);
  });

  it.each([
    ["a wrong code", { inviteCode: "not-the-right-code-at-all-123" }],
    ["a code that is too short to be configured", { inviteCode: "short" }],
  ])("refuses %s and creates nothing", async (_label, overrides) => {
    const result = await adminSignup({}, signupForm(overrides));

    expect(result.errors?.inviteCode).toEqual(["Invalid invitation code."]);
    expect(await db.select().from(admins)).toHaveLength(0);
    expect(cookieJar.values.size).toBe(0);
  });

  it("requires an invitation code", async () => {
    const result = await adminSignup({}, signupForm({ inviteCode: "   " }));

    expect(result.errors?.inviteCode).toBeDefined();
    expect(await db.select().from(admins)).toHaveLength(0);
  });

  it("registers nobody when no invitation codes are configured", async () => {
    process.env.ADMIN_INVITE_CODES = "";

    const result = await adminSignup({}, signupForm());

    expect(result.errors?.inviteCode).toEqual(["Invalid invitation code."]);
    expect(await db.select().from(admins)).toHaveLength(0);
  });

  it("validates the account details before touching the database", async () => {
    const weak = await adminSignup({}, signupForm({ password: "short" }));
    expect(weak.errors?.password).toBeDefined();

    const badEmail = await adminSignup({}, signupForm({ email: "not-an-email" }));
    expect(badEmail.errors?.email).toBeDefined();

    const badName = await adminSignup({}, signupForm({ username: "has spaces" }));
    expect(badName.errors?.username).toBeDefined();

    expect(await db.select().from(admins)).toHaveLength(0);
  });

  it("does not create a second account for a taken username or email, and does not sign in", async () => {
    await seedAdmin("taken@example.com", "taken");

    const sameEmail = await adminSignup({}, signupForm({ email: "TAKEN@example.com", username: "other" }));
    const sameName = await adminSignup({}, signupForm({ email: "fresh@example.com", username: "taken" }));

    expect(sameEmail.message).toBe("That username or email is already registered.");
    expect(sameName.message).toBe("That username or email is already registered.");
    expect(await db.select().from(admins)).toHaveLength(1);
    expect(cookieJar.values.size).toBe(0);
  });

  it("fails safely, creating no account, when sessions are not configured", async () => {
    delete process.env.SESSION_SECRET;

    const result = await adminSignup({}, signupForm());

    expect(result.message).toBe("Unable to create your account. Please try again.");
    expect(await db.select().from(admins)).toHaveLength(0);
  });
});

describe("login", () => {
  it("signs an admin in with an admin session and sends them to the dashboard", async () => {
    const admin = await seedAdmin("boss@example.com", "boss");

    await expect(login({}, loginForm({ email: "boss@example.com" }))).rejects.toThrow("redirect:/admin");

    expect(await sessionFromCookie()).toEqual({ userId: admin.id, username: "boss", role: "admin" });
  });

  it("ignores the case of the email", async () => {
    await seedAdmin("boss@example.com");

    await expect(login({}, loginForm({ email: "BOSS@Example.COM" }))).rejects.toThrow("redirect:/admin");
  });

  it("signs a student in through the student role and sends them home", async () => {
    const student = await seedStudent("student@example.com", "student");

    await expect(login({}, loginForm({ email: "student@example.com", role: "student" }))).rejects.toThrow("redirect:/");

    expect(await sessionFromCookie()).toEqual({ userId: student.id, username: "student", role: "student" });
  });

  it("does not let a student account log in as an admin, or the reverse", async () => {
    await seedStudent("student@example.com");
    await seedAdmin("boss@example.com");

    const studentAsAdmin = await login({}, loginForm({ email: "student@example.com", role: "admin" }));
    const adminAsStudent = await login({}, loginForm({ email: "boss@example.com", role: "student" }));

    expect(studentAsAdmin.message).toBe("Invalid email, password or account type.");
    expect(adminAsStudent.message).toBe("Invalid email, password or account type.");
    expect(cookieJar.values.size).toBe(0);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await seedAdmin("boss@example.com");

    const wrongPassword = await login({}, loginForm({ email: "boss@example.com", password: "Wrong1234" }));
    const unknownEmail = await login({}, loginForm({ email: "nobody@example.com" }));

    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.message).toBe("Invalid email, password or account type.");
    expect(cookieJar.values.size).toBe(0);
  });

  it("validates the form before reading any account", async () => {
    const badRole = await login({}, loginForm({ role: "superuser" }));
    expect(badRole.errors?.role).toBeDefined();

    const noPassword = await login({}, loginForm({ password: "" }));
    expect(noPassword.errors?.password).toBeDefined();

    const badEmail = await login({}, loginForm({ email: "nope" }));
    expect(badEmail.errors?.email).toBeDefined();
  });

  it("fails safely, without signing in, when sessions are not configured", async () => {
    await seedAdmin("boss@example.com");
    delete process.env.SESSION_SECRET;

    const result = await login({}, loginForm({ email: "boss@example.com" }));

    expect(result.message).toBe("Unable to log in right now. Please try again.");
    expect(cookieJar.values.size).toBe(0);
  });

  it("never stores the password in the session", async () => {
    await seedAdmin("boss@example.com");
    await expect(login({}, loginForm({ email: "boss@example.com" }))).rejects.toThrow("redirect:/admin");

    const token = cookieJar.values.get(COOKIE)!;
    const [, payloadPart] = token.split(".");
    const payload = Buffer.from(payloadPart, "base64url").toString();
    expect(payload).not.toContain(PASSWORD);
    expect(Object.keys(JSON.parse(payload)).sort()).toEqual(["exp", "iat", "role", "userId", "username"]);
  });
});

describe("logout", () => {
  it("ends an admin session and returns to the admin login", async () => {
    const admin = await seedAdmin("boss@example.com", "boss");
    await expect(login({}, loginForm({ email: admin.email }))).rejects.toThrow("redirect:/admin");

    await expect(logout()).rejects.toThrow("redirect:/admin/login");

    expect(cookieJar.deleted).toContain(COOKIE);
    expect(await sessionFromCookie()).toBeNull();
  });

  it("returns a student to the student login", async () => {
    await seedStudent("student@example.com");
    await expect(login({}, loginForm({ email: "student@example.com", role: "student" }))).rejects.toThrow("redirect:/");

    await expect(logout()).rejects.toThrow("redirect:/login");
  });

  it("is safe to call when nobody is signed in", async () => {
    await expect(logout()).rejects.toThrow("redirect:/login");
  });
});
