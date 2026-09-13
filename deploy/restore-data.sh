#!/usr/bin/env bash
#
# Puts a catalogue archive from backup-data.sh onto this server, in place of
# whatever catalogue it had.
#
#   deploy/restore-data.sh boxx-data.tar.gz
#
# Run in /opt/boxx on a server whose stack is up and migrated. The catalogue
# tables are emptied and refilled from the archive, and the uploaded files are
# unpacked over the upload directories; accounts, sessions, saved quotes and
# integration settings are left as they are. The app is stopped for the
# duration so nobody reads a half-written catalogue, and started again after.
set -euo pipefail

ARCHIVE="${1:?usage: restore-data.sh <archive.tar.gz>}"
[ -f "$ARCHIVE" ] || { echo "No such archive: $ARCHIVE" >&2; exit 1; }
[ -f .env ] || { echo 'Run this in /opt/boxx, beside .env and docker-compose.yml.' >&2; exit 1; }

PGUSER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
PGDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
UPLOADS="${UPLOADS_DIR:-/opt/boxx/uploads}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar -xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/catalogue.sql" ] || { echo 'The archive has no catalogue.sql — not a backup-data.sh archive.' >&2; exit 1; }

echo 'stopping the app'
docker compose stop app

echo 'emptying the catalogue'
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB" <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND (
      table_name LIKE 'building\_%' OR table_name LIKE 'furniture\_%' OR
      table_name IN ('configurator_settings', 'exterior_options', 'images', 'models', 'regions', 'room_types', 'textures')
    )
  LOOP
    EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
  END LOOP;
END $$;
SQL

echo 'loading the catalogue'
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U "$PGUSER" -d "$PGDB" < "$WORK/catalogue.sql"

echo "unpacking uploads into $UPLOADS"
for dir in models textures images media; do
  mkdir -p "$UPLOADS/$dir"
  [ -d "$WORK/uploads/$dir" ] && cp -r "$WORK/uploads/$dir/." "$UPLOADS/$dir/" || true
done
chown -R 1000:1000 "$UPLOADS"

echo 'starting the app'
docker compose up -d app

docker compose exec -T db psql -At -U "$PGUSER" -d "$PGDB" -c \
  "select 'buildings: ' || count(*) from building_models union all select 'packages: ' || count(*) from furniture_packages union all select 'models: ' || count(*) from models"
