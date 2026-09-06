import { describe, expect, it } from 'vitest'

import { footprintFromMeta } from './footprint-from-meta'

describe('footprintFromMeta', () => {
  it('reads the floor rectangle off the measured box', () => {
    expect(
      footprintFromMeta({ bboxMin: [-1.1, 0, -0.8], bboxMax: [1.075, 1.1, 0.7] }),
    ).toEqual({ width: 2.175, depth: 1.5 })
  })

  it('ignores height, which no plan check uses', () => {
    const flat = footprintFromMeta({ bboxMin: [0, 0, 0], bboxMax: [2, 0.02, 1] })
    const tall = footprintFromMeta({ bboxMin: [0, 0, 0], bboxMax: [2, 4, 1] })

    expect(flat).toEqual(tall)
  })

  it('measures a box that sits away from its own origin', () => {
    expect(footprintFromMeta({ bboxMin: [10, 0, 20], bboxMax: [12, 1, 23] })).toEqual({
      width: 2,
      depth: 3,
    })
  })

  it('rounds to millimetres', () => {
    const footprint = footprintFromMeta({
      bboxMin: [0, 0, 0],
      bboxMax: [1.23456789, 1, 0.98765432],
    })

    expect(footprint).toEqual({ width: 1.235, depth: 0.988 })
  })

  it('reports nothing when the model was never measured', () => {
    expect(footprintFromMeta(null)).toBeNull()
    expect(footprintFromMeta({})).toBeNull()
    expect(footprintFromMeta({ bboxMin: [0, 0, 0] })).toBeNull()
    expect(footprintFromMeta({ bboxMin: 'nope', bboxMax: [1, 1, 1] })).toBeNull()
  })

  it('refuses a degenerate box rather than store a zero', () => {
    expect(footprintFromMeta({ bboxMin: [0, 0, 0], bboxMax: [0, 2, 0] })).toBeNull()
  })
})
