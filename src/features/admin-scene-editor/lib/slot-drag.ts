/**
 * Bearing of a point as seen from a spot, in the same terms a facing is.
 *
 * A yaw of θ about Y takes the local +Z axis to `(sin θ, cos θ)`, so the bearing
 * that matches a facing is `atan2(x, z)` — x before z, which is not the usual
 * order and is exactly the mistake this exists to stop anyone making twice.
 */
export function bearingDeg(dx: number, dz: number): number {
  return (Math.atan2(dx, dz) * 180) / Math.PI
}

/** Into [0, 360), which is how a facing is stored. */
export function normaliseDeg(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

type Turn = {
  /** Facing the spot had when the ring was grabbed. */
  startYaw: number
  /** Bearing the grip was taken at. */
  startBearing: number
  /** Bearing the pointer is at now. */
  bearing: number
  /** Facing the spot has right now — how the wrap is resolved. */
  currentYaw: number
}

/**
 * Where a ring drag has turned the spot to.
 *
 * Measured from the grip rather than accumulated per move, so the error cannot
 * drift over a long gesture. That leaves one problem: bearings live in a
 * 360-wide window, so a drag past half a turn reads as the same angle going the
 * other way. Resolved against the facing the spot is at this instant, which
 * moves continuously with the pointer — no state to carry, and a full turn is a
 * full turn.
 */
export function draggedYaw({ startYaw, startBearing, bearing, currentYaw }: Turn): number {
  const raw = startYaw + (bearing - startBearing)
  const turns = Math.round((currentYaw - raw) / 360)
  return normaliseDeg(raw + turns * 360)
}
