#!/usr/bin/env bash
#
# Packs the catalogue — the database rows and the uploaded files — into one
# archive that restore-data.sh puts onto another server.
#
#   deploy/backup-data.sh [out.tar.gz]
#
# Run where the database runs: on the server (`/opt/boxx`) or on a workstation
# beside its `docker compose` database. It needs `docker` and the connection
# details from `.env` (POSTGRES_USER, POSTGRES_DB) or the defaults of the dev
# compose file.
#
# What goes in: every table the catalogue is made of — lines, buildings,
# furniture, exterior options, regions, room types, tiers, the quiz settings,
# and the models / textures / images rows — plus the files those rows point
# at. What stays behind: accounts and sessions, saved quotes, integration
# settings, Payload's own bookkeeping. A restore therefore replaces what the
# visitor can configure and nothing about who runs the site.
set -euo pipefail

OUT="${1:-boxx-data-$(date +%Y%m%d-%H%M).tar.gz}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# The database container: the production stack's `db`, or the dev `postgres`.
DB_CONTAINER="${DB_CONTAINER:-$(docker compose ps -q db 2>/dev/null || true)}"
DB_CONTAINER="${DB_CONTAINER:-$(docker compose -f "$ROOT/docker-compose.yml" ps -q postgres 2>/dev/null || true)}"
[ -n "$DB_CONTAINER" ] || { echo 'No database container found (compose service "db" or "postgres").' >&2; exit 1; }

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-configurator}"
if [ -f .env ]; then
  PGUSER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- || true)"; PGUSER="${PGUSER:-postgres}"
  PGDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- || true)"; PGDB="${PGDB:-configurator}"
fi

# Uploads: the production bind mounts, or the dev checkout's own directories.
UPLOADS="${UPLOADS_DIR:-}"
if [ -z "$UPLOADS" ]; then
  if [ -d /opt/boxx/uploads ]; then UPLOADS=/opt/boxx/uploads; else UPLOADS="$ROOT"; fi
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "database: container $DB_CONTAINER, $PGUSER@$PGDB"
docker exec "$DB_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" \
  --data-only --disable-triggers --no-owner \
  -t 'building_*' -t 'furniture_*' -t configurator_settings -t exterior_options \
  -t images -t models -t regions -t room_types -t textures \
  > "$WORK/catalogue.sql"
grep -c '^COPY ' "$WORK/catalogue.sql" | xargs -I{} echo "tables dumped: {}"

echo "uploads: $UPLOADS"
mkdir -p "$WORK/uploads"
for dir in models textures images media; do
  mkdir -p "$WORK/uploads/$dir"
  [ -d "$UPLOADS/$dir" ] && cp -r "$UPLOADS/$dir/." "$WORK/uploads/$dir/" || true
done

tar -czf "$OUT" -C "$WORK" catalogue.sql uploads
echo "written $OUT ($(du -h "$OUT" | cut -f1))"
