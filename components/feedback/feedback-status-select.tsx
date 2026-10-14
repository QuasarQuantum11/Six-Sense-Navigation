"use client";

import { useId, useState, useTransition } from "react";
import { updateFeedbackStatus } from "@/app/admin/feedback/actions";
import {
  FEEDBACK_STATUSES,
  feedbackStatusLabels,
  type FeedbackStatus,
} from "@/lib/feedback/status";

export function FeedbackStatusSelect({
  feedbackId,
  status,
}: {
  feedbackId: string;
  status: FeedbackStatus;
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = useId();

  function handleChange(next: FeedbackStatus) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateFeedbackStatus(feedbackId, next);
        if (result.error) {
          setCurrent(previous);
          setError(result.error);
        }
      } catch {
        setCurrent(previous);
        setError("Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value as FeedbackStatus)}
        disabled={isPending}
        aria-label="Feedback status"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="rounded-md border-2 border-primary bg-white px-2 py-1 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {FEEDBACK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {feedbackStatusLabels[value]}
          </option>
        ))}
      </select>
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "Saving status" : ""}
      </span>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
