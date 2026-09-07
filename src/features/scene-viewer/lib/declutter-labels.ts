/** A label as it lands on screen: its middle, and how much room it takes. */
export type LabelBox = {
  /** Middle of the label, in css pixels from the top-left of the canvas. */
  x: number
  y: number
  width: number
  height: number
}

/** Pixels left between two labels that had to be moved apart. */
const GAP = 6

/**
 * How far each label has to move down to stop sitting on its neighbour.
 *
 * The markers stand over the rooms they name, and in a building of nine small
 * rooms — or on a phone, where the whole building is 300 px wide — those points
 * are closer together on screen than the words are wide. Left alone they print
 * over each other and none of them can be read, which is what a marker is for.
 *
 * Moved down and never sideways. A label pushed sideways stops pointing at its
 * own room and starts pointing at the one beside it, which is worse than being
 * a little high; moving along one axis also keeps the answer stable while the
 * camera turns, where nudging in the nearest free direction would have labels
 * swapping sides as the building rotates.
 *
 * Top-down, so the order does not depend on which room was drawn first: the
 * highest label keeps its place and the ones below it stack under it. Ties are
 * settled left to right for the same reason.
 *
 * A label that has not been measured yet — width or height of zero — is left
 * where it is and does not push anything, so a chip whose text has not been
 * laid out cannot shove the rest of them down the screen.
 */
export function declutterLabels(boxes: ReadonlyArray<LabelBox>): number[] {
  const offsets = new Array<number>(boxes.length).fill(0)

  const order = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || a.index - b.index)

  const placed: Array<{ left: number; right: number; top: number; bottom: number }> = []

  for (const { box, index } of order) {
    const halfWidth = box.width / 2
    const left = box.x - halfWidth
    const right = box.x + halfWidth
    let top = box.y - box.height / 2

    // Each pass may push it below a box it had cleared before it moved, so keep
    // going until a whole pass changes nothing. Every pass moves it strictly
    // down past one more label, and there are finitely many, so it ends.
    let settled = false
    while (!settled) {
      settled = true

      for (const other of placed) {
        const apart = right <= other.left || left >= other.right
        if (apart) continue
        if (top >= other.bottom || top + box.height <= other.top) continue

        top = other.bottom + GAP
        settled = false
      }
    }

    offsets[index] = top - (box.y - box.height / 2)
    placed.push({ left, right, top, bottom: top + box.height })
  }

  return offsets
}
