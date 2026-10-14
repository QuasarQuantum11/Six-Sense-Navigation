import dotenv from "dotenv";
import { Pool } from "pg";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) throw new Error("Usage: node scripts/fix-ltb-location.mjs [--apply]");
const config = JSON.parse(readFileSync(new URL("../api/ltb_entrances.json", import.meta.url), "utf8"));
const entrance = config.entrances.find((entry) => entry.id === config.building_search_entrance);
const oldLocation = { latitude: -37.91329573181047, longitude: 145.13278055602936 };
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await pool.query("BEGIN");
  const { rows } = await pool.query(
    "SELECT id, name, latitude, longitude FROM buildings WHERE name = $1 FOR UPDATE",
    ["Learning and Teaching Building"],
  );
  if (rows.length !== 1) throw new Error("Expected exactly one LTB record; resolve missing/duplicate records first");
  const row = rows[0];
  const matches = (point) => Math.abs(row.latitude - point.latitude) < 1e-9 && Math.abs(row.longitude - point.longitude) < 1e-9;
  if (row.latitude !== null && row.longitude !== null && matches(entrance)) {
    console.log("LTB already uses the east candidate entrance. No update needed.");
  } else {
    if (row.latitude === null || row.longitude === null || !matches(oldLocation)) {
      throw new Error("LTB has independently changed coordinates; refusing to overwrite them");
    }
    console.log(JSON.stringify({ id: row.id, name: row.name, before: oldLocation, after: { latitude: entrance.latitude, longitude: entrance.longitude }, mappingVerified: false }));
    if (args.includes("--apply")) {
      await pool.query("UPDATE buildings SET latitude = $1, longitude = $2 WHERE id = $3", [entrance.latitude, entrance.longitude, row.id]);
      console.log("Updated only the LTB building-search location.");
    } else console.log("Preview only. Add --apply to update this one record.");
  }
  await pool.query(args.includes("--apply") ? "COMMIT" : "ROLLBACK");
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Error ? error.message : "LTB correction failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
