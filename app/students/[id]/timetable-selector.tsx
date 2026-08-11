"use client";

import { useState } from "react";

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

export function TimetableSelector({
  timetables,
}: {
  timetables: TimetableOption[];
}) {
  const [selectedId, setSelectedId] = useState(timetables[0]?.id ?? "");

  if (timetables.length === 0) {
    return (
      <p className="text-zinc-500 dark:text-zinc-500">No timetables yet.</p>
    );
  }

  const selected =
    timetables.find((t) => t.id === selectedId) ?? timetables[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="timetable"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Timetable
        </label>
        <select
          id="timetable"
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full max-w-xs rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        >
          {timetables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="bg-black/[.03] dark:bg-white/[.06]">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Position
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Building
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.08] dark:divide-white/[.145]">
            {selected.stops.map((stop) => (
              <tr key={`${selected.id}-${stop.position}-${stop.buildingId}`}>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {stop.position}
                </td>
                <td className="px-4 py-3 text-black dark:text-zinc-50">
                  {stop.buildingName}
                </td>
              </tr>
            ))}
            {selected.stops.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-500"
                >
                  No buildings in this timetable.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
