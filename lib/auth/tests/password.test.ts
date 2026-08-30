import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("accepts the original password and rejects a different one", async () => {
    const hash = await hashPassword("accessible-route-123");

    await expect(verifyPassword("accessible-route-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("password", "not-a-valid-hash")).resolves.toBe(false);
  });
});
