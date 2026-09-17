"use client";

import { ChangeEvent, useState } from "react";

type Stop = {
  position: number;
  buildingId: string;
  buildingName: string;
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

export function TimetableSelector({
  timetables = [],
}: {
  timetables?: TimetableOption[];
}) {
  const [manualRows, setManualRows] = useState<ManualClassRow[]>([
    { day: "Monday", time: "", location: "Building name" },
  ]);
  const [saveMessage, setSaveMessage] = useState("");

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

    const text = await file.text();
    const parsedLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1);

    const rows = parsedLines
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 3)
      .map(([day, time, location]) => ({
        day: day || "Monday",
        time: time || "",
        location: location || "",
      }));

    if (rows.length > 0) {
      setManualRows(rows);
      setSaveMessage(`${rows.length} class entries loaded from ${file.name}.`);
      event.target.value = "";
      return;
    }

    setSaveMessage(
      "The file could not be parsed. Please use CSV with day,time,location columns.",
    );
    event.target.value = "";
  };

  const handleSave = () => {
    const validClasses = manualRows.filter(
      (row) => row.day && row.time && row.location.trim(),
    );

    setSaveMessage(
      validClasses.length > 0
        ? `${validClasses.length} timetable entries saved locally.`
        : "Please add at least one class before saving.",
    );
  };

  return (
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
          Upload your class timetable (CSV or iCal format)
        </p>

        <div className="mt-5 flex justify-center">
          <label className="inline-flex cursor-pointer rounded-md bg-accent px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-accent-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
            <input
              type="file"
              accept=".csv,.ics,text/csv,text/calendar"
              className="hidden"
              onChange={handleFileUpload}
            />
            Choose File
          </label>
        </div>
      </div>

      <div className="space-y-4">
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
                  +
                </button>
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
          className="mt-6 w-full rounded-md bg-accent px-4 py-4 text-xl font-bold text-white transition hover:bg-accent-dark"
        >
          Save Preferences
        </button>

        {saveMessage && (
          <p className="mt-3 text-sm text-primary">{saveMessage}</p>
        )}
      </div>
    </div>
  );
}
