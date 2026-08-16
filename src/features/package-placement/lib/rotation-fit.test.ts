import { describe, expect, it } from 'vitest'

import { nearestFittingAngle, nextFittingQuarter, normaliseDeg } from './rotation-fit'

/** A long piece in a narrow room: it lies one way, or the other way round. */
const alongTheRoom = (deg: number) => {
  const at = normaliseDeg(deg)
  return at <= 10 || at >= 350 || Math.abs(at - 180) <= 10
}

const anywhere = () => true
const nowhere = () => false

describe('the quarter-turn button', () => {
  // The complaint: a desk that only fits lengthways refused to turn at all,
  // because the very next quarter is across the room and does not fit.
  it('steps over a quarter turn that does not fit to one that does', () => {
    expect(nextFittingQuarter(0, alongTheRoom)).toBe(180)
    expect(nextFittingQuarter(180, alongTheRoom)).toBe(0)
  })

  it('takes the plain quarter when the piece fits there', () => {
    expect(nextFittingQuarter(0, anywhere)).toBe(90)
    expect(nextFittingQuarter(270, anywhere)).toBe(0)
  })

  // Where a piece stands is the fourth quarter, and turning it to where it
  // already is would be a button that does nothing while looking like it works.
  it('gives up when no other quarter fits', () => {
    expect(nextFittingQuarter(0, (deg) => normaliseDeg(deg) === 0)).toBeNull()
    expect(nextFittingQuarter(45, nowhere)).toBeNull()
  })

  it('answers in the same turn of the circle whatever it is handed', () => {
    expect(nextFittingQuarter(-90, anywhere)).toBe(0)
    expect(nextFittingQuarter(720, anywhere)).toBe(90)
  })
})

describe('letting go of the slider', () => {
  it('leaves an angle that fits exactly where it was left', () => {
    expect(nearestFittingAngle(137, anywhere)).toBe(137)
    expect(nearestFittingAngle(5, alongTheRoom)).toBe(5)
  })

  // The correction has to be the smallest one that works, or a small nudge
  // past the limit would fling the piece to the other end of its range.
  it('comes back by as little as it can', () => {
    expect(nearestFittingAngle(12, alongTheRoom)).toBe(10)
    expect(nearestFittingAngle(348, alongTheRoom)).toBe(350)
  })

  it('crosses to the far side when that is the nearer way', () => {
    expect(nearestFittingAngle(100, alongTheRoom)).toBe(170)
    expect(nearestFittingAngle(280, alongTheRoom)).toBe(350)
  })

  it('normalises what it hands back', () => {
    expect(nearestFittingAngle(-5, alongTheRoom)).toBe(355)
    expect(nearestFittingAngle(365, anywhere)).toBe(5)
  })

  it('says so when the piece fits nowhere at all', () => {
    expect(nearestFittingAngle(0, nowhere)).toBeNull()
  })

  // A coarser search is allowed to skip past a one-degree sliver, but must
  // still land on something legal rather than on the sliver's edge.
  it('honours the step it is given', () => {
    const onlyAtNinety = (deg: number) => normaliseDeg(deg) === 90
    expect(nearestFittingAngle(0, onlyAtNinety, 90)).toBe(90)
    expect(nearestFittingAngle(0, onlyAtNinety, 45)).toBe(90)
  })
})
