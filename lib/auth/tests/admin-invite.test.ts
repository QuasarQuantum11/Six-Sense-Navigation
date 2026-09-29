import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isValidAdminInvite } from "../admin-invite";

afterEach(() => vi.unstubAllEnvs());

describe("administrator invitation allowlist", () => {
  const first = "0123456789abcdef0123456789abcdef";
  const second = "fedcba9876543210fedcba9876543210";

  it("accepts only configured, sufficiently long codes", () => {
    vi.stubEnv("ADMIN_INVITE_CODES", `${first}, ${second}, short`);

    expect(isValidAdminInvite(first)).toBe(true);
    expect(isValidAdminInvite(second)).toBe(true);
    expect(isValidAdminInvite("short")).toBe(false);
    expect(isValidAdminInvite("not-in-the-allowlist-at-all")).toBe(false);
  });

  it("disables registration when no codes are configured", () => {
    vi.stubEnv("ADMIN_INVITE_CODES", "");
    expect(isValidAdminInvite(first)).toBe(false);
  });
});
