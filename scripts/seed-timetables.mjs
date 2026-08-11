import "dotenv/config";
import { Pool } from "pg";

const exampleBuildings = [
  "Learning and Teaching Building",
  "Science Building",
  "Engineering Block",
  "Library",
  "Sports and Recreation Centre",
];

// Example timetables, referencing buildings by name and the order
// (position) they occur in the day. Building 0 ("Learning and Teaching
// Building") appears twice in the first timetable, at different
// positions, to demonstrate the many-to-many relationship.
const exampleTimetables = [
  {
    username: "alice",
    name: "Semester 1 2026",
    stops: [
      { building: "Learning and Teaching Building", position: 1 },
      { building: "Science Building", position: 2 },
      { building: "Learning and Teaching Building", position: 3 },
      { building: "Library", position: 4 },
    ],
  },
  {
    username: "alice",
    name: "Semester 2 2026",
    stops: [
      { building: "Engineering Block", position: 1 },
      { building: "Library", position: 2 },
      { building: "Sports and Recreation Centre", position: 3 },
    ],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the .env file");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const name of exampleBuildings) {
      await pool.query(
        `INSERT INTO buildings (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name],
      );
    }
    console.log(`Seeded ${exampleBuildings.length} buildings`);

    for (const exampleTimetable of exampleTimetables) {
      const { rows: studentRows } = await pool.query(
        `SELECT id FROM students WHERE username = $1`,
        [exampleTimetable.username],
      );
      if (studentRows.length === 0) {
        throw new Error(`Student "${exampleTimetable.username}" not found`);
      }
      const studentId = studentRows[0].id;

      const { rows: existing } = await pool.query(
        `SELECT id FROM timetables WHERE student_id = $1 AND name = $2`,
        [studentId, exampleTimetable.name],
      );
      if (existing.length > 0) {
        console.log(`Timetable "${exampleTimetable.name}" already seeded, skipping`);
        continue;
      }

      const { rows: timetableRows } = await pool.query(
        `INSERT INTO timetables (student_id, name) VALUES ($1, $2) RETURNING id`,
        [studentId, exampleTimetable.name],
      );
      const timetableId = timetableRows[0].id;

      for (const stop of exampleTimetable.stops) {
        const { rows: buildingRows } = await pool.query(
          `SELECT id FROM buildings WHERE name = $1`,
          [stop.building],
        );
        await pool.query(
          `INSERT INTO timetable_buildings (timetable_id, building_id, position)
           VALUES ($1, $2, $3)`,
          [timetableId, buildingRows[0].id, stop.position],
        );
      }
      console.log(
        `Seeded timetable "${exampleTimetable.name}" for ${exampleTimetable.username} with ${exampleTimetable.stops.length} stops`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
