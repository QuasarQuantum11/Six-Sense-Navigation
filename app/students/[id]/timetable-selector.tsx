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
    return <p className="text-muted">No timetables yet.</p>;
  }

  const selected =
    timetables.find((t) => t.id === selectedId) ?? timetables[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="timetable"
          className="text-sm font-semibold text-primary"
        >
          Timetable
        </label>
        <select
          id="timetable"
          value={selected.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full max-w-xs rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground"
        >
          {timetables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border-2 border-primary">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="bg-panel">
            <tr>
              <th className="px-4 py-3 font-semibold text-primary">
                Position
              </th>
              <th className="px-4 py-3 font-semibold text-primary">
                Building
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/20">
            {selected.stops.map((stop) => (
              <tr key={`${selected.id}-${stop.position}-${stop.buildingId}`}>
                <td className="px-4 py-3 text-muted">{stop.position}</td>
                <td className="px-4 py-3 text-foreground">
                  {stop.buildingName}
                </td>
              </tr>
            ))}
            {selected.stops.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-muted">
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
