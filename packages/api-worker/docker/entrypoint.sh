#!/bin/sh
# One image, several jobs: `serve` (default) runs the API; the others are one-off tasks, e.g.
#   docker compose run --rm api setup
set -eu
tsx=node_modules/.bin/tsx
city="${CITY:-napoli}"

case "${1:-serve}" in
    serve) exec "$tsx" src/server.ts ;;
    migrate) exec "$tsx" src/db/migrate-cli.ts ;;
    seed) exec "$tsx" src/db/seed/seed-db.ts --city "$city" ;;
    timetables) exec "$tsx" src/db/timetables/import.ts --city "$city" ;;
    # First run, and after every snapshot update: reference network, then the departures on it.
    setup)
        "$tsx" src/db/seed/seed-db.ts --city "$city"
        exec "$tsx" src/db/timetables/import.ts --city "$city"
        ;;
    *) exec "$@" ;;
esac
