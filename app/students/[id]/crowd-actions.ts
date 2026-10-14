"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { timetables } from "@/lib/timetables/schema";
import { crowdParticipation } from "@/lib/crowd/schema";
import { isMissingCrowdTable, readParticipation, type ParticipationStatus } from "@/lib/crowd/data";
import { PARTICIPATION_MS } from "@/lib/crowd/time";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), timetableId: z.string().uuid(), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("stop") }).strict(),
]);

export async function setCrowdParticipation(input: unknown): Promise<{ success: boolean; message: string; status?: ParticipationStatus }> {
  const session = await getSession();
  if (!session || session.role !== "student") return { success: false, message: "Only signed-in students can manage their own participation." };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Select your timetable and explicitly confirm participation for seven days." };
  try {
    if (parsed.data.action === "stop") {
      await db.delete(crowdParticipation).where(eq(crowdParticipation.studentId, session.userId));
    } else {
      const timetableId = parsed.data.timetableId;
      const now = new Date();
      await db.transaction(async tx => {
        // Hold the selected timetable against concurrent deletion while authorising it.
        const owned = await tx.select({ id: timetables.id }).from(timetables)
          .where(and(eq(timetables.id, timetableId), eq(timetables.studentId, session.userId))).for("update");
        if (owned.length !== 1) throw new Error("NOT_OWNER");
        const values = { studentId: session.userId, timetableId, consentedAt: now, expiresAt: new Date(now.getTime() + PARTICIPATION_MS) };
        await tx.insert(crowdParticipation).values(values).onConflictDoUpdate({ target: crowdParticipation.studentId, set: values });
      });
    }
    revalidatePath(`/students/${session.userId}`);
    return { success: true, message: parsed.data.action === "stop" ? "Participation stopped. Your timetable is still saved." : "Your selected timetable participates for the next seven days. You can stop at any time.", status: await readParticipation(session.userId) };
  } catch (error) {
    return { success: false, message: error instanceof Error && error.message === "NOT_OWNER" ? "Choose one of your own saved timetables." : isMissingCrowdTable(error) ? "Crowd participation has not been set up on this deployment yet." : "Could not change participation. Please try again." };
  }
}
