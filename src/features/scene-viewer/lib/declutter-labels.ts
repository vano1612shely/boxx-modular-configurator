/** A label as it lands on screen, and how far away the thing it names is. */
export type LabelBox = {
  /** Middle of the label, in css pixels from the top-left of the canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Distance from the camera to what it names. Only used to break ties. */
  depth: number
}

/** Pixels left between two labels that had to be moved apart. */
const GAP = 4

/**
 * How far a label may be lifted off its own room, in pixels.
 *
 * A marker means "this room, here", and one carried far enough stops pointing at
 * anything — on a building a couple of hundred pixels high it ends up over the
 * lawn. This is one chip's height and a little over: enough to let three in a
 * row settle, and no more.
 *
 * It binds far less often than it looks. Because the crowd shares the move, a
 * crowded *pair* — much the commonest case — steps only half a chip either way
 * and never comes near this. Only three or more on one spot reach it, and past
 * it they are left to overlap rather than walked off the building.
 */
const MAX_SHIFT = 28

type Placed = { index: number; box: LabelBox }

/** Whether two labels would print over each other where they naturally fall. */
function crowds(a: LabelBox, b: LabelBox): boolean {
  const apartX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2
  const apartY = Math.abs(a.y - b.y) >= (a.height + b.height) / 2 + GAP
  return !apartX && !apartY
}

/**
 * The labels that crowd each other, gathered into groups.
 *
 * Not pairs: three markers in a row are one problem, and solving them two at a
 * time moves the middle one twice.
 */
function clusters(items: ReadonlyArray<Placed>): Placed[][] {
  const groups: Placed[][] = []
  const home = new Map<number, number>()

  for (const item of items) {
    const joined = new Set<number>()
    for (const other of items) {
      if (other.index === item.index) continue
      const group = home.get(other.index)
      if (group !== undefined && crowds(item.box, other.box)) joined.add(group)
    }

    if (joined.size === 0) {
      home.set(item.index, groups.length)
      groups.push([item])
      continue
    }

    // Touching two groups at once merges them: one label can be the thing that
    // ties one crowd to another.
    const [keep, ...rest] = [...joined].sort((a, b) => a - b)
    groups[keep].push(item)
    home.set(item.index, keep)

    for (const merged of rest) {
      for (const moved of groups[merged]) home.set(moved.index, keep)
      groups[keep].push(...groups[merged])
      groups[merged] = []
    }
  }

  return groups.filter((group) => group.length > 1)
}

/**
 * How far each label should move so the crowded ones can still be read.
 *
 * Spread about the middle of the crowd, not pushed off one another. Pinning the
 * nearest label and shoving its neighbour clear was the obvious thing and it is
 * wrong: one chip then carries the whole separation — a chip's height and more —
 * and lands somewhere with no room under it, while the one that kept its place
 * looks untouched. Sharing the move means two crowded markers step half as far
 * each and both stay over the rooms they name.
 *
 * Ordered by where they already are, so nothing crosses anything on the way and
 * what comes out matches what is underneath. Depth only settles ties, so two
 * labels at the same height come out the same way round every frame.
 *
 * Only vertical. Sideways a chip stops pointing at its room and starts pointing
 * at its neighbour's, which is the one thing a marker must not do.
 *
 * Never further than `MAX_SHIFT`. A crowd too big for that budget is spread as
 * far as the budget goes and left to overlap the rest, rather than being walked
 * off the building. A label that has not been measured yet — width or height of
 * zero — is left where it is.
 */
export function declutterLabels(boxes: ReadonlyArray<LabelBox>): number[] {
  const offsets = new Array<number>(boxes.length).fill(0)

  const measured = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => box.width > 0 && box.height > 0)

  for (const group of clusters(measured)) {
    const inOrder = [...group].sort(
      (a, b) => a.box.y - b.box.y || a.box.depth - b.box.depth || a.index - b.index,
    )

    const pitch = Math.max(...inOrder.map(({ box }) => box.height)) + GAP
    const middle = inOrder.reduce((sum, { box }) => sum + box.y, 0) / inOrder.length
    const first = middle - (pitch * (inOrder.length - 1)) / 2

    inOrder.forEach(({ box, index }, position) => {
      const wanted = first + position * pitch - box.y
      // Clamped rather than abandoned: half a step apart still reads better
      // than none, and it keeps the chip over its own room.
      offsets[index] = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, wanted))
    })
  }

  return offsets
}
