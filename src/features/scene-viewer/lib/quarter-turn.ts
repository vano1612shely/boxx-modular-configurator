const QUARTER = Math.PI / 2

/** How close to a face still counts as being on it, in radians (about 1.1°). */
const ON_FACE = 0.02

/**
 * The next quarter of a turn from `azimuth`, in the direction `dir`.
 *
 * Snaps rather than adds: a camera dragged 20° off a face should arrive on the
 * next face, not 20° past it, or every hand-made offset is carried around the
 * building forever. The tolerance is what stops a camera resting a hair short of
 * a face from "turning" by that hair — visibly, nothing would happen.
 *
 * Works on the accumulated azimuth camera-controls keeps, which is not wrapped
 * to a single turn; the result stays within a quarter of the input, so no flight
 * derived from it ever takes the long way round.
 */
export function quarterTurn(azimuth: number, dir: 1 | -1): number {
  const shifted = (azimuth + dir * ON_FACE) / QUARTER
  const steps = dir > 0 ? Math.floor(shifted) + 1 : Math.ceil(shifted) - 1
  return steps * QUARTER
}
