import { describe, expect, it } from 'vitest'

import type { StoredQuoteExterior, StoredQuotePackage } from '@/entities/quote'

import { replayExterior, replayPlacements } from './replay-configuration'

function line(over: Partial<StoredQuotePackage> = {}): StoredQuotePackage {
  return {
    packageId: 1,
    title: 'Desk',
    roomKey: 'office-1',
    zoneKey: null,
    zoneName: null,
    price: 100,
    x: 1.5,
    z: -2,
    rotationYDeg: 90,
    pieces: [],
    ...over,
  }
}

function spot(over: Partial<StoredQuoteExterior> = {}): StoredQuoteExterior {
  return {
    slotKey: 'front',
    slotName: 'Front entrance',
    variantKey: 'ramp',
    title: 'Deck and ramp',
    price: null,
    ...over,
  }
}

describe('replayPlacements', () => {
  it('carries the pose across unchanged', () => {
    const [placed] = replayPlacements([line()])

    expect(placed).toMatchObject({
      packageId: 1,
      roomKey: 'office-1',
      x: 1.5,
      z: -2,
      rotationYDeg: 90,
    })
  })

  // These become React keys, and the server and the client both build them:
  // a key drawn at random would remount every model on the page on hydration.
  it('mints the same ids every time for the same order', () => {
    const order = [line(), line({ packageId: 2 })]

    expect(replayPlacements(order).map((p) => p.instanceId)).toEqual(
      replayPlacements(order).map((p) => p.instanceId),
    )
  })

  it('gives two of the same package their own ids', () => {
    const ids = replayPlacements([line(), line()]).map((p) => p.instanceId)
    expect(new Set(ids).size).toBe(2)
  })

  it('has nothing to replay for an empty order', () => {
    expect(replayPlacements([])).toEqual([])
  })
})

describe('replayExterior', () => {
  it('keys the picks by the spot they were made at', () => {
    expect(replayExterior([spot(), spot({ slotKey: 'rear', variantKey: 'steps' })])).toEqual({
      front: 'ramp',
      rear: 'steps',
    })
  })

  // Which is what the store's own writes do, so a duplicated line reads the
  // same way here as it would have while the customer was configuring.
  it('lets the later line win when a spot is named twice', () => {
    expect(replayExterior([spot(), spot({ variantKey: 'steps' })])).toEqual({ front: 'steps' })
  })

  // An order taken before there were exterior choices at all. Empty means every
  // spot falls back to its own default, which is how it renders at all.
  it('makes nothing of an empty list', () => {
    expect(replayExterior([])).toEqual({})
  })
})

/**
 * A group is saved as one line — one title, one price — carrying where each of
 * its pieces was left. Reopening the order has to put all of them back, or a
 * dining set comes back as a table with nowhere to sit.
 */
describe('replayPlacements, for a group', () => {
  const dining = line({
    packageId: 9,
    title: 'Dining set',
    x: 0,
    z: 0,
    pieces: [
      { memberKey: 'table', x: 0, z: 0, rotationYDeg: 0 },
      { memberKey: 'chair-a', x: 0, z: 1, rotationYDeg: 180 },
      { memberKey: 'chair-b', x: 0, z: -1, rotationYDeg: 0 },
    ],
  })

  it('puts back one placement per piece, where each was left', () => {
    const placed = replayPlacements([dining])

    expect(placed).toHaveLength(3)
    expect(placed[1]).toMatchObject({
      packageId: 9,
      memberKey: 'chair-a',
      roomKey: 'office-1',
      x: 0,
      z: 1,
      rotationYDeg: 180,
    })
  })

  it('keeps them reading as one set', () => {
    const placed = replayPlacements([dining])
    const groups = new Set(placed.map((p) => p.groupId))

    expect(groups.size).toBe(1)
    expect([...groups][0]).toBeTruthy()
  })

  it('gives every piece its own key, and the same ones on both renders', () => {
    const ids = replayPlacements([dining]).map((p) => p.instanceId)

    expect(new Set(ids).size).toBe(3)
    expect(replayPlacements([dining]).map((p) => p.instanceId)).toEqual(ids)
  })

  it('leaves an ordinary line exactly as it was', () => {
    const [placed] = replayPlacements([line()])

    expect(placed.groupId).toBeUndefined()
    expect(placed.memberKey).toBeUndefined()
    expect(placed).toMatchObject({ x: 1.5, z: -2, rotationYDeg: 90 })
  })

  it('does not mix the groups of two sets in one order', () => {
    const placed = replayPlacements([dining, { ...dining, roomKey: 'office-2' }])
    expect(new Set(placed.map((p) => p.groupId)).size).toBe(2)
  })
})
