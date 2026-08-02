import { describe, expect, it } from 'vitest'

import { panSpeedFactor } from './pan-resistance'

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
