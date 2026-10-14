import dotenv from "dotenv";
import { Pool } from "pg";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply")) throw new Error("Usage: node scripts/crowd/setup.mjs [--apply]");
// Explicit test/deployment URLs take precedence over local config.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const connectionString = process.env.CROWD_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set CROWD_DATABASE_URL or a configured database URL.");
const sql = readFileSync(new URL("./create-participation.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString });
const expected = { student_id: "uuid", timetable_id: "uuid", consented_at: "timestamp with time zone", expires_at: "timestamp with time zone" };
try {
  const { rows: location } = await pool.query("SELECT current_database() AS database, current_schema() AS schema");
  console.log(JSON.stringify({ target: location[0], operation: "Add crowd_participation only", apply: args.includes("--apply") }));
  const { rows } = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'crowd_participation'");
  if (rows.length) {
    if (rows.length !== 4 || rows.some(row => expected[row.column_name] !== row.data_type || row.is_nullable !== "NO")) throw new Error("Existing crowd table has a different shape; refusing to alter it.");
    const { rows: checks } = await pool.query("SELECT conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'crowd_participation'::regclass");
    const primary = checks.some(c => c.contype === "p" && c.definition === "PRIMARY KEY (student_id)");
    const foreignKey = (column, table) => checks.some(c => c.contype === "f" && c.definition.includes(`FOREIGN KEY (${column})`) && c.definition.includes(`REFERENCES ${table}(id)`) && c.definition.includes("ON DELETE CASCADE"));
    const period = checks.some(c => c.conname === "crowd_participation_valid_period" && c.contype === "c" && c.definition.includes("expires_at > consented_at") && c.definition.includes("expires_at <=") && (c.definition.includes("168:00:00") || c.definition.includes("168 hours")));
    if (!primary || !foreignKey("student_id", "students") || !foreignKey("timetable_id", "timetables") || !period) throw new Error("Existing crowd table constraints require review; no changes made.");
  }
  if (!args.includes("--apply")) {
    console.log(rows.length ? "Existing table is compatible. Preview only." : "Preview only: the table will be created. Confirm the target is your test/deployment database before applying.");
    console.log(sql);
  } else {
    await pool.query("BEGIN");
    await pool.query(sql);
    await pool.query("COMMIT");
    console.log("Crowd participation table is ready. No timetable or account records were changed.");
  }
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Error ? error.message : "Crowd setup failed.");
  process.exitCode = 1;
} finally { await pool.end(); }
