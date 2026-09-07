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

  /**
   * The whole point. One chip carrying the separation on its own lands over
   * nothing; sharing it keeps both over the rooms they name.
   */
  describe('sharing the move', () => {
    it('spreads a crowded pair about their middle, not off one another', () => {
      const boxes = [label({ y: 0 }), label({ y: 0 })]
      const [up, down] = declutterLabels(boxes)

      expect(up).toBe(-down)
      expect(Math.abs(up)).toBeCloseTo(14, 5)
      expect(anyOverlap(boxes)).toBe(false)
    })

    it('keeps every move inside the budget', () => {
      const boxes = Array.from({ length: 4 }, () => label())
      const offsets = declutterLabels(boxes)

      expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(28)
    })

    it('leaves the middle of a row of three where it was', () => {
      const boxes = [label({ y: -6 }), label({ y: 0 }), label({ y: 6 })]
      const at = middles(boxes)

      // The one in the middle of the crowd is already at the middle of it.
      expect(at[1]).toBeCloseTo(0, 5)
      expect(at[0]).toBeLessThan(at[1])
      expect(at[2]).toBeGreaterThan(at[1])
      expect(anyOverlap(boxes)).toBe(false)
    })
  })

  it('keeps them in the order they were already in', () => {
    const boxes = [label({ y: 10 }), label({ y: -10 }), label({ y: 0 })]
    const at = middles(boxes)

    // Lowest stays lowest, highest stays highest: nothing crosses anything.
    expect(at[1]).toBeLessThan(at[2])
    expect(at[2]).toBeLessThan(at[0])
  })

  it('does not move a label away from one it is clear of sideways', () => {
    const boxes = [label({ x: 0 }), label({ x: 140 })]
    expect(declutterLabels(boxes)).toEqual([0, 0])
  })

  it('treats a row of three as one crowd rather than two pairs', () => {
    // Solved pairwise the middle one would be moved twice, once by each side.
    const boxes = [label({ y: 0 }), label({ y: 10 }), label({ y: 20 })]
    expect(anyOverlap(boxes)).toBe(false)
    expect(Math.max(...declutterLabels(boxes).map(Math.abs))).toBeLessThanOrEqual(28)
  })

  it('joins two crowds when one label bridges them', () => {
    const boxes = [label({ x: 0 }), label({ x: 90 }), label({ x: 180 })]
    // The middle one overlaps both ends, so all three are one problem.
    expect(anyOverlap(boxes)).toBe(false)
  })

  /**
   * A pile past what the budget holds is spread as far as it goes and left to
   * overlap the rest — better than walking half the markers off the building.
   */
  it('spreads what it can when a crowd is past the budget', () => {
    const boxes = Array.from({ length: 8 }, (_, i) => label({ depth: i + 1 }))
    const offsets = declutterLabels(boxes)

    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(28)
    expect(offsets.some((offset) => offset !== 0)).toBe(true)
  })

  it('settles the same way however the rooms happen to be listed', () => {
    const boxes = [label({ x: 0, y: 0 }), label({ x: 10, y: 10 }), label({ x: 20, y: 20 })]
    const forwards = middles(boxes)
    const backwards = middles([...boxes].reverse()).reverse()

    expect(forwards).toEqual(backwards)
  })

  it('breaks a tie by depth, so two on one spot come out the same way round', () => {
    const offsets = declutterLabels([label({ depth: 9 }), label({ depth: 4 })])
    // The nearer one takes the upper place, whichever order they are listed in.
    expect(offsets[1]).toBeLessThan(offsets[0])
  })

  it('leaves an unmeasured label alone, and lets it shove nobody', () => {
    const boxes = [label({ width: 0, height: 0 }), label()]
    expect(declutterLabels(boxes)).toEqual([0, 0])
  })

  it('settles: once moved, the arrangement asks for no further move', () => {
    const boxes = [label({ y: 0 }), label({ y: 8 }), label({ y: 16 })]
    const settled = boxes.map((box, i) => ({ ...box, y: box.y + declutterLabels(boxes)[i] }))

    expect(declutterLabels(settled)).toEqual([0, 0, 0])
  })
})
