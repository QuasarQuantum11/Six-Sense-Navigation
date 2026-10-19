import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), databaseTouched: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
// The chart pulls in a large charting library that these access checks never render.
vi.mock("@/components/admin/signups-chart", () => ({ SignupsChart: () => null }));
// Any use of the database fails loudly, so these tests can prove that a page
// refused a visitor *before* reading anything.
vi.mock("@/lib/db/client", () => ({
  db: new Proxy(
    {},
    {
      get(_target, key) {
        mocks.databaseTouched(String(key));
        throw new Error("database touched");
      },
    },
  ),
}));

const admin = { userId: "a1", username: "admin", role: "admin" };
const student = { userId: "s1", username: "student", role: "student" };

type PageModule = { default: (props: never) => Promise<unknown> };

// Every admin-only page. Props mimic what Next passes (search params as a promise).
const adminPages: [string, () => Promise<PageModule>][] = [
  ["/admin (dashboard)", () => import("../../../app/admin/page") as Promise<PageModule>],
  ["/admin/feedback", () => import("../../../app/admin/feedback/page") as Promise<PageModule>],
  ["/admin/admins", () => import("../../../app/admin/admins/page") as Promise<PageModule>],
  ["/students", () => import("../../../app/students/page") as Promise<PageModule>],
  ["/admins/buildings", () => import("../../../app/admins/buildings/page") as Promise<PageModule>],
];

const props = { searchParams: Promise.resolve({}), params: Promise.resolve({}) } as never;

// Loading the page modules the first time is slow; do it once, outside any test's time limit.
beforeAll(async () => {
  await Promise.all(adminPages.map(([, load]) => load()));
}, 60_000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(adminPages)("%s", (_path, load) => {
  it("sends a visitor who is not signed in to the admin login, without reading data", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { default: Page } = await load();

    await expect(Page(props)).rejects.toThrow("redirect:/admin/login");
    expect(mocks.databaseTouched).not.toHaveBeenCalled();
  });

  it("does not show a student anything either", async () => {
    mocks.getSession.mockResolvedValue(student);
    const { default: Page } = await load();

    await expect(Page(props)).rejects.toThrow("redirect:/admin/login");
    expect(mocks.databaseTouched).not.toHaveBeenCalled();
  });

  it("lets an admin through to load its data", async () => {
    mocks.getSession.mockResolvedValue(admin);
    const { default: Page } = await load();

    // Getting as far as the database proves the access check passed.
    await expect(Page(props)).rejects.toThrow("database touched");
    expect(mocks.databaseTouched).toHaveBeenCalled();
  });
});

describe("a session with an unexpected role", () => {
  it("is not treated as an admin", async () => {
    mocks.getSession.mockResolvedValue({ userId: "x", username: "x", role: "moderator" });
    const { default: Page } = await load("/admin/admins");

    await expect(Page(props)).rejects.toThrow("redirect:/admin/login");
    expect(mocks.databaseTouched).not.toHaveBeenCalled();
  });
});

async function load(path: string) {
  const entry = adminPages.find(([name]) => name.startsWith(path));
  if (!entry) throw new Error(`unknown page ${path}`);
  return entry[1]();
}
