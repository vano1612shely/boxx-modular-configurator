import { describe, expect, it } from 'vitest'

import { hiddenLabels, type LabelBox } from './declutter-labels'

/** A chip-sized label: 100 px of words, 32 px tall, ten metres out. */
function label(over: Partial<LabelBox> = {}): LabelBox {
  return { x: 0, y: 0, width: 100, height: 32, depth: 10, ...over }
}

describe('hiddenLabels', () => {
  it('leaves labels that already clear each other alone', () => {
    const boxes = [label({ x: 0 }), label({ x: 200 }), label({ y: 100 })]
    expect(hiddenLabels(boxes)).toEqual(new Set())
  })

  it('has nothing to say about one label, or none', () => {
    expect(hiddenLabels([label()])).toEqual(new Set())
    expect(hiddenLabels([])).toEqual(new Set())
  })

  /** The room in front is the one being looked at; the one behind it is not. */
  it('drops the further of two labels standing on the same spot', () => {
    const near = label({ depth: 4 })
    const far = label({ depth: 9 })

    expect(hiddenLabels([near, far])).toEqual(new Set([1]))
    expect(hiddenLabels([far, near])).toEqual(new Set([0]))
  })

  it('keeps the nearest of a whole pile and drops the rest', () => {
    const boxes = [label({ depth: 8 }), label({ depth: 3 }), label({ depth: 12 })]
    expect(hiddenLabels(boxes)).toEqual(new Set([0, 2]))
  })

  /**
   * The building seen edge-on: every room projects into one band. Dropping is
   * the only honest answer — there is nowhere to move a label to that is still
   * over its own room.
   */
  it('thins a row of labels crowded along one line', () => {
    const boxes = [
      label({ x: 0, depth: 5 }),
      label({ x: 40, depth: 6 }),
      label({ x: 80, depth: 7 }),
      label({ x: 400, depth: 8 }),
    ]
    const out = hiddenLabels(boxes)

    // The nearest keeps its place, its two neighbours go, and the one far
    // across the screen is untouched.
    expect(out.has(0)).toBe(false)
    expect(out.has(3)).toBe(false)
    expect(out.has(1)).toBe(true)
  })

  describe('the dead band', () => {
    /** Just clear, by less than the slack: a shown label stays shown. */
    const nearlyTouching = [label({ x: 0, depth: 4 }), label({ x: 104, depth: 9 })]

    it('keeps a label that is only just clear, once it is on screen', () => {
      expect(hiddenLabels(nearlyTouching, new Set())).toEqual(new Set())
    })

    it('holds a hidden label back until it clears by more than the slack', () => {
      // The same geometry judged the harder way, because it is currently out.
      expect(hiddenLabels(nearlyTouching, new Set([1]))).toEqual(new Set([1]))

      // Moved properly clear, it comes back.
      const apart = [nearlyTouching[0], { ...nearlyTouching[1], x: 130 }]
      expect(hiddenLabels(apart, new Set([1]))).toEqual(new Set())
    })

    it('does not flicker when nothing moves', () => {
      let state = hiddenLabels(nearlyTouching)
      for (let frame = 0; frame < 10; frame++) {
        const next = hiddenLabels(nearlyTouching, state)
        expect(next).toEqual(state)
        state = next
      }
    })
  })

  it('leaves an unmeasured label showing, and lets it hide nobody', () => {
    const boxes = [label({ width: 0, height: 0, depth: 1 }), label({ depth: 5 })]
    expect(hiddenLabels(boxes)).toEqual(new Set())
  })

  /**
   * Depth changes smoothly as the camera goes round, so the answer does too —
   * which is the whole reason it is depth and not screen position. Two rooms
   * passing each other must not disturb a label on the far side of the screen.
   */
  it('does not disturb a distant label when two others swap places', () => {
    const far = label({ x: 500, depth: 20 })
    const before = hiddenLabels([label({ depth: 4 }), label({ depth: 5 }), far])
    const after = hiddenLabels([label({ depth: 5 }), label({ depth: 4 }), far])

    expect(before.has(2)).toBe(false)
    expect(after.has(2)).toBe(false)
  })
})
