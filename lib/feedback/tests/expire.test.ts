import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: { update: mocks.update } }));

import { expireStaleFeedback } from "../expire";
import { FEEDBACK_STATUSES, feedbackStatusLabels } from "../status";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockReturnValue({ returning: mocks.returning });
});

describe("expireStaleFeedback", () => {
  it("moves stale new feedback to not_reviewed without touching updatedAt", async () => {
    mocks.returning.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const count = await expireStaleFeedback(new Date("2026-10-07T00:00:00Z"));
    expect(count).toBe(2);
    expect(mocks.set).toHaveBeenCalledWith({ status: "not_reviewed" });
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when nothing is stale", async () => {
    mocks.returning.mockResolvedValue([]);
    expect(await expireStaleFeedback()).toBe(0);
  });
});

describe("feedback statuses", () => {
  it("includes not_reviewed with a label", () => {
    expect(FEEDBACK_STATUSES).toContain("not_reviewed");
    expect(feedbackStatusLabels.not_reviewed).toBe("Not reviewed");
  });
});
