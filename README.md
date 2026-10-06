# Six-Sense Navigation

Accessible indoor and outdoor navigation for the Monash University Clayton campus.

## Local setup

Create a `.env` based on `.env.example`. Generate a session secret with:

```bash
openssl rand -hex 32
```

Install the frontend and Python dependencies:

```bash
npm ci
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the routing API in one terminal:

```bash
source .venv/bin/activate
python -m uvicorn api.index:app --reload --port 8000
```

Start Next.js in another terminal:

```bash
npm run dev
```

Open <http://localhost:3000>. The Python API documentation is available at
<http://localhost:8000/docs>.

## Administrator registration

Student sign-up is available at `/signup`. Administrator sign-up uses
`/admin/signup` and requires an invitation code from the server-side
`ADMIN_INVITE_CODES` allowlist in `.env.local` (or the deployment environment). Generate a random code with
`openssl rand -hex 24` and add it to the comma-separated list. Codes are
reusable until removed from the list; rotate them after distribution or use.
If the variable is empty, no administrator can sign up. Never commit real codes
or put them in a `NEXT_PUBLIC_` variable. Existing admins log in at
`/admin/login`. The admin directory and feedback pages are available at
`/admin` and `/admin/feedback` to authenticated administrators.

## Database

Run migrations only after confirming the configured database/branch:

```bash
npm run db:migrate
```

Optional example data can be added with `npm run db:seed`. Both commands modify
the configured database.

## LTB indoor distance

The `/api/indoor-route` and `/api/ltb-route` responses report the travel
distance along the selected floor-plan graph in metres, using the floor plans'
0–50 m scale bar (14.2 pixels per metre). For same-floor routes they also
report the direct straight-line map distance for comparison. Manually added
same-floor edges without a stored pixel length are measured from their node
coordinates.

Stair and lift edges do not contain measured travel lengths. The published
[LTB building section](https://www.gooood.cn/en/the-learning-teaching-building-for-monash-university-john-wardle-architects.htm)
suggests roughly 4.5 m between floors; this is an inference from a drawing,
not a surveyed dimension. We assume 4.5 m of lift travel per floor (4–5 m
range), and 12 m of stair travel per floor (8–16 m range, allowing for treads
and landings). The stair values are provisional assumptions, not values read
from the section. The range covers connector assumptions only, not floor-plan
scale, node placement or route-graph error.

Cross-floor responses report `indoor_estimated_distance_m` and its min/max
alongside the horizontal-only `indoor_horizontal_distance_m`. The combined
route also reports `total_estimated_distance_m` and its min/max; it uses the
estimate to compare entrances. `distance_complete` remains `false` for routes
with unmeasured cross-floor segments, and `total_known_distance_m` still
excludes those segments. The routing penalty for extra floor changes is not
reported as a physical distance. Replace these assumptions with measured
connector lengths if a tighter accuracy requirement is introduced.

## Current location and privacy (original RTM R12)

On `/map`, guests and students can click **Enable location**, grant browser
permission and see a live position dot and accuracy circle. **Use current
location as start** copies a fresh position into the planner; choose a building
or LTB room and calculate a route. The chosen start is a snapshot: movement
does not automatically recalculate routes. Positions outside the Clayton map
area cannot be used as a start. Browser location does not determine an indoor
room or floor.

**Stop location**, leaving the map, hiding the page, a denied permission or a
location error ends the watch and removes the live position. Restart manually
when returning. Location updates are kept in memory only; no location history
table or browser storage is used. A selected start remains until replaced or
the map is closed. `/privacy` explains stored data, administrator access,
third-party map tiles and retention limitations.

The frontend uses same-origin POST requests for outdoor and LTB routing, with
coordinates in JSON bodies and `Cache-Control: private, no-store` responses.
The LTB proxy forwards a validated body to the Python service over HTTPS in
production (HTTP is permitted only for localhost development). Deploy the
Python POST `/api/ltb-route` handler before deploying this frontend. Set
`API_BASE_URL` on the Next.js server to override the routing service;
`NEXT_PUBLIC_API_BASE_URL` remains the fallback and indoor-node source.
Legacy GET route endpoints remain for compatibility; do not send personal
coordinates to them, as query strings can appear in hosting access logs.

Feedback pages and mutations require the student's own session or an
authorised administrator. Existing timetable ownership checks remain in force.
Student/admin display queries select only required fields, excluding password
hashes. Authentication/database failures do not log raw errors containing user
data. Production uses secure HttpOnly cookies, HSTS and same-origin location
permissions. Configure HTTPS on both deployments and a TLS database connection
(for Neon, use the provider's TLS connection string with `sslmode=verify-full`). Hosting-level encryption
at rest and operational log retention must be checked in the deployment
settings; application changes do not establish those guarantees. Timetable
field encryption and self-service account deletion are outside this change.

Manual acceptance checks:

- Guest and student: enable location, verify dot/accuracy, update position,
  choose it as a start, then calculate outdoor and LTB routes.
- Stop/restart, permission denied, unavailable location, timeout and hiding or
  leaving the map: verify updates stop, errors explain manual map selection,
  and no location history or automatic route request is created.
- Guest and a different student cannot open another student's new-feedback
  page or submit feedback under their ID; the owner and admin retain access.
- Inspect network requests: route coordinates are in POST bodies; both route
  responses and error responses include `private, no-store`.

## Verification

```bash
npm test
npm run lint
npm run build
./node_modules/.bin/drizzle-kit check --config=drizzle.config.ts
```
