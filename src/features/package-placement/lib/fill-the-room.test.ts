import { describe, expect, it } from 'vitest'

import { regionFrom } from '@/entities/building'

import { findFreeSpotInRegion } from './placement-geometry'

/** A plain 10 by 8 room, the size the client was filling with chairs. */
const ROOM = regionFrom([
  [
    { x: -5, z: -4 },
    { x: 5, z: -4 },
    { x: 5, z: 4 },
    { x: -5, z: 4 },
  ],
])

const CHAIR = { width: 0.6, depth: 0.6 }
const CENTRE = { x: 0, z: 0 }

/** Adds chairs one at a time until the room refuses another. */
function fillWithChairs(limit: number) {
  const placed: Array<{ x: number; z: number; rotationYDeg: number; footprint: typeof CHAIR }> = []

  for (let i = 0; i < limit; i++) {
    const spot = findFreeSpotInRegion(CENTRE, CHAIR, 0, ROOM, placed)
    if (!spot) break
    placed.push({ ...spot, rotationYDeg: 0, footprint: CHAIR })
  }

  return placed
}

describe('filling a room with small furniture', () => {
  /**
   * The complaint, in one number.
   *
   * The search used to try a star of forty-nine points around the middle, so
   * the room called itself full at roughly that many chairs while most of the
   * floor was bare. Eighty square metres holds hundreds of half-metre chairs.
   */
  it('keeps finding room long past the old star of candidates', () => {
    expect(fillWithChairs(400).length).toBeGreaterThan(120)
  })

  it('never puts two of them in the same place', () => {
    const placed = fillWithChairs(120)

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const apart =
          Math.abs(placed[i].x - placed[j].x) >= CHAIR.width ||
          Math.abs(placed[i].z - placed[j].z) >= CHAIR.depth
        expect(apart).toBe(true)
      }
    }
  })

  it('uses the whole floor, not a cross through the middle', () => {
    const placed = fillWithChairs(120)
    const offAxis = placed.filter((p) => Math.abs(p.x) > 1 && Math.abs(p.z) > 1)

    expect(offAxis.length).toBeGreaterThan(40)
  })

  // The first one asked for still lands where it was asked for.
  it('starts in the middle', () => {
    const first = findFreeSpotInRegion(CENTRE, CHAIR, 0, ROOM, [])
    expect(first).toEqual({ x: 0, z: 0 })
  })

  it('still says no when the room really is full', () => {
    const wall = { width: 9.9, depth: 7.9 }
    const blocker = [{ x: 0, z: 0, rotationYDeg: 0, footprint: wall }]

    expect(findFreeSpotInRegion(CENTRE, CHAIR, 0, ROOM, blocker)).toBeNull()
  })
})
