import type { Payload } from 'payload'

import { STARTER_FURNITURE_TIERS, STARTER_ROOM_TYPES } from './room-types'

const CATALOGUES = [
  ['room-types', STARTER_ROOM_TYPES],
  ['furniture-tiers', STARTER_FURNITURE_TIERS],
] as const

/** Every term, by `<collection>:<slug>`, once the missing ones have been made. */
export type CatalogueTerms = {
  roomType: (slug: string) => number
  tier: (slug: string) => number
}

/**
 * Puts the starter room types and furniture tiers in the database.
 *
 * These used to be lists in the code, so they were always there. Now they are
 * rows, and rows have to be written by somebody — on a fresh clone, on a
 * developer's database that the schema was pushed to rather than migrated, and
 * on a server whose migration made the tables but whose catalogue an admin has
 * since edited.
 *
 * Written term by term against what is already there, so it is safe to run on
 * every boot: matching is by slug, so a term an admin renamed keeps its name
 * and is not duplicated.
 *
 * A starter term an admin deletes, though, is missing by this test and comes
 * back on the next boot. Nothing records that the deletion was deliberate, and
 * telling that apart from a database that never had the row needs somewhere to
 * write it down — so for now a starter term cannot be got rid of for good, only
 * renamed or left unused.
 */
export async function ensureCatalogueTerms(payload: Payload): Promise<CatalogueTerms> {
  const ids = new Map<string, number>()

  for (const [collection, starters] of CATALOGUES) {
    const existing = await payload.find({ collection, limit: 1000, depth: 0 })
    for (const doc of existing.docs) ids.set(`${collection}:${doc.slug}`, doc.id)

    for (const term of starters) {
      if (ids.has(`${collection}:${term.slug}`)) continue
      const made = await payload.create({ collection, data: { ...term } })
      ids.set(`${collection}:${term.slug}`, made.id)
    }
  }

  const lookup = (collection: string) => (slug: string) => {
    const id = ids.get(`${collection}:${slug}`)
    if (id === undefined) throw new Error(`No "${slug}" in ${collection}.`)
    return id
  }

  return { roomType: lookup('room-types'), tier: lookup('furniture-tiers') }
}
