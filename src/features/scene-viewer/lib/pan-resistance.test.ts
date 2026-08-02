import { describe, expect, it } from 'vitest'

import { offsetLimit, panSpeedFactor } from './pan-resistance'

const LIMIT = 10
const KNEE = 6

describe('panSpeedFactor', () => {
  it('pans at full speed up to the knee', () => {
    expect(panSpeedFactor(0, LIMIT)).toBe(1)
    expect(panSpeedFactor(3, LIMIT)).toBe(1)
    expect(panSpeedFactor(KNEE, LIMIT)).toBe(1)
  })

  it('falls to a standstill at the limit and stays there', () => {
    expect(panSpeedFactor(LIMIT, LIMIT)).toBeCloseTo(0, 12)
    expect(panSpeedFactor(LIMIT * 2, LIMIT)).toBe(0)
  })

  // A step in speed is felt as a jolt, and the knee is mid-travel where it
  // would be most obvious.
  it('leaves the knee without a step', () => {
    const step = 1e-6
    expect(panSpeedFactor(KNEE - step, LIMIT)).toBeCloseTo(1, 9)
    expect(panSpeedFactor(KNEE + step, LIMIT)).toBeCloseTo(1, 5)
  })

  it('decreases monotonically once resistance starts', () => {
    let previous = 1
    for (let reach = KNEE; reach <= LIMIT; reach += 0.01) {
      const factor = panSpeedFactor(reach, LIMIT)
      expect(factor).toBeLessThanOrEqual(previous + 1e-12)
      previous = factor
    }
  })

  it('never gives back a negative or oversized speed', () => {
    for (const reach of [0, 5, 9.9, LIMIT, 1e6]) {
      const factor = panSpeedFactor(reach, LIMIT)
      expect(factor).toBeGreaterThanOrEqual(0)
      expect(factor).toBeLessThanOrEqual(1)
    }
  })

  it('does not resist when there is nothing measured to resist against', () => {
    expect(panSpeedFactor(500, 0)).toBe(1)
  })
})

/** Half of the frame height in world metres, at a distance. */
function halfHeight(radius: number, fovDeg: number): number {
  return radius * Math.tan((fovDeg * Math.PI) / 360)
}

describe('offsetLimit', () => {
  it('is the same share of the screen at every distance', () => {
    for (const radius of [0.4, 2, 8, 30]) {
      expect(offsetLimit(radius, 50) / halfHeight(radius, 50)).toBeCloseTo(0.55, 9)
    }
  })

  it('keeps the subject on screen, with room to look around it', () => {
    for (const fov of [35, 50, 70]) {
      const share = offsetLimit(12, fov) / halfHeight(12, fov)
      expect(share).toBeGreaterThan(0.3)
      expect(share).toBeLessThan(1)
    }
  })

  // The offset is rescaled with the distance on a dolly, so a bound that scales
  // the same way can never be crossed by zooming rather than by panning.
  it('scales exactly as the offset does under a dolly', () => {
    const zoomed = 0.6
    expect(offsetLimit(10 * zoomed, 50)).toBeCloseTo(offsetLimit(10, 50) * zoomed, 9)
  })

  it('does not go negative on a degenerate camera', () => {
    expect(offsetLimit(-5, 50)).toBe(0)
    expect(offsetLimit(10, 0)).toBeGreaterThan(0)
  })
})
