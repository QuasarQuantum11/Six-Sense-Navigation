"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateFeedback } from "@/app/students/[id]/feedback/actions";

export function FeedbackRowActions({
  feedbackId,
  message,
}: {
  feedbackId: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(message);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setDraft(message);
    setError(null);
    setOpen(true);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateFeedback(feedbackId, draft);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const isDirty = draft.trim().length > 0 && draft.trim() !== message.trim();

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openModal}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
        >
          Edit
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-muted"
        >
          Delete
        </button>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg border-2 border-primary bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-bold text-primary">
                Edit feedback
              </h2>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                autoFocus
                className="w-full rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground"
              />
              {error && (
                <p className="mt-2 text-sm text-red-700">{error}</p>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm font-semibold text-accent hover:text-accent-dark"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || isPending}
                  className="rounded-md bg-accent px-6 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Change Feedback"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
