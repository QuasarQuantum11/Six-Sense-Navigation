import { sql } from "drizzle-orm";
import { check, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { students } from "@/lib/students/schema";
import { timetables } from "@/lib/timetables/schema";

export const crowdParticipation = pgTable("crowd_participation", {
  studentId: uuid("student_id").primaryKey().references(() => students.id, { onDelete: "cascade" }),
  timetableId: uuid("timetable_id").notNull().references(() => timetables.id, { onDelete: "cascade" }),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  index("crowd_participation_timetable_idx").on(table.timetableId),
  check("crowd_participation_valid_period", sql`${table.expiresAt} > ${table.consentedAt} AND ${table.expiresAt} <= ${table.consentedAt} + INTERVAL '168 hours'`),
]);
