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
pnpm setup                      # schema + catalogue + the admin account from .env
pnpm dev                        # http://localhost:3000
```

- Client configurator: `http://localhost:3000/configurator`
- Admin panel: `http://localhost:3000/admin` (`pnpm setup` makes the account named in `.env`)
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

### What the server has to be

Serving the configurator is light. Sizing is decided by model upload, which
optimises the file inside the request.

| | |
|---|---|
| RAM | **4 GB** is enough, 8 GB is comfortable. This is not the lever — see below |
| vCPU | **2**, and prefer a dedicated core over four shared ones |
| Disk | NVMe, 40 GB + room for every model you will ever upload |
| Swap | 2 GB, as a cliff-edge guard |

**Upload time is dominated by the wire, not the server.** Measured against this
deployment: 11.8 MB took 29.6 s to reach it, an upstream of ~3.2 Mbit/s, while
optimising that same file on the box took 12.7 s. A 180 MB source spends
minutes being uploaded and under a minute being processed. Buying RAM does not
touch that, and buying cores barely touches the rest.

So the fix that actually works is to send less: run `pnpm optimize:model <file>`
on a workstation and upload the `.glb` it writes. It is the same pipeline, and
it takes a 180 MB source to about 12 MB — a fifteenfold smaller upload.

Memory is not a constraint and does not need planning for. A measured 11.2 MB
model carrying 86 Mpx of textures peaks under 1 GB, and this deployment has
never touched its swap.

Where the server time goes, on that model: images 73%, `prune` 16%, `meshopt`
6%, everything else 5%. Textures are encoded one after another, so a second
core changes almost nothing — measured at 12.7 s against 12.0 s with the
encoder given two threads. Single-core speed is what moves it. Those stages are
also synchronous JavaScript, so they hold the event loop while they run and the
site stutters during a large upload.

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

A swap file, if the image does not already come with one. It is there so a big
upload degrades instead of having the kernel shoot Postgres:

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
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
docker compose run --rm app pnpm setup
docker compose up -d app
```

`pnpm setup` is `pnpm migrate` and then `pnpm catalogue`: it creates the schema and
writes the catalogue, and both are safe to run again on a database that already has
them. It runs **before** the app serves. If it fails, stop — do not start the new
image against a schema it does not match.

On a server with no `DEV_ADMIN_*` in its environment no account is made, and the
first visit to `/admin` asks for one. That is on purpose: the credentials in a
development `.env` have no business on somebody else’s hardware.

### 7. Check it

```bash
curl -I http://localhost/configurator     # expect 200
docker compose ps                          # both services up, db healthy
docker compose logs -f app
```

Then open `http://SERVER_IP/admin` and create the first admin user. The admin panel
refuses to create a second one once any user exists, so do this yourself.

### The catalogue is data, and it lives in one file

`scripts/catalogue.ts` holds the real BOXX catalogue — the product lines, and every
section added to it since — and it is the only script that writes them:

```bash
pnpm catalogue            # import, or re-import over what is there
pnpm catalogue --reset    # empty the catalogue first, then import
pnpm catalogue --status   # count what is there and change nothing
```

Every section matches on the key an admin would recognise — a slug, a code — so a
second run updates rather than duplicates, and a value edited in the admin panel is
overwritten by the next one. Sections go in that one file rather than in a script
each: twenty importers would be twenty ideas about what “already there” means.

Which regions a section is sold in is one constant, `SOLD_IN`, rather than a list
repeated per section — so widening the catalogue to Canada is one edit, and there is
one place to look to answer what is sold where. An empty `regions` on a document
means "sold everywhere", so scoping is something you add, never something you forget:
a region named in `SOLD_IN` that is not in `REGIONS` throws rather than importing a
line that quietly sells everywhere.

`--reset` empties the catalogue and leaves the accounts alone. The room types and
furniture tiers come back on the next boot — `ensureCatalogueTerms` writes the
starter terms into an empty catalogue — so resetting those two restores them rather
than removing them.

### Buildings are imported from the client's glbs, one spec each

A building is two glb files from the client — the model cut open horizontally, and
the whole thing for its roof and ceiling — plus a spec under `scripts/buildings/`
saying where its rooms, doors and windows are, in the file's own coordinates.

```bash
pnpm analyze:model <file.glb> --out r.json          # what is in the file: floors, materials, nodes
pnpm analyze:model <file.glb> --islands door_frame  # every door, as a box
pnpm audit:building <slug>                          # check a spec against its glb
pnpm import:building <slug> [--reuse]               # audit, cut, upload, write the building
```

The spec is checked before anything is uploaded: every outline edge must lie on a
wall, every declared door and window must have a casing at both jambs, and no wall
may stand inside a room. That check is what lets a new size of a line be written as
a handful of shifts of pieces already measured — the EDUPlex sizes are all
`eduplex-school.ts` with a list of columns — rather than measured again.

