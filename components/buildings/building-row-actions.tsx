"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  deleteBuilding,
  mergeBuilding,
  updateBuilding,
} from "@/app/admins/buildings/actions";
import { BuildingFields } from "@/components/buildings/building-fields";
import type {
  BuildingActionState,
  BuildingInput,
} from "@/lib/buildings/validation";

type Mode = "closed" | "edit" | "delete" | "merge";

type BuildingSummary = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

const hasLocation = (building: BuildingSummary) =>
  building.latitude !== null && building.longitude !== null;

function toInput(building: BuildingSummary): BuildingInput {
  return {
    name: building.name,
    latitude: building.latitude === null ? "" : String(building.latitude),
    longitude: building.longitude === null ? "" : String(building.longitude),
  };
}

export function BuildingRowActions({
  building,
  allBuildings,
}: {
  building: BuildingSummary & { timetableEntries: number };
  // Every building, used to choose what to merge this one into.
  allBuildings: BuildingSummary[];
}) {
  const [mode, setMode] = useState<Mode>("closed");
  const [draft, setDraft] = useState<BuildingInput>(() => toInput(building));
  const [result, setResult] = useState<BuildingActionState>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const mergeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const mergeSelectId = useId();

  const mergeTargets = allBuildings
    .filter((other) => other.id !== building.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const mergeTarget = mergeTargets.find((other) => other.id === mergeTargetId);

  function openEdit() {
    setDraft(toInput(building));
    setResult({});
    setMode("edit");
  }

  function openDelete() {
    setDeleteError(null);
    setMode("delete");
  }

  function openMerge() {
    setMergeTargetId("");
    setMergeError(null);
    setMode("merge");
  }

  function closeModal() {
    // Return focus to the button that opened the popup.
    const openedBy = { edit: editButtonRef, delete: deleteButtonRef, merge: mergeButtonRef };
    if (mode !== "closed") openedBy[mode].current?.focus();
    setMode("closed");
  }

  useEffect(() => {
    if (mode === "closed") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) closeModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({});
    startTransition(async () => {
      try {
        const saved = await updateBuilding(building.id, draft);
        if (saved.errors || saved.message) {
          setResult(saved);
        } else {
          closeModal();
        }
      } catch {
        setResult({ message: "Something went wrong. Please try again." });
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deleteBuilding(building.id);
        setMode("closed");
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleMerge() {
    if (!mergeTarget) return;
    setMergeError(null);
    startTransition(async () => {
      try {
        await mergeBuilding(building.id, mergeTarget.id);
        // This row no longer exists, so there's no button to return focus to.
        setMode("closed");
      } catch (err) {
        setMergeError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const entries = building.timetableEntries;
  const entriesLabel = `${entries} timetable ${entries === 1 ? "entry" : "entries"}`;

  const original = toInput(building);
  const isDirty =
    draft.name.trim().length > 0 &&
    (draft.name.trim() !== original.name ||
      draft.latitude.trim() !== original.latitude ||
      draft.longitude.trim() !== original.longitude);

  return (
    <>
      <div className="flex gap-2">
        <button
          ref={editButtonRef}
          type="button"
          onClick={openEdit}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          Edit<span className="sr-only"> {building.name}</span>
        </button>
        <button
          ref={deleteButtonRef}
          type="button"
          onClick={openDelete}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Delete<span className="sr-only"> {building.name}</span>
        </button>
        <button
          ref={mergeButtonRef}
          type="button"
          onClick={openMerge}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Merge<span className="sr-only"> {building.name}</span>
        </button>
      </div>

      {mode === "edit" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-primary bg-white p-6 shadow-lg"
            >
              <h2 id={titleId} className="mb-4 text-lg font-bold text-primary">
                Edit building
              </h2>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <BuildingFields
                  idPrefix={`edit-${building.id}`}
                  values={draft}
                  onChange={setDraft}
                  errors={result.errors}
                  autoFocus
                />
                {result.message && (
                  <p role="alert" className="text-sm text-red-700">
                    {result.message}
                  </p>
                )}
                {result.errors && (
                  <p role="alert" className="sr-only">
                    The building wasn&apos;t saved. Fix the highlighted fields and try again.
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isPending}
                    className="text-sm font-semibold text-accent hover:text-accent-dark"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isDirty || isPending}
                    className="rounded-md bg-accent px-6 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {mode === "delete" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-md rounded-lg border-2 border-primary bg-white p-6 shadow-lg"
            >
              <h2 id={titleId} className="mb-4 text-lg font-bold text-primary">
                Delete {building.name}
              </h2>
              <p className="text-sm text-foreground">
                Are you sure you want to delete this building? This action
                cannot be undone.
              </p>
              {building.timetableEntries > 0 && (
                <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  This building is used by {building.timetableEntries} timetable{" "}
                  {building.timetableEntries === 1 ? "entry" : "entries"}.
                  Deleting it will also remove{" "}
                  {building.timetableEntries === 1 ? "that class" : "those classes"}{" "}
                  from students&apos; timetables. To fix a misspelt name, edit the
                  building instead.
                </p>
              )}
              {deleteError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {deleteError}
                </p>
              )}
              <div className="mt-6 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  autoFocus
                  className="text-sm font-semibold text-accent hover:text-accent-dark"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mode === "merge" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border-2 border-primary bg-white p-6 shadow-lg"
            >
              <h2 id={titleId} className="mb-4 text-lg font-bold text-primary">
                Merge {building.name}
              </h2>
              <p className="text-sm text-foreground">
                Use this when {building.name} is a duplicate of another
                building, such as an abbreviation or misspelling. Its timetable
                entries move to the building you choose, and {building.name} is
                then deleted.
              </p>

              {mergeTargets.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  There are no other buildings to merge into.
                </p>
              ) : (
                <label
                  htmlFor={mergeSelectId}
                  className="mt-4 flex flex-col gap-2 text-sm font-semibold text-primary"
                >
                  Merge into
                  <select
                    id={mergeSelectId}
                    value={mergeTargetId}
                    onChange={(event) => setMergeTargetId(event.target.value)}
                    autoFocus
                    className="rounded-md border-2 border-primary/30 bg-white px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="">Choose a building</option>
                    {mergeTargets.map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mergeTarget && (
                <ul
                  aria-live="polite"
                  className="mt-4 list-disc space-y-1 rounded-md bg-red-50 p-3 pl-7 text-sm text-red-800"
                >
                  <li>
                    {entries > 0
                      ? `${entriesLabel} will move to ${mergeTarget.name}.`
                      : `No timetable entries use ${building.name}.`}
                  </li>
                  {hasLocation(building) && !hasLocation(mergeTarget) && (
                    <li>
                      {mergeTarget.name} has no location, so it will take{" "}
                      {building.name}&apos;s location.
                    </li>
                  )}
                  {hasLocation(building) && hasLocation(mergeTarget) && (
                    <li>
                      {mergeTarget.name} keeps its own location;{" "}
                      {building.name}&apos;s is discarded.
                    </li>
                  )}
                  <li>
                    {building.name} will be deleted. This cannot be undone.
                  </li>
                </ul>
              )}

              {mergeError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {mergeError}
                </p>
              )}
              <div className="mt-6 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="text-sm font-semibold text-accent hover:text-accent-dark"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={!mergeTarget || isPending}
                  className="rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Merging..." : "Merge"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
