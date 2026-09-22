import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "../token";

const secret = "test-session-secret-that-is-long-enough";

describe("session tokens", () => {
  it("round-trips a valid session payload", async () => {
    const payload = {
      userId: "student-id",
      username: "alice",
      role: "student" as const,
    };
    const token = await signSessionToken(
      payload,
      secret,
      new Date(Date.now() + 60_000),
    );

    await expect(verifySessionToken(token, secret)).resolves.toEqual(payload);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSessionToken(
      { userId: "admin-id", username: "admin", role: "admin" },
      secret,
      new Date(Date.now() + 60_000),
    );

    await expect(
      verifySessionToken(token, "different-session-secret-that-is-long"),
    ).resolves.toBeNull();
  });
});
