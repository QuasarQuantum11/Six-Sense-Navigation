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
`/admin/login`.

## Database

Run migrations only after confirming the configured database/branch:

```bash
npm run db:migrate
```

Optional example data can be added with `npm run db:seed`. Both commands modify
the configured database.

## Verification

```bash
npm test
npm run lint
npm run build
./node_modules/.bin/drizzle-kit check --config=drizzle.config.ts
```
