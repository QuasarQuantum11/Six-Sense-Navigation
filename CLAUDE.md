@AGENTS.md

# Six-Sense Navigation

An accessible indoor/outdoor navigation web app for the Monash University Clayton campus (FIT3162 project). It helps guests and logged-in students find routes between campus locations — including inside the Learning and Teaching Building — with accessibility-aware routing.

## Project goals

- **Outdoor navigation**: interactive, zoomable/pannable campus map; shortest-path routing (Dijkstra's algorithm) between a selected start and destination, with distance/time estimates. Available to unregistered (guest) users, no login required.
- **Indoor navigation**: room-level navigation inside the Learning and Teaching Building, built from MSIS floor plans integrated into the same campus graph, with seamless transitions between outdoor↔indoor and between floors.
- **Accessibility-first routing**: routes can be weighted/filtered to prioritise ramps and lifts and avoid stairs and other inaccessible paths, for users who enable accessibility preferences.
- **Personalisation for logged-in users**: accessibility preferences, walking speed (slow/normal/fast), and Allocate+ timetable upload so the system can recommend routes to upcoming classes using crowd density estimation.
- **Accounts**: guest mode alongside login/sign-up with email + password validation.
- **Admin interface**: view/sort user feedback, monitor user data, manage navigation-related information.
- **Feedback loop**: users submit text feedback; logged-in users get alerts when their usual route changes significantly (crowd density, path closures) based on their timetable.
- **Search**: find campus buildings by name.
- **Non-functional**: WCAG 2.1 conformance (colour/contrast, keyboard navigation, focus visibility, labelled errors, etc.), privacy/security for stored and transmitted data (especially timetable/location data), and a consistent, intuitive UI.

Full requirement detail lives in the team's Requirement Traceability Matrix (RTM); the summary above and the demo list below are not a substitute for it.

### Requirements to demonstrate at end of development

Five priority requirements the team has committed to showing as the final milestone demo:

1. **Outdoor navigation** — an unregistered user selects a start and destination on the interactive Monash Clayton map; the system computes and displays the shortest route via Dijkstra's algorithm, with estimated walking distance and travel time.
2. **Indoor navigation** — navigate within the Learning and Teaching Building using MSIS floor plans integrated into the campus graph, to specific rooms, across floors, and seamlessly between outdoor and indoor.
3. **Accessibility-aware routing** — logged-in users can enable accessibility preferences so routing prioritises accessible infrastructure (ramps, lifts) and avoids stairs/inaccessible paths.
4. **Timetable-based route recommendations** — logged-in users upload their Allocate+ timetable; the system recommends routes to upcoming classes using crowd density estimation plus timetable data.
5. **Admin interface** — administrators can manage the system: view submitted feedback, monitor user data, and manage navigation-related information.

## Methodology

The team follows an Agile Scrum–adapted process with iterative sprints.

## Architecture & tech stack

- **Framework**: Next.js (App Router), at the repo root — `app/`, not `src/app/`. This project pins a version with breaking changes vs. training data; see the note above (pulled in from `AGENTS.md`) before using any Next.js API.
- **Language**: TypeScript, React 19.
- **Styling**: Tailwind CSS v4.
- **Database**: Neon Postgres (serverless Postgres with branching). Prefer branching off `main` for schema experiments and applying to `main` once verified, rather than migrating `main` directly.
- **ORM**: Drizzle ORM + `drizzle-kit`. Schema files live per domain at `lib/<domain>/schema.ts` (e.g. `lib/students/schema.ts`, `lib/timetables/schema.ts`), combined in `lib/db/client.ts`. `drizzle.config.ts` globs `./lib/*/schema.ts` and outputs migrations to `./drizzle`.
- **DB connection**: `pg` (`node-postgres`) `Pool`, attached to Vercel's serverless function pool via `@vercel/functions` — the intended deploy target is Vercel.
- **Path alias**: `@/*` → `./*` (project root; no `src/` dir).
- **Current schema** (expect this to grow as features land): `students`, `buildings`, `timetables`, `timetable_buildings` — a junction table for the many-to-many relationship between timetables and buildings, ordered by `position`. See `lib/*/schema.ts` for the source of truth.
- **Auth**: not yet implemented. Login/sign-up (RTM requirements around the log-in feature) are still to be built; a reference prototype in a sibling project used `better-auth` as a starting point.
- **Env vars**: `DATABASE_URL` (pooled, used at runtime) and `DATABASE_URL_UNPOOLED` (direct, used for migrations) go in a local `.env` (gitignored, never commit real credentials) — see `.env.example` for the expected format.
