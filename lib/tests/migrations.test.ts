import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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

// Guards against the database and the code drifting apart. Mistakes this project
// has already made, and which these tests now catch:
//  - a migration file written but missing from drizzle/meta/_journal.json, so
//    `npm run db:migrate` silently skips it (this happened to two files in a merge);
//  - two migration files with the same number;
//  - a schema change with no migration, or no snapshot (drizzle-kit generate diffs
//    the schema against the newest snapshot, so a missing one makes it re-create
//    columns that already exist).

// SHA-256 of each migration as the live database recorded it when it was applied
// (line endings normalised to LF, since Windows checkouts convert them).
// drizzle never notices if an applied migration is edited, so editing one makes
// databases silently differ. To change the schema, add a NEW migration instead.
const APPLIED_MIGRATION_HASHES: Record<string, string> = {
  "0000_red_iron_monger": "48a38c72bb057bb8109b7e11bf8f34d3ee77bf9988f148fd2cdab149b38f86f3",
  "0001_orange_polaris": "55d04c7e00355837ec8120c22f7b9f8a57a37d4c461e356940556863ae2aa35d",
  "0002_add_timetable_class_schedule": "da032c972dbc8f7dc08bd690187a018d360922b6c313e569c7e64106a3de7c03",
  "0003_add_building_coordinates": "4f69c49cec056cc39c386a2fad0e7e4067b31778b45533de6d44877736e41ccd",
  "0004_add_timetable_class_details": "115242dffa7067c900de7e395e81cc75804ca6e7aed06b0460f797626e058df5",
  "0005_add_feedback_not_reviewed_status": "fda058d987c413ffad200b4510f05726f7f16b295bd2d9ce3cf25959ff0f64ef",
};

// Columns the code uses that no migration creates: scripts/navigation/generate-accessible-graph.py
// adds them to the navigation graph table when the graph is generated. Remove an entry
// from this list once a migration creates the column.
const NOT_IN_ANY_MIGRATION = [
  "navigation_edges.has_steps",
  "navigation_edges.wheelchair_accessible",
].sort();

type Database = Awaited<ReturnType<typeof createTestDatabase>>;
type Journal = { entries: { idx: number; when: number; tag: string }[] };
type Snapshot = {
  id: string;
  prevId: string;
  tables: Record<string, { columns: Record<string, unknown> }>;
  enums: Record<string, { values: string[] }>;
};

const journal = JSON.parse(
  readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
) as Journal;
const readSnapshot = (index: number): Snapshot =>
  JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", `${String(index).padStart(4, "0")}_snapshot.json`), "utf8"),
  );

// The schema map also holds enums; keep just the tables.
const tables = Object.values(schema).filter((value) => value instanceof PgTable) as unknown as PgTable[];

// Built exactly the way `npm run db:migrate` would: only the journaled files, in order.
let database: Database;

beforeAll(async () => {
  database = await createTestDatabase(journaledMigrationFiles());
}, 60_000);

afterAll(async () => {
  await database.client.close();
});

