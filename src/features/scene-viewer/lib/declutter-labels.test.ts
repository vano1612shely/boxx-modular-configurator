import { describe, expect, it } from 'vitest'

import { declutterLabels, type LabelBox } from './declutter-labels'

/** A chip-sized label: 100 px of words, 24 px tall, ten metres out. */
function label(over: Partial<LabelBox> = {}): LabelBox {
  return { x: 0, y: 0, width: 100, height: 24, depth: 10, ...over }
}

/** Where each label ends up once it has been moved. */
function middles(boxes: LabelBox[]): number[] {
  const offsets = declutterLabels(boxes)
  return boxes.map((box, i) => box.y + offsets[i])
}

/** Whether any two of them still print over each other. */
function anyOverlap(boxes: LabelBox[]): boolean {
  const at = middles(boxes)

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = { ...boxes[i], y: at[i] }
      const b = { ...boxes[j], y: at[j] }
      const apartX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2
      const apartY = Math.abs(a.y - b.y) >= (a.height + b.height) / 2
      if (!apartX && !apartY) return true
    }
  }

  return false
}

describe('declutterLabels', () => {
  it('leaves labels that already clear each other alone', () => {
    const boxes = [label({ x: 0 }), label({ x: 200 }), label({ y: 100 })]
    expect(declutterLabels(boxes)).toEqual([0, 0, 0])
  })

  it('moves nothing when there is only one', () => {
    expect(declutterLabels([label()])).toEqual([0])
    expect(declutterLabels([])).toEqual([])
  })

  /** The room in front is the one being looked at; it keeps its place. */
  it('leaves the nearest label alone and moves the one behind it', () => {
    const near = label({ depth: 4 })
    const far = label({ depth: 9 })

    expect(declutterLabels([near, far])[0]).toBe(0)
    expect(declutterLabels([near, far])[1]).not.toBe(0)
    // And the same however the two are listed.
    expect(declutterLabels([far, near])[1]).toBe(0)
    expect(declutterLabels([far, near])[0]).not.toBe(0)
  })

  it('moves by the least that clears, not by a fixed stack', () => {
    // The far label sits just below the near one, so the way out is downwards
    // and it is short: half of each height, less what already separates them.
    const boxes = [label({ depth: 4, y: 0 }), label({ depth: 9, y: 10 })]
    const [, moved] = declutterLabels(boxes)

    expect(moved).toBeGreaterThan(0)
    expect(moved).toBeLessThan(24)
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('goes up when up is the shorter way out', () => {
    const boxes = [label({ depth: 4, y: 0 }), label({ depth: 9, y: -10 })]
    expect(declutterLabels(boxes)[1]).toBeLessThan(0)
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('clears a crowd rather than only the first one in the way', () => {
    const boxes = [label({ depth: 3, y: 0 }), label({ depth: 4, y: 8 }), label({ depth: 5, y: 16 })]
    expect(anyOverlap(boxes)).toBe(false)
  })

  /**
   * Three chips of this height fit inside the limit and a fourth does not, so
   * the fourth takes the overlap rather than being carried off its room. What
   * matters is that the three that did fit are still readable — a crowd past
   * what the budget holds must not undo the work done for the rest of it.
   */
  it('places what it can when a crowd is past what the limit holds', () => {
    const boxes = Array.from({ length: 5 }, (_, i) => label({ depth: i + 1, y: i * 8 }))
    const offsets = declutterLabels(boxes)
    const at = middles(boxes)

    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(44)
    // The nearest three are spread far enough apart to read.
    expect(Math.abs(at[1] - at[0])).toBeGreaterThanOrEqual(24)
    expect(Math.abs(at[2] - at[0])).toBeGreaterThanOrEqual(24)
  })

  it('does not move a label away from one it is already clear of sideways', () => {
    const boxes = [label({ x: 0 }), label({ x: 140, depth: 20 })]
    expect(declutterLabels(boxes)).toEqual([0, 0])
  })

  /**
   * Better a little overlap than a chip hovering over the wrong half of the
   * building: past the limit the label stays over the room it names.
   */
  it('gives up rather than carry a label off its own room', () => {
    // Eight labels on one spot: the last of them has nowhere within reach.
    const boxes = Array.from({ length: 8 }, (_, i) => label({ depth: i + 1 }))
    const offsets = declutterLabels(boxes)

    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(44)
    expect(offsets[0]).toBe(0)
  })

  /**
   * The reason the order is depth and not screen position: two rooms passing
   * each other as the camera goes round must not disturb anybody else.
   */
  it('is unmoved by two labels swapping places on screen', () => {
    const other = label({ x: 400, depth: 30 })
    const before = declutterLabels([label({ y: 0, depth: 4 }), label({ y: 6, depth: 9 }), other])
    const after = declutterLabels([label({ y: 6, depth: 4 }), label({ y: 0, depth: 9 }), other])

    expect(before[2]).toBe(0)
    expect(after[2]).toBe(0)
  })

  it('settles the same way however the rooms happen to be listed', () => {
    const boxes = [
      label({ x: 0, y: 0, depth: 3 }),
      label({ x: 10, y: 10, depth: 6 }),
      label({ x: 20, y: 20, depth: 9 }),
    ]
    const forwards = middles(boxes)
    const backwards = middles([...boxes].reverse()).reverse()

    expect(forwards).toEqual(backwards)
  })

  it('leaves an unmeasured label alone, and lets it shove nobody', () => {
    const boxes = [label({ width: 0, height: 0, depth: 1 }), label({ depth: 5 })]
    expect(declutterLabels(boxes)).toEqual([0, 0])
  })
})

/**
 * The crowd shifts as the camera goes round, and a label that has already
 * given way must not keep changing its mind about which side to give way on —
 * it slides the whole allowance and back for no reason the visitor can see.
 */
describe('declutterLabels, holding its place', () => {
  const crowd = [label({ depth: 3, y: 0 }), label({ depth: 6, y: 6 })]

  it('keeps a label where it already is when that still works', () => {
    const fresh = declutterLabels(crowd)
    // Told it is currently on the other side, and that side is clear too.
    const held = declutterLabels(crowd, [0, -30])

    expect(fresh[1]).toBeGreaterThan(0)
    expect(held[1]).toBe(-30)
  })

  it('brings it home the moment its room is free again', () => {
    const apart = [label({ depth: 3, y: 0 }), label({ depth: 6, y: 200 })]
    expect(declutterLabels(apart, [0, -30])).toEqual([0, 0])
  })

  it('moves it when where it was stops working', () => {
    // Held at -30, but another label is now sitting there.
    const three = [label({ depth: 3, y: 0 }), label({ depth: 4, y: -30 }), label({ depth: 6, y: 6 })]
    const out = declutterLabels(three, [0, 0, -30])

    expect(out[2]).not.toBe(-30)
    expect(anyOverlap(three)).toBe(false)
  })

  it('settles: what it returns, fed back in, comes out unchanged', () => {
    let state = declutterLabels(crowd)
    for (let frame = 0; frame < 8; frame++) {
      const next = declutterLabels(crowd, state)
      expect(next).toEqual(state)
      state = next
    }
  })
})
