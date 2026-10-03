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

## Verification

```bash
npm test
npm run lint
npm run build
./node_modules/.bin/drizzle-kit check --config=drizzle.config.ts
```
