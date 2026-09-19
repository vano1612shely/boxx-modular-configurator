# Deploying the configurator

The app runs as two containers — Postgres and the Next.js/Payload app — behind
nginx, on one Linux server. Uploaded models and the database live in `/opt/boxx`
on the host, not in the containers.

## Step 1: Server

Ubuntu 22.04 or 24.04, 2 vCPU, 4 GB RAM, 40 GB NVMe, root access, a domain name
pointing at it. Install Docker and nginx:

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

## Step 2: Directories

```bash
mkdir -p /opt/boxx/uploads/{models,textures,images,media} /opt/boxx/postgres
chown -R 1000:1000 /opt/boxx/uploads
chown -R 999:999 /opt/boxx/postgres
```

## Step 3: Environment

Create `/opt/boxx/.env` (owner root, `chmod 600`):

```bash
cd /opt/boxx
PGPASS=$(openssl rand -hex 24)
cat > .env <<EOF
POSTGRES_USER=boxx
POSTGRES_PASSWORD=${PGPASS}
POSTGRES_DB=configurator
DATABASE_URL=postgres://boxx:${PGPASS}@db:5432/configurator
PAYLOAD_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
NEXT_PUBLIC_SERVER_URL=https://configurator.example.com
APP_IMAGE=ghcr.io/<your-github-org>/<repo>:latest
EOF
chmod 600 .env
```

`NEXT_PUBLIC_SERVER_URL` is the public address of the site. `APP_IMAGE` is where
the built image lives (Step 5).

## Step 4: Stack files

Copy from the repository to the server:

- `deploy/docker-compose.yml` → `/opt/boxx/docker-compose.yml`
- `deploy/nginx.conf` → `/etc/nginx/sites-available/boxx`, then
  `ln -s /etc/nginx/sites-available/boxx /etc/nginx/sites-enabled/boxx`,
  set `server_name` to your domain, `nginx -t && systemctl reload nginx`.
- `deploy/backup-data.sh` and `deploy/restore-data.sh` → `/opt/boxx/`, `chmod +x`.

TLS: `apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d configurator.example.com`.

## Step 5: The image

Either of:

- **GitHub Actions (recommended).** Push the repository to GitHub, add the
  secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (a key that can log into the
  server as root). Every push to `main` then builds the image, pushes it to
  GHCR and releases it to the server — including migrations. Nothing else in
  Step 6 is needed.
- **By hand.** On any machine with Docker (8 GB RAM for the build):
  `docker build -t <registry>/<repo>:<tag> . && docker push <registry>/<repo>:<tag>`,
  then put that tag into `APP_IMAGE` in `/opt/boxx/.env`.

## Step 6: First start (manual image only)

```bash
cd /opt/boxx
docker login <registry>
docker compose pull
docker compose up -d db
docker compose run --rm -T app pnpm migrate
docker compose up -d app
```

## Step 7: First user

Open `https://<domain>/admin` — the panel asks to create the first admin account.

## Step 8: Data

The catalogue — product lines, buildings, furniture, models — is not in the
repository. Put it on the server one of two ways.

**Option A — from the repository.** Every model and texture is in
`catalogue/`, already optimised; the import scripts upload them as they are and
write the rows. On a workstation with Node 22, pnpm and Docker:

```bash
pnpm install
docker compose up -d                     # local Postgres
cp .env.example .env                     # DATABASE_URL points at it already
pnpm setup                               # migrate + product lines, regions, quiz copy
pnpm import:building all                 # every building
pnpm import:furniture all                # every furniture package, kitchens laid out in every kitchen
deploy/backup-data.sh boxx-data.tar.gz   # packs the rows and the uploaded files
```

The client's original glb files are not needed for this. They are only needed
to cut a model again (`--recut`, see README).

Copy `boxx-data.tar.gz` to the server, then `cd /opt/boxx && ./restore-data.sh boxx-data.tar.gz`.

**Option B — from a server that already has the data** (for example the test
server, after the catalogue was adjusted in its admin panel):

```bash
cd /opt/boxx && ./backup-data.sh boxx-data.tar.gz     # on the source server
cd /opt/boxx && ./restore-data.sh boxx-data.tar.gz    # on the new server
```

Both keep the accounts, saved quotes and integration settings of the server
they are run on; only the catalogue and its files are replaced.

With GitHub Actions the same restore can be run from the Actions tab: attach
`boxx-data.tar.gz` to a GitHub release, then run the **Deploy** workflow by hand
with `data_release` set to that release's tag. Ticking `wipe_database` there
drops the database first — for a test server that should start over.

## Updating

- With GitHub Actions: push to `main`.
- By hand: build and push a new image tag, set `APP_IMAGE` in `.env`, then
  `docker compose pull && docker compose run --rm -T app pnpm migrate && docker compose up -d app`.

## Backups

`./backup-data.sh` for the catalogue and files; `docker compose exec -T db pg_dump -U boxx configurator > all.sql`
for everything, accounts and quotes included.
