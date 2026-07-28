import { describe, expect, it } from 'vitest'

import { defaultYRange, sameBlockRef } from './blocks'
import { floorPlaneBounds } from './floor-plane'

const FALLBACK = { minX: -6, minZ: -6, maxX: 6, maxZ: 6 }

describe('floorPlaneBounds', () => {
  it('falls back when there is nothing drawn yet', () => {
    expect(floorPlaneBounds([], 0.6, FALLBACK)).toEqual(FALLBACK)
  })

  it('wraps an outline with the padding on every side', () => {
    const bounds = floorPlaneBounds(
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 3 },
      ],
      0.6,
      FALLBACK,
    )

    expect(bounds).toEqual({ minX: -0.6, minZ: -0.6, maxX: 4.6, maxZ: 3.6 })
  })

  it('still gives the first point of a new outline something to stand on', () => {
    // One click has no extent, so the plane would be zero-sized without pad.
    const bounds = floorPlaneBounds([{ x: 2, z: -1 }], 1.5, FALLBACK)

    expect(bounds.maxX - bounds.minX).toBeCloseTo(3, 9)
    expect(bounds.maxZ - bounds.minZ).toBeCloseTo(3, 9)
  })

  it('ignores the fallback as soon as one point exists', () => {
    const bounds = floorPlaneBounds([{ x: 50, z: 50 }], 1, FALLBACK)

    expect(bounds.minX).toBe(49)
    expect(bounds.maxX).toBe(51)
  })
})

describe('defaultYRange', () => {
  it('places a fresh volume at roof height, above the model', () => {
    const [min, max] = defaultYRange(4)

    expect(min).toBeCloseTo(3.28, 9)
    expect(max).toBeCloseTo(4.6, 9)
  })

  it('never collapses on a model whose height was not measured yet', () => {
    const [min, max] = defaultYRange(0)

    expect(max).toBeGreaterThan(min)
  })
})

describe('sameBlockRef', () => {
  it('compares roof volumes by index alone', () => {
    expect(sameBlockRef({ index: 2 }, { index: 2 })).toBe(true)
    expect(sameBlockRef({ index: 2 }, { index: 3 })).toBe(false)
  })
})
