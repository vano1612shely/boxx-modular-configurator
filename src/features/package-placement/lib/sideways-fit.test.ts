import { describe, expect, it } from 'vitest'

import { regionFrom } from '@/entities/building'

import { findFreeSpotInRegion } from './placement-geometry'

/**
 * A kitchen zone: long and narrow, the way half a divided room usually is.
 *
 * 5.4 m along and 2.2 m deep. The package below is 4.6 m by 1.9 m, so it goes
 * in across the zone and not along it.
 */
const KITCHEN = regionFrom([
  [
    { x: -1.1, z: -2.7 },
    { x: 1.1, z: -2.7 },
    { x: 1.1, z: 2.7 },
    { x: -1.1, z: 2.7 },
  ],
])

const PACKAGE = { width: 4.6, depth: 1.9 }
const CENTRE = { x: 0, z: 0 }

describe('adding a package to a zone it only fits sideways in', () => {
  // The way it faces is the way it does not go.
  it('finds nowhere at the angle the model happens to face', () => {
    expect(findFreeSpotInRegion(CENTRE, PACKAGE, 0, KITCHEN, [])).toBeNull()
  })

  // Turned, it fits with room to spare — which is what the visitor can see and
  // what the panel used to deny, because adding only ever asked for zero.
  it('finds a place once it is turned', () => {
    expect(findFreeSpotInRegion(CENTRE, PACKAGE, 90, KITCHEN, [])).not.toBeNull()
  })

  // What the model now does: the facing angle first, then the turn. Both are
  // asked before the room is told it has no space.
  it('is placeable when both angles are tried', () => {
    const placed = [0, 90]
      .map((deg) => findFreeSpotInRegion(CENTRE, PACKAGE, deg, KITCHEN, []))
      .filter(Boolean)

    expect(placed.length).toBeGreaterThan(0)
  })
})
