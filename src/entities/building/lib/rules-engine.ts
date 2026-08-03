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
      restroomSetsRequired: number
    }
  | { status: 'over-capacity' }
  | { status: 'no-match' }

// Size is decided before restrooms: smallest model that holds the request, then
// among those the smallest restroom count covering it.
export function resolveBuildingSize(
  input: SizingInput,
  rules: BuildingLineRules,
  candidates: SizingCandidate[],
): SizingResult {
  if (input.requestedUnits < 1) return { status: 'no-match' }
  if (candidates.length === 0) return { status: 'no-match' }

  // The largest standard size is whatever the published models offer, so there
  // is nothing to configure: a request no model holds is over capacity.
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
  // Nothing covers it: take the most restrooms available rather than refusing.
  const shortlist = covering.length > 0 ? covering : variants
  const target = covering.length > 0
    ? Math.min(...shortlist.map((candidate) => candidate.restroomCount))
    : Math.max(...shortlist.map((candidate) => candidate.restroomCount))

  const matches = shortlist.filter((candidate) => candidate.restroomCount === target)
  // Lowest id wins, so identical entries resolve independently of query order.
  const chosen = matches.reduce((best, candidate) => (candidate.id < best.id ? candidate : best))

  return { status: 'ok', modelId: chosen.id, restroomSetsRequired }
}

function mandatedRestroomSets(rules: BuildingLineRules, units: number): number {
  if (rules.restroomsRequiredAt === null || units < rules.restroomsRequiredAt) return 0
  return rules.secondRestroomSetAt !== null && units >= rules.secondRestroomSetAt ? 2 : 1
}
