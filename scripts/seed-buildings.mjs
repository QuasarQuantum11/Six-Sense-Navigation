import "dotenv/config";
import { Pool } from "pg";

// Fill in each building's location as decimal degrees. A quick way is to
// right-click the building's main entrance in Google Maps, which copies
// "latitude, longitude" (latitude first). Buildings left as null are skipped,
// so any coordinates already in the database are not overwritten.
const buildingLocations = [
  { name: "Learning and Teaching Building", latitude: -37.91329573181047, longitude: 145.13278055602936 },
  { name: "Science Building", latitude: null, longitude: null },
  { name: "Engineering Block", latitude: null, longitude: null },
  { name: "Library", latitude: null, longitude: null },
  { name: "Sports and Recreation Centre", latitude: -37.91292257751217, longitude: 145.13606816442083 },
];

// Same bounding box as scripts/navigation/generate_graph.py. Anything outside
// it is almost certainly a typo or swapped latitude/longitude.
const campusBounds = {
  south: -37.922,
  north: -37.905,
  west: 145.127,
  east: 145.142,
};

function validateLocation({ name, latitude, longitude }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`"${name}": latitude and longitude must both be numbers`);
  }
  const insideCampus =
    latitude >= campusBounds.south &&
    latitude <= campusBounds.north &&
    longitude >= campusBounds.west &&
    longitude <= campusBounds.east;
  if (!insideCampus) {
    throw new Error(
      `"${name}": (${latitude}, ${longitude}) is outside Monash Clayton — check the values aren't swapped`,
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in the .env file");
  }

  const located = buildingLocations.filter(
    ({ latitude, longitude }) => latitude !== null || longitude !== null,
  );
  const skipped = buildingLocations.filter((building) => !located.includes(building));

  // Validate everything before touching the database, so one bad entry
  // doesn't leave the table half-updated.
  located.forEach(validateLocation);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const { name, latitude, longitude } of located) {
      await pool.query(
        `INSERT INTO buildings (name, latitude, longitude)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
        [name, latitude, longitude],
      );
      console.log(`Set location for ${name}: ${latitude}, ${longitude}`);
    }
    console.log(`Seeded locations for ${located.length} buildings`);
    if (skipped.length > 0) {
      console.log(
        `Skipped ${skipped.length} without coordinates: ${skipped.map(({ name }) => name).join(", ")}`,
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
