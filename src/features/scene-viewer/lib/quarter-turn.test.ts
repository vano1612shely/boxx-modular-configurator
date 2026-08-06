import { describe, expect, it } from 'vitest'

import { quarterTurn } from './quarter-turn'

const QUARTER = Math.PI / 2
const deg = (d: number) => (d * Math.PI) / 180

describe('quarterTurn', () => {
  it('moves one face at a time from a face', () => {
    expect(quarterTurn(0, 1)).toBeCloseTo(QUARTER, 9)
    expect(quarterTurn(0, -1)).toBeCloseTo(-QUARTER, 9)
    expect(quarterTurn(QUARTER, 1)).toBeCloseTo(2 * QUARTER, 9)
    expect(quarterTurn(2 * QUARTER, -1)).toBeCloseTo(QUARTER, 9)
  })

  // The point of snapping: a dragged camera lands square on the next face, and
  // the hand-made offset is spent rather than carried.
  it('snaps a dragged camera onto the next face', () => {
    expect(quarterTurn(deg(20), 1)).toBeCloseTo(QUARTER, 9)
    expect(quarterTurn(deg(70), 1)).toBeCloseTo(QUARTER, 9)
    expect(quarterTurn(deg(20), -1)).toBeCloseTo(0, 9)
    expect(quarterTurn(deg(70), -1)).toBeCloseTo(0, 9)
  })

  // A camera a hair short of a face must still travel a face, or the button
  // does nothing anyone can see.
  it('does not turn by a hair', () => {
    expect(quarterTurn(deg(89.9), 1)).toBeCloseTo(2 * QUARTER, 9)
    expect(quarterTurn(deg(90.1), -1)).toBeCloseTo(0, 9)
  })

  // camera-controls accumulates azimuth and never wraps it, so the input can be
  // any number of turns from zero and the step must stay local to it.
  it('stays next to an azimuth that has been round several times', () => {
    for (const azimuth of [deg(740), deg(-400), deg(1000.5)]) {
      for (const dir of [1, -1] as const) {
        expect(Math.abs(quarterTurn(azimuth, dir) - azimuth)).toBeLessThanOrEqual(QUARTER + 1e-9)
      }
    }
  })

  it('always lands on a quarter', () => {
    for (const azimuth of [0, 0.3, -2.2, 7.9, deg(133)]) {
      for (const dir of [1, -1] as const) {
        const steps = quarterTurn(azimuth, dir) / QUARTER
        expect(steps).toBeCloseTo(Math.round(steps), 9)
      }
    }
  })

  it('goes the way it was asked to', () => {
    for (const azimuth of [0, 0.3, -2.2, 7.9, deg(133)]) {
      expect(quarterTurn(azimuth, 1)).toBeGreaterThan(azimuth)
      expect(quarterTurn(azimuth, -1)).toBeLessThan(azimuth)
    }
  })
})
