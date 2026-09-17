import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function inspectDatabase() {
  try {
    await client.connect();

    console.log("✅ Connected to Neon PostgreSQL!\n");

    // 1. Get all tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("📋 Tables:");
    console.table(tables.rows);

    // 2. Get columns for each table
    const columns = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    console.log("\n📋 Columns:");
    console.table(columns.rows);

    // 3. Show the first 5 rows of every table
    for (const table of tables.rows) {
      const tableName = table.table_name;

      // Table names come directly from PostgreSQL metadata,
      // so they are safe to use here.
      const result = await client.query(
        `SELECT * FROM "${tableName}" LIMIT 5;`
      );

      console.log(`\n📦 Data from "${tableName}":`);
      console.table(result.rows);
    }

  } catch (error) {
    console.error("❌ Database inspection failed:");
    console.error(error.message);
  } finally {
    await client.end();
  }
}

inspectDatabase();