# Integrating the configurator

How a finished configuration leaves the configurator and reaches your systems.
Two channels exist, and they serve different sides of the fence:

| Channel | Runs where | Reaches | Use it for |
|---|---|---|---|
| **Webhook** | Configurator server → your server | Any backend: CRM, ERP, mailer, Zapier/Make | Anything that must happen even if the visitor closes the tab: creating a lead, sending emails, syncing to a sales pipeline. |
| **postMessage** | Configurator iframe → the page that embeds it | Browser JavaScript on the host page | Anything about *this visitor's* page: redirecting them, analytics events, updating the host UI, closing a modal. |

Both fire from the same event: the visitor pressing **Send** on the quote form.
Both are configured in the admin panel under **Sales → Integration Settings**.
Neither is required — a submitted quote is always stored in **Sales → Quotes**.

---

## 1. What happens on submit

```
visitor presses Send
  │
  ├─ 1. contact + configuration validated (Zod), row created in Quotes
  │       └─ reference minted (12 chars, e.g. K7MD4XQ2MN3P), status = new
  │
  ├─ 2. webhook (if Webhook URL is set)
  │       POST <webhookUrl>, 10 s timeout, no retries
  │       2xx → status = forwarded; anything else → status = webhook-failed
  │
  ├─ 3. server answers the browser: { quoteId, reference }
  │
  ├─ 4. postMessage  configurator:quote-submitted   (if enabled)
  │
  └─ 5. navigation
          Redirect URL empty  → own thank-you page /order/<reference>?submitted=1 (inside the iframe)
          Redirect URL set    → postMessage configurator:redirect, then window.top.location = url
```

Steps 1–2 are synchronous on the server; the visitor sees a spinner until the
webhook answers or times out. A webhook failure does **not** fail the request:
the quote is saved, the visitor sees success, and the row is marked
`webhook-failed` for a human to pick up.

---

## 2. Webhook

### Settings

| Field | Meaning |
|---|---|
| **Webhook URL** | Absolute `https://` URL. Empty → no webhook, quotes are only stored. |
| **Webhook headers** | Key/value pairs added to every request. Put your API key or shared secret here. |

### Request

```
POST <webhookUrl>
Content-Type: application/json
<your extra headers>

{
  "contact":       QuoteContact,
  "configuration": QuoteConfiguration
}
```

Shapes are in section 4. The body does **not** carry `quoteId` or `reference`
— if you need to match the webhook to the order page or to the admin row, key
on `contact.email` + `configuration.submittedAt`, or ask for the reference to be
added to the body.

### Behaviour

| Aspect | Value |
|---|---|
| Timeout | 10 seconds. A slower endpoint is treated as failed. |
| Success | Any `2xx` response. The response body is ignored. |
| Failure | Non-2xx, timeout, DNS/TLS error. Quote status becomes `webhook-failed`. |
| Retries | None. Failed quotes stay in the admin with status `webhook-failed`; re-sending is manual (copy the configuration from the row). |
| Ordering | One request per submit. Nothing is batched. |
| Delivery guarantee | At-most-once. |
| Authentication | Whatever you put in the headers. There is no HMAC signature. |
| Idempotency | None built in. Two clicks on Send are two quotes and two webhooks. |

### Securing the endpoint

1. Set a header in **Webhook headers**, e.g. `X-Configurator-Key: <long random string>`, and reject requests without it.
2. Serve the endpoint over HTTPS only.
3. Validate the body against the schema in section 4 before using it; the JSON column in the admin is hand-editable, the webhook body is not — but treat it as untrusted anyway.
4. Answer `2xx` fast (under a second) and do the slow work — CRM calls, emails — after responding. The visitor is waiting on your response.

### Minimal receiver (Node)

```js
import express from 'express'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post('/hooks/configurator', (req, res) => {
  if (req.get('X-Configurator-Key') !== process.env.CONFIGURATOR_KEY) return res.sendStatus(401)

  const { contact, configuration } = req.body
  res.sendStatus(202)                       // answer first

  queue.add('quote', { contact, configuration })   // then do the work
})
```

### Testing

Point **Webhook URL** at a request bin (webhook.site, RequestBin) or an
`ngrok` tunnel to your local server, submit a quote, inspect the body. The
admin row shows `forwarded` or `webhook-failed` immediately after submit.

---

## 3. postMessage

### Settings

| Field | Meaning |
|---|---|
| **Enable postMessage** | On by default. Off → no messages are sent; the configurator navigates on its own (section 5). |
| **Target origin** | Passed as `targetOrigin` to `window.postMessage`. `*` delivers to any embedding page. **Set your site's origin in production**, e.g. `https://www.boxxmodular.com` — the message contains the customer's full configuration and prices. |

