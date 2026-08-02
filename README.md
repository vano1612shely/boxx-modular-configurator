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

## Production

```bash
pnpm build
pnpm start          # serves on PORT (default 3000)
```

Reverse-proxy `/configurator` (and `/admin`, `/api`) to this app. Example nginx location:

```nginx
location /configurator { proxy_pass http://127.0.0.1:3000; }
location /admin        { proxy_pass http://127.0.0.1:3000; }
location /api          { proxy_pass http://127.0.0.1:3000; }
location /_next        { proxy_pass http://127.0.0.1:3000; }
```

### Uploads

Models, textures and images are written to `./models`, `./textures` and `./images`
next to the code, and served by the app. Those directories must survive a restart
and a redeploy.

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
