import 'dotenv/config'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'

/**
 * The BOXX catalogue, as data, in one place.
 *
 * This is the only script that writes the catalogue, and it is meant to grow:
 * data arrives a section at a time, and each section is a table near the top of
 * this file rather than a script of its own. Twenty little importers would each
 * need their own argument parsing, their own idea of what "already there"
 * means, and their own order of running — one file with one table per
 * collection is what keeps that from happening.
 *
 * Every section matches on the key an admin would recognise — a slug, a code —
 * so running it twice updates rather than duplicates, and a value edited in the
 * admin is overwritten by the next run. That is the point: this file is the
 * source of truth, and the admin is where you look at it.
 *
 *   pnpm catalogue            import, or re-import over what is there
 *   pnpm catalogue --reset    empty the catalogue first, then import
 *   pnpm catalogue --status   count what is there and change nothing
 */

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

/**
 * Codes are lowercase: they arrive from a host page's query string, which
 * promises nothing about case, and the scope resolver folds both sides before
 * matching.
 */
const REGIONS = [
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
]

/**
 * Where everything below is sold, until a section says otherwise.
 *
 * Canada is a region the catalogue knows about, not one anything is offered in
 * yet — the Canadian range has not been handed over. Naming it once here rather
 * than repeating a region list in every section means the day it does arrive is
 * one edit, and there is one place to look to answer "what do we sell in
 * Canada".
 *
 * Worth knowing what this does to a visitor: `?region=ca` now matches nothing
 * and shows the empty-catalogue message, which is the honest answer while
 * nothing is sold there. A visitor who arrives with no region at all is not
 * narrowed and still sees everything.
 */
const SOLD_IN = ['us']

// ---------------------------------------------------------------------------
// Product Lines
// ---------------------------------------------------------------------------

/**
 * `rules` is deliberately absent. The restroom thresholds are a regulatory
 * matter each client fills in against their own code, and a number invented
 * here would read as a decision somebody made.
 */
const LINES = [
  { slug: 'boxxplex', name: 'BOXXPlex', unitLabel: 'offices' as const },
  { slug: 'mobile-offices', name: 'Mobile Offices', unitLabel: 'offices' as const },
  { slug: 'eduplex', name: 'EDUPlex', unitLabel: 'classrooms' as const },
]

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

/**
 * Emptied deepest first, so nothing is deleted out from under a document that
 * still points at it. Users are not on the list: the account you sign in with
 * survives a reset.
 *
 * `room-types` and `furniture-tiers` come back by themselves on the next boot —
 * `ensureCatalogueTerms` writes the starter terms into an empty catalogue — so
 * emptying those two resets them rather than removing them.
 */
const RESET_ORDER = [
  'quotes',
  'building-models',
  'furniture-packages',
  'exterior-options',
  'building-lines',
  'room-types',
  'furniture-tiers',
  'regions',
  'images',
  'models',
  'textures',
] as const

type Tally = { created: number; updated: number }

/**
 * Creates the document, or updates the one already carrying that key.
 *
 * The key is a field name rather than always `slug` because regions are known
 * by `code`. An admin hunting a duplicate looks at whichever column has to be
 * unique, and this matches on the same one.
 */
async function upsert(
  payload: Payload,
  collection: string,
  key: string,
  data: Record<string, unknown>,
  tally: Tally,
): Promise<{ id: number }> {
  // `collection` is a string here rather than one of Payload's literal slugs,
  // which is what lets one function serve every section. That costs the return
  // types, so they are named back — the alternative is a copy of this per
  // collection.
  const found = (await payload.find({
    collection: collection as never,
    where: { [key]: { equals: data[key] } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number }> }

  if (found.docs.length > 0) {
    const updated = await payload.update({
      collection: collection as never,
      id: found.docs[0].id,
      data: data as never,
    })
    tally.updated += 1
    return updated
  }

  const created = await payload.create({ collection: collection as never, data: data as never })
  tally.created += 1
  return created
}

/**
 * The first admin account, from the env, on a database that has none.
 *
 * Here rather than in the seed so that a brand-new database is usable after
 * `pnpm migrate && pnpm catalogue` and nothing else. An existing account is
 * never touched — no password is reset by running this.
 */
async function ensureAdminUser(payload: Payload) {
  const email = process.env.DEV_ADMIN_EMAIL
  const password = process.env.DEV_ADMIN_PASSWORD
  if (!email || !password) return

  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) return

  await payload.create({ collection: 'users', data: { email, password } })
  payload.logger.info(`users: created ${email}`)
}

async function status(payload: Payload) {
  const counts: string[] = []
  for (const slug of [...RESET_ORDER, 'users' as const]) {
    const { totalDocs } = await payload.count({ collection: slug as never })
    counts.push(`${slug} ${totalDocs}`)
  }
  payload.logger.info(counts.join(', '))
}

async function reset(payload: Payload) {
  for (const slug of RESET_ORDER) {
    // Payload's way of saying "every one of them".
    const { docs, errors } = await payload.delete({
      collection: slug as never,
      where: { id: { exists: true } },
    })
    if (docs.length || errors.length) {
      payload.logger.info(`${slug}: deleted ${docs.length}${errors.length ? `, ${errors.length} failed` : ''}`)
    }
    for (const error of errors) payload.logger.error(`${slug} ${error.id}: ${error.message}`)
  }
}

function report(payload: Payload, collection: string, tally: Tally) {
  payload.logger.info(`${collection}: ${tally.created} created, ${tally.updated} updated`)
}

async function main() {
  const payload = await getPayload({ config })

  if (process.argv.includes('--status')) {
    await status(payload)
    process.exit(0)
  }

  if (process.argv.includes('--reset')) {
    payload.logger.info('Emptying the catalogue — accounts are kept.')
    await reset(payload)
  }

  await ensureAdminUser(payload)

  const regions: Tally = { created: 0, updated: 0 }
  const regionIds = new Map<string, number>()
  for (const region of REGIONS) {
    const doc = await upsert(payload, 'regions', 'code', region, regions)
    regionIds.set(region.code, doc.id as number)
  }
  report(payload, 'regions', regions)

  // Thrown rather than skipped: an empty `regions` reads as "sold everywhere",
  // so a typo here would quietly widen the catalogue instead of narrowing it.
  const soldIn = SOLD_IN.map((code) => {
    const id = regionIds.get(code)
    if (id === undefined) throw new Error(`SOLD_IN names "${code}", which is not in REGIONS.`)
    return id
  })

  const lines: Tally = { created: 0, updated: 0 }
  for (const line of LINES) {
    await upsert(payload, 'building-lines', 'slug', { ...line, regions: soldIn }, lines)
  }
  report(payload, 'building-lines', lines)

  await status(payload)
  process.exit(0)
}

await main()
