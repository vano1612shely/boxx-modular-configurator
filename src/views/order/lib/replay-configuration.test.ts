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