async function missingColumns() {
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

async function enumLabels(name: string) {
  const { rows } = await database.client.query<{ enumlabel: string }>(
    "select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = $1 order by e.enumsortorder",
    [name],
  );
  return rows.map((row) => row.enumlabel);
}

describe("migration files and the journal", () => {
  it("has a journal entry for every file, and a file for every entry", () => {
    const files = migrationFiles();
    const journaled = journaledMigrationFiles();

    expect(
      files,
      "A migration file is missing from drizzle/meta/_journal.json (so `npm run db:migrate` would skip it), or the journal lists a file that doesn't exist.",
    ).toEqual(journaled);
    for (const file of journaled) expect(existsSync(join(MIGRATIONS_DIR, file))).toBe(true);
  });

  it("numbers the files 0000, 0001, 0002... with no gaps or repeats", () => {
    const numbers = migrationFiles().map((file) => Number(file.slice(0, 4)));

    expect(numbers).toEqual(numbers.map((_, index) => index));
  });

  it("gives each journal entry the same index as its file number", () => {
    for (const entry of journal.entries) {
      expect(entry.idx, entry.tag).toBe(Number(entry.tag.slice(0, 4)));
    }
  });

  it("lists entries in time order, because drizzle only runs entries newer than the last one applied", () => {
    const times = journal.entries.map((entry) => entry.when);

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("has a snapshot for every migration, chained to the one before", () => {
    const snapshots = journal.entries.map((_, index) => readSnapshot(index));

    expect(snapshots[0].prevId).toBe("00000000-0000-0000-0000-000000000000");
    snapshots.forEach((snapshot, index) => {
      if (index > 0) expect(snapshot.prevId, `snapshot ${index}`).toBe(snapshots[index - 1].id);
    });
    expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(snapshots.length);
  });

  it("leaves migrations that have already been applied unedited", () => {
    const actual = Object.fromEntries(
      journal.entries.map((entry) => {
        const sql = readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8").replace(/\r\n/g, "\n");
        return [entry.tag, createHash("sha256").update(sql).digest("hex")];
      }),
    );

    // A new migration must be added to APPLIED_MIGRATION_HASHES once it has been applied.
    expect(
      actual,
      "An applied migration was edited (or a new one needs its hash recorded). Add a new migration rather than changing an old one.",
    ).toEqual(APPLIED_MIGRATION_HASHES);
  });
});

describe("a database built the way `npm run db:migrate` builds it", () => {
  it("applies cleanly to an empty database", () => {
    // createTestDatabase() ran every journaled migration in order during setup and would have thrown.
    expect(database.client).toBeDefined();
  });

  it("creates the enums the code uses, with the same values in the same order", async () => {
    expect(await enumLabels("feedback_status")).toEqual([...feedbackStatus.enumValues]);
    expect(await enumLabels("walking_speed")).toEqual([...walkingSpeed.enumValues]);
    expect(await enumLabels("day_of_week")).toEqual([...dayOfWeek.enumValues]);
  });

  it("creates every table the code expects", async () => {
    const { rows } = await database.client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const present = new Set(rows.map((row) => row.table_name));
    for (const table of tables) {
      expect(present.has(getTableConfig(table).name), `table ${getTableConfig(table).name}`).toBe(true);
    }
  });

  it("creates every column the code expects, apart from the known exceptions", async () => {
    expect(
      await missingColumns(),
      "The code uses a column that no journaled migration creates.",
    ).toEqual(NOT_IN_ANY_MIGRATION);
  });
});

describe("the newest snapshot (what `drizzle-kit generate` compares the schema against)", () => {
  // Read inside each test, so a missing snapshot is reported by the test above rather than crashing the file.
  const latest = () => readSnapshot(journal.entries.length - 1);

  it("matches the schema's columns, apart from the known exceptions", () => {
    const differences: string[] = [];
    for (const table of tables) {
      const config = getTableConfig(table);
      const inSnapshot = new Set(Object.keys(latest().tables[`public.${config.name}`]?.columns ?? {}));
      for (const column of config.columns) {
        if (!inSnapshot.has(column.name)) differences.push(`${config.name}.${column.name}`);
      }
    }

    expect(
      differences.sort(),
      "The schema has a column the newest snapshot doesn't. Generate a migration (which writes a snapshot) rather than editing the schema alone.",
    ).toEqual(NOT_IN_ANY_MIGRATION);
  });

  it("matches the schema's enum values", () => {
    expect(latest().enums["public.feedback_status"].values).toEqual([...feedbackStatus.enumValues]);
    expect(latest().enums["public.walking_speed"].values).toEqual([...walkingSpeed.enumValues]);
    expect(latest().enums["public.day_of_week"].values).toEqual([...dayOfWeek.enumValues]);
  });
});