Messages are sent only when the configurator is inside a frame
(`window.parent !== window`). Opened directly in a tab, nothing is posted.

### Message types

#### `configurator:quote-submitted`

Sent once, right after the server confirmed the quote was stored (and the
webhook, if any, has run). Always sent before `configurator:redirect`.

```ts
{
  type: 'configurator:quote-submitted'
  quoteId: number
  reference: string
  orderUrl: string
  configuration: QuoteConfiguration
}
```

**`quoteId`** — `number`. The primary key of the row in the `quotes` table,
i.e. the id in the admin URL `/admin/collections/quotes/<quoteId>` and in the
REST API `GET /api/quotes/<quoteId>` (signed-in user required). It is a serial
integer: it counts up with every quote, so it reveals order volume and is
guessable. Use it for internal bookkeeping — logging, matching against a REST
query, a link for staff — and never show it to the customer or build a public
link on it. `/order/<quoteId>` opens the order only for a signed-in admin; for
anyone else it answers as not found.

**`reference`** — `string`, always 12 characters from the alphabet
`23456789ABCDEFGHJKMNPQRSTVWXYZ` (no `0`/`O`, no `1`/`I`/`L`, so it can be
read out over the phone). Regex: `^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$`.
Minted on the server from `crypto.getRandomValues` when the row is created,
~59 bits of entropy, `unique` and indexed in the database. Written once and
never changed: editing the quote in the admin keeps it, and *Duplicate* in the
admin gives the copy a fresh one. This is the order number the customer sees
on the thank-you page (the `{reference}` placeholder in *After submitting*),
and it is the credential for the order page — whoever has it can open the 3D
view. That is the intended bargain, the same as a password-reset link: safe to
email to the customer, safe to put in your own URLs and CRM, not something to
publish. Look a quote up by it with
`GET /api/quotes?where[reference][equals]=<reference>`.
Defensive note: the server falls back to `''` if the row somehow came back
without one, so a listener that builds links should check `reference.length === 12`.

**`orderUrl`** — `string`, absolute:
`<configurator origin>/order/<reference>`, e.g.
`https://configurator.example.com/order/K7MD4XQ2MN3P`. The origin is the
iframe's own (`window.location.origin` inside the frame — the host of your
`<iframe src>`), never the host page's. It opens the read-only 3D view of
exactly this order: same building, same furniture in the same places, same
exterior options, nothing editable, no contact details on the page. It is
what the *View order* button on the thank-you page points at. Appending
`?submitted=1` turns it into the thank-you page instead of the 3D view. Use
it as-is in a `window.location.href`, an `<a href>`, or an email; it needs no
auth and does not expire. It is provided so the host does not have to know the
configurator's URL layout; if you build links yourself, `reference` is the
only part you need.

**`configuration`** — the same `QuoteConfiguration` object (section 4) that
was stored in the quote and POSTed to the webhook: built once in the browser at
submit time and sent unchanged to all three places.

**What is not there** — `contact` (name, email, phone, company). The host page
has no need for it, and a message to `targetOrigin: *` would hand it to any
embedding page. It is in the webhook body and in the admin.

#### `configurator:redirect`

Sent only when **After submitting → Redirect URL** is set to an external URL
(`http://` / `https://`). Not sent when the URL is empty or a same-origin path
(then the configurator navigates inside its own frame and the host is not
involved).

```ts
{
  type: 'configurator:redirect'
  url: string              // the Redirect URL from settings, already validated as http(s)
}
```

Immediately after posting it, the configurator tries `window.top.location.href = url`
itself. On a cross-origin host that throws and it falls back to navigating its
own iframe. A host that handles this message therefore gets to navigate first;
a host that ignores it gets the fallback.

### Host page listener

```js
const CONFIGURATOR_ORIGIN = 'https://configurator.example.com'

window.addEventListener('message', (event) => {
  // 1. Origin check. Every page on the internet can post to yours.
  if (event.origin !== CONFIGURATOR_ORIGIN) return
  const data = event.data
  if (!data || typeof data.type !== 'string') return

  switch (data.type) {
    case 'configurator:quote-submitted':
      // analytics, host UI, or redirect on your own terms
      dataLayer.push({ event: 'quote_submitted', reference: data.reference, value: data.configuration.totalPrice })
      window.location.href = '/quote-received?ref=' + encodeURIComponent(data.reference)
      break

    case 'configurator:redirect': {
      // 2. Only http(s). A javascript: URL here would run on your origin.
      const url = new URL(data.url)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return
      window.location.href = url.href
      break
    }
  }
})
```

