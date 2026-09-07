/** A label as it lands on screen, and how far away the thing it names is. */
export type LabelBox = {
  /** Middle of the label, in css pixels from the top-left of the canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Distance from the camera to what it names. The nearest one keeps its place. */
  depth: number
}

/**
 * How finely the search steps outwards, in pixels.
 *
 * Two is under the eye's notice once the move is animated, and it keeps the
 * search to a couple of dozen tries per label.
 */
const STEP = 2

/**
 * How far a label may be lifted off its own room, in pixels.
 *
 * A marker means "this room, here", and past a certain distance it stops saying
 * that — better a little overlap than a chip hovering over the wrong half of
 * the building. When nothing within reach is clear the label simply stays where
 * it belongs and takes the overlap.
 */
const MAX_SHIFT = 44

type Rect = { left: number; right: number; top: number; bottom: number }

function rectOf(box: LabelBox, offset: number): Rect {
  return {
    left: box.x - box.width / 2,
    right: box.x + box.width / 2,
    top: box.y - box.height / 2 + offset,
    bottom: box.y + box.height / 2 + offset,
  }
}

function hits(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
}

/**
 * How far each label should move so the crowded ones can still be read.
 *
 * Ordered by distance from the camera, not by where they land on screen. The
 * nearest label keeps its place and the ones behind it give way — and because
 * depth changes smoothly as the camera goes round, so does the answer. Screen
 * order was the first thing tried and it flips the moment two rooms pass each
 * other, which sends every label in the scene somewhere else at once.
 *
 * Moved by the least that clears, up or down, rather than stacked downwards:
 * a stack walks the whole crowd off the building, and the shortest way out
 * keeps each chip as near its own room as the crowding allows. Never further
 * than `MAX_SHIFT`; a label with nowhere to go stays put and overlaps, which is
 * the honest failure — it is still pointing at its own room.
 *
 * Only vertical. Sideways a chip stops pointing at its room and starts pointing
 * at its neighbour's, which is the one thing a marker must not do.
 *
 * A label that has not been measured yet — width or height of zero — is left
 * where it is and pushes nobody.
 */
export function declutterLabels(
  boxes: ReadonlyArray<LabelBox>,
  previous: ReadonlyArray<number> = [],
): number[] {
  const offsets = new Array<number>(boxes.length).fill(0)

  const order = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => a.box.depth - b.box.depth || a.index - b.index)

  const placed: Rect[] = []

  for (const { box, index } of order) {
    const rest = rectOf(box, 0)

    // Home first: a label goes back to its own room the moment the room next
    // to it stops needing the space.
    if (!placed.some((other) => hits(rest, other))) {
      placed.push(rest)
      continue
    }

    // Then wherever it already was, if that still works. Without this the
    // search picks afresh every time the crowd shifts, and a label that was
    // sitting happily above its neighbour swings to below it and back as the
    // camera goes round — a smooth slide, but across the whole allowance and
    // for no reason the visitor can see.
    const held = previous[index] ?? 0
    if (held !== 0 && Math.abs(held) <= MAX_SHIFT) {
      const where = rectOf(box, held)
      if (!placed.some((other) => hits(where, other))) {
        offsets[index] = held
        placed.push(where)
        continue
      }
    }

    // Outwards from home, a step at a time, taking the first clear spot. It
    // was tempting to jump straight to "flush above or below whatever is in
    // the way", and that is shorter, but it packs badly: the second label
    // takes the space the third one needed and the third is left with nowhere
    // inside the limit at all. Walking out finds the nearest gap wherever it
    // is, and alternating the sign spreads a crowd either side of the room
    // rather than dragging all of it downwards.
    let best = 0

    for (let distance = STEP; distance <= MAX_SHIFT; distance += STEP) {
      const up = rectOf(box, -distance)
      if (!placed.some((other) => hits(up, other))) {
        best = -distance
        break
      }

      const down = rectOf(box, distance)
      if (!placed.some((other) => hits(down, other))) {
        best = distance
        break
      }
    }

    offsets[index] = best
    placed.push(rectOf(box, best))
  }

  return offsets
}
