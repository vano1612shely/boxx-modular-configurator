/** A label as it lands on screen, and how far away the thing it names is. */
export type LabelBox = {
  /** Middle of the label, in css pixels from the top-left of the canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Distance from the camera to what it names. Nearer labels win. */
  depth: number
}

/**
 * Pixels of slack around the decision, so a label does not flicker.
 *
 * One shown keeps its place until it is overlapped by more than this; one
 * hidden has to clear by the same margin before it comes back. Without the
 * dead band a label sitting exactly on the edge of a collision switches on and
 * off with every pixel the camera drifts.
 */
const HYSTERESIS = 8

function overlaps(a: LabelBox, b: LabelBox, slack: number): boolean {
  const apartX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2 + slack
  const apartY = Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + slack
  return !apartX && !apartY
}

/**
 * Which labels to leave out so the ones that remain can be read.
 *
 * Nothing is ever moved. A marker stands over the room it names — that is the
 * whole of what it says — and a label nudged aside to make room stops pointing
 * at its own room and starts pointing at its neighbour's. Seen from the side,
 * where every room in the building projects into one narrow band, moving them
 * apart also sends them somewhere with no rooms at all.
 *
 * So the crowded ones are dropped instead, nearest first: a room in front of
 * another is the one the visitor is looking at, and the one behind it is
 * hidden by the building anyway. Depth is a continuous measure and changes
 * smoothly as the camera goes round, which is what keeps the answer steady —
 * an order taken from screen position flips whenever two rooms pass each other,
 * and every label in the scene jumps when it does.
 *
 * `hidden` is what is currently out, and it only feeds the dead band: a label
 * already hidden is judged a little more harshly than one on screen, so the
 * two swap places at two different moments rather than trading on one pixel.
 *
 * A label that has not been measured yet — width or height of zero — is left
 * showing and hides nobody.
 */
export function hiddenLabels(
  boxes: ReadonlyArray<LabelBox>,
  hidden: ReadonlySet<number> = new Set(),
): Set<number> {
  const order = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => box.width > 0 && box.height > 0)
    .sort((a, b) => a.box.depth - b.box.depth || a.index - b.index)

  const shown: LabelBox[] = []
  const out = new Set<number>()

  for (const { box, index } of order) {
    // Slack works the way the label's own state needs it to: positive slack
    // widens the box and makes a collision easier to find, which is the harder
    // test — asked of the ones that are currently hidden.
    const slack = hidden.has(index) ? HYSTERESIS : -HYSTERESIS
    const clash = shown.some((other) => overlaps(box, other, slack))

    if (clash) out.add(index)
    else shown.push(box)
  }

  return out
}
