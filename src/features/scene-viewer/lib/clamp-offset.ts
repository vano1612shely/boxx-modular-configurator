import type CameraControlsImpl from 'camera-controls'
import { Spherical, Vector3 } from 'three'

import { offsetLimit, restingReach } from './pan-resistance'

const OFFSET = new Vector3()
const SPHERICAL = new Spherical()

/**
 * Pulls the focal offset back inside the bound, and reports whether it had to.
 *
 * The pan is bounded by slowing the drag, and that speed reaches zero at the
 * limit — which makes being past the limit a state panning cannot leave, since
 * panning is the thing that was switched off. Nothing gets there by panning, the
 * resistance being asymptotic, but the bound is a share of the orbit radius, so
 * a zoom moves the bound rather than the offset: close in far enough and the
 * offset already held is suddenly outside it. From then on the pan is dead until
 * a view preset zeroes the offset.
 *
 * So the invariant is restored between gestures rather than defended during
 * them. Call it while nothing is being dragged.
 */
export function clampOffsetToLimit(controls: CameraControlsImpl, fovDeg: number): boolean {
  const offset = controls.getFocalOffset(OFFSET, true)
  const reach = Math.hypot(offset.x, offset.y)
  if (reach === 0) return false

  const limit = offsetLimit(controls.getSpherical(SPHERICAL, true).radius, fovDeg)
  if (reach <= limit) return false

  const scale = restingReach(limit) / reach
  void controls.setFocalOffset(offset.x * scale, offset.y * scale, offset.z, true)
  return true
}
