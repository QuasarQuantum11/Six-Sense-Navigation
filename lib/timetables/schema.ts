import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { students } from "@/lib/students/schema";

export const buildings = pgTable("buildings", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timetables = pgTable("timetables", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for the many-to-many relationship between timetables and
// buildings. A row represents one class/stop in a timetable, so the same
// building can appear multiple times (e.g. two classes in the same
// building) at different `position`s.
export const timetableBuildings = pgTable(
  "timetable_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    timetableId: uuid("timetable_id")
      .notNull()
      .references(() => timetables.id, { onDelete: "cascade" }),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("timetable_buildings_timetable_id_position_idx").on(
      table.timetableId,
      table.position,
    ),
  ],
);

export const buildingsRelations = relations(buildings, ({ many }) => ({
  timetableBuildings: many(timetableBuildings),
}));

export const timetablesRelations = relations(timetables, ({ one, many }) => ({
  student: one(students, {
    fields: [timetables.studentId],
    references: [students.id],
  }),
  timetableBuildings: many(timetableBuildings),
}));

export const timetableBuildingsRelations = relations(timetableBuildings, ({ one }) => ({
  timetable: one(timetables, {
    fields: [timetableBuildings.timetableId],
    references: [timetables.id],
  }),
  building: one(buildings, {
    fields: [timetableBuildings.buildingId],
    references: [buildings.id],
  }),
}));
