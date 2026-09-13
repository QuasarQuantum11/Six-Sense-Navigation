import "dotenv/config";
import { Pool } from "pg";

const exampleFeedback = [
  {
    username: "alice",
    message: "The route to the Learning and Teaching Building doesn't mention the ramp near the library entrance.",
    status: "new",
  },
  {
    username: "alice",
    message: "Loved how quickly the shortest path loaded on the outdoor map, great work!",
    status: "resolved",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the .env file");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const { username, message, status } of exampleFeedback) {
      const { rows: studentRows } = await pool.query(
        `SELECT id FROM students WHERE username = $1`,
        [username],
      );
      if (studentRows.length === 0) {
        throw new Error(`Student "${username}" not found`);
      }
      const studentId = studentRows[0].id;

      const { rows: existing } = await pool.query(
        `SELECT id FROM feedback WHERE student_id = $1 AND message = $2`,
        [studentId, message],
      );
      if (existing.length > 0) {
        console.log(`Feedback "${message}" already seeded, skipping`);
        continue;
      }

      await pool.query(
        `INSERT INTO feedback (student_id, message, status) VALUES ($1, $2, $3)`,
        [studentId, message, status],
      );
      console.log(`Seeded feedback from ${username}: "${message}"`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
