import type CameraControlsImpl from 'camera-controls'
import { Spherical, Vector3 } from 'three'

import { offsetLimit, restingReach } from './pan-resistance'

const OFFSET = new Vector3()
const SPHERICAL = new Spherical()

/**
 * Pulls the focal offset back inside its bounds, and reports whether it had to.
 *
 * The pan is bounded by slowing the drag, and that speed reaches zero at the
 * limit — which makes being past the limit a state panning cannot leave, since
 * panning is the thing that was switched off. Nothing gets there by panning, the
 * resistance being asymptotic, but both bounds move underneath an offset that
 * does not: the radial one is a share of the orbit radius, so a zoom can strand
 * the offset outside it, and the ground one falls as the orbit lowers the eye.
 * From then on the pan is dead until a view preset zeroes the offset.
 *
 * So the invariant is restored between gestures rather than defended during
 * them. Call it while nothing is being dragged.
 *
 * `downLimit` is how far the view may still be slid downward before the eye
 * reaches the ground; it bounds the vertical component alone, because sliding
 * sideways cannot lower the eye.
 */
export function clampOffsetToLimit(
  controls: CameraControlsImpl,
  fovDeg: number,
  downLimit = Infinity,
): boolean {
  const offset = controls.getFocalOffset(OFFSET, true)
  const reach = Math.hypot(offset.x, offset.y)

  let x = offset.x
  let y = offset.y

  if (reach > 0) {
    const limit = offsetLimit(controls.getSpherical(SPHERICAL, true).radius, fovDeg)
    if (reach > limit) {
      const scale = restingReach(limit) / reach
      x *= scale
      y *= scale
    }
  }

  if (y > downLimit) y = restingReach(downLimit)

  if (x === offset.x && y === offset.y) return false

  void controls.setFocalOffset(x, y, offset.z, true)
  return true
}
