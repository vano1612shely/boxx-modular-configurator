# Deployment

The app is one Next.js process: the configurator, the Payload admin and the REST
API all come out of the same build. Nothing else needs hosting except a database.

## What has to exist first

| Thing | Why | Notes |
| --- | --- | --- |
| **Postgres** | every collection lives there | `docker-compose.yml` in the repo runs one; anything reachable over TLS works |
| **A writable disk** | uploaded models, textures and images | the app writes `./models`, `./textures`, `./images` and serves them itself |

**The upload directories must survive a restart and a redeploy.** A host that
hands the process a fresh filesystem each time accepts every upload and loses it
by the next request, silently.

## Environment variables

`.env.example` has the full list with notes. The short version:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | needed at BUILD time too — migrations run there |
| `PAYLOAD_SECRET` | long random string; rotating it invalidates every session |
| `NEXT_PUBLIC_SERVER_URL` | the site's public URL |

`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` are for local seeding only. Do not set
them in production — the first admin is created through the admin UI, which
refuses to create a second one once any user exists.

## Building and running

```bash
pnpm install --frozen-lockfile
pnpm build:deploy
pnpm start
```

`build:deploy` is `pnpm migrate && pnpm generate:importmap && pnpm build`, and the
order is the point:

- **Migrate first.** A deploy that cannot migrate must fail before the code that
  assumes the new schema goes live; the previous version keeps running.
- **Then the import map.** `src/app/(payload)/admin/importMap.js` is generated
  from the config, so it has to be regenerated whenever an admin component is
  added or removed.

The process listens on `PORT` (3000 by default). Put a reverse proxy in front for
TLS, and **raise the request body limit there**: models here run to 100 MB, and
nginx defaults to 1 MB, which shows up as a `413` on upload.

## Migrations

Development uses Payload's push mode: it diffs the schema on boot and alters the
database in place, which is what you want while collections are still being
drawn. Everywhere else `push` is off (`src/payload.config.ts`) and schema changes
travel as committed migrations.

After changing any collection or field:

```bash
pnpm generate:types          # keep payload-types.ts in step
pnpm migrate:create <name>   # writes src/migrations/<timestamp>_<name>.ts
```

Read the generated SQL before committing it. Drizzle infers intent from a schema
diff, and a renamed field is indistinguishable from "drop one column, add
another" — which is silent data loss if you let it through.

`pnpm migrate:status` lists what has run. `pnpm migrate:down` reverts the last
batch, but treat it as a development convenience — a `down` that drops a column
destroys whatever was in it.

## First run on an empty database

```bash
pnpm migrate     # builds the schema — 25 tables
```

Then open `/admin`, which offers to create the first user. Nothing else is
seeded: regions, product lines, models and furniture are entered through the
admin. `pnpm seed` exists for local demo data and is not meant for production.

## Uploading models

Uploads pass through the app, which optimizes every model on the way in:
textures re-encoded to capped-size WebP, geometry compressed with meshopt.

Size the machine for that. The whole file is held in memory and the pipeline
works on top of it, so budget several times the largest model you intend to
upload — a 100 MB model is not a 100 MB job. And the request has to be allowed to
take the time: that is the proxy's read timeout, not only its body size. Node's
own heap ceiling is raised for the build (`--max-old-space-size=8000`); if
uploads start dying on large models, `pnpm start` wants the same treatment.

A `.gltf` that keeps its textures as separate files cannot be uploaded on its
own: the browser sends the one file you picked and the rest of the folder stays
behind. Pack it into a self-contained `.glb` first, from the folder that holds
the `.gltf`, its `.bin` and its `textures/`:

```bash
pnpm optimize:model path/to/scene.gltf
```

That writes `scene.optimized.glb` beside the input with everything embedded, and
that is the file to upload. The admin refuses a multi-file `.gltf` and says the
same thing, rather than storing a model whose textures can never load.
