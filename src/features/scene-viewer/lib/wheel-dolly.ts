/** Distance multiplier one detent of the wheel should produce. */
const NOTCH_STEP = 1.11

/** camera-controls turns its own delta into `0.95 ** (delta * dollySpeed)`. */
const NOTCH_DELTA = Math.log(NOTCH_STEP) / Math.log(1 / 0.95)

/** What one detent reports per `deltaMode`: pixels, lines, pages. */
const NOTCH_UNIT = [100, 3, 1]

/**
 * The `dollySpeed` that makes this wheel event mean one notch, whatever the
 * browser and OS reported.
 *
 * camera-controls normalizes with `deltaY / (isMac ? -1 : -3) / 10` for pixel
 * deltas and `deltaY / (isMac ? -1 : -3)` for line deltas, so the same physical
 * wheel moves 5% per notch in Firefox, 19% in Chrome and 67% at the macOS pixel
 * rate. Undoing that division and re-imposing a notch keeps the feel identical
 * everywhere, while staying proportional for the small continuous deltas a
 * trackpad emits and capping the step for a "one screen per notch" wheel.
 */
export function dollySpeedFor(deltaY: number, deltaMode: number, isMac: boolean): number {
  const reported = Math.abs(deltaY)
  if (reported === 0) return 1

  const factor = isMac ? 1 : 3
  const libraryDelta = deltaMode === 1 ? reported / factor : reported / (factor * 10)

  const notches = Math.min(reported / (NOTCH_UNIT[deltaMode] ?? NOTCH_UNIT[0]), 1)
  return (NOTCH_DELTA * notches) / libraryDelta
}

/** What the library's dolly does to the distance, for a given event and speed. */
export function dollyStepFor(
  deltaY: number,
  deltaMode: number,
  isMac: boolean,
  dollySpeed: number,
): number {
  const factor = isMac ? -1 : -3
  const delta = deltaMode === 1 ? deltaY / factor : deltaY / (factor * 10)
  return 0.95 ** (delta * dollySpeed)
}
