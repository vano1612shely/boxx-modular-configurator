# 3D Building Configurator

A guided 3D configurator for modular buildings (IKEA room-designer style) with a full admin panel.
Customers pick a building by answering two questions, furnish it with predefined furniture
packages and send a quote request — the whole catalog is managed
through the admin panel without code changes.

**Stack:** Next.js (App Router) + Payload CMS 3 (monolith) · PostgreSQL · three.js +
React Three Fiber + drei · zustand · Tailwind 4 + shadcn-style tokens · glTF-Transform
asset pipeline · Zod.

---

## Quick start (development)

```bash
cp .env.example .env            # fill PAYLOAD_SECRET (any random string)
docker compose up -d postgres   # Postgres 17 on :5432
pnpm install
pnpm dev                        # http://localhost:3000
pnpm seed                       # demo catalog: 1 building, 2 packages
```

- Client configurator: `http://localhost:3000/configurator`
- Admin panel: `http://localhost:3000/admin` (first visit prompts to create the admin user)
- Tests: `pnpm test` · Types: `pnpm generate:types` after changing collections

## Deployment

Pushing to `main` builds an image, pushes it to GHCR and releases it to the server
(`.github/workflows/deploy.yml`). Everything below is the same thing done by hand,
from a bare Ubuntu server — useful for a second environment, or when CI is not an
option.

The stack is two containers, `db` and `app`, on a private bridge network. The
database publishes no port at all and the app is bound to `127.0.0.1`, so nginx is
the only way in. Nothing that matters lives inside a container: uploads and the
database directory are bind mounts from `/opt/boxx`.

### 1. Install what the server needs

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

### 2. Make the directories the data will live in

The uploads must be owned by uid 1000 (the `node` user inside the app image) and
the database directory by uid 999 (`postgres` inside its image). Get this wrong and
the containers start and then fail on the first write.

```bash
mkdir -p /opt/boxx/uploads/{models,textures,images,media} /opt/boxx/postgres
chown -R 1000:1000 /opt/boxx/uploads
chown -R 999:999 /opt/boxx/postgres
```

### 3. Write the environment file

`/opt/boxx/.env`, readable only by root (`chmod 600`). Generate the secrets, do not
invent them:

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

APP_IMAGE=ghcr.io/vano1612shely/boxx-modular-configurator:latest
EOF
chmod 600 .env
```

`DATABASE_URL` points at `db`, the service name — that is the hostname on the
private network, not `localhost`.

### 4. Put the stack definition in place

Copy `deploy/docker-compose.yml` from this repository to
`/opt/boxx/docker-compose.yml`, and `deploy/nginx.conf` to
`/etc/nginx/sites-available/boxx`, then:

```bash
ln -sfn /etc/nginx/sites-available/boxx /etc/nginx/sites-enabled/boxx
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 5. Get the image

The image is **not** built on the server: `pnpm build` asks for 8 GB of heap, and a
small VPS does not have it. Either pull one CI already published —

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
docker compose pull
```

— or build it on a machine that can and push it:

```bash
docker build -t ghcr.io/vano1612shely/boxx-modular-configurator:latest .
docker push ghcr.io/vano1612shely/boxx-modular-configurator:latest
```

### 6. Start it

```bash
cd /opt/boxx
docker compose up -d db          # wait for it to report healthy
docker compose run --rm app pnpm migrate
docker compose up -d app
```

Migrations run **before** the app serves. If they fail, stop — do not start the new
image against a schema it does not match.

### 7. Check it

```bash
curl -I http://localhost/configurator     # expect 200
docker compose ps                          # both services up, db healthy
docker compose logs -f app
```

Then open `http://SERVER_IP/admin` and create the first admin user. The admin panel
refuses to create a second one once any user exists, so do this yourself.

### Schema changes need a migration, always

Development runs Payload's push mode: the database is altered to match the
collections on boot. Production does not — it applies only what is committed under
`src/migrations`. A field added without a migration therefore works perfectly
locally and breaks exactly one collection in production.

After changing any collection or field:

```bash
pnpm generate:types
pnpm migrate:create <name>      # commit both the .ts and the .json snapshot
```

Read the generated SQL before committing it. Drizzle infers intent from a schema
diff, and a renamed field is indistinguishable from "drop one column, add another".

CI queries every collection after a release for this reason: a page can render
while the schema under it is a migration behind.

