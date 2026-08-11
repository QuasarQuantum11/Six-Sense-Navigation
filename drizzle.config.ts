import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Prefer the unpooled connection for migrations: Neon's pooled (pgbouncer)
// connection runs in transaction mode, which doesn't reliably support the
// session-level locking drizzle-kit uses while applying DDL.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error('DATABASE_URL is not set in the .env file');
}

export default defineConfig({
  schema: "./lib/*/schema.ts",
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl,
  },
});
