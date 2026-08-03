/** Fraction of the travel that pans at full speed before resistance starts. */
const KNEE = 0.6

/** How far off centre the view may slide, in half-frame-heights. */
const MAX_OFFSET_HALF_HEIGHTS = 0.55

/**
 * How far the focal offset may reach at a given orbit distance, in metres.
 *
 * camera-controls applies the offset as a world-space translation *after* the
 * camera has been aimed (`update()` composes the matrix, then adds the offset
 * along its own columns), so a fixed world bound is a different displacement on
 * screen at every distance: the same 2 m is a fifth of the frame from the
 * dollhouse and ten frames away up close. Stating the bound in half-heights
 * makes the limit — and the resistance approaching it — mean one thing at any
 * zoom, and it is what lets the offset be rescaled with the distance without
 * ever crossing its own bound.
 */
export function offsetLimit(radius: number, fovDeg: number): number {
  const half = (Math.max(fovDeg, 1) * Math.PI) / 360
  return MAX_OFFSET_HALF_HEIGHTS * Math.max(radius, 0) * Math.tan(half)
}

/**
 * How much of the pan speed survives at a given distance off centre: full speed
 * up to the knee, then falling linearly to nothing at the limit.
 *
 * Resistance belongs on the speed, not on the result. camera-controls applies an
 * offset drag through `setFocalOffset(…, true)`, so it is damped; rewriting the
 * value afterwards swaps that damping for a snap partway through the travel,
 * which is felt as a jolt. Scaling the speed leaves the library's own motion
 * untouched and only makes the drag heavier.
 *
 * A linear falloff is what makes the limit reachable-but-not-crossable: with
 * `dr/ds = 1 − (r − knee)/span` the offset approaches the limit exponentially in
 * drag distance and never arrives. An exponential falloff — the obvious first
 * guess — integrates to `knee + span·ln(1 + s/span)`, which grows without bound
 * and would sail past the limit given a long enough drag.
 */
/**
 * Where to put an offset that ended up outside the bound. The limit itself is
 * the one place resistance is total, so landing exactly on it would leave the
 * pan just as stuck as being past it; the knee is the nearest point that pans at
 * full speed again.
 */
export function restingReach(limit: number): number {
  return Math.max(limit, 0) * KNEE
}

export function panSpeedFactor(reach: number, limit: number): number {
  if (limit <= 0) return 1

  const knee = limit * KNEE
  if (reach <= knee) return 1

  const span = limit - knee
  return Math.max(0, 1 - (reach - knee) / span)
}
