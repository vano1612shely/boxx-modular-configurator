import { describe, expect, it } from 'vitest'

import { polygonSignedArea, type Point2 } from './polygon'
import { cutPolygon, type CutFailure } from './zone-cut'

/** 6 × 4, wound clockwise in XZ; 24 m². */
const ROOM: Point2[] = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 0, z: 4 },
]

function area(polygon: Point2[]): number {
  return Math.abs(polygonSignedArea(polygon))
}

function parts(polygon: Point2[], path: Point2[]) {
  const result = cutPolygon(polygon, path)
  if (!result.ok) throw new Error(`expected a cut, got "${result.reason}"`)
  return result.parts
}

function refusal(polygon: Point2[], path: Point2[]): CutFailure {
  const result = cutPolygon(polygon, path)
  if (result.ok) throw new Error('expected the cut to be refused')
  return result.reason
}

describe('cutPolygon', () => {
  it('splits a room down the middle', () => {
    const [near, far] = parts(ROOM, [
      { x: 3, z: 0 },
      { x: 3, z: 4 },
    ])

    expect(area(near)).toBeCloseTo(12, 6)
    expect(area(far)).toBeCloseTo(12, 6)
  })

  it('follows a cut that turns corners', () => {
    const [near, far] = parts(ROOM, [
      { x: 1, z: 0 },
      { x: 1, z: 3 },
      { x: 5, z: 3 },
      { x: 5, z: 4 },
    ])

    expect(area(near)).toBeCloseTo(16, 6)
    expect(area(far)).toBeCloseTo(8, 6)
  })

  it('keeps every square metre of the room', () => {
    const [near, far] = parts(ROOM, [
      { x: 1, z: 0 },
      { x: 1, z: 3 },
      { x: 5, z: 3 },
      { x: 5, z: 4 },
    ])

    expect(area(near) + area(far)).toBeCloseTo(area(ROOM), 6)
  })

  it('walks the outline round its own start', () => {
    const [near, far] = parts(ROOM, [
      { x: 0, z: 1 },
      { x: 6, z: 1 },
    ])

    expect(area(near)).toBeCloseTo(6, 6)
    expect(area(far)).toBeCloseTo(18, 6)
  })

  it('cuts corner to corner without leaving a doubled vertex', () => {
    const [near, far] = parts(ROOM, [
      { x: 0, z: 0 },
      { x: 6, z: 4 },
    ])

    expect(near).toHaveLength(3)
    expect(far).toHaveLength(3)
    expect(area(near)).toBeCloseTo(12, 6)
    expect(area(far)).toBeCloseTo(12, 6)
  })

  it('takes a bite out of one wall, starting and ending on it', () => {
    const [near, far] = parts(ROOM, [
      { x: 1, z: 0 },
      { x: 1, z: 2 },
      { x: 3, z: 2 },
      { x: 3, z: 0 },
    ])

    expect(area(near)).toBeCloseTo(4, 6)
    expect(area(far)).toBeCloseTo(20, 6)
  })

  it('cuts a zone that is itself a cut', () => {
    const [right] = parts(ROOM, [
      { x: 3, z: 0 },
      { x: 3, z: 4 },
    ])
    const [lower, upper] = parts(right, [
      { x: 3, z: 2 },
      { x: 6, z: 2 },
    ])

    expect(area(lower)).toBeCloseTo(6, 6)
    expect(area(upper)).toBeCloseTo(6, 6)
  })

  // Everything downstream leans on this: an edge counts as internal, and so as
  // crossable, by stepping off it into the neighbour. A rounding difference of
  // half a millimetre would read as a gap between the two zones.
  it('hands both halves the identical boundary', () => {
    const path = [
      { x: 1.00049, z: 0 },
      { x: 1.00049, z: 3.0004 },
      { x: 5, z: 3.0004 },
      { x: 5, z: 4 },
    ]
    const [near, far] = parts(ROOM, path)

    const shared = near.filter((p) => far.some((q) => q.x === p.x && q.z === p.z))
    expect(shared).toHaveLength(4)
    for (const point of shared) {
      expect(point.x).toBe(Math.round(point.x * 1000) / 1000)
      expect(point.z).toBe(Math.round(point.z * 1000) / 1000)
    }
  })

  it('pulls an end that missed the wall onto it', () => {
    const [near, far] = parts(ROOM, [
      { x: 3, z: 0.12 },
      { x: 3, z: 3.9 },
    ])

    expect(area(near)).toBeCloseTo(12, 6)
    expect(area(far)).toBeCloseTo(12, 6)
  })

  it('refuses a cut that starts nowhere near a wall', () => {
    expect(refusal(ROOM, [{ x: 3, z: 1 }, { x: 3, z: 4 }])).toBe('ends-off-outline')
  })

  it('refuses a cut that steps outside the room', () => {
    expect(
      refusal(ROOM, [
        { x: 3, z: 0 },
        { x: 8, z: 2 },
        { x: 3, z: 4 },
      ]),
    ).toBe('leaves-the-room')
  })

  it('refuses a cut that crosses itself', () => {
    expect(
      refusal(ROOM, [
        { x: 1, z: 0 },
        { x: 5, z: 3 },
        { x: 1, z: 3 },
        { x: 5, z: 0 },
      ]),
    ).toBe('crosses-itself')
  })

  it('refuses a cut that ends where it started', () => {
    expect(refusal(ROOM, [{ x: 3, z: 0 }, { x: 3, z: 0.01 }])).toBe('ends-together')
  })

  it('refuses a cut laid along a wall it would leave nothing beside', () => {
    expect(refusal(ROOM, [{ x: 0, z: 0 }, { x: 6, z: 0 }])).toBe('empty-side')
  })

  it('refuses a single point', () => {
    expect(refusal(ROOM, [{ x: 3, z: 0 }])).toBe('short-path')
  })
})
