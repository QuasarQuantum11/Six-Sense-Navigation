import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { feedbackStatus } from "@/lib/feedback/schema";
import { walkingSpeed } from "@/lib/students/schema";
import { dayOfWeek } from "@/lib/timetables/schema";
import {
  MIGRATIONS_DIR,
  createTestDatabase,
  journaledMigrationFiles,
  migrationFiles,
  schema,
} from "@/lib/test-utils/test-database";

// Guards against the database and the code drifting apart. Two mistakes this
// project has already made are caught here: a migration file that was written
// but not added to drizzle/meta/_journal.json (so `npm run db:migrate` silently
// skips it), and a schema change with no migration at all.
//
// Gaps that exist today are listed explicitly below. The tests fail if a NEW gap
// appears, and also if one of these is fixed but left in the list, so the lists
// can only shrink.

// Migration files that exist but are not in the journal, so `db:migrate` does not run them.
// Fix by adding them to the journal (check they are safe to re-run first: 0003_round_killraven
// has no IF NOT EXISTS), then delete the entry here.
const KNOWN_UNJOURNALED_FILES = [
  "0003_add_building_coordinates.sql",
  "0003_round_killraven.sql",
];

// Columns a database built from the journal alone would be missing. They are only
// created by the unjournaled files above.
const MISSING_WITHOUT_UNJOURNALED_FILES = [
  "buildings.latitude",
  "buildings.longitude",
  "timetable_buildings.activity",
  "timetable_buildings.campus",
  "timetable_buildings.class_dates",
  "timetable_buildings.class_group",
  "timetable_buildings.duration",
  "timetable_buildings.room",
  "timetable_buildings.source_location",
  "timetable_buildings.staff",
  "timetable_buildings.subject_code",
  "timetable_buildings.subject_description",
].sort();

// Columns in no migration at all: scripts/navigation/generate-accessible-graph.py adds
// them to the navigation graph tables when the graph is generated.
const NOT_IN_ANY_MIGRATION = [
  "navigation_edges.has_steps",
  "navigation_edges.wheelchair_accessible",
].sort();

type Database = Awaited<ReturnType<typeof createTestDatabase>>;
let fullDatabase: Database;
let journalOnlyDatabase: Database;

beforeAll(async () => {
  fullDatabase = await createTestDatabase(); // every .sql file, in name order
  journalOnlyDatabase = await createTestDatabase(journaledMigrationFiles()); // what db:migrate runs
}, 60_000);

afterAll(async () => {
  await fullDatabase.client.close();
  await journalOnlyDatabase.client.close();
});

// The schema map also holds enums; keep just the tables.
const tables = Object.values(schema).filter((value) => value instanceof PgTable) as unknown as PgTable[];

async function missingColumns(database: Database) {
  const missing: string[] = [];
  for (const table of tables) {
    const config = getTableConfig(table);
    const { rows } = await database.client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
      [config.name],
    );
    const present = new Set(rows.map((row) => row.column_name));
    for (const column of config.columns) {
      if (!present.has(column.name)) missing.push(`${config.name}.${column.name}`);
    }
  }
  return missing.sort();
}

async function enumLabels(database: Database, name: string) {
  const { rows } = await database.client.query<{ enumlabel: string }>(
    "select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = $1 order by e.enumsortorder",
    [name],
  );
  return rows.map((row) => row.enumlabel);
}

describe("the migration journal", () => {
  it("only lists files that exist", () => {
    for (const file of journaledMigrationFiles()) {
      expect(existsSync(join(MIGRATIONS_DIR, file)), `${file} is in the journal but missing`).toBe(true);
    }
  });

  it("includes every migration file, apart from the known exceptions", () => {
    const journaled = new Set(journaledMigrationFiles());
    const unjournaled = migrationFiles().filter((file) => !journaled.has(file));

    expect(
      unjournaled,
      "A migration file is not in drizzle/meta/_journal.json, so `npm run db:migrate` will not apply it.",
    ).toEqual(KNOWN_UNJOURNALED_FILES);
  });
});

describe("applying the migrations to an empty database", () => {
  it("succeeds", () => {
    // createTestDatabase() ran every migration in order during setup and would have thrown.
    expect(fullDatabase.client).toBeDefined();
  });

  it("creates the enums the code uses, with the same values in the same order", async () => {
    expect(await enumLabels(fullDatabase, "feedback_status")).toEqual([...feedbackStatus.enumValues]);
    expect(await enumLabels(fullDatabase, "walking_speed")).toEqual([...walkingSpeed.enumValues]);
    expect(await enumLabels(fullDatabase, "day_of_week")).toEqual([...dayOfWeek.enumValues]);
  });

  it("creates every column the code expects, apart from the known exceptions", async () => {
    expect(await missingColumns(fullDatabase)).toEqual(NOT_IN_ANY_MIGRATION);
  });

  it("creates every table the code expects", async () => {
    const { rows } = await fullDatabase.client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const present = new Set(rows.map((row) => row.table_name));
    for (const table of tables) {
      expect(present.has(getTableConfig(table).name), `table ${getTableConfig(table).name}`).toBe(true);
    }
  });
});

describe("what `npm run db:migrate` alone would build (journaled files only)", () => {
  it("has the right enum values, so status changes can't fail on a fresh database", async () => {
    expect(await enumLabels(journalOnlyDatabase, "feedback_status")).toEqual([...feedbackStatus.enumValues]);
    expect(await enumLabels(journalOnlyDatabase, "walking_speed")).toEqual([...walkingSpeed.enumValues]);
    expect(await enumLabels(journalOnlyDatabase, "day_of_week")).toEqual([...dayOfWeek.enumValues]);
  });

  it("is missing only the columns that come from the known unjournaled files", async () => {
    const missing = await missingColumns(journalOnlyDatabase);

    expect(
      missing.filter((column) => !NOT_IN_ANY_MIGRATION.includes(column)),
      "A column the code uses would not exist after `npm run db:migrate`.",
    ).toEqual(MISSING_WITHOUT_UNJOURNALED_FILES);
  });
});
