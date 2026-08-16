/** Whether a piece turned to this angle has somewhere legal to stand. */
export type Fits = (deg: number) => boolean

const QUARTERS = [90, 180, 270]

export function normaliseDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * The next quarter turn that leaves the piece somewhere it can stand.
 *
 * A desk that only fits along the room's length has two positions, not four,
 * and the button that turns it should walk between them rather than refusing.
 * Ninety degrees is tried first, then a half turn, then three quarters; the
 * fourth is where it already is, so a piece with nowhere else to go returns
 * null and the button says so.
 */
export function nextFittingQuarter(from: number, fits: Fits): number | null {
  for (const step of QUARTERS) {
    const candidate = normaliseDeg(from + step)
    if (fits(candidate)) return candidate
  }

  return null
}

/**
 * The angle nearest the one asked for that the piece actually fits at.
 *
 * For the slider, which is let go wherever the hand happens to stop. Searching
 * outwards in both directions at once keeps the correction as small as it can
 * be — a piece nudged two degrees past its limit comes back two degrees, not to
 * the far side of the room's length.
 *
 * `step` is the resolution of the search in degrees. One degree is what the
 * slider itself offers, so nothing finer can be asked for.
 */
export function nearestFittingAngle(target: number, fits: Fits, step = 1): number | null {
  const from = normaliseDeg(target)
  if (fits(from)) return from

  for (let offset = step; offset <= 180; offset += step) {
    const back = normaliseDeg(from - offset)
    if (fits(back)) return back

    const forward = normaliseDeg(from + offset)
    if (fits(forward)) return forward
  }

  return null
}
