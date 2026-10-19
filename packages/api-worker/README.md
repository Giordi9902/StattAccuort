# Statt’Accuort API (`api-worker`) — Hono + Drizzle on Node.js and PostgreSQL

The name is historical: the API used to run on Cloudflare Workers.

## Setup

```sh
bun install
cp .env.example .env     # every variable is documented there; set REPORT_HASH_SECRET
bun run db:up            # local PostgreSQL in Docker (compose.yaml): `stattaccuort` + `stattaccuort_test`
```

## Local development

```sh
bun run seed --city napoli               # applies migrations, seeds stations/lines/segments
bun run timetables:import --city napoli  # departures: ANM GTFS + EAV boards
bun run dev                              # http://localhost:8787, restarts on change
```

The seed builds the reference tables from the bundled snapshots in `src/db/seed/snapshots/` through
the same `seedBaseData` pipeline the test suite uses. `bun run db:seed:refresh --city napoli`
regenerates the snapshots from Overpass and the GTFS feed (`--gtfs-only` for the bus network alone).

## Tests

```sh
bun run test
```

Vitest in Node against `stattaccuort_test` (override with `TEST_DATABASE_URL`):
`tests/global-setup.ts` drops and rebuilds the schema, applies the migrations and seeds once per
run; files run one after another because they share that database.

## Migrations

After altering `src/db/schema/`, generate a migration and give it a descriptive name:

```sh
bun run db:generate -- --name add_reports_direction_index
bun run db:migrate
```

Migrations are idempotent (Drizzle keeps its own journal) and also run on server start and in the
seed. `bun run db:studio` opens Drizzle Studio on `DATABASE_URL`.

## Report intake

`POST /v0/reports` normalizes the report against the network (`modules/reports`) and stores it
through `modules/report-intake`, which rate limits per device: an anonymous HMAC fingerprint of IP
and User-Agent, one report per `REPORT_COOLDOWN_SECONDS`, otherwise `429 REPORT_RATE_LIMITED`.
