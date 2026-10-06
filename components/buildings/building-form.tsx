"use client";

import { useActionState, useState } from "react";
import { createBuilding } from "@/app/admins/buildings/actions";
import { BuildingFields } from "@/components/buildings/building-fields";
import type { BuildingActionState } from "@/lib/buildings/validation";

const initialState: BuildingActionState = {};

export function BuildingForm() {
  const [state, action, pending] = useActionState(createBuilding, initialState);
  const [values, setValues] = useState({ name: "", latitude: "", longitude: "" });

  return (
    <form action={action} className="flex flex-col gap-5">
      <BuildingFields
        idPrefix="new-building"
        values={values}
        onChange={setValues}
        errors={state.errors}
      />

      {state.errors && (
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