Rules:

- Check `event.origin`. Never act on an unchecked message.
- Do not put anything from `event.data` into `innerHTML` or a `javascript:` URL.
- If you redirect on `quote-submitted`, leave **Redirect URL** empty in settings — otherwise the configurator will also try to navigate the top window and the two redirects race.
- The iframe must not be `sandbox`ed without `allow-top-navigation` if you rely on the built-in `window.top` fallback. With your own listener the sandbox does not matter.

### Embedding

```html
<iframe
  src="https://configurator.example.com/configurator?building=boxxplex&offices=8&restrooms=1"
  style="width:100%;height:100dvh;border:0"
  allow="fullscreen"
></iframe>
```

Query parameters (`building`, `offices`/`units`, `classrooms`, `restrooms`)
pre-select the building; see README → *Smart pre-loading*.

---

## 4. Data shapes

Source of truth: `src/entities/quote/model/schema.ts` (Zod). Everything below
is derived from it.

### `QuoteContact` (webhook only)

| Field | Type | Notes |
|---|---|---|
| `name` | string | required |
| `email` | string | required, validated as email |
| `phone` | string | optional |
| `company` | string | optional |

### `QuoteConfiguration` (webhook and postMessage)

| Field | Type | Notes |
|---|---|---|
| `buildingModelId` | number \| null | Row id in Catalog → Building Models. |
| `buildingTitle` | string | e.g. `"BOXXPlex 8-Section"`. |
| `lineSlug` | string | `boxxplex` \| `mobile-offices` \| `eduplex`. |
| `unitCount` | number | Offices (BOXXPlex, Mobile Offices) or classrooms (EDUPlex). |
| `restroomCount` | number | Restroom sets in the building. |
| `officeCount` | number | optional; offices in an EDUPlex building. |
| `packages` | `QuotePackage[]` | One line per placed furniture package. |
| `exterior` | `QuoteExterior[]` | optional; exterior options the visitor chose where there was a choice. |
| `totalPrice` | number | Sum of package and exterior prices; `0` when the catalogue has no prices. |
| `submittedAt` | string | ISO 8601 UTC, set by the browser at submit. |

### `QuotePackage`

| Field | Type | Notes |
|---|---|---|
| `packageId` | number | Row id in Catalog → Furniture Packages. |
| `title` | string | Package title at the time of the quote. |
| `roomKey` | string | Room in the building model, e.g. `office-2`, `common`, `conference`. |
| `zoneKey` / `zoneName` | string \| null | Zone of a shared room (`kitchen`, `conference`), or null when the room has none. |
| `price` | number \| null | Package price at the time of the quote; null when unpriced. |
| `x`, `z` | number | Position in metres in the building's scene, Y-up. |
| `rotationYDeg` | number | Rotation around the vertical axis, degrees. |
| `pieces` | array | optional; only for multi-part packages: `{ memberKey, x, z, rotationYDeg }` per part. |

A multi-part package (a table with chairs sold as one item) is **one line with
one price**; `pieces` records where each part stands.

### `QuoteExterior`

| Field | Type | Notes |
|---|---|---|
| `slotKey` / `slotName` | string | The spot on the building, e.g. `entrance-1` / `Entrance 1`. |
| `variantKey` / `title` | string | What was chosen there. |
| `price` | number \| null | |

Slots with a single option are part of the building and are not listed.

### Example (webhook body)

```json
{
  "contact": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 555 0100",
    "company": "Acme Construction"
  },
  "configuration": {
    "buildingModelId": 14,
    "buildingTitle": "BOXXPlex 8-Section",
    "lineSlug": "boxxplex",
    "unitCount": 8,
    "restroomCount": 1,
    "packages": [
      {
        "packageId": 3,
        "title": "Construction Office",
        "roomKey": "office-1",
        "zoneKey": null,
        "zoneName": null,
        "price": 1850,
        "x": 4.21,
        "z": -1.37,
        "rotationYDeg": 90,
        "pieces": [
          { "memberKey": "workstation", "x": 4.9, "z": -1.3, "rotationYDeg": 90 },
          { "memberKey": "table", "x": 3.3, "z": -0.7, "rotationYDeg": 90 },
          { "memberKey": "rack", "x": 3.4, "z": -2.5, "rotationYDeg": 0 }
        ]
      },
      {
        "packageId": 9,
        "title": "Kitchen",
        "roomKey": "common",
        "zoneKey": "kitchen",
        "zoneName": "Kitchen",
        "price": 2400,
        "x": -8.1,
        "z": 2.9,
        "rotationYDeg": 0
      }
    ],
    "exterior": [
      { "slotKey": "entrance-1", "slotName": "Entrance 1", "variantKey": "canopy", "title": "Steps with canopy", "price": 900 }
    ],
    "totalPrice": 5150,
    "submittedAt": "2026-09-17T10:42:11.000Z"
  }
}
```

