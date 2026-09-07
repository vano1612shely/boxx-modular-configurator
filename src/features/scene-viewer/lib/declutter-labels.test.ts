import { describe, expect, it } from 'vitest'

import { declutterLabels, type LabelBox } from './declutter-labels'

/** A chip-sized label: 100 px of words, 32 px tall. */
function label(over: Partial<LabelBox> = {}): LabelBox {
  return { x: 0, y: 0, width: 100, height: 32, ...over }
}

/** Where a label ends up: its own middle plus whatever it was moved by. */
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
    const boxes = [label({ x: 0, y: 0 }), label({ x: 200, y: 0 }), label({ x: 0, y: 100 })]
    expect(declutterLabels(boxes)).toEqual([0, 0, 0])
  })

  it('moves nothing when there is only one', () => {
    expect(declutterLabels([label()])).toEqual([0])
    expect(declutterLabels([])).toEqual([])
  })

  it('stacks a pile of labels on one spot into a readable column', () => {
    const boxes = [label(), label(), label()]
    expect(anyOverlap(boxes)).toBe(false)

    // The highest one keeps its place; the rest go under it, in order.
    const at = middles(boxes)
    expect(at[0]).toBe(0)
    expect(at[1]).toBeGreaterThan(at[0])
    expect(at[2]).toBeGreaterThan(at[1])
  })

  it('separates labels that only just touch along the words', () => {
    // Two rooms side by side: the points are 60 px apart, the words 100 px wide.
    const boxes = [label({ x: 0, y: 0 }), label({ x: 60, y: 4 })]
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('does not move a label away from one it is already clear of sideways', () => {
    // Same height, but far enough apart across the screen to both be read.
    const boxes = [label({ x: 0, y: 0 }), label({ x: 140, y: 0 })]
    expect(declutterLabels(boxes)).toEqual([0, 0])
  })

  /**
   * The chip pushed down must be checked against everything again, not only
   * against what it first hit — a third label may be waiting exactly where the
   * second one was sent.
   */
  it('re-checks a label against the ones it lands among', () => {
    const boxes = [label({ y: 0 }), label({ y: 20 }), label({ y: 42 }), label({ y: 64 })]
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('settles the same way however the rooms happen to be listed', () => {
    const boxes = [label({ x: 0, y: 0 }), label({ x: 10, y: 10 }), label({ x: 20, y: 20 })]
    const forwards = middles(boxes)
    const backwards = middles([...boxes].reverse()).reverse()

    expect(forwards).toEqual(backwards)
  })

  it('leaves an unmeasured label alone, and lets it shove nobody', () => {
    const boxes = [label({ width: 0, height: 0 }), label(), label()]
    const offsets = declutterLabels(boxes)

    expect(offsets[0]).toBe(0)
    // The two real ones still sort themselves out around it.
    expect(offsets[1]).toBe(0)
    expect(offsets[2]).toBeGreaterThan(0)
  })

  it('keeps its nerve on a whole building of rooms in one place', () => {
    const boxes = Array.from({ length: 9 }, (_, i) => label({ x: i, y: i }))
    expect(anyOverlap(boxes)).toBe(false)
  })
})
