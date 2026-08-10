import { describe, expect, it } from 'vitest'

import { pointInPolygon, type Point2 } from './polygon'
import { cutPolygon, onOutline } from './zone-cut'

/** 6 × 4. */
const ROOM: Point2[] = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 0, z: 4 },
]

type Step =
  | { kind: 'started'; path: Point2[] }
  | { kind: 'corner'; path: Point2[] }
  | { kind: 'done'; parts: [Point2[], Point2[]] }
  | { kind: 'refused'; reason: string }

/**
 * The editor's click handling, as a pure function.
 *
 * Whether a click starts the cut, adds a corner, finishes it or is refused is
 * the whole of the interaction, and it is decided by geometry alone. Keeping
 * that decision testable is worth mirroring the branch here — the model does
 * the same three calls in the same order.
 */
function click(outline: Point2[], path: Point2[], at: Point2): Step {
  const wall = onOutline(outline, at)

  if (path.length === 0) {
    return wall ? { kind: 'started', path: [wall.point] } : { kind: 'refused', reason: 'ends-off-outline' }
  }

  if (wall) {
    const result = cutPolygon(outline, [...path, wall.point])
    return result.ok ? { kind: 'done', parts: result.parts } : { kind: 'refused', reason: result.reason }
  }

  if (!pointInPolygon(at, outline)) return { kind: 'refused', reason: 'leaves-the-room' }
  return { kind: 'corner', path: [...path, at] }
}

function area(polygon: Point2[]): number {
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum / 2)
}

describe('drawing a cut', () => {
  it('will not start out in the middle of the floor', () => {
    expect(click(ROOM, [], { x: 3, z: 2 })).toEqual({
      kind: 'refused',
      reason: 'ends-off-outline',
    })
  })

  it('starts on the wall the pointer was over, snapped onto it', () => {
    expect(click(ROOM, [], { x: 3, z: 0.15 })).toEqual({
      kind: 'started',
      path: [{ x: 3, z: 0 }],
    })
  })

  // The client's rule: reaching the second wall is the end of the cut, and the
  // end of the cut is the cut. Nothing left to press.
  it('finishes the moment a second wall is reached', () => {
    const started = click(ROOM, [], { x: 3, z: 0 })
    if (started.kind !== 'started') throw new Error('expected a start')

    const finished = click(ROOM, started.path, { x: 3, z: 3.9 })
    expect(finished.kind).toBe('done')
    if (finished.kind !== 'done') return
    expect(area(finished.parts[0])).toBeCloseTo(12, 6)
    expect(area(finished.parts[1])).toBeCloseTo(12, 6)
  })

  it('takes corners in between without finishing on them', () => {
    let path: Point2[] = []
    for (const at of [
      { x: 1, z: 0 },
      { x: 1, z: 3 },
      { x: 5, z: 3 },
    ]) {
      const step = click(ROOM, path, at)
      expect(step.kind === 'started' || step.kind === 'corner').toBe(true)
      if (step.kind !== 'started' && step.kind !== 'corner') return
      path = step.path
    }
    expect(path).toHaveLength(3)

    const finished = click(ROOM, path, { x: 5, z: 4 })
    expect(finished.kind).toBe('done')
    if (finished.kind !== 'done') return
    expect(area(finished.parts[0]) + area(finished.parts[1])).toBeCloseTo(24, 6)
  })

  it('refuses a corner outside the floor being divided', () => {
    const started = click(ROOM, [], { x: 1, z: 0 })
    if (started.kind !== 'started') throw new Error('expected a start')

    expect(click(ROOM, started.path, { x: 9, z: 2 })).toEqual({
      kind: 'refused',
      reason: 'leaves-the-room',
    })
  })

  it('says why when the second wall is the first point over again', () => {
    const started = click(ROOM, [], { x: 3, z: 0 })
    if (started.kind !== 'started') throw new Error('expected a start')

    expect(click(ROOM, started.path, { x: 3, z: 0.02 })).toEqual({
      kind: 'refused',
      reason: 'ends-together',
    })
  })

  it('finishes on the wall it started from, taking a bite out of it', () => {
    let path: Point2[] = []
    for (const at of [
      { x: 1, z: 0 },
      { x: 1, z: 2 },
      { x: 3, z: 2 },
    ]) {
      const step = click(ROOM, path, at)
      if (step.kind !== 'started' && step.kind !== 'corner') throw new Error('expected a point')
      path = step.path
    }

    const finished = click(ROOM, path, { x: 3, z: 0 })
    expect(finished.kind).toBe('done')
    if (finished.kind !== 'done') return
    expect(area(finished.parts[0])).toBeCloseTo(4, 6)
    expect(area(finished.parts[1])).toBeCloseTo(20, 6)
  })
})
