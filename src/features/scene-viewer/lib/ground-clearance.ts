/** Metres the eye is held above the ground plane. */
export const GROUND_MARGIN = 0.35

/** Everything about the pose that decides how high the eye ends up. */
export type EyePose = {
  /** Orbit radius, in metres. */
  radius: number
  /** Polar angle from +Y, in radians. */
  phi: number
  /** World height of the orbit target. */
  targetY: number
  /** Focal offset along the camera's forward axis. Nothing sets it today. */
  offsetZ?: number
}

/**
 * World height of the eye, focal offset included.
 *
 * camera-controls composes the pose and only then adds the offset along the
 * camera's own columns, leaving the target where it is (`update()`, "set offset
 * after the orbit movement"). The right column is horizontal — `cross(up,
 * forward)` on a Y-up camera — so only the vertical part of the offset can lower
 * the eye, and it does so by `sin(phi)`: all of it at the horizon, almost none
 * of it looking straight down. A positive `offsetY` is the one that lowers it;
 * the library negates the up column before adding.
 *
 * Nothing else in the viewer works this out. `maxPolarAngle` bounds the orbit
 * against the *target*, and `setBoundary` bounds the target itself — neither has
 * ever looked at where the eye actually ended up.
 */
export function eyeHeight(pose: EyePose, offsetY: number): number {
  const radial = pose.radius + (pose.offsetZ ?? 0)
  return pose.targetY + radial * Math.cos(pose.phi) - offsetY * Math.sin(pose.phi)
}

/**
 * The most the view may be slid downward before the eye reaches the ground.
 *
 * Infinite at the pole, where sliding the view cannot change the eye's height at
 * all, and zero once the orbit alone has already put the eye too low — there is
 * no downward slide left to give.
 */
export function groundOffsetLimit(pose: EyePose, groundY: number): number {
  const drop = Math.sin(pose.phi)
  if (drop <= 1e-6) return Infinity

  const headroom = eyeHeight(pose, 0) - (groundY + GROUND_MARGIN)
  return Math.max(0, headroom / drop)
}

/**
 * How far the orbit may tip before the eye itself drops through the floor.
 *
 * `maxPolarAngle` alone cannot answer this. It is one fixed angle, while how
 * low a given angle puts the eye depends entirely on the orbit radius: 85° is
 * a comfortable three-quarter view from across the site and is under the floor
 * from two metres out. Zooming in and then dragging is exactly that sequence,
 * which is how a visitor ends up looking at the underside of a floor slab.
 *
 * So the answer is recomputed from the live radius: the largest angle whose
 * eye still clears the floor, or `PI` when the radius is short enough that no
 * angle can reach it. Zero when even looking straight down would not clear it,
 * which is the honest answer to an impossible ask rather than a silent pass.
 */
export function maxPolarForClearance(radius: number, targetY: number, groundY: number): number {
  if (!(radius > 1e-6)) return Math.PI

  const needed = (groundY + GROUND_MARGIN - targetY) / radius
  if (needed <= -1) return Math.PI
  if (needed >= 1) return 0

  return Math.acos(needed)
}
