import { describe, expect, it } from 'vitest'

import { resistPan } from './pan-resistance'

const LIMIT = 10
const KNEE = 6

describe('resistPan', () => {
  it('moves one-to-one below the knee', () => {
    expect(resistPan(0, LIMIT)).toBe(0)
    expect(resistPan(3, LIMIT)).toBe(3)
    expect(resistPan(KNEE, LIMIT)).toBe(KNEE)
    expect(resistPan(-3, LIMIT)).toBe(-3)
  })

  it('never exceeds the limit, however far the drag goes', () => {
    for (const value of [7, 12, 40, 1000, 1e6]) {
      expect(Math.abs(resistPan(value, LIMIT))).toBeLessThanOrEqual(LIMIT)
      expect(Math.abs(resistPan(-value, LIMIT))).toBeLessThanOrEqual(LIMIT)
    }
  })

  // Asymptotic in exact arithmetic; past roughly 40 the exponential underflows
  // and it settles on the limit itself, which is fine — it must not pass it.
  it('stays strictly inside the limit across any drag a hand can make', () => {
    for (const value of [7, 12, 25, 40]) {
      expect(resistPan(value, LIMIT)).toBeLessThan(LIMIT)
      expect(resistPan(-value, LIMIT)).toBeGreaterThan(-LIMIT)
    }
  })

  it('is monotonic, so a drag never reverses direction', () => {
    let previous = -Infinity
    for (let value = 0; value <= 30; value += 0.05) {
      const eased = resistPan(value, LIMIT)
      expect(eased).toBeGreaterThan(previous)
      previous = eased
    }
  })

  // The whole point of the knee: a slope discontinuity is felt as a jerk.
  it('keeps slope 1 through the knee, so resistance starts without a kink', () => {
    const step = 1e-4
    const before = (resistPan(KNEE, LIMIT) - resistPan(KNEE - step, LIMIT)) / step
    const after = (resistPan(KNEE + step, LIMIT) - resistPan(KNEE, LIMIT)) / step

    expect(before).toBeCloseTo(1, 3)
    expect(after).toBeCloseTo(1, 3)
  })

  it('slows down as it goes, so the edge feels heavy', () => {
    const step = 1e-4
    const slopeAt = (value: number) =>
      (resistPan(value + step, LIMIT) - resistPan(value, LIMIT)) / step

    expect(slopeAt(8)).toBeLessThan(slopeAt(7))
    expect(slopeAt(12)).toBeLessThan(slopeAt(8))
    expect(slopeAt(30)).toBeCloseTo(0, 2)
  })

  it('is odd, so left and right resist alike', () => {
    for (const value of [2, 6.5, 9, 25]) {
      expect(resistPan(-value, LIMIT)).toBeCloseTo(-resistPan(value, LIMIT), 12)
    }
  })

  it('collapses to zero when there is nothing measured to bound', () => {
    expect(resistPan(5, 0)).toBe(0)
  })
})