### Updating later

```bash
cd /opt/boxx
docker compose pull
docker compose run --rm app pnpm migrate
docker compose up -d app
```

To roll back, point `APP_IMAGE` in `/opt/boxx/.env` at an older tag — CI tags every
image with its commit SHA — and run the same three commands.

### TLS

The server answers on plain HTTP. With a domain pointed at it:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.example
```

Certbot rewrites the nginx site in place and sets up renewal.

### Uploads

Models, textures and images are written to `./models`, `./textures` and `./images`
relative to the working directory — `/app` in the container, which is where the
bind mounts land. Those directories must survive a restart and a redeploy.

---

## Embedding into the host website

The configurator is iframe-first:

```html
<iframe
  src="https://example.com/configurator?building=boxxplex&offices=8&restrooms=1"
  style="width:100%;height:100dvh;border:0"
  allow="fullscreen"
></iframe>
```

### Smart pre-loading (query parameters)

| Param | Meaning |
|---|---|
| `building` | Building line slug (e.g. `boxxplex`). Omit → intake form is shown. |
| `offices` / `units` | Requested unit count. The rules engine resolves the closest fitting size. |
| `restrooms` | `1`/`true` if restrooms are required. |

Business rules per line (admin-editable): restrooms become mandatory at a threshold, a second
restroom set at a higher one, and requests above `maxUnits` route to the custom-quote screen.

### Quote hand-off

On submit the configuration is:

1. Stored in the **Quotes** collection (admin panel → Sales → Quotes).
2. POSTed as JSON to the webhook configured in **Integration Settings** (optional headers
   supported, e.g. an API key). Status per quote: `new` / `forwarded` / `webhook-failed`.
3. Emitted to the embedding page via `postMessage` (if enabled in Integration Settings):

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'configurator:quote-submitted') {
    // event.data.configuration — building, packages, prices
  }
})
```

The payload shape is defined once in `src/entities/quote/model/schema.ts` (Zod).

---

## Admin panel guide

| Section | What it does |
|---|---|
| **Media → Models** | Upload `.glb`/self-contained `.gltf`. Files are auto-optimized on upload (dedup, prune, weld, WebP textures ≤2048px, meshopt compression) and metadata (triangles, bbox, sizes) is recorded. |
| **Catalog → Building Lines** | Product lines + sizing rules (restroom thresholds, max units) and regions. |
| **Catalog → Building Models** | One entry per size. The **Scene Editor** tab is the visual setup: default camera & limits ("Set default camera from view"), hidden-mesh patterns (roof/ceiling), wall auto-hide pattern, drawing room zones on the floor, per-room camera presets, default furniture placements (click-to-place). |
| **Catalog → Furniture Packages** | Package + model, price, footprint (used for fit/collision checks), compatible room types / building lines / regions. |
| **Sales → Quotes** | Submitted quote requests with the full configuration JSON. |
| **Sales → Integration Settings** | Webhook URL + headers, postMessage toggle and target origin. |

New buildings/packages go live immediately — no rebuild or deploy needed.

## 3D asset requirements

Models are used as-is after automatic optimization; prepare them once before upload:

- **Format:** `.glb` (preferred) or self-contained `.gltf`. FBX/OBJ must be converted first.
- **Scale:** real-world meters; +Y up; building floor at y=0, centered near the origin.
- **Naming (critical):** roof/ceiling meshes contain `roof`/`ceiling` in the name; exterior
  wall meshes contain `wall` (configurable per building). Rooms as separate groups with
  meaningful names allow per-room isolation.
- **Furniture packages:** one group per package, centered at the origin, resting on y=0.
- Textures up to 2048px are kept; larger ones are downscaled on upload.

## Architecture notes

- `src/modules/*` — Payload domains (users, media, regions, buildings, furniture,
  quotes); `payload.config.ts` only aggregates them.
- `src/entities|features|views` — FSD frontend; interactive slices follow MVVM
  (`use<Slice>Model` hooks); shared control-flow primitives in `src/shared/ui/control-flow`.
- Rules engine: `src/entities/building/lib/rules-engine.ts` (pure, unit-tested).
- Placement geometry (fit/collision/clamping): `src/features/package-placement/lib/placement-geometry.ts` (unit-tested).
- Models load lazily: the building glb loads on entry; a furniture package glb loads only
  when the customer adds it.
