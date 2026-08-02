import { describe, expect, it } from 'vitest'

import { shortestTurn } from './shortest-turn'

const TURN = Math.PI * 2

function travel(from: number, to: number): number {
  return Math.abs(shortestTurn(from, to) - from)
}

describe('shortestTurn', () => {
  it('never travels more than half a turn, from anywhere to anywhere', () => {
    for (let from = -12; from <= 12; from += 0.37) {
      for (let to = -Math.PI; to <= Math.PI; to += 0.19) {
        expect(travel(from, to)).toBeLessThanOrEqual(Math.PI + 1e-9)
      }
    }
  })

  it('lands on an angle congruent to the destination', () => {
    for (const [from, to] of [
      [-3, Math.PI],
      [37.6, -Math.PI / 2],
      [0.2, -3.1],
      [-100, 1.4],
    ]) {
      const turns = (shortestTurn(from, to) - to) / TURN
      expect(turns).toBeCloseTo(Math.round(turns), 9)
    }
  })

  // The case the rig hits: resting just short of the back view, clicking Back.
  it('takes 8 degrees to the back view, not 352', () => {
    expect(travel(-3, Math.PI)).toBeCloseTo(Math.PI - 3, 9)
    expect(((Math.PI - 3) * 180) / Math.PI).toBeCloseTo(8.1, 1)
  })

  it('unwinds an accumulated azimuth rather than replaying it', () => {
    // Six turns of orbiting, then the right-hand view.
    expect(travel(37.6, -Math.PI / 2)).toBeLessThanOrEqual(Math.PI)
  })

  it('is a no-op when it is already there', () => {
    expect(shortestTurn(1.23, 1.23)).toBeCloseTo(1.23, 12)
    expect(shortestTurn(1.23 + TURN, 1.23)).toBeCloseTo(1.23 + TURN, 12)
  })
})
