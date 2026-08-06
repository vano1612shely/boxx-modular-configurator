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
