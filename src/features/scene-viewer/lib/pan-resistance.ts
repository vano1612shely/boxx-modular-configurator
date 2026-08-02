/** Fraction of the travel that moves one-to-one before resistance starts. */
const KNEE = 0.6

/**
 * One-to-one up to the knee, then easing asymptotically towards the limit, so
 * a pan grows heavy at the edge instead of stopping dead on it.
 *
 * The slope is 1 on both sides of the knee — the derivative of
 * `span * (1 - e^(-over/span))` at `over = 0` is exactly 1 — so there is no
 * kink where resistance begins, and the limit is approached but never reached.
 */
export function resistPan(value: number, limit: number): number {
  if (limit <= 0) return 0

  const knee = limit * KNEE
  const magnitude = Math.abs(value)
  if (magnitude <= knee) return value

  const span = limit - knee
  const eased = knee + span * (1 - Math.exp(-(magnitude - knee) / span))
  return Math.sign(value) * eased
}
