/**
 * The angle congruent to `to` that lies nearest `from`, so a flight never
 * travels more than half a turn.
 *
 * camera-controls drives azimuth with a plain scalar `smoothDamp`, with no
 * wrapping, and `setLookAt` writes the destination through
 * `Spherical.setFromVector3`, which returns `atan2` in (−π, π]. Left alone,
 * a camera resting at −172° reaches the 180° back view by travelling 352°.
 */
export function shortestTurn(from: number, to: number): number {
  const delta = to - from
  return from + Math.atan2(Math.sin(delta), Math.cos(delta))
}
