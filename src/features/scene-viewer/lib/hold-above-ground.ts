import type CameraControlsImpl from 'camera-controls'
import { Spherical, Vector3 } from 'three'

import { maxPolarForClearance } from './ground-clearance'

/**
 * The parts of camera-controls this touches, so a test can hand it a real
 * instance and a caller cannot quietly widen what it reaches for.
 */
export type Orbit = Pick<
  CameraControlsImpl,
  | 'minPolarAngle'
  | 'maxPolarAngle'
  | 'getSpherical'
  | 'getTarget'
  | 'getFocalOffset'
  | 'rotatePolarTo'
>

const SPHERICAL = new Spherical()
const TARGET = new Vector3()
const OFFSET = new Vector3()

/** Radians of give, so a pose resting exactly on the limit is left alone. */
const SLACK = 1e-4

/**
 * Holds the eye above the floor, tipping the orbit up when nothing else will.
 *
 * Writing `maxPolarAngle` is not enough on its own, and that is the whole of the
 * bug this exists for. camera-controls clamps against it inside `rotateTo` —
 * that is, when rotation is *asked for*. `update()` never re-checks it, so an
 * angle that was legal when it was set stays set, and a dolly afterwards is free
 * to shorten the radius under it until the eye is through the floor. Tipping
 * over first and zooming second is the order a visitor naturally does it in, so
 * the tighter limit always arrives too late to have prevented anything.
 *
 * The answer is to re-apply the limit to the pose that already exists, every
 * frame, against the radius and offset it is currently true for. What the
 * visitor feels is the camera skimming the floor as it closes in: the tilt gives
 * way, gradually, rather than the zoom stopping dead at arm's length — which is
 * what bounding the distance instead would have meant, and from a low angle onto
 * something at floor level that stop lands metres away.
 *
 * Measured on the live pose rather than the pose being flown to: the constraint
 * is on where the eye *is*, and the live radius moves smoothly under the damping,
 * so the tilt it dictates moves smoothly too. Taking it from the destination
 * would snap the tilt to its final value on the first frame of a zoom.
 *
 * Returns the limit in force, for the caller to assert on.
 */
export function holdAboveGround(
  controls: Orbit,
  groundY: number,
  authoredMaxPolar: number,
): number {
  const limitNow = limitFor(controls, groundY, authoredMaxPolar, false)
  const limitEnd = limitFor(controls, groundY, authoredMaxPolar, true)

  // Nothing below this is reachable: `rotateTo` clamps up to `minPolarAngle`
  // first, so asking for less would spend every frame re-asking for a pose the
  // library has already refused.
  const floor = controls.minPolarAngle
  const phiNow = controls.getSpherical(SPHERICAL, false).phi
  const phiEnd = controls.getSpherical(SPHERICAL, true).phi
  const heldNow = Math.min(phiNow, Math.max(limitNow, floor))
  const heldEnd = Math.min(phiEnd, Math.max(limitEnd, floor))

  if (phiNow - heldNow > SLACK || phiEnd - heldEnd > SLACK) {
    // Wide enough to admit both writes below, since `rotateTo` clamps what it
    // is given; the number that judges the visitor's own input is set after.
    controls.maxPolarAngle = Math.max(heldNow, heldEnd)
    // No transition on the first: the pose on screen is the one that is too
    // low, so it is the one that has to move. It reads as continuous anyway —
    // the limit it lands on is a smooth function of a radius that is itself
    // being damped.
    void controls.rotatePolarTo(heldNow, false)
    // …which also overwrote the destination, so put it back. Everything the
    // orbit is travelling towards is judged at the radius it will be travelling
    // at, not at the one it happens to be at now: leaving a room is a shrunken
    // radius and a wide destination at the same moment, and judging that
    // destination by the radius being left behind would land the flight at a
    // tilt nobody asked for and nothing later would undo.
    if (heldEnd !== heldNow) void controls.rotatePolarTo(heldEnd, true)
  }

  const limit = Math.min(limitNow, limitEnd)
  controls.maxPolarAngle = limit
  return limit
}

function limitFor(controls: Orbit, groundY: number, authored: number, end: boolean): number {
  const { radius } = controls.getSpherical(SPHERICAL, end)
  const targetY = controls.getTarget(TARGET, end).y
  const offsetY = controls.getFocalOffset(OFFSET, end).y

  return Math.min(authored, maxPolarForClearance({ radius, targetY, offsetY }, groundY))
}
