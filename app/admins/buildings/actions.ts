"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { buildings } from "@/lib/timetables/schema";
import { requireAdmin } from "@/lib/auth/dal";
import {
  buildingSchema,
  type BuildingActionState,
} from "@/lib/buildings/validation";

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
  const duplicateError = {
    errors: { name: [`A building named "${name}" already exists`] },
  };

  // The unique constraint is case-sensitive, so also catch "library" vs "Library".
  const existing = await db.query.buildings.findFirst({
    where: sql`lower(${buildings.name}) = lower(${name})`,
  });
  if (existing) {
    return duplicateError;
  }

  const inserted = await db
    .insert(buildings)
    .values({ name, latitude, longitude })
    .onConflictDoNothing({ target: buildings.name })
    .returning({ id: buildings.id });

  if (inserted.length === 0) {
    return duplicateError;
  }

  revalidatePath("/admins/buildings");
  redirect("/admins/buildings");
}
