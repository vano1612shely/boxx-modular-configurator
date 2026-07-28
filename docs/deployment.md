# Deployment

The app is one Next.js process: the configurator, the Payload admin and the
REST API all come out of the same build. Netlify runs it on its Next.js
runtime; nothing else needs hosting except a database and a file store.

## What has to exist before the first deploy

Netlify gives you neither of these, so both are set up once, by hand:

| Thing | Why | Options |
| --- | --- | --- |
| **Postgres** | every collection lives there | Neon, Supabase, RDS — anything reachable over TLS |
| **S3 bucket** | uploaded models, textures and images | S3, Cloudflare R2, Backblaze B2 |

The bucket is not optional in production. Uploads are written through
`@payloadcms/storage-s3`, which switches on as soon as `S3_BUCKET` is set (see
`src/payload.config.ts`). Leave it unset and Payload falls back to writing files
next to the code — on a serverless host that disk is wiped between invocations,
so every upload appears to succeed and is gone by the next request.

## Environment variables

Set these in **Site configuration → Environment variables**. Everything except
`NEXT_PUBLIC_SERVER_URL` should be marked secret.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `postgresql://…`. Needed at BUILD time too — migrations run there |
| `PAYLOAD_SECRET` | long random string; rotating it invalidates every session |
| `NEXT_PUBLIC_SERVER_URL` | the site's public URL, e.g. `https://3d-configurator.netlify.app` |
| `S3_BUCKET` | presence of this switches storage from local disk to S3 |
| `S3_ENDPOINT` | required for R2/B2; omit for real AWS |
| `S3_REGION` | `auto` for R2 |
| `S3_ACCESS_KEY_ID` | |
| `S3_SECRET_ACCESS_KEY` | |

`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` are for local seeding only. Do not set
them in production — the first admin is created through the admin UI, which
refuses to create a second one once any user exists.

## Automatic rebuilds

Yes, this is Netlify's default behaviour and needs no extra machinery. Once the
GitHub repository is linked (**Site configuration → Build & deploy → Continuous
deployment**), Netlify installs a webhook and every push to the production
branch builds and publishes. Pull requests get their own preview deploys.

The one thing worth changing from the defaults: preview deploys share the
`DATABASE_URL` of production unless you scope a different value to the
`deploy-preview` context. A preview build runs migrations, so an unscoped
setup means a branch can migrate production's database.

## Migrations

Development uses Payload's push mode: it diffs the schema on boot and alters
the database in place, which is what you want while collections are still being
drawn. Everywhere else `push` is off (`src/payload.config.ts`) and schema
changes travel as committed migrations.

After changing any collection or field:

```bash
pnpm generate:types          # keep payload-types.ts in step
pnpm migrate:create <name>   # writes src/migrations/<timestamp>_<name>.ts
```

Read the generated SQL before committing it. Drizzle infers intent from a
schema diff, and a renamed field is indistinguishable from "drop one column,
add another" — which is a silent data loss if you let it through.

Netlify applies them: `build:netlify` is `pnpm migrate && pnpm build`, so the
schema is always in place before the code that assumes it. A failed migration
fails the deploy and the previous version stays live.

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
