import { describe, expect, it } from 'vitest'

import { regionOf } from '@/entities/building'
import type { PackageFootprint } from '@/entities/furniture-package'

import { findFreeSpotInRegion, rotatedHalfExtents } from './placement-geometry'

/**
 * The conference room of the "1 office" building, to the centimetre: 6.5 by 2.8.
 */
const ROOM = regionOf([
  { x: 5.25, z: -1.4 },
  { x: 5.25, z: 1.4 },
  { x: 11.75, z: 1.4 },
  { x: 11.75, z: -1.4 },
])

const CENTRE = { x: 8.5, z: 0 }

/** Both as authored, measured off their models. */
const BASIC: PackageFootprint = { width: 2.335, depth: 1.787 }
const PREMIUM: PackageFootprint = { width: 2.489, depth: 3.074 }

/**
 * Premium office is deeper than the room, so it stands sideways or not at all,
 * and sideways it clears the walls by 15 cm a side. That thin band is the whole
 * point of these: a sweep that steps over it reports a half-empty room full.
 */
describe('a package that only fits one way round, in a room with one already in it', () => {
  it('is deeper than the room, and fits across it', () => {
    expect(rotatedHalfExtents(PREMIUM, 0).halfD).toBeGreaterThan(1.4)
    expect(rotatedHalfExtents(PREMIUM, 90).halfD).toBeLessThan(1.4)
    // 15 cm of slack on the tight axis, against a footprint 2.5 m across.
    expect(1.4 - rotatedHalfExtents(PREMIUM, 90).halfD).toBeCloseTo(0.1555, 3)
  })

  it('goes in beside a basic office parked at one end', () => {
    const basic = { x: 10.4, z: 0, rotationYDeg: 0, footprint: BASIC }

    const spot = findFreeSpotInRegion(CENTRE, PREMIUM, 90, ROOM, [basic])

    expect(spot).not.toBeNull()
  })

  // The same room, the other way round: this one never broke, and must not.
  it('still takes a basic office beside a premium one', () => {
    const premium = { x: 6.8, z: 0, rotationYDeg: 90, footprint: PREMIUM }

    expect(findFreeSpotInRegion(CENTRE, BASIC, 0, ROOM, [premium])).not.toBeNull()
  })

  // Two of them do share this room — 3.07 m each against 6.5 m of wall — and
  // only the second one's 30 cm of leeway ever made it look otherwise.
  it('takes a second premium along the far end', () => {
    const premium = { x: 6.8, z: 0, rotationYDeg: 90, footprint: PREMIUM }

    expect(findFreeSpotInRegion(CENTRE, PREMIUM, 90, ROOM, [premium])).not.toBeNull()
  })

  // Refusals still have to mean something. A third has 35 cm of wall left.
  it('refuses a third, which really does not fit', () => {
    const two = [
      { x: 6.8, z: 0, rotationYDeg: 90, footprint: PREMIUM },
      { x: 9.9, z: 0, rotationYDeg: 90, footprint: PREMIUM },
    ]

    expect(findFreeSpotInRegion(CENTRE, PREMIUM, 90, ROOM, two)).toBeNull()
  })

  /**
   * The one refusal that is arithmetic rather than a miss.
   *
   * A package lands in the middle of the floor, and a basic office there leaves
   * 2.08 m at either end against the 3.07 m a premium needs — it cannot go in
   * without the basic one moving first. Worth pinning down, because it looks
   * exactly like the bug above and is not one.
   */
  it('refuses a premium beside a basic office parked dead centre', () => {
    const basic = { x: 8.5, z: 0, rotationYDeg: 0, footprint: BASIC }

    expect(findFreeSpotInRegion(CENTRE, PREMIUM, 90, ROOM, [basic])).toBeNull()
    expect(findFreeSpotInRegion(CENTRE, PREMIUM, 0, ROOM, [basic])).toBeNull()
  })
})