The `postMessage` variant carries the same `configuration` plus `quoteId`,
`reference`, `orderUrl` (each described under `configurator:quote-submitted`
in section 3), and no `contact`:

```json
{
  "type": "configurator:quote-submitted",
  "quoteId": 42,
  "reference": "K7MD4XQ2MN3P",
  "orderUrl": "https://configurator.example.com/order/K7MD4XQ2MN3P",
  "configuration": { "...": "as above" }
}
```

---

## 5. After submitting (navigation)

**Sales → Integration Settings → After submitting → Redirect URL** decides where
the visitor goes once the quote is stored.

| Redirect URL | Behaviour |
|---|---|
| empty | Own thank-you page `/order/<reference>?submitted=1` inside the iframe. Heading, sentence (`{reference}` is substituted) and the "view order" button are editable in the same settings group. |
| `/some/path` | Same-origin path inside the configurator, navigated inside the iframe. |
| `https://…` | `configurator:redirect` is posted, then the top window is navigated. |
| anything else (`javascript:`, `//host`, garbage) | Treated as empty. |

Whatever happens, the confirmation with the reference and a link stays visible
underneath, so a redirect the browser refuses costs the visitor one click, not
the request.

---

## 6. Reading quotes afterwards

| Need | How |
|---|---|
| Show the customer their order | `https://<configurator>/order/<reference>` — read-only 3D view, no contact details. The link is the credential; it is safe to email. |
| Open a quote as admin | Sales → Quotes, or `/order/<quoteId>` while signed in. Unauthenticated, a numeric id answers as not found. |
| Pull quotes from a backend | Payload REST: `POST /api/users/login` `{ email, password }` → `token`; then `GET /api/quotes?where[status][equals]=new&sort=-createdAt` with `Authorization: JWT <token>`. `GET /api/quotes?where[reference][equals]=K7MD4XQ2MN3P` for one. All quote endpoints require a signed-in user; there is no public read. |
| Mark a quote handled | `PATCH /api/quotes/<id>` with `{ "status": "forwarded" }`, same auth. The `status` select has `new` / `forwarded` / `webhook-failed`; add values in `src/modules/quotes/collections/quotes.ts` if you need more. |

---

## 7. Use cases

| Scenario | Channel | Setup |
|---|---|---|
| **Lead into CRM (HubSpot, Salesforce, Pipedrive)** | Webhook | Webhook URL → your endpoint or a Zapier/Make catch hook. Map `contact` to the lead, `configuration` to a note or custom fields. |
| **Email the sales team / the customer** | Webhook | The configurator sends no email. Your endpoint (or Zapier) sends it from the webhook body. To include the order link `https://<configurator>/order/<reference>` in the customer's copy, the reference has to be in the body — it is not today (section 2). |
| **Redirect to a page on your site after submit** | postMessage | Listen for `configurator:quote-submitted`, `location.href = '/thanks?ref=' + reference`. Leave Redirect URL empty. |
| **Redirect without writing any JS** | Settings only | Set Redirect URL to `https://your-site/thanks`. Works as long as the host page is not sandboxed; the reference is not passed, so the page is generic. |
| **Analytics / conversion pixel on the host page** | postMessage | On `quote-submitted`, push `totalPrice`, `lineSlug`, `unitCount` to your tag manager. |
| **Close a modal / update host UI** | postMessage | Same listener; do not navigate. |
| **Polling instead of webhooks** (no public endpoint available) | REST | Cron job logs in, fetches `status=new`, processes, PATCHes to `forwarded`. |
| **Retry failed deliveries** | Admin + REST | Filter Quotes by `status=webhook-failed`; re-POST the `configuration` JSON to your endpoint yourself, then PATCH the status. No automatic retry exists. |

Rule of thumb: the **webhook** is the system of record for your backend; the
**postMessage** is a UI hint for the page the visitor is looking at. Do not
create leads from postMessage — it runs in the visitor's browser, where the
visitor can edit it — and do not redirect from the webhook, which has no
browser to redirect.
