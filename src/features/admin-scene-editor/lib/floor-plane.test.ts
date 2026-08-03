import { describe, expect, it } from 'vitest'

import { defaultYRange } from './blocks'
import { floorPlaneBounds } from './floor-plane'

const FALLBACK = { minX: -6, minZ: -6, maxX: 6, maxZ: 6 }

describe('floorPlaneBounds', () => {
  it('falls back until the model has been measured', () => {
    expect(floorPlaneBounds(null, FALLBACK)).toEqual(FALLBACK)
  })

  it('covers the whole model footprint', () => {
    const bounds = floorPlaneBounds({ minX: -18, minZ: -7, maxX: 22, maxZ: 31 }, FALLBACK)

    expect(bounds).toEqual({ minX: -18, minZ: -7, maxX: 22, maxZ: 31 })
  })

  it('grows a footprint too small to grab, around its own centre', () => {
    const bounds = floorPlaneBounds({ minX: 9, minZ: 0, maxX: 11, maxZ: 40 }, FALLBACK)

    expect(bounds.maxX - bounds.minX).toBeCloseTo(4, 9)
    expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(10, 9)
    expect(bounds.minZ).toBe(0)
    expect(bounds.maxZ).toBe(40)
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
