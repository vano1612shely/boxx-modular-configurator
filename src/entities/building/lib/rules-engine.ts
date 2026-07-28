import type { BuildingLineRules } from '../model/types'

export type SizingInput = {
  requestedUnits: number
  /** Restroom sets the customer asked for. The line's rules can raise it. */
  restroomsRequested: number
}

export type SizingCandidate = {
  id: number
  unitCount: number
  restroomCount: number
}

export type SizingResult =
  | {
      status: 'ok'
      modelId: number
      /** What the request and the line's mandates added up to asking for. */
      restroomSetsRequired: number
    }
  | { status: 'over-capacity' }
  | { status: 'no-match' }

/**
 * The catalogue entry closest to what was asked for.
 *
 * Two independent decisions, in order, and the order matters: a building that
 * does not hold the offices is no use however many restrooms it has.
 *
 *   1. SIZE — the smallest model that actually holds the request. Ask for 17
 *      offices and a 19 wins over a 24; nothing at or above 17 is a custom
 *      quote.
 *   2. RESTROOMS — among the models of that size, the same rule again: the
 *      smallest count that covers the request, or the largest on offer when
 *      nothing does. With 2- and 5-set variants, asking for 0 or 1 gets the 2
 *      and asking for 3, 5 or 10 gets the 5.
 *
 * The old version made one pass looking for `unitCount >= requested &&
 * restroomCount >= required` and took the first hit. Among models of the same
 * size that is whichever the query happened to return first — which is how
 * asking for two offices and no restrooms handed back the model with one.
 */
export function resolveBuildingSize(
  input: SizingInput,
  rules: BuildingLineRules,
  candidates: SizingCandidate[],
): SizingResult {
  if (input.requestedUnits < 1) return { status: 'no-match' }
  if (candidates.length === 0) return { status: 'no-match' }

  if (rules.maxUnits !== null && input.requestedUnits > rules.maxUnits) {
    return { status: 'over-capacity' }
  }

  const holdsTheRequest = candidates.filter(
    (candidate) => candidate.unitCount >= input.requestedUnits,
  )
  if (holdsTheRequest.length === 0) return { status: 'over-capacity' }

  const size = Math.min(...holdsTheRequest.map((candidate) => candidate.unitCount))
  const variants = holdsTheRequest.filter((candidate) => candidate.unitCount === size)

  const restroomSetsRequired = Math.max(
    Math.max(input.restroomsRequested, 0),
    mandatedRestroomSets(rules, input.requestedUnits),
  )

  const covering = variants.filter(
    (candidate) => candidate.restroomCount >= restroomSetsRequired,
  )
  // Nothing covers it: take the most restrooms available rather than refusing
  // a building over a fixture count.
  const shortlist = covering.length > 0 ? covering : variants
  const target = covering.length > 0
    ? Math.min(...shortlist.map((candidate) => candidate.restroomCount))
    : Math.max(...shortlist.map((candidate) => candidate.restroomCount))

  const matches = shortlist.filter((candidate) => candidate.restroomCount === target)
  // Lowest id last, so two identical entries always resolve the same way
  // instead of following whatever order the query returned them in.
  const chosen = matches.reduce((best, candidate) => (candidate.id < best.id ? candidate : best))

  return { status: 'ok', modelId: chosen.id, restroomSetsRequired }
}

/** Restrooms the line insists on at this size, whatever the customer asked for. */
function mandatedRestroomSets(rules: BuildingLineRules, units: number): number {
  if (rules.restroomsRequiredAt === null || units < rules.restroomsRequiredAt) return 0
  return rules.secondRestroomSetAt !== null && units >= rules.secondRestroomSetAt ? 2 : 1
}
