import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as adminsSchema from "@/lib/admins/schema";
import * as feedbackSchema from "@/lib/feedback/schema";
import * as navigationSchema from "@/lib/navigation/schema";
import * as studentsSchema from "@/lib/students/schema";
import * as timetablesSchema from "@/lib/timetables/schema";

// An in-memory PostgreSQL (PGlite) built from the project's real migration files,
// so tests exercise the same SQL, enums and constraints as production. Same schema
// map as lib/db/client.ts, so `db.query.*` works too.
export const schema = {
  ...adminsSchema,
  ...feedbackSchema,
  ...studentsSchema,
  ...timetablesSchema,
  ...navigationSchema,
};

export const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function journaledMigrationFiles(): string[] {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  return journal.entries.map((entry) => `${entry.tag}.sql`);
}

export async function createTestDatabase(files: string[] = migrationFiles()) {
  const client = new PGlite();
  // The app stores UTC in `timestamp` columns (Neon runs in UTC). Without this,
  // now() defaults would follow the developer's machine time zone.
  await client.exec("SET TIME ZONE 'UTC'");
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    );
    await client.exec(statements);
  }
  return { client, db: drizzle(client, { schema }) };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>["db"];

/** Empties every application table between tests. */
export async function resetTables(client: PGlite) {
  await client.exec(
    "TRUNCATE feedback, timetable_buildings, timetables, buildings, students, admins CASCADE",
  );
}

// Stand-in for `db` from "@/lib/db/client". Test files mock that module with this
// proxy, then call setCurrentDatabase() once the in-memory database is ready.
let current: Record<PropertyKey, unknown> | null = null;

export function setCurrentDatabase(database: TestDatabase) {
  current = database as unknown as Record<PropertyKey, unknown>;
}

export const currentDatabaseProxy = new Proxy(
  {},
  {
    get(_target, key) {
      if (!current) throw new Error("setCurrentDatabase() has not been called");
      const value = current[key];
      return typeof value === "function" ? value.bind(current) : value;
    },
  },
);

/** A fixed UUID per number, for readable fixtures. */
export const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
