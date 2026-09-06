import { describe, expect, it } from 'vitest'

import {
  readStoredExterior,
  readStoredPackages,
  storedQuoteConfigurationSchema,
} from './stored-schema'

const TODAY = {
  buildingModelId: 3,
  buildingTitle: 'BOXXPlex 8',
  lineSlug: 'boxxplex',
  unitCount: 8,
  restroomCount: 1,
  packages: [],
  exterior: [],
  totalPrice: 12000,
  submittedAt: '2026-08-19T09:12:33.000Z',
}

describe('storedQuoteConfigurationSchema', () => {
  it('reads back what the configurator writes today', () => {
    expect(storedQuoteConfigurationSchema.parse(TODAY)).toMatchObject({
      buildingModelId: 3,
      lineSlug: 'boxxplex',
      unitCount: 8,
    })
  })

  // A json round trip turns an omitted key into null as often as not, and the
  // write schema rejects that — which would shut the customer out of their own
  // order over a difference nobody can see.
  it('accepts a null where the client simply left the key out', () => {
    expect(storedQuoteConfigurationSchema.parse({ ...TODAY, exterior: null }).exterior).toEqual([])
  })

  it('takes a missing buildingModelId as none', () => {
    const { buildingModelId, ...without } = TODAY
    void buildingModelId
    expect(storedQuoteConfigurationSchema.parse(without).buildingModelId).toBeNull()
  })

  it('coerces figures that came back as strings', () => {
    const parsed = storedQuoteConfigurationSchema.parse({ ...TODAY, unitCount: '8' })
    expect(parsed.unitCount).toBe(8)
  })

  // A page that will not open is worse than one that shows no date.
  it('accepts a timestamp carrying an offset', () => {
    expect(
      storedQuoteConfigurationSchema.parse({ ...TODAY, submittedAt: '2026-08-19 09:12:33+02:00' })
        .submittedAt,
    ).toBe('2026-08-19 09:12:33+02:00')
  })

  it('reads an order written before any of these fields existed', () => {
    expect(storedQuoteConfigurationSchema.parse({})).toMatchObject({
      buildingModelId: null,
      packages: [],
      exterior: [],
      totalPrice: 0,
    })
  })
})

describe('readStoredPackages', () => {
  const desk = { packageId: 7, title: 'Desk', roomKey: 'office-1', x: 1, z: 2, rotationYDeg: 90 }

  it('keeps a well-formed placement whole', () => {
    expect(readStoredPackages([desk])).toEqual([
      {
        packageId: 7,
        title: 'Desk',
        roomKey: 'office-1',
        zoneKey: null,
        zoneName: null,
        price: null,
        x: 1,
        z: 2,
        rotationYDeg: 90,
        // An ordinary package is one thing standing at x, z. The list is where
        // a group records its pieces, and this line has none.
        pieces: [],
      },
    ])
  })

  it('keeps the pieces of a group, so the arrangement can be put back', () => {
    const [line] = readStoredPackages([
      {
        ...desk,
        title: 'Dining set',
        pieces: [
          { memberKey: 'table', x: 0, z: 0, rotationYDeg: 0 },
          { memberKey: 'chair', x: 0, z: 1, rotationYDeg: 180 },
        ],
      },
    ])

    expect(line.pieces).toEqual([
      { memberKey: 'table', x: 0, z: 0, rotationYDeg: 0 },
      { memberKey: 'chair', x: 0, z: 1, rotationYDeg: 180 },
    ])
  })

  // The line is still a line, and still says what was bought and what it cost.
  it('keeps a line whose pieces cannot be read, without them', () => {
    const [line] = readStoredPackages([{ ...desk, pieces: 'nonsense' }])
    expect(line).toMatchObject({ packageId: 7, pieces: [] })
  })

  // One broken piece of furniture must not blank a whole order.
  it('drops only the placement it cannot read', () => {
    const kept = readStoredPackages([desk, { packageId: 8 }, { ...desk, packageId: 9 }])
    expect(kept.map((line) => line.packageId)).toEqual([7, 9])
  })

  it('defaults an unturned piece to facing forward', () => {
    const { rotationYDeg, ...unturned } = desk
    void rotationYDeg
    expect(readStoredPackages([unturned])[0].rotationYDeg).toBe(0)
  })
})

describe('readStoredExterior', () => {
  it('keeps a pick, and drops one with no variant on it', () => {
    const rows = readStoredExterior([
      { slotKey: 'front', slotName: 'Front', variantKey: 'ramp', title: 'Ramp', price: 900 },
      { slotKey: 'rear' },
    ])

    expect(rows.map((row) => row.slotKey)).toEqual(['front'])
  })
})

// One null in a column that has been through JSON more than once must not cost
// the customer their whole order.
describe('nulls where a string was expected', () => {
  it('reads an order whose title arrived as null', () => {
    const parsed = storedQuoteConfigurationSchema.parse({ ...TODAY, buildingTitle: null })
    expect(parsed.buildingTitle).toBe('')
    expect(parsed.buildingModelId).toBe(3)
  })

  it('reads one whose counts arrived as null', () => {
    const parsed = storedQuoteConfigurationSchema.parse({
      ...TODAY,
      unitCount: null,
      restroomCount: null,
      totalPrice: null,
      submittedAt: null,
    })
    expect(parsed).toMatchObject({ unitCount: 0, restroomCount: 0, totalPrice: 0, submittedAt: '' })
  })

  it('keeps a placement whose title and angle arrived as null', () => {
    const kept = readStoredPackages([
      { packageId: 7, title: null, roomKey: 'office-1', x: 1, z: 2, rotationYDeg: null },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatchObject({ title: '', rotationYDeg: 0 })
  })
})
