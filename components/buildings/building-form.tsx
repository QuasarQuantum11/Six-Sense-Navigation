"use client";

import { useActionState, useState } from "react";
import { createBuilding } from "@/app/admins/buildings/actions";
import type { BuildingActionState } from "@/lib/buildings/validation";

const initialState: BuildingActionState = {};

const inputClassName =
  "rounded-md border-2 px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none";

// Google Maps copies coordinates as "latitude, longitude".
const coordinatePairPattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function FieldErrors({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <div id={id}>
      {errors.map((error) => (
        <p key={error} className="text-sm text-red-700">
          {error}
        </p>
      ))}
    </div>
  );
}

export function BuildingForm() {
  const [state, action, pending] = useActionState(createBuilding, initialState);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  function handleCoordinatePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const match = event.clipboardData.getData("text").match(coordinatePairPattern);
    if (!match) return;
    event.preventDefault();
    setLatitude(match[1]);
    setLongitude(match[2]);
  }

  const errors = state.errors;

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Building name
        <input
          className={`${inputClassName} ${errors?.name ? "border-red-500" : "border-primary/30"}`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={errors?.name ? "name-errors" : undefined}
          required
          maxLength={100}
        />
      </label>
      <FieldErrors id="name-errors" errors={errors?.name} />

      <fieldset className="flex flex-col gap-4 rounded-md border-2 border-primary/20 p-4">
        <legend className="px-1 text-sm font-semibold text-primary">
          Location (optional)
        </legend>
        <p id="location-hint" className="text-sm text-muted">
          Right-click the building&apos;s main entrance in Google Maps and paste
          the copied coordinates into either field. Leave both blank if
          you don&apos;t know the location yet.
        </p>

        <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
          Latitude
          <input
            className={`${inputClassName} ${errors?.latitude ? "border-red-500" : "border-primary/30"}`}
            name="latitude"
            inputMode="decimal"
            placeholder="-37.9133"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            onPaste={handleCoordinatePaste}
            aria-invalid={errors?.latitude ? true : undefined}
            aria-describedby={`location-hint${errors?.latitude ? " latitude-errors" : ""}`}
          />
        </label>
        <FieldErrors id="latitude-errors" errors={errors?.latitude} />

        <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
          Longitude
          <input
            className={`${inputClassName} ${errors?.longitude ? "border-red-500" : "border-primary/30"}`}
            name="longitude"
            inputMode="decimal"
            placeholder="145.1328"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            onPaste={handleCoordinatePaste}
            aria-invalid={errors?.longitude ? true : undefined}
            aria-describedby={`location-hint${errors?.longitude ? " longitude-errors" : ""}`}
          />
        </label>
        <FieldErrors id="longitude-errors" errors={errors?.longitude} />
      </fieldset>

      {errors && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          The building wasn&apos;t added. Fix the highlighted fields and try again.
        </p>
      )}

      <button
        className="self-start rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Adding building…" : "Add building"}
      </button>
    </form>
  );
}
