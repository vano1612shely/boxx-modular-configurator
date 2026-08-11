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

/** A pose with the tip angle left out, that being the thing being solved for. */
export type OrbitPose = Omit<EyePose, 'phi'> & {
  /** Focal offset along the camera's up axis. Positive is a view slid down. */
  offsetY?: number
}

/**
 * How far the orbit may tip before the eye itself drops through the floor.
 *
 * `maxPolarAngle` alone cannot answer this. It is one fixed angle, while how
 * low a given angle puts the eye depends on the rest of the pose: at the
 * authored 85° the eye sits `radius * 0.087` above the target, so the same tilt
 * that stands a metre clear from twelve metres out is three centimetres clear
 * from half a metre. Tipping over and then zooming is exactly that sequence,
 * and the top view — whose target is the bottom of the subject, not its middle
 * — starts it already low.
 *
 * `eyeHeight` in terms of `phi` is `radius * cos(phi) - offsetY * sin(phi)`,
 * which is a single cosine of `phi` shifted by the angle the offset leans at.
 * So the largest tilt that still clears the floor is one `acos`, and it accounts
 * for a slid view as well as a tipped one — the two lower the eye together, and
 * bounding either alone leaves the pair to walk through the floor.
 *
 * `PI` when nothing about the pose can reach the floor; zero when even looking
 * straight down would not clear it, which is the honest answer to an impossible
 * ask rather than a silent pass.
 */
export function maxPolarForClearance(pose: OrbitPose, groundY: number): number {
  const forward = pose.radius + (pose.offsetZ ?? 0)
  const down = pose.offsetY ?? 0
  const floor = groundY + GROUND_MARGIN

  // Straight down is as high as the eye gets: the offset slides across the
  // ground from there, it does not lift. If that does not clear, nothing does,
  // and a limit means "every tilt up to here clears" or it means nothing —
  // clamping down to it has to be an improvement at any angle below it.
  if (pose.targetY + forward < floor) return 0

  const reach = Math.hypot(forward, down)
  if (!(reach > 1e-6)) return Math.PI

  const lean = Math.atan2(down, forward)
  const limit = Math.acos(Math.min(1, Math.max(-1, (floor - pose.targetY) / reach))) - lean
  return Math.min(Math.PI, Math.max(0, limit))
}
