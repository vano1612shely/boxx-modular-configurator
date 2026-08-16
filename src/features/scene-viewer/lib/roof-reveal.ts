/**
 * Tilt, in degrees from straight down, at which the roof gets out of the way.
 *
 * The honest test is "can the visitor see the floor", which depends on the
 * shape of the building, where the camera is over it and how wide the lens is —
 * a different answer for every room in the plan, recomputed every frame. The
 * angle is the same question asked once, and it is the one thing the visitor is
 * actually doing when they ask for the inside: tipping over the top of it.
 */
export const ROOF_HIDE_POLAR_DEG = 60

/** …and, coming back down, the tilt at which it returns. */
export const ROOF_SHOW_POLAR_DEG = 68

/**
 * Whether the roof is drawn at this tilt, given whether it is drawn now.
 *
 * Two angles rather than one, and this is the whole reason the function holds
 * state: on a single threshold, a hand resting on the exact angle flickers the
 * roof in and out for as long as it rests there, and every flip of it redraws
 * the shadow map. Between the two the answer is whichever it already was, so
 * crossing has to be deliberate in the direction it is crossed.
 */
export function roofShownAt(polarDeg: number, shown: boolean): boolean {
  if (polarDeg <= ROOF_HIDE_POLAR_DEG) return false
  if (polarDeg >= ROOF_SHOW_POLAR_DEG) return true
  return shown
}
