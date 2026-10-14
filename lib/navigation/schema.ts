import { bigint, boolean, doublePrecision, integer, pgTable, text } from "drizzle-orm/pg-core";

export const navigationNodes = pgTable("navigation_nodes", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  streetCount: integer("street_count"),
});

export const navigationEdges = pgTable("navigation_edges", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  fromNode: bigint("from_node", { mode: "number" }).notNull(),
  toNode: bigint("to_node", { mode: "number" }).notNull(),
  osmid: bigint("osmid", { mode: "number" }),
  highway: text("highway"),
  lanes: text("lanes"),
  maxspeed: text("maxspeed"),
  name: text("name"),
  oneway: boolean("oneway"),
  ref: text("ref"),
  reversed: boolean("reversed"),
  length: doublePrecision("length").notNull(),
  weight: doublePrecision("weight"),
  geometry: text("geometry"),
});