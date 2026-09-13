import { describe, expect, it } from 'vitest'

import { resolveBuildingSize } from './rules-engine'

const rules = { restroomsRequiredAt: 5, secondRestroomSetAt: 10 }

const catalog = [
  { id: 1, unitCount: 4, restroomCount: 0 },
  { id: 2, unitCount: 4, restroomCount: 2 },
  { id: 3, unitCount: 6, restroomCount: 2 },
  { id: 4, unitCount: 8, restroomCount: 2 },
  { id: 5, unitCount: 12, restroomCount: 4 },
  { id: 6, unitCount: 18, restroomCount: 4 },
]

const open = { restroomsRequiredAt: null, secondRestroomSetAt: null }

describe('resolveBuildingSize — size', () => {
  it('resolves the closest size at least as large as the request', () => {
    const result = resolveBuildingSize({ requestedUnits: 5, restroomsRequested: 0 }, rules, catalog)
    expect(result).toEqual({ status: 'ok', modelId: 3, restroomSetsRequired: 1 })
  })

  it('takes the nearest size that covers the request, not the next one up', () => {
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

describe('resolveBuildingSize — offices on top of the units', () => {
  // The EDUPlex six-classroom family: plain, with restrooms, with two offices
  // and a kitchen, and with both.
  const school = [
    { id: 21, unitCount: 6, restroomCount: 0, officeCount: 0 },
    { id: 22, unitCount: 6, restroomCount: 3, officeCount: 0 },
    { id: 23, unitCount: 6, restroomCount: 0, officeCount: 2 },
    { id: 24, unitCount: 6, restroomCount: 3, officeCount: 2 },
    { id: 25, unitCount: 8, restroomCount: 0, officeCount: 0 },
  ]

  it('keeps the offices out of the classroom count', () => {
    // Six classrooms and two offices is the six-classroom school with offices,
    // never the eight-classroom one.
    const result = resolveBuildingSize(
      { requestedUnits: 6, restroomsRequested: 0, officesRequested: 2 },
      open,
      school,
    )
    expect(result).toEqual({ status: 'ok', modelId: 23, restroomSetsRequired: 0 })
  })

  it('gives the plain school to someone who asked for no extras', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 6, restroomsRequested: 0, officesRequested: 0 },
      open,
      school,
    )
    expect(result).toMatchObject({ modelId: 21 })
  })

  it('combines the two extras when both are asked for', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 6, restroomsRequested: 1, officesRequested: 1 },
      open,
      school,
    )
    expect(result).toMatchObject({ modelId: 24 })
  })

  it('lets a mandated restroom outrank a wished-for office', () => {
    const noBoth = school.filter((candidate) => candidate.id !== 24)
    const result = resolveBuildingSize(
      { requestedUnits: 6, restroomsRequested: 0, officesRequested: 2 },
      rules,
      noBoth,
    )
    expect(result).toMatchObject({ modelId: 22, restroomSetsRequired: 1 })
  })

  it('offers the most offices it has rather than refusing', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 6, restroomsRequested: 0, officesRequested: 5 },
      open,
      school,
    )
    expect(result).toMatchObject({ modelId: 23 })
  })

  it('treats a catalogue without the field as one without offices', () => {
    const result = resolveBuildingSize(
      { requestedUnits: 4, restroomsRequested: 0, officesRequested: 2 },
      open,
      catalog,
    )
    expect(result).toMatchObject({ modelId: 1 })
  })
})
