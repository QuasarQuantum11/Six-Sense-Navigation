"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { buildings, timetableBuildings } from "@/lib/timetables/schema";
import { requireAdmin } from "@/lib/auth/dal";
import {
  buildingSchema,
  type BuildingActionState,
  type BuildingInput,
} from "@/lib/buildings/validation";

const buildingIdSchema = z.uuid();

function duplicateNameError(name: string): BuildingActionState {
  return { errors: { name: [`A building named "${name}" already exists`] } };
}

// The unique constraint is case-sensitive, so also catch "library" vs "Library".
async function nameIsTaken(name: string, excludeId?: string) {
  const sameName = sql`lower(${buildings.name}) = lower(${name})`;
  const existing = await db.query.buildings.findFirst({
    where: excludeId ? and(sameName, ne(buildings.id, excludeId)) : sameName,
  });
  return existing !== undefined;
}

// Drizzle wraps driver errors, so the Postgres code may be on `cause`.
function isUniqueViolation(error: unknown) {
  const code = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value
      ? value.code
      : undefined;
  return (
    code(error) === "23505" ||
    (error instanceof Error && code(error.cause) === "23505")
  );
}

export async function createBuilding(
  _state: BuildingActionState,
  formData: FormData,
): Promise<BuildingActionState> {
  // Server actions can be called directly, so check here as well as on the page.
  await requireAdmin();

  const result = buildingSchema.safeParse({
    name: formData.get("name") ?? "",
    latitude: formData.get("latitude") ?? "",
    longitude: formData.get("longitude") ?? "",
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { name, latitude, longitude } = result.data;

  if (await nameIsTaken(name)) {
    return duplicateNameError(name);
  }

  const inserted = await db
    .insert(buildings)
    .values({ name, latitude, longitude })
    .onConflictDoNothing({ target: buildings.name })
    .returning({ id: buildings.id });

  if (inserted.length === 0) {
    return duplicateNameError(name);
  }

  revalidatePath("/admins/buildings");
  redirect("/admins/buildings");
}

export async function updateBuilding(
  buildingId: string,
  input: BuildingInput,
): Promise<BuildingActionState> {
  await requireAdmin();

  if (!buildingIdSchema.safeParse(buildingId).success) {
    return { message: "Building not found." };
  }

  const result = buildingSchema.safeParse(input);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { name, latitude, longitude } = result.data;

  if (await nameIsTaken(name, buildingId)) {
    return duplicateNameError(name);
  }

  try {
    const updated = await db
      .update(buildings)
      .set({ name, latitude, longitude })
      .where(eq(buildings.id, buildingId))
      .returning({ id: buildings.id });

    if (updated.length === 0) {
      return { message: "Building not found. It may have been merged into another building." };
    }
  } catch (error) {
    // Another admin may have taken the name since the check above.
    if (isUniqueViolation(error)) {
      return duplicateNameError(name);
    }
    throw error;
  }

  revalidatePath("/admins/buildings");
  return {};
}

// Merges a duplicate building into another: the duplicate's timetable entries
// move to the kept building, then the duplicate is deleted. The kept building
// keeps its own name and location, but takes the duplicate's location if it
// has none.
export async function mergeBuilding(duplicateId: string, keepId: string) {
  await requireAdmin();

  if (
    !buildingIdSchema.safeParse(duplicateId).success ||
    !buildingIdSchema.safeParse(keepId).success
  ) {
    throw new Error("Building not found.");
  }
  if (duplicateId === keepId) {
    throw new Error("Choose a different building to merge into.");
  }

  await db.transaction(async (tx) => {
    // Lock both rows so a concurrent edit or merge can't interleave.
    const rows = await tx
      .select()
      .from(buildings)
      .where(inArray(buildings.id, [duplicateId, keepId]))
      .for("update");
    const duplicate = rows.find((row) => row.id === duplicateId);
    const keep = rows.find((row) => row.id === keepId);
    if (!duplicate || !keep) {
      throw new Error("Building not found. It may have been merged already.");
    }

    await tx
      .update(timetableBuildings)
      .set({ buildingId: keepId })
      .where(eq(timetableBuildings.buildingId, duplicateId));

    const keepHasLocation = keep.latitude !== null && keep.longitude !== null;
    const duplicateHasLocation =
      duplicate.latitude !== null && duplicate.longitude !== null;
    if (!keepHasLocation && duplicateHasLocation) {
      await tx
        .update(buildings)
        .set({ latitude: duplicate.latitude, longitude: duplicate.longitude })
        .where(eq(buildings.id, keepId));
    }

    await tx.delete(buildings).where(eq(buildings.id, duplicateId));
  });

  revalidatePath("/admins/buildings");
}
