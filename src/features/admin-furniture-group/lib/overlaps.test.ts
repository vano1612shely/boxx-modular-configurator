import { describe, expect, it } from 'vitest'

import { clashingPieces, type ArrangedPiece } from './overlaps'

function piece(over: Partial<ArrangedPiece> = {}): ArrangedPiece {
  return { footprint: { width: 1, depth: 1 }, x: 0, z: 0, rotationYDeg: 0, ...over }
}

describe('clashingPieces', () => {
  it('says nothing about pieces standing apart', () => {
    expect(clashingPieces([piece(), piece({ x: 3 })])).toEqual(new Set())
  })

  /** Two models dropped in at once: the case the scene exists to make visible. */
  it('names both pieces of a pair left on top of each other', () => {
    expect(clashingPieces([piece(), piece()])).toEqual(new Set([0, 1]))
  })

  /**
   * A chair pushed under a table is the arrangement working. Their rectangles
   * overlap by most of the chair, and warning about it would train an admin to
   * ignore the warning.
   */
  it('leaves a small piece tucked under a large one alone', () => {
    const table = piece({ footprint: { width: 2, depth: 1.2 } })
    const chair = piece({ footprint: { width: 0.5, depth: 0.5 }, z: 0.5 })

    expect(clashingPieces([table, chair])).toEqual(new Set())
  })

  it('counts a turned piece by what it really sweeps, not by its stated sides', () => {
    const long = piece({ footprint: { width: 2, depth: 0.2 } })

    // End to end they miss, and crossed on the same spot they still only share
    // the little square where they cross — two planks in a cross are not one
    // plank inside another, and saying so would be a warning about nothing.
    expect(clashingPieces([long, piece({ ...long, x: 2.1 })])).toEqual(new Set())
    expect(clashingPieces([long, piece({ ...long, rotationYDeg: 90 })])).toEqual(new Set())

    // Turned, though, it reaches where its width never did: a small piece 0.8 m
    // along is clear of the plank lying flat, and wholly inside it stood on end.
    const small = piece({ footprint: { width: 0.15, depth: 0.3 }, z: 0.8 })
    expect(clashingPieces([long, small])).toEqual(new Set())
    expect(clashingPieces([piece({ ...long, rotationYDeg: 90 }), small])).toEqual(new Set([0, 1]))
  })

  it('names a small piece left inside a large one', () => {
    const table = piece({ footprint: { width: 2, depth: 1.2 } })
    const lamp = piece({ footprint: { width: 0.3, depth: 0.3 } })

    expect(clashingPieces([table, lamp])).toEqual(new Set([0, 1]))
  })

  it('names every piece of a pile, not just the first pair', () => {
    expect(clashingPieces([piece(), piece(), piece()])).toEqual(new Set([0, 1, 2]))
  })

  it('has nothing to say about an empty group or a single piece', () => {
    expect(clashingPieces([])).toEqual(new Set())
    expect(clashingPieces([piece()])).toEqual(new Set())
  })
})
