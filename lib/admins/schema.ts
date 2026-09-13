import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
