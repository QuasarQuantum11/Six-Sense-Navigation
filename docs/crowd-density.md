# Timetable-based crowd estimation, version 1

## What this feature demonstrates

The map estimates relative activity near Clayton buildings from timetable
samples. It does not measure live crowds, attendance, footpath capacity or
people per square metre. It does not change navigation routes. R4 still needs
next-class selection and crowd-aware route integration in a later change.

## Real data and simulation are separate

**Real mode** reads only voluntarily participating timetables. Uploading or
saving a timetable does not grant consent. A signed-in student selects one
owned timetable and explicitly confirms it applies to the coming week. Consent
lasts 168 elapsed hours, then stops automatically. Renewing or switching requires
confirmation again. Opting out removes the participation row; deleting the
selected timetable cascades to that row. Saved timetable data is otherwise kept.
Editing the selected timetable changes the schedule used during the remaining
participation period. Administrators cannot opt students in on their behalf.

**Simulation mode** uses AI-assisted fictional timetables prepared by Codex
from the agreed fixed scenario in `lib/crowd/demo.ts`. It never reads real
participants or classes, never creates student accounts, and never inserts
fictional records into the database. The synthetic fixture is deterministic:

| Scenario | Fictional students | Class time | Duration | Peak result |
| --- | ---: | --- | --- | --- |
| LTB | 12 | 2026-10-07 10:00 Melbourne | 1 hour | High |
| Campus Centre | 8 | Same | 1 hour | Medium |
| Menzies | 4 | Same | 1 hour | Low |

These numbers describe the simulation only. AI helped prepare inputs; the
crowd estimation algorithm computes the results. They are not generated
claims about observed campus populations. Simulation runs the same scoring
and sample thresholds as real mode, with a fixed synthetic participation
window so that it remains replayable after the scenario date has passed.

Suggested presentation wording:

> Our real timetable sample is currently limited. We therefore prepared
> AI-assisted fictional student timetables and simulated campus activity at
> different times. The system uses those schedules to estimate activity near
> buildings and display it on the map. This validates the implemented rules
> and interface, but does not establish accuracy against real campus crowds.

## Model assumptions

- Use `Australia/Melbourne` for dates, weekdays and course times. Real requests
  cover the current minute through the next 168 hours. Simulation is fixed to
  2026-10-07; its clock can be changed within that date.
- A course contributes a triangular activity peak around its start and, when
  duration is known, its end. At the event the weight is 1; at 15 minutes before
  or after it the weight is 0. Contributions vary linearly in between.
- At a building and queried time, one student contributes at most 1, including
  duplicate classes or coinciding arrivals and departures. The sum is an
  internal activity score, not an attendance prediction.
- Low: score below 5. Medium: 5 up to but excluding 10. High: at least 10.
  These thresholds are provisional modelling assumptions, not calibrated
  physical density thresholds.
- Require at least 5 valid participating students in the cohort and at least
  3 distinct positive contributors at that building and time. Otherwise show
  **Unable to estimate**. No matching activity is not proof that an area is empty.
- Empty class dates mean weekly recurrence during the confirmed participation
  window. Support `d/m`, `d/m/yyyy`, comma-separated date intervals and yearless
  cross-year ranges. Invalid dates/times are excluded with a general notice.
- Interpret durations such as `3 hrs`, `1 hr 30 mins`, `1.5 hours`, `90 mins`
  and `01:30`, up to 24 hours. Missing or invalid duration permits arrivals only;
  it never creates a guessed departure. Adjacent-day events cover midnight.
- Exclude explicitly non-Clayton classes and buildings without valid Clayton
  coordinates. The 100 m display circles are illustrative areas, not measured
  congestion boundaries. Colour always has a matching text label.

## Interface and privacy

Signed-in users open **Estimated crowd activity** on `/map`, enable the layer,
and explicitly choose real or simulated data. Real is the default. Insufficient
real data never triggers a simulation fallback. Date/time changes and manual
refresh request a new snapshot; there is no background polling. Mode changes,
closing the overlay and leaving the map cancel pending requests and remove
old circles. An old response cannot overwrite a newer selection.

`POST /api/crowd-estimates` accepts `{ "mode": "real" }` for now or
`{ "mode": "demo", "date": "2026-10-07", "time": "10:00" }` for replay.
Both modes require login. Returns model version, source label, requested and
generated times, explanatory notices and building-level `low`, `medium`,
`high` or `unknown` labels. Responses and errors use `private, no-store`.
No student identifiers, class details, exact counts or scores are returned.
Small-sample safeguards limit disclosure; they do not claim formal anonymity
or empirical crowd-prediction accuracy.

Real-data reads use a consistent read-only database snapshot. Participation
mutations recheck the current student's identity and timetable ownership on
the server. Consent is limited to one timetable per student by a primary key.
No uploaded data is sent to an external AI service to generate the simulation.

## Setup and verification

Install dependencies with `npm ci`. The isolated PGlite PostgreSQL tests cover
the exact additive DDL, consent transactions, ownership, expiration, cascades
and real-data joins without touching deployment records.

The historical Drizzle journal does not register all current schema updates,
so this change has a targeted standalone setup instead of running that chain:

```bash
node scripts/crowd/setup.mjs           # inspect target and preview
node scripts/crowd/setup.mjs --apply   # add the one table/index to that target
```

`CROWD_DATABASE_URL` overrides the target for an isolated test/deployment
database. Otherwise the script prefers `DATABASE_URL_UNPOOLED`, then
`DATABASE_URL`. Verify these refer to the same intended branch as runtime.
The script refuses an existing incompatible table. Apply database setup before
deploying the frontend. Python routing does not need an update for this feature.
If the table is missing, saved timetables still work, participation explains
that setup is pending, real estimates return 503, and explicitly chosen
simulation remains available. Rolling back the frontend leaves stored
participation harmless; expiry still limits later aggregation.

```bash
npm test
npm run lint
npm run build -- --webpack
.venv/bin/python -m unittest discover -s api/tests
```

Manual simulation: enable the layer, select simulated data, use 10:00 to see
high/medium/low, 09:55 to see medium/medium/low, 11:00 for departure peaks,
and 12:00 to see unavailable estimates. Click a building's result to centre its
circle. Switch back to real mode to verify the simulated banner and results
are removed. Confirm on a narrow screen and check keyboard labels.

Manual real participation: save a timetable, visit your student timetable
page, choose that timetable, tick the explicit agreement, and confirm. Check
the expiry display, replacement by another timetable, stopping, and removal
after deleting the selected timetable. Real grades need the minimum sample;
one person's consent is intentionally insufficient to produce a grade.
