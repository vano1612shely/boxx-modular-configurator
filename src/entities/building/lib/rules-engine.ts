import type { BuildingLineRules } from '../model/types'

export type SizingInput = {
  requestedUnits: number
  /** Restroom sets the customer asked for. The line's rules can raise it. */
  restroomsRequested: number
  /**
   * Offices asked for on top of the units. Only a line counted in something
   * else has these — a school's offices are not classrooms, and a school with
   * two of them and a kitchen is still a six-classroom school. Zero for a line
   * whose units are offices already.
   */
  officesRequested?: number
}

export type SizingCandidate = {
  id: number
  unitCount: number
  restroomCount: number
  officeCount?: number
}

export type SizingResult =
  | {
      status: 'ok'
      modelId: number
      restroomSetsRequired: number
    }
  | { status: 'over-capacity' }
  | { status: 'no-match' }

/**
 * Size is decided before anything else: the smallest model that holds the
 * request. Among those, restrooms — the count the customer asked for or the
 * line's rules mandate, whichever is more — and among those, offices. Each
 * step takes the smallest count that covers what was asked, and where nothing
 * covers it, the most on offer rather than a refusal.
 *
 * Restrooms before offices because a restroom can be the law and an office
 * never is: where the catalogue has a model with the restrooms and another
 * with the offices but none with both, the one that meets the code wins.
 */
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

  const withRestrooms = closest(
    variants,
    (candidate) => candidate.restroomCount,
    restroomSetsRequired,
  )
  const withOffices = closest(
    withRestrooms,
    (candidate) => candidate.officeCount ?? 0,
    Math.max(input.officesRequested ?? 0, 0),
  )

  // Lowest id wins, so identical entries resolve independently of query order.
  const chosen = withOffices.reduce((best, candidate) => (candidate.id < best.id ? candidate : best))

  return { status: 'ok', modelId: chosen.id, restroomSetsRequired }
}

/**
 * The candidates whose count sits closest above what was asked — or, when
 * none reaches it, the ones with the most.
 */
function closest(
  candidates: SizingCandidate[],
  count: (candidate: SizingCandidate) => number,
  wanted: number,
): SizingCandidate[] {
  const covering = candidates.filter((candidate) => count(candidate) >= wanted)
  const shortlist = covering.length > 0 ? covering : candidates
  const target =
    covering.length > 0 ? Math.min(...shortlist.map(count)) : Math.max(...shortlist.map(count))

  return shortlist.filter((candidate) => count(candidate) === target)
}

function mandatedRestroomSets(rules: BuildingLineRules, units: number): number {
  if (rules.restroomsRequiredAt === null || units < rules.restroomsRequiredAt) return 0
  return rules.secondRestroomSetAt !== null && units >= rules.secondRestroomSetAt ? 2 : 1
}
