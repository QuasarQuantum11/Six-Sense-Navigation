import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { feedback } from "@/lib/feedback/schema";
import { timetables } from "@/lib/timetables/schema";

// "accessible" is used in place of "slow" to avoid stigmatising the option.
export const walkingSpeed = pgEnum("walking_speed", [
  "accessible",
  "normal",
  "fast",
]);

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password").notNull(),
  profilePicture: text("profile_picture"),
  walkingSpeed: walkingSpeed("walking_speed").default("normal").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  timetables: many(timetables),
  feedback: many(feedback),
}));
