import { describe, expect, it } from 'vitest'

import { collidesWithAny, findFreeSpot, overlaps, rotatedHalfExtents } from './placement-geometry'

const roomPoly = [
  { x: -3, z: -3 },
  { x: 3, z: -3 },
  { x: 3, z: 3 },
  { x: -3, z: 3 },
]
const footprint = { width: 2, depth: 1 }

describe('rotatedHalfExtents', () => {
  it('returns plain half extents at 0°', () => {
    expect(rotatedHalfExtents(footprint, 0)).toEqual({ halfW: 1, halfD: 0.5 })
  })

  it('swaps extents at 90°', () => {
    const { halfW, halfD } = rotatedHalfExtents(footprint, 90)
    expect(halfW).toBeCloseTo(0.5)
    expect(halfD).toBeCloseTo(1)
  })

  it('expands extents at 45°', () => {
    const { halfW, halfD } = rotatedHalfExtents(footprint, 45)
    expect(halfW).toBeCloseTo((Math.SQRT1_2 * 3) / 2)
    expect(halfD).toBeCloseTo((Math.SQRT1_2 * 3) / 2)
  })
})

describe('overlaps / collidesWithAny', () => {
  const at = (x: number, z: number, rotationYDeg = 0) => ({ x, z, rotationYDeg, footprint })

  it('detects overlapping packages', () => {
    expect(overlaps(at(0, 0), at(1, 0))).toBe(true)
  })

  it('accepts touching-but-separate packages', () => {
    expect(overlaps(at(0, 0), at(2, 0))).toBe(false)
    expect(collidesWithAny(at(0, 0), [at(2, 0), at(0, 1)])).toBe(false)
  })
})

describe('findFreeSpot', () => {
  const at = (x: number, z: number) => ({ x, z, rotationYDeg: 0, footprint })

  it('returns the preferred spot when free', () => {
    expect(findFreeSpot({ x: 0, z: 0 }, footprint, 0, roomPoly, [])).toEqual({ x: 0, z: 0 })
  })

  it('finds a nearby spot when the preferred one is taken', () => {
    const spot = findFreeSpot({ x: 0, z: 0 }, footprint, 0, roomPoly, [at(0, 0)])
    expect(spot).not.toBeNull()
    expect(collidesWithAny({ ...spot!, rotationYDeg: 0, footprint }, [at(0, 0)])).toBe(false)
  })

  it('returns null when the package cannot fit the room at all', () => {
    expect(findFreeSpot({ x: 0, z: 0 }, { width: 10, depth: 10 }, 0, roomPoly, [])).toBeNull()
  })
})
