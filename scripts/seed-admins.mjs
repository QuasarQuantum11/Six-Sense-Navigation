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

const exampleAdmins = [
  {
    username: "admin",
    email: "admin@example.invalid",
    password: "admin-example-pass",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the .env file");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const { username, email, password } of exampleAdmins) {
      const hashed = await hashPassword(password);
      await pool.query(
        `INSERT INTO admins (username, email, password)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [username, email, hashed],
      );
      console.log(`Seeded admin: ${username}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
