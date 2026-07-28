import { describe, expect, it } from 'vitest'

import { resolveBuildingSize } from './rules-engine'

const rules = { restroomsRequiredAt: 5, secondRestroomSetAt: 10, maxUnits: 18 }

const catalog = [
  { id: 1, unitCount: 4, restroomCount: 0 },
  { id: 2, unitCount: 4, restroomCount: 2 },
  { id: 3, unitCount: 6, restroomCount: 2 },
  { id: 4, unitCount: 8, restroomCount: 2 },
  { id: 5, unitCount: 12, restroomCount: 4 },
  { id: 6, unitCount: 18, restroomCount: 4 },
]

/** No mandates, so the restroom rule can be tested on its own. */
const open = { restroomsRequiredAt: null, secondRestroomSetAt: null, maxUnits: null }

describe('resolveBuildingSize — size', () => {
  it('resolves the closest size at least as large as the request', () => {
    const result = resolveBuildingSize({ requestedUnits: 5, restroomsRequested: 0 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 3, restroomSetsRequired: 1 })
  })

  it('takes the nearest size that covers the request, not the next one up', () => {
    // 17 offices: a 19 holds them and a 24 also would. The 19 wins.
    const sizes = [
      { id: 10, unitCount: 12, restroomCount: 2 },
      { id: 11, unitCount: 19, restroomCount: 2 },
      { id: 12, unitCount: 24, restroomCount: 2 },
    ]
    const result = resolveBuildingSize({ requestedUnits: 17, restroomsRequested: 0 }, open, sizes)

    expect(result).toEqual({ status: 'ok', modelId: 11, restroomSetsRequired: 0 })
  })

  it('returns over-capacity beyond the largest standard size', () => {
    const result = resolveBuildingSize({ requestedUnits: 24, restroomsRequested: 0 }, rules, catalog)
    expect(result).toEqual({ status: 'over-capacity' })
  })

  it('returns over-capacity when nothing in the catalogue is big enough', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 17, restroomsRequested: 0 },
      open,
      catalog.filter((candidate) => candidate.unitCount <= 8),
    )
    expect(result).toEqual({ status: 'over-capacity' })
  })

  it('rejects nonsensical input', () => {
    expect(resolveBuildingSize({ requestedUnits: 0, restroomsRequested: 0 }, rules, catalog)).toEqual(
      { status: 'no-match' },
    )
    expect(resolveBuildingSize({ requestedUnits: 4, restroomsRequested: 0 }, rules, [])).toEqual({
      status: 'no-match',
    })
  })
})

describe('resolveBuildingSize — restrooms', () => {
  /** Same size, two restroom variants — the shape the reported bug lived in. */
  const variants = [
    { id: 20, unitCount: 19, restroomCount: 2 },
    { id: 21, unitCount: 19, restroomCount: 5 },
  ]

  it('gives the smaller variant to a request it already covers', () => {
    for (const asked of [0, 1, 2]) {
      const result = resolveBuildingSize(
        { requestedUnits: 17, restroomsRequested: asked },
        open,
        variants,
      )
      expect(result).toEqual({ status: 'ok', modelId: 20, restroomSetsRequired: asked })
    }
  })

  it('steps up to the next variant as soon as the smaller one falls short', () => {
    for (const asked of [3, 4, 5]) {
      const result = resolveBuildingSize(
        { requestedUnits: 17, restroomsRequested: asked },
        open,
        variants,
      )
      expect(result).toEqual({ status: 'ok', modelId: 21, restroomSetsRequired: asked })
    }
  })

  it('offers the most it has rather than refusing an impossible request', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 17, restroomsRequested: 10 },
      open,
      variants,
    )
    expect(result).toEqual({ status: 'ok', modelId: 21, restroomSetsRequired: 10 })
  })

  it('gives no restrooms to someone who asked for none', () => {
    // The bug as reported: two models of the same size, one with a restroom
    // and one without, and asking for none handed back the one with.
    const pair = [
      { id: 30, unitCount: 2, restroomCount: 1 },
      { id: 31, unitCount: 2, restroomCount: 0 },
    ]
    const result = resolveBuildingSize({ requestedUnits: 2, restroomsRequested: 0 }, open, pair)

    expect(result).toEqual({ status: 'ok', modelId: 31, restroomSetsRequired: 0 })
  })

  it('does not depend on the order the catalogue came back in', () => {
    const pair = [
      { id: 30, unitCount: 2, restroomCount: 1 },
      { id: 31, unitCount: 2, restroomCount: 0 },
    ]
    const forwards = resolveBuildingSize({ requestedUnits: 2, restroomsRequested: 0 }, open, pair)
    const backwards = resolveBuildingSize(
      { requestedUnits: 2, restroomsRequested: 0 },
      open,
      [...pair].reverse(),
    )

    expect(backwards).toEqual(forwards)
  })
})

describe('resolveBuildingSize — the line can insist', () => {
  it('applies the mandate to someone who asked for nothing', () => {
    const result = resolveBuildingSize({ requestedUnits: 4, restroomsRequested: 0 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 1, restroomSetsRequired: 0 })

    // One unit further and the line makes restrooms mandatory.
    const mandated = resolveBuildingSize(
      { requestedUnits: 5, restroomsRequested: 0 },
      rules,
      catalog,
    )
    expect(mandated).toMatchObject({ restroomSetsRequired: 1 })
  })

  it('honours an explicit request below the mandate threshold', () => {
    const result = resolveBuildingSize({ requestedUnits: 4, restroomsRequested: 1 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 2, restroomSetsRequired: 1 })
  })

  it('requires a second set past the second threshold', () => {
    const result = resolveBuildingSize({ requestedUnits: 11, restroomsRequested: 0 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 5, restroomSetsRequired: 2 })
  })

  it('never lowers what the customer asked for', () => {
    const result = resolveBuildingSize({ requestedUnits: 4, restroomsRequested: 2 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 2, restroomSetsRequired: 2 })
  })
})
