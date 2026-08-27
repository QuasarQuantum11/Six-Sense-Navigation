import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timetables } from "@/lib/timetables/schema";
import { feedback } from "@/lib/feedback/schema";

// "accessible" is used in place of "slow" to avoid stigmatising the option.
export const walkingSpeedEnum = pgEnum("walking_speed", ["accessible", "normal", "fast"]);

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  profilePicture: text("profile_picture"),
  walkingSpeed: walkingSpeedEnum("walking_speed").notNull().default("normal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  timetables: many(timetables),
  feedback: many(feedback),
}));
