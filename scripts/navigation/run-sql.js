import dotenv from "dotenv";
import fs from "fs";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function runSQL() {
    try {
        await client.connect();

        console.log("✅ Connected to Neon PostgreSQL!");

        const sql = fs.readFileSync(
            "./create-navigation-tables.sql",
            "utf8"
        );

        console.log("Running SQL...");

        await client.query(sql);

        console.log("✅ Navigation tables created successfully!");

    } catch (error) {
        console.error("❌ Failed to create tables:");
        console.error(error.message);

    } finally {
        await client.end();
    }
}

runSQL();