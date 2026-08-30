import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { students } from "@/lib/students/schema";

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "new",
  "in_review",
  "resolved",
  "dismissed",
]);

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nullable so unregistered (guest) users can also submit feedback.
  // Set null (not cascade) on delete so an admin's feedback history/audit
  // trail survives the student account being removed.
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: feedbackStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const feedbackRelations = relations(feedback, ({ one }) => ({
  student: one(students, {
    fields: [feedback.studentId],
    references: [students.id],
  }),
}));