Assets are shared, not copied: a size names the building it takes its finishes, door
and window from (`reuseAssetsFrom`), and only its own roof is cut. A room can pick
a different door than the building's usual one (`openingModelKeys`) — a school's
offices have one, its classrooms another.

### Furniture packages are imported the same way

A package is one glb from the client, named `<region>_<tier>_<what>_package_NN.glb`
— the tier and the region are read off the name — and an entry in
`scripts/furniture/packages.ts`. Every file carries the floor it was rendered on;
that is dropped. A package is either the whole file as one model, or a group of
pieces cut out by object name, each standing where the modeller put it unless the
spec says otherwise. A visitor adds a group whole and then moves its pieces one by
one, which is what lets a customer rearrange a desk against a table.

```bash
pnpm analyze:model <file.glb> --objects       # the objects in the file, with where they stand
pnpm import:furniture <slug|all> [--reuse]    # cut, upload, write the package
```

The import writes the title, the tier, the region, the pieces and — when the
spec names them — the rooms. Price, picture and description are set in the admin
and a re-import leaves them alone.

A fitted package (the kitchens) is laid out by the import in every kitchen of
every building: the counter and the sink are read off the building's model, and
the appliances, fridge, cooler, table and bin go where the client's pictures put
them (`layoutKitchen` in the importer). Re-importing a kitchen re-lays it
everywhere; re-importing a building keeps the sets it already had.

### Schema changes need a migration, always

Development runs Payload's push mode: the database is altered to match the
collections on boot. Production does not — it applies only what is committed under
`src/migrations`. A field added without a migration therefore works perfectly
locally and breaks exactly one collection in production.

The history was collapsed on 2026-09-10: twenty-two migrations that only ever ran
against a test server became one baseline, checked by migrating an empty database
and diffing the result against the pushed schema column by column. Nothing is
gained by replaying how the schema got here, and a shorter chain is a faster and
more honest way to stand up the client’s own hardware.

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
docker compose run --rm app pnpm setup
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

### Telling a slow upload from a slow server

A slow upload is almost always the wire. To see the split rather than guess it,
give nginx a log format that records both halves — in the `http` block of
`/etc/nginx/nginx.conf`:

```nginx
log_format upload '$remote_addr "$request" $status body=$request_length rt=${request_time}s upstream=${upstream_response_time}s';
access_log /var/log/nginx/access.log upload;
```

`rt` is the whole request including the body arriving; `upstream` is what the
app spent on it. The gap between them is transfer.

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
| `offices` / `units` | Requested unit count for a line counted in offices. The rules engine resolves the closest fitting size. |
| `classrooms` | Requested unit count for a line counted in classrooms (EDUPlex). |
| `offices` (with `classrooms`) | Offices wanted on top of the classrooms — a school with two offices and a kitchen is still a six-classroom school, so these never count as units. |
| `restrooms` | How many restroom sets are wanted (`1`/`true` for one). |

A school link therefore reads `?building=eduplex&classrooms=6&offices=2&restrooms=1`. Among the
models of the fitting size the engine takes the smallest restroom count that covers the request,
then the smallest office count that does — restrooms first, because a restroom can be mandated by
the line's rules and an office never is.

Business rules per line (admin-editable): restrooms become mandatory at a threshold, a second
restroom set at a higher one, and requests above `maxUnits` route to the custom-quote screen.

### Quote hand-off

Full reference — message types, webhook contract, data shapes, use cases — is in
[integration.md](integration.md). In short, on submit the configuration is:

1. Stored in the **Quotes** collection (admin panel → Sales → Quotes).
2. POSTed as JSON to the webhook configured in **Integration Settings** (optional headers
   supported, e.g. an API key). Status per quote: `new` / `forwarded` / `webhook-failed`.
3. Emitted to the embedding page via `postMessage` (if enabled in Integration Settings):

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'configurator:quote-submitted') {
    // event.data.quoteId       — the row in the admin panel
    // event.data.reference     — the order number the customer was shown, e.g. K7MD4XQ2
    // event.data.orderUrl      — the configurator's own page for it, /order/<reference>
    // event.data.configuration — building, packages, prices
    // A host that wants to move the visitor itself can do it here, e.g.
    // window.location.href = '/order-received?ref=' + event.data.reference
  }
})
```

The configuration's shape is defined once in `src/entities/quote/model/schema.ts` (Zod).

Then the visitor is sent on. **Integration Settings → After submitting** decides where:

- **Redirect URL empty** — our own thank-you page at `/order/<reference>?submitted=1`. Its heading,
  its sentence (`{reference}` is filled in) and the label on its button are all editable there.
- **Redirect URL set** — that address, in the top window. Because a cross-origin parent cannot be
  navigated from inside the frame, the host page is asked first and can do it properly itself:

```js
const CONFIGURATOR_ORIGIN = 'https://configurator.example'

