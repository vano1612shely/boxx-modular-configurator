/** A full turn costs this many canvas widths of horizontal drag… */
const TURN_WIDTHS = 1

/** …and never fewer than this many canvas heights. */
const TURN_HEIGHTS = 1.5

/** The authored polar range costs this fraction of the canvas height. */
const TILT_HEIGHTS = 0.55

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * camera-controls turns a drag into `2π · speed · deltaX / elementHeight` — it
 * divides the *horizontal* delta by the *height*, so at speed 1 the same swipe
 * spins 728° on a wide desktop canvas and 187° on a phone. Restating the speed
 * against the width makes a full turn cost a canvas rather than a flick.
 *
 * The width alone is not enough of a reference, though. The tilt below is priced
 * in heights, and the library divides both axes by the height, so a turn priced
 * in widths alone leaves the yaw-to-pitch ratio per pixel a function of the
 * aspect: 1.4 on a landscape desktop canvas, 5.4 on a portrait phone, where one
 * thumb width buys a whole revolution and a diagonal drag spins the model
 * without tilting it. The height floor pulls that back to 1.9 on any canvas
 * narrower than 3:2, and costs a landscape one nothing — a width there is
 * already the longer of the two references.
 */
export function azimuthRotateSpeed(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1
  return clamp(height / Math.max(TURN_WIDTHS * width, TURN_HEIGHTS * height), 0.2, 4)
}

/**
 * The polar range is authored, not a full circle, so at speed 1 the whole tilt
 * is spent in a fifth of a vertical swipe and every diagonal drag dies
 * vertically. Deriving the speed from the range keeps the tilt gesture the same
 * length whatever the building allows.
 */
export function polarRotateSpeed(minPolarDeg: number, maxPolarDeg: number): number {
  const span = Math.abs(maxPolarDeg - minPolarDeg)
  return clamp(span / (360 * TILT_HEIGHTS), 0.05, 1)
}
