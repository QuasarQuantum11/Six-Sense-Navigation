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

## Database

Run migrations only after confirming the configured database/branch:

```bash
npm run db:migrate
```

Optional example data can be added with `npm run db:seed`. Both commands modify
the configured database.

## LTB indoor distance

The `/api/indoor-route` and `/api/ltb-route` responses report the walking
distance along the selected floor-plan graph in metres, using the floor plans'
0–50 m scale bar (14.2 pixels per metre). For same-floor routes they also
report the direct straight-line map distance for comparison. Manually added
same-floor edges without a stored pixel length are measured from their node
coordinates.

Stair and lift edges do not contain measured travel lengths. Cross-floor
responses therefore include `vertical_segments` and set `distance_complete`
to `false`; `indoor_horizontal_distance_m` and `total_known_distance_m` exclude
those segments. The routing algorithm penalises extra floor changes, but this
penalty is only for route selection and is never reported as a real distance.

## Verification

```bash
npm test
npm run lint
npm run build
./node_modules/.bin/drizzle-kit check --config=drizzle.config.ts
```
