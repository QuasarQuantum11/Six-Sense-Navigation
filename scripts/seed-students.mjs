import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

const exampleStudents = [
  {
    username: "alice",
    email: "alice@example.invalid",
    password: "alice-example-pass",
  },
  {
    username: "bob",
    email: "bob@example.invalid",
    password: "bob-example-pass",
  },
  {
    username: "carol",
    email: "carol@example.invalid",
    password: "carol-example-pass",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the .env file");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const { username, email, password } of exampleStudents) {
      const hashed = await hashPassword(password);
      await pool.query(
        `INSERT INTO students (username, email, password)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [username, email, hashed],
      );
      console.log(`Seeded student: ${username}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
