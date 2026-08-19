import { describe, expect, it } from 'vitest'

import { overlaps, overlapsExtents, rectsOverlap } from './placement-geometry'

const SLAB = { width: 2, depth: 1 }

const at = (x: number, z: number, rotationYDeg = 0) => ({
  x,
  z,
  rotationYDeg,
  footprint: SLAB,
})

describe('the footprint rectangles themselves', () => {
  /**
   * The extents test circumscribes a turned rectangle with an upright one, so a
   * 2 × 1 slab at 45° is treated as a 2.12 m square. Two of them a metre and a
   * half apart are nowhere near each other and it says they clash.
   */
  it('stops treating a turned package as the square around it', () => {
    const a = at(0, 0, 45)
    const b = at(1.5, 1.5, 45)

    expect(overlapsExtents(a, b)).toBe(true)
    expect(rectsOverlap(a, b)).toBe(false)
    expect(overlaps(a, b)).toBe(false)
  })

  // Which is why nothing placed under the old rule moves: at right angles the
  // circumscribed box and the rectangle are the same shape.
  it('agrees with the old test at right angles', () => {
    for (const deg of [0, 90, 180, 270]) {
      for (const gap of [1.5, 1.99, 2.01, 2.5, 3]) {
        const a = at(0, 0, deg)
        const b = at(gap, 0, deg)
        expect(rectsOverlap(a, b)).toBe(overlapsExtents(a, b))
      }
    }
  })
})

describe('a package whose model has not arrived', () => {
  // The answer has to be exactly the old one, not approximately: a piece that
  // could not be placed a moment ago and can be now is a surprise, but a piece
  // that could be placed and now cannot is a bug report.
  it('is judged by its footprint, as it always was', () => {
    expect(overlaps(at(0, 0), at(1, 0))).toBe(true)
    expect(overlaps(at(0, 0), at(2, 0))).toBe(false)
  })

  it('is judged by its footprint when only the other side has been measured', () => {
    const measured = { ...at(1, 0), shape: null }
    expect(overlaps(at(0, 0), measured)).toBe(true)
  })
})

/**
 * Deterministic, so a failure is reproducible rather than a rumour.
 *
 * Mulberry32 — small, well-behaved, and its sequence is fixed by the seed.
 */
function poses(seed: number, count: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return Array.from({ length: count }, () => {
    const footprint = { width: 0.3 + next() * 2, depth: 0.3 + next() * 2 }
    const other = { width: 0.3 + next() * 2, depth: 0.3 + next() * 2 }

    return [
      { x: 0, z: 0, rotationYDeg: next() * 360, footprint },
      { x: (next() - 0.5) * 6, z: (next() - 0.5) * 6, rotationYDeg: next() * 360, footprint: other },
    ] as const
  })
}

/**
 * The property the whole design rests on.
 *
 * The new rule is a conjunction whose first term is the old one, so it can only
 * ever allow more. Stated here as a test rather than as a comment, because it is
 * the promise that nothing a visitor placed yesterday is refused today — and
 * because the next person to add a stage will find out here rather than from a
 * customer.
 */
describe('the new rule against the old', () => {
  it('never blocks a placement the footprint rule allowed', () => {
    for (const [a, b] of poses(20260819, 3000)) {
      if (!overlapsExtents(a, b)) expect(overlaps(a, b)).toBe(false)
    }
  })
})
