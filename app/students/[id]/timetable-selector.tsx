"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { deleteTimetable, saveTimetable } from "./timetable-actions";
import { parseAllocatePlusWorkbook } from "@/lib/timetables/allocate-plus";

type Stop = {
  position: number;
  buildingId: string;
  buildingName: string;
  dayOfWeek: string | null;
  startTime: string | null;
  subjectCode: string | null;
  subjectDescription: string | null;
  classGroup: string | null;
  activity: string | null;
  campus: string | null;
  sourceLocation: string | null;
  room: string | null;
  staff: string | null;
  duration: string | null;
  classDates: string | null;
};

type TimetableOption = {
  id: string;
  name: string;
  stops: Stop[];
};

type ManualClassRow = {
  day: string;
  time: string;
  location: string;
  subjectCode?: string;
  subjectDescription?: string;
  classGroup?: string;
  activity?: string;
  campus?: string;
  sourceLocation?: string;
  room?: string;
  staff?: string;
  duration?: string;
  classDates?: string;
};

const defaultDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatTime(time: string | null) {
  if (!time) {
    return "—";
  }
  // Postgres "time" values come back as "HH:MM:SS"; drop the seconds.
  return time.slice(0, 5);
}

export function TimetableSelector({
  studentId,
  timetables = [],
}: {
  studentId: string;
  timetables?: TimetableOption[];
}) {
  const [timetableName, setTimetableName] = useState("My Timetable");
  const [manualRows, setManualRows] = useState<ManualClassRow[]>([
    { day: "Monday", time: "", location: "" },
  ]);
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const updateManualRow = (
    index: number,
    field: keyof ManualClassRow,
    value: string,
  ) => {
    setManualRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addManualRow = () => {
    setManualRows((currentRows) => [
      ...currentRows,
      { day: "Monday", time: "", location: "" },
    ]);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rows = parseAllocatePlusWorkbook(await file.arrayBuffer());
      setManualRows(rows);
      setSaveMessage(
        `Imported ${rows.length} classes from ${file.name}. Review them below, then save.`,
      );
      event.target.value = "";
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Could not read this Allocate+ workbook.",
      );
      event.target.value = "";
    }
  };

  const handleSave = () => {
    const validClasses = manualRows.filter(
      (row) => row.day && row.time && row.location.trim(),
    );

    if (validClasses.length === 0) {
      setSaveMessage("Please add at least one class before saving.");
      return;
    }

    startTransition(async () => {
      try {
        await saveTimetable(studentId, timetableName, validClasses);
        setSaveMessage(
          `Saved "${timetableName}" with ${validClasses.length} classes.`,
        );
        setManualRows([{ day: "Monday", time: "", location: "" }]);
      } catch (error) {
        setSaveMessage(
          error instanceof Error ? error.message : "Failed to save timetable.",
        );
      }
    });
  };

  const handleDelete = (timetableId: string, name: string) => {
    startTransition(async () => {
      try {
        await deleteTimetable(studentId, timetableId);
        setSaveMessage(`Deleted "${name}".`);
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : "Failed to delete timetable.",
        );
      }
    });
  };

  return (
    <div className="w-full space-y-6">
      {timetables.length > 0 && (
        <div className="w-full rounded-[20px] border-2 border-primary bg-white p-4 sm:p-8">
          <h2 className="mb-4 text-lg font-bold text-primary">
            Saved timetables
          </h2>
          <div className="space-y-4">
            {timetables.map((timetable) => (
              <div
                key={timetable.id}
                className="rounded-lg border-2 border-primary/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-primary">
                    {timetable.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(timetable.id, timetable.name)}
                    disabled={isPending}
                    className="text-sm font-semibold text-accent hover:text-accent-dark disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  {[...timetable.stops]
                    .sort((a, b) => a.position - b.position)
                    .map((stop) => (
                      <li
                        key={`${timetable.id}-${stop.position}`}
                        className="grid grid-cols-[6rem_4rem_1fr] gap-x-2 gap-y-1"
                      >
                        <span className="w-24 font-medium">
                          {stop.dayOfWeek ?? "—"}
                        </span>
                        <span className="w-16">
                          {formatTime(stop.startTime)}
                        </span>
                        <span>
                          {stop.buildingName}{stop.room ? `, ${stop.room}` : ""}
                        </span>
                        {(stop.subjectCode || stop.subjectDescription || stop.activity) && (
                          <span className="col-span-3 text-xs text-muted">
                            {[stop.subjectCode, stop.subjectDescription, stop.classGroup, stop.activity]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        {stop.classDates && (
                          <span className="col-span-3 text-xs text-muted">
                            Classes: {stop.classDates}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full rounded-[20px] border-2 border-primary bg-[#eaf6ff] p-4 sm:p-8">
        <div className="mb-6 rounded-[18px] border-2 border-dashed border-primary bg-[#edf8ff] p-4 sm:p-8">
          <div className="flex justify-center">
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-2 rounded-md border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
              aria-label="Preview timetable upload"
            >
              <span aria-hidden="true">↑</span>
              <span>Preview</span>
            </button>
          </div>

          <p className="text-center text-base text-primary">
            Upload an Allocate+ Excel timetable (.xls or .xlsx)
          </p>

          <div className="mt-5 flex justify-center">
            <label className="inline-flex cursor-pointer rounded-md bg-accent px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-accent-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
              <input
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileUpload}
              />
              Choose File
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="timetable-name"
              className="mb-1 block text-sm font-semibold text-primary"
            >
              Timetable name
            </label>
            <input
              id="timetable-name"
              type="text"
              value={timetableName}
              onChange={(event) => setTimetableName(event.target.value)}
              className="w-full rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground sm:w-64"
            />
          </div>

          <p className="text-lg font-medium text-primary">
            Or manually add your classes below
          </p>

          <div className="overflow-hidden rounded-lg border-2 border-primary bg-white">
            <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 border-b-2 border-primary bg-[#f3f9ff] px-3 py-3 text-sm font-bold text-primary">
              <span>DAY</span>
              <span>TIME</span>
              <span>LOCATION</span>
              <span className="text-right"> </span>
            </div>

            <div className="space-y-3 p-3">
              {manualRows.map((row, index) => (
                <div
                  key={`${row.day}-${row.time}-${row.location}-${index}`}
                  className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-center gap-2"
                >
                  <select
                    aria-label={`Day for class ${index + 1}`}
                    value={row.day}
                    onChange={(event) =>
                      updateManualRow(index, "day", event.target.value)
                    }
                    className="rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground"
                  >
                    {defaultDays.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>

                  <input
                    type="time"
                    aria-label={`Time for class ${index + 1}`}
                    value={row.time}
                    onChange={(event) =>
                      updateManualRow(index, "time", event.target.value)
                    }
                    className="rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground"
                  />

                  <input
                    type="text"
                    aria-label={`Location for class ${index + 1}`}
                    value={row.location}
                    onChange={(event) =>
                      updateManualRow(index, "location", event.target.value)
                    }
                    placeholder="Building name"
                    className="rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setManualRows((currentRows) =>
                        currentRows.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                    className="rounded-md bg-accent px-4 py-2 text-lg font-bold text-white transition hover:bg-accent-dark"
                    aria-label={`Remove class ${index + 1}`}
                  >
                    ×
                  </button>
                  {(row.subjectCode || row.subjectDescription || row.activity || row.classDates || row.sourceLocation) && (
                    <p className="col-span-4 text-xs text-muted">
                      {[row.subjectCode, row.subjectDescription, row.classGroup, row.activity]
                        .filter(Boolean)
                        .join(" · ")}
                      {row.room ? ` · Room ${row.room}` : ""}
                      {row.duration ? ` · ${row.duration}` : ""}
                      {row.classDates ? ` · ${row.classDates}` : ""}
                      {row.sourceLocation ? ` · Allocate+ location: ${row.sourceLocation}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addManualRow}
              className="rounded-md border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-sky-50"
            >
              + Add row
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="mt-6 w-full rounded-md bg-accent px-4 py-4 text-xl font-bold text-white transition hover:bg-accent-dark disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Preferences"}
          </button>

          {saveMessage && (
            <p className="mt-3 text-sm text-primary">{saveMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
