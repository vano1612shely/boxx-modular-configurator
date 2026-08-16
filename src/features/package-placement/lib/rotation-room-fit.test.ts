import { describe, expect, it } from 'vitest'

import { clampPoseToRegion, poseInsideRegion, regionFrom } from '@/entities/building'

import { nearestFittingAngle, nextFittingQuarter } from './rotation-fit'

/**
 * The case the client reported, at its own measurements.
 *
 * A Premium conference package — 6.089 m across, 2.579 m deep — in a long
 * 18.2 m² room. It lies along the room or the other way round, and nothing in
 * between.
 */
const ROOM = regionFrom([
  [
    { x: -3.25, z: -1.4 },
    { x: 3.25, z: -1.4 },
    { x: 3.25, z: 1.4 },
    { x: -3.25, z: 1.4 },
  ],
])

const PACKAGE = { width: 6.089, depth: 2.579 }

/**
 * What the turn button asks, written the way the component asks it.
 *
 * Clamping walks the piece towards the room and hands back wherever it got to
 * after ten passes — it does not promise to have got there. The check that was
 * missing is the second line: whether it actually landed inside.
 */
const fitsAt = (deg: number) => {
  const clamped = clampPoseToRegion(0, 0, deg, PACKAGE, ROOM)
  return poseInsideRegion(clamped.x, clamped.z, deg, PACKAGE, ROOM)
}

describe('a long package in a long room', () => {
  it('lies along the room, either way round', () => {
    expect(fitsAt(0)).toBe(true)
    expect(fitsAt(180)).toBe(true)
  })

  // The bug: this was reported as a legal turn, so the table swung across the
  // room and out through both walls. Clamping could not save it and nothing
  // asked whether it had.
  it('does not fit across it', () => {
    expect(fitsAt(90)).toBe(false)
    expect(fitsAt(270)).toBe(false)
  })

  it('sends the turn button to the half turn', () => {
    expect(nextFittingQuarter(0, fitsAt)).toBe(180)
    expect(nextFittingQuarter(180, fitsAt)).toBe(0)
  })

  it('settles a slider let go across the room onto the nearest side', () => {
    expect(nearestFittingAngle(80, fitsAt)).toBeLessThan(80)
    expect(nearestFittingAngle(100, fitsAt)).toBeGreaterThan(100)
    expect(fitsAt(nearestFittingAngle(80, fitsAt) as number)).toBe(true)
  })

  // A room barely deeper than the package is: there is a little play either
  // way, and none at all by the time the piece is halfway round.
  it('allows the play the room really has, and no more', () => {
    expect(fitsAt(1)).toBe(true)
    expect(fitsAt(45)).toBe(false)
  })
})
