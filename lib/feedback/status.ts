import { feedbackStatus } from "@/lib/feedback/schema";

export const FEEDBACK_STATUSES = feedbackStatus.enumValues;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  in_review: "In review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

// Feedback submitted within this many days counts as "recent" and is tagged New.
export const RECENT_FEEDBACK_DAYS = 7;

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (
    typeof value === "string" &&
    (FEEDBACK_STATUSES as readonly string[]).includes(value)
  );
}

export function isRecentFeedback(createdAt: Date, now: Date = new Date()) {
  const windowMs = RECENT_FEEDBACK_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - createdAt.getTime() <= windowMs;
}
