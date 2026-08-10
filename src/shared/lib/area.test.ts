import { describe, expect, it } from 'vitest'

import { areaIn, formatArea, type AuthoredArea } from './area'

const NOTHING: AuthoredArea = { sqft: null, sqm: null }

describe('areaIn', () => {
  // Two rounded marketing figures that are not exact conversions of each other
  // is a thing an admin may mean; overwriting either would be second-guessing.
  it('shows both authored figures exactly as typed', () => {
    const both: AuthoredArea = { sqft: 215, sqm: 20 }

    expect(areaIn('sqft', both, 19.5)).toBe(215)
    expect(areaIn('sqm', both, 19.5)).toBe(20)
  })

  // The key call: someone who typed a figure is holding a better drawing than
  // the trace, so the other unit follows their number, not the outline.
  it('converts from the one that was authored, ignoring the trace', () => {
    expect(areaIn('sqm', { sqft: 215.278, sqm: null }, 100)).toBeCloseTo(20, 3)
    expect(areaIn('sqft', { sqft: null, sqm: 20 }, 100)).toBeCloseTo(215.278, 3)
  })

  it('measures each unit off the outline when neither was authored', () => {
    expect(areaIn('sqm', NOTHING, 20)).toBe(20)
    expect(areaIn('sqft', NOTHING, 20)).toBeCloseTo(215.278, 3)
  })

  // Nothing authored and nothing to trace: a building has no outline, so its
  // area row simply does not appear.
  it('knows nothing when there is nothing to know', () => {
    expect(areaIn('sqft', NOTHING, null)).toBeNull()
    expect(areaIn('sqm', NOTHING, null)).toBeNull()
  })

  // Zero is a figure someone typed, and `??`-style truthiness would drop it.
  it('treats an authored zero as an answer', () => {
    expect(areaIn('sqft', { sqft: 0, sqm: null }, 20)).toBe(0)
    expect(areaIn('sqm', { sqft: 0, sqm: null }, 20)).toBe(0)
  })

  it('round-trips a conversion without drift', () => {
    const there = areaIn('sqft', { sqft: null, sqm: 37.4 }, null)!
    expect(areaIn('sqm', { sqft: there, sqm: null }, null)).toBeCloseTo(37.4, 9)
  })
})

describe('formatArea', () => {
  it('gives feet whole numbers and metres one decimal', () => {
    expect(formatArea(1244.6, 'sqft')).toBe('1,245 ft²')
    expect(formatArea(115.63, 'sqm')).toBe('115.6 m²')
  })

  // A square metre is about eleven square feet, so whole metres would be a much
  // coarser bucket than the whole feet visitors see today.
  it('does not round a small room to nothing', () => {
    expect(formatArea(11.72, 'sqm')).toBe('11.7 m²')
    expect(formatArea(0.4, 'sqm')).toBe('0.4 m²')
  })

  it('groups thousands', () => {
    expect(formatArea(12480, 'sqft')).toBe('12,480 ft²')
  })
})
