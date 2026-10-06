"use client";

import {
  parseCoordinatePair,
  type BuildingActionState,
  type BuildingInput,
} from "@/lib/buildings/validation";

const inputClassName =
  "rounded-md border-2 px-3 py-2 font-normal text-foreground focus:border-accent focus:outline-none";

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

// Name and location inputs shared by the add-building form and the edit
// popup. `idPrefix` keeps element ids unique when both could be on a page.
export function BuildingFields({
  idPrefix,
  values,
  onChange,
  errors,
  autoFocus = false,
}: {
  idPrefix: string;
  values: BuildingInput;
  onChange: (values: BuildingInput) => void;
  errors?: BuildingActionState["errors"];
  autoFocus?: boolean;
}) {
  const ids = {
    nameErrors: `${idPrefix}-name-errors`,
    hint: `${idPrefix}-location-hint`,
    latitudeErrors: `${idPrefix}-latitude-errors`,
    longitudeErrors: `${idPrefix}-longitude-errors`,
  };

  function handleCoordinatePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pair = parseCoordinatePair(event.clipboardData.getData("text"));
    if (!pair) return;
    event.preventDefault();
    onChange({ ...values, ...pair });
  }

  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
        Building name
        <input
          className={`${inputClassName} ${errors?.name ? "border-red-500" : "border-primary/30"}`}
          name="name"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={errors?.name ? ids.nameErrors : undefined}
          required
          maxLength={100}
          autoFocus={autoFocus}
        />
      </label>
      <FieldErrors id={ids.nameErrors} errors={errors?.name} />

      <fieldset className="flex flex-col gap-4 rounded-md border-2 border-primary/20 p-4">
        <legend className="px-1 text-sm font-semibold text-primary">
          Location (optional)
        </legend>
        <p id={ids.hint} className="text-sm text-muted">
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
            value={values.latitude}
            onChange={(event) => onChange({ ...values, latitude: event.target.value })}
            onPaste={handleCoordinatePaste}
            aria-invalid={errors?.latitude ? true : undefined}
            aria-describedby={`${ids.hint}${errors?.latitude ? ` ${ids.latitudeErrors}` : ""}`}
          />
        </label>
        <FieldErrors id={ids.latitudeErrors} errors={errors?.latitude} />

        <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
          Longitude
          <input
            className={`${inputClassName} ${errors?.longitude ? "border-red-500" : "border-primary/30"}`}
            name="longitude"
            inputMode="decimal"
            placeholder="145.1328"
            value={values.longitude}
            onChange={(event) => onChange({ ...values, longitude: event.target.value })}
            onPaste={handleCoordinatePaste}
            aria-invalid={errors?.longitude ? true : undefined}
            aria-describedby={`${ids.hint}${errors?.longitude ? ` ${ids.longitudeErrors}` : ""}`}
          />
        </label>
        <FieldErrors id={ids.longitudeErrors} errors={errors?.longitude} />
      </fieldset>
    </>
  );
}
