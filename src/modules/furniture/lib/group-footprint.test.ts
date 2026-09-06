import { describe, expect, it } from 'vitest'

import { groupFootprint } from './group-footprint'

/** A 2 × 1 m piece, the shape of a small table. */
const table = { bboxMin: [-1, 0, -0.5], bboxMax: [1, 0.75, 0.5] }
/** A 0.5 × 0.5 m piece, the shape of a chair. */
const chair = { bboxMin: [-0.25, 0, -0.25], bboxMax: [0.25, 0.9, 0.25] }

describe('groupFootprint', () => {
  it('is the piece itself when there is only one', () => {
    const measured = groupFootprint([{ meta: table, x: 0, z: 0, rotationYDeg: 0 }])

    expect(measured?.footprint).toEqual({ width: 2, depth: 1 })
    expect(measured?.centre).toEqual({ x: 0, z: 0 })
  })

  it('reaches around every piece', () => {
    const measured = groupFootprint([
      { meta: table, x: 0, z: 0, rotationYDeg: 0 },
      { meta: chair, x: 0, z: 1, rotationYDeg: 0 },
      { meta: chair, x: 0, z: -1, rotationYDeg: 0 },
    ])

    // 2 m wide from the table; 1.25 either side of centre from the chairs.
    expect(measured?.footprint).toEqual({ width: 2, depth: 2.5 })
    expect(measured?.centre).toEqual({ x: 0, z: 0 })
  })

  /**
   * The middle of an arrangement is rarely the origin, and the placement search
   * asks for a space around a point — so a group laid out to one side has to
   * report where it actually sits, or the room is asked to clear the wrong spot.
   */
  it('reports the middle of the arrangement, not the origin', () => {
    const measured = groupFootprint([
      { meta: chair, x: 4, z: 0, rotationYDeg: 0 },
      { meta: chair, x: 6, z: 0, rotationYDeg: 0 },
    ])

    expect(measured?.footprint).toEqual({ width: 2.5, depth: 0.5 })
    expect(measured?.centre).toEqual({ x: 5, z: 0 })
  })

  it('grows a piece turned off the axis by what it really sweeps', () => {
    const straight = groupFootprint([{ meta: table, x: 0, z: 0, rotationYDeg: 0 }])
    const turned = groupFootprint([{ meta: table, x: 0, z: 0, rotationYDeg: 90 }])

    expect(straight?.footprint).toEqual({ width: 2, depth: 1 })
    // A quarter turn swaps the sides rather than growing them.
    expect(turned?.footprint).toEqual({ width: 1, depth: 2 })

    const diagonal = groupFootprint([{ meta: table, x: 0, z: 0, rotationYDeg: 45 }])
    // Both sides project onto both axes at 45°: (2 + 1) / 2 × √2 ≈ 2.121.
    expect(diagonal?.footprint.width).toBeCloseTo(2.121, 3)
    expect(diagonal?.footprint.depth).toBeCloseTo(2.121, 3)
  })

  it('ignores a piece whose model was never measured', () => {
    const measured = groupFootprint([
      { meta: table, x: 0, z: 0, rotationYDeg: 0 },
      { meta: null, x: 10, z: 10, rotationYDeg: 0 },
    ])

    expect(measured?.footprint).toEqual({ width: 2, depth: 1 })
  })

  it('has nothing to say about a group with no measurable piece in it', () => {
    expect(groupFootprint([])).toBeNull()
    expect(groupFootprint([{ meta: null, x: 0, z: 0, rotationYDeg: 0 }])).toBeNull()
  })
})
