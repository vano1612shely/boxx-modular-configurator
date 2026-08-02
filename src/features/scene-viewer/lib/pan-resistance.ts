/** Fraction of the travel that pans at full speed before resistance starts. */
const KNEE = 0.6

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
export function panSpeedFactor(reach: number, limit: number): number {
  if (limit <= 0) return 1

  const knee = limit * KNEE
  if (reach <= knee) return 1

  const span = limit - knee
  return Math.max(0, 1 - (reach - knee) / span)
}