window.addEventListener('message', (event) => {
  // Check the origin first, always. Any page on the internet can post to yours,
  // and a `location.href` driven by an unchecked message is a redirect — or, with
  // a `javascript:` URL, script execution — handed to whoever sent it.
  if (event.origin !== CONFIGURATOR_ORIGIN) return
  if (event.data?.type !== 'configurator:redirect') return

  const url = new URL(event.data.url)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  window.location.href = url.href
})
```

The same check belongs on the `configurator:quote-submitted` listener above.

Without a listener the configurator falls back to `window.top`, then to the frame it is in. The
confirmation stays on screen underneath with a plain link, so a redirect the browser refuses costs
one click rather than the whole request.

### Viewing a saved order

Every quote carries a **reference** — twelve random characters, written once and never changed —
and `/order/<reference>` opens that exact configuration in the 3D view: the same building, the same
furniture in the same places, the same entrances, with everything that edits the scene taken away.
The link is the credential, so it can be emailed to a customer; the page never shows contact
details. The reference and a ready-made link are on each quote in the admin.

A signed-in admin can also open `/order/<quote id>`. Without a Payload session that answers exactly
as an unknown reference does, so the serial ids cannot be counted through from outside.

---

## Admin panel guide

| Section | What it does |
|---|---|
| **Media → Models** | Upload `.glb`/self-contained `.gltf`. Files are auto-optimized on upload (dedup, prune, weld, WebP textures ≤2048px, meshopt compression) and metadata (triangles, bbox, sizes) is recorded. |
| **Catalog → Building Lines** | Product lines + sizing rules (restroom thresholds, max units) and regions. |
| **Catalog → Building Models** | One entry per size. The **Scene Editor** tab is the visual setup: default camera & limits ("Set default camera from view"), hidden-mesh patterns (roof/ceiling), wall auto-hide pattern, drawing room zones on the floor, per-room camera presets, default furniture placements (click-to-place). |
| **Catalog → Furniture Packages** | Package + model, price, footprint (the floor rectangle used for fitting into a room; what a piece may be pushed up against is measured from the model itself), compatible room types / building lines / regions. |
| **Sales → Quotes** | Submitted quote requests with the full configuration JSON, each with its order reference and a link to the 3D view of it. |
| **Sales → Integration Settings** | Webhook URL + headers, postMessage toggle and target origin, and what happens after a request is sent: redirect URL, or the wording on our own thank-you page. |

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
  quotes, settings) plus `shared`, which holds what more than one of them needs.
  `payload.config.ts` aggregates them and does the two things that belong to the
  whole app: the admin's own branding, and writing the starter room types and
  furniture tiers on boot.
- `src/entities|features|views` — FSD frontend; interactive slices follow MVVM
  (`use<Slice>Model` hooks); shared control-flow primitives in `src/shared/ui/control-flow`.
  Six of the nine feature slices carry such a hook — `admin-model-viewer`,
  `building-intake` and `order-view` are small enough to be their components.
- A furniture package is one model, or several. Several makes it a *group*: the
  visitor adds and removes the whole thing for one price but moves each piece
  afterwards, so a group becomes one placement per piece sharing a `groupId`.
  Everything downstream — the drag, the collision tests, the clamp to the room —
  sees ordinary furniture, because `placedPackage` in `@/entities/furniture-package`
  dresses a piece as a package of its own. The default arrangement is laid out in
  `admin-furniture-group`, on the package's own page.
- Rules engine: `src/entities/building/lib/rules-engine.ts` (pure, unit-tested).
- Placement geometry (fit/collision/clamping): `src/features/package-placement/lib/placement-geometry.ts` (unit-tested).
- Two packages are in each other's way only if all three of these are true, in order:
  their upright bounding boxes overlap, their footprint rectangles overlap, and — once
  both models have loaded — the models themselves share space. The third question is what
  lets a chair be pushed under a desk: `src/entities/furniture-package/lib/measured-shapes.ts`
  drops a vertical line through each cell of a grid over the package's footprint and pairs
  the surfaces it crosses into runs of solid, so the air between a desk's legs is air.
  Written as a conjunction beginning with the old rule, so a shape can only ever *allow*
  more — nothing placeable before is refused now. **A model built as one solid block from
  the floor up has nothing to slide under**; the demo desk and conference table are a top
  on four legs for exactly this reason.
- Adding by the "+" button still places by footprint alone, deliberately — see the comment
  at `addToSection` in `src/features/package-placement/model/use-package-placement-model.ts`.
- Models load lazily: the building glb loads on entry; a furniture package glb loads only
  when the customer adds it.
