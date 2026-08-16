import { describe, expect, it } from 'vitest'

import { bearingDeg, draggedYaw, normaliseDeg, slotToWorld, worldToSlot } from './slot-drag'

describe('bearingDeg', () => {
  // Matches what a yaw of the same number does to the spot's own +Z arrow.
  it('reads +Z as zero and turns towards +X', () => {
    expect(bearingDeg(0, 1)).toBeCloseTo(0, 9)
    expect(bearingDeg(1, 0)).toBeCloseTo(90, 9)
    expect(bearingDeg(0, -1)).toBeCloseTo(180, 9)
    expect(bearingDeg(-1, 0)).toBeCloseTo(-90, 9)
  })
})

describe('normaliseDeg', () => {
  it('lands everything in [0, 360)', () => {
    expect(normaliseDeg(0)).toBe(0)
    expect(normaliseDeg(360)).toBe(0)
    expect(normaliseDeg(-90)).toBe(270)
    expect(normaliseDeg(450)).toBe(90)
    expect(normaliseDeg(-450)).toBe(270)
  })
})

describe('slotToWorld and worldToSlot', () => {
  const frame = { x: 3, y: 0.8, z: -2, yawDeg: 37 }

  it('leave a point alone at an unturned spot standing at the origin', () => {
    const flat = { x: 0, y: 0, z: 0, yawDeg: 0 }
    expect(slotToWorld(flat, { x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 })
  })

  // The spot's own arrow: +Z locally is where the facing points.
  it('send the local forward axis where the spot faces', () => {
    const east = { x: 0, y: 0, z: 0, yawDeg: 90 }
    const out = slotToWorld(east, { x: 0, y: 0, z: 1 })

    expect(out.x).toBeCloseTo(1, 9)
    expect(out.z).toBeCloseTo(0, 9)
  })

  // The pair is what a drag runs through — out to the world to be moved, back
  // to the spot to be written down. Anything lost here is drift the admin sees
  // as the model creeping every time they touch it.
  it('undo one another', () => {
    for (const local of [
      { x: 0, y: 0, z: 0 },
      { x: 1.4, y: -0.6, z: 2.2 },
      { x: -3, y: 5, z: -0.25 },
    ]) {
      const round = worldToSlot(frame, slotToWorld(frame, local))
      expect(round.x).toBeCloseTo(local.x, 9)
      expect(round.y).toBeCloseTo(local.y, 9)
      expect(round.z).toBeCloseTo(local.z, 9)
    }
  })

  it('measure from the spot, not from the origin', () => {
    expect(worldToSlot({ x: 5, y: 1, z: 5, yawDeg: 0 }, { x: 5, y: 1, z: 5 })).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
  })
})

describe('draggedYaw', () => {
  const turn = (startYaw: number, startBearing: number, bearing: number, currentYaw: number) =>
    draggedYaw({ startYaw, startBearing, bearing, currentYaw })

  it('turns the spot by however far the grip went', () => {
    expect(turn(0, 0, 30, 0)).toBeCloseTo(30, 9)
    expect(turn(90, 45, 15, 90)).toBeCloseTo(60, 9)
  })

  it('leaves the facing alone for a grip that has not moved', () => {
    expect(turn(137, 20, 20, 137)).toBeCloseTo(137, 9)
  })

  // The whole reason this is a function and not two lines inline: bearings wrap
  // at ±180, and a grip dragged across that line reads as a jump most of the way
  // back round if the wrap is not resolved.
  it('does not spin the other way when the grip crosses the back', () => {
    // Grip at 170°, dragged to -170°: twenty degrees on, not three hundred and
    // forty back.
    expect(turn(0, 170, -170, 0)).toBeCloseTo(20, 9)
    expect(turn(0, -170, 170, 0)).toBeCloseTo(340, 9)
  })

  // Absolute-from-grip alone caps a gesture at half a turn. Reading the wrap off
  // the live facing is what lifts that.
  it('follows a grip all the way round and past the start', () => {
    // Three quarters of a turn on: the spot is already at 170 from this drag, so
    // a bearing 100 past the grip is 100, not -260.
    expect(turn(0, 0, 100, 170)).toBeCloseTo(100, 9)
    // And a full turn keeps going rather than snapping back to nothing.
    expect(turn(0, 0, -10, 340)).toBeCloseTo(350, 9)
  })

  it('crosses zero without a jump', () => {
    expect(turn(350, 0, 20, 350)).toBeCloseTo(10, 9)
    expect(turn(10, 0, -20, 10)).toBeCloseTo(350, 9)
  })

  // Walked round twice a degree at a time, feeding each answer back in as the
  // live facing — which is exactly how the drag runs.
  it('stays continuous over two full turns', () => {
    let current = 0
    for (let step = 1; step <= 720; step += 1) {
      const next = turn(0, 0, normaliseDeg(step) > 180 ? step % 360 : step % 360, current)
      const jump = Math.abs(((next - current + 540) % 360) - 180)
      expect(jump).toBeLessThan(2)
      current = next
    }
    expect(current).toBeCloseTo(0, 6)
  })
})
