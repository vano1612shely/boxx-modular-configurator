import { describe, expect, it } from 'vitest'

import type { PlacedPackage } from '@/entities/configuration'

import { framePose } from './drag-pose'

const CHAIR: PlacedPackage = {
  instanceId: 'chair-1',
  packageId: 1,
  roomKey: 'office-1',
  x: 1,
  z: 2,
  rotationYDeg: 0,
}

describe('framePose', () => {
  it('eases to the placed pose when nothing is being dragged', () => {
    expect(framePose(CHAIR, false, null)).toEqual({ x: 1, z: 2, rotationYDeg: 0, snap: false })
  })

  it('puts the piece exactly where the finger is', () => {
    const live = { instanceId: 'chair-1', x: 5, z: 6, rotationYDeg: 90 }
    expect(framePose(CHAIR, true, live)).toEqual({ x: 5, z: 6, rotationYDeg: 90, snap: true })
  })

  /**
   * The flick this exists to stop.
   *
   * Letting go writes the landed pose to the store and clears the live one, but
   * the release is handled outside React, so a frame or two runs before the prop
   * catches up. In those frames the prop still says where the drag *started*.
   */
  it('leaves the piece alone in the frames between letting go and React catching up', () => {
    expect(framePose(CHAIR, true, null)).toBeNull()
  })

  // The same gap at the other end: pressed, but not yet moved.
  it('leaves it alone between pressing and the first move', () => {
    expect(framePose(CHAIR, true, null)).toBeNull()
  })

  // Two pieces, one finger: a pose belonging to the other one is not this one's.
  it('ignores the pose of a different piece', () => {
    const other = { instanceId: 'chair-2', x: 5, z: 6, rotationYDeg: 90 }
    expect(framePose(CHAIR, true, other)).toBeNull()
  })

  // A piece nobody is dragging follows the configuration even while another one
  // is in the air — that is how a blocked piece is eased back into place.
  it('still follows the configuration when the finger is on something else', () => {
    const other = { instanceId: 'chair-2', x: 5, z: 6, rotationYDeg: 90 }
    expect(framePose(CHAIR, false, other)).toEqual({ x: 1, z: 2, rotationYDeg: 0, snap: false })
  })
})
