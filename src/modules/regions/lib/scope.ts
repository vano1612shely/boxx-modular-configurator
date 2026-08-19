import { getPayload, type Where } from 'payload'

import config from '@payload-config'

/** No region carries this id, so an unrecognised code matches nothing. */
const UNKNOWN_REGION = -1

/** The id to scope a request to, or null when no region was asked for. */
export type RegionScope = number | null

/**
 * Region codes come from a host page's query string, where nobody guarantees
 * the case. The collection is a handful of rows, so matching in memory is
 * cheaper than teaching the query layer about case folding.
 */
export async function resolveRegionScope(code: string | undefined): Promise<RegionScope> {
  if (!code) return null

  const payload = await getPayload({ config })
  const regions = await payload.find({ collection: 'regions', limit: 100, depth: 0 })
  const wanted = code.trim().toLowerCase()
  const match = regions.docs.find((region) => region.code.toLowerCase() === wanted)

  return match?.id ?? UNKNOWN_REGION
}

/**
 * An empty `regions` list means "sold everywhere" — the same convention
 * `compatibleLines` already uses, and what keeps every existing record visible.
 *
 * An unrecognised code narrows to those unrestricted items rather than widening
 * back to everything: showing a region-locked product for a region we cannot
 * identify is the failure this field exists to prevent.
 */
export function regionClauses(scope: RegionScope): Where[] {
  if (scope === null) return []
  return [{ or: [{ regions: { contains: scope } }, { regions: { exists: false } }] }]
}

/** Payload rejects an empty `and`, so an unscoped query has to pass nothing. */
export function whereAll(clauses: Where[]): Where {
  return clauses.length === 0 ? {} : { and: clauses }
}
