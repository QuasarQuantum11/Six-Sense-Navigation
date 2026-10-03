"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { buildings } from "@/lib/timetables/schema";
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
      return { message: "Building not found. It may have been deleted." };
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

export async function deleteBuilding(buildingId: string) {
  await requireAdmin();

  if (!buildingIdSchema.safeParse(buildingId).success) {
    throw new Error("Building not found.");
  }

  // Timetable entries for this building are removed by the ON DELETE CASCADE
  // on timetable_buildings.building_id.
  const deleted = await db
    .delete(buildings)
    .where(eq(buildings.id, buildingId))
    .returning({ id: buildings.id });

  if (deleted.length === 0) {
    throw new Error("Building not found. It may have already been deleted.");
  }

  revalidatePath("/admins/buildings");
}
