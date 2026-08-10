import { describe, expect, it } from 'vitest'

import { pointInPolygon, type Point2 } from './polygon'
import {
  clampPoseToRegion,
  connectedGroups,
  footprintFitsRegion,
  pointInRegion,
  poseInsideRegion,
  regionAround,
  regionFrom,
  regionOf,
} from './region'

/** A 12 × 4 room cut into three 4 × 4 zones side by side along x. */
function strip(fromX: number, toX: number): Point2[] {
  return [
    { x: fromX, z: 0 },
    { x: toX, z: 0 },
    { x: toX, z: 4 },
    { x: fromX, z: 4 },
  ]
}

const A = strip(0, 4)
const B = strip(4, 8)
const V = strip(8, 12)

const CHAIR = { width: 1, depth: 1 }

describe('regionFrom', () => {
  it('keeps every edge of a lone polygon', () => {
    expect(regionOf(A).edges).toHaveLength(4)
  })

  it('drops the boundary two neighbours share', () => {
    // Eight edges between them, less the shared one counted from either side.
    expect(regionFrom([A, B]).edges).toHaveLength(6)
  })

  it('keeps the boundary when the neighbour is not in the region', () => {
    expect(regionFrom([A, V]).edges).toHaveLength(8)
  })

  it('is inside when any of its pieces is', () => {
    const region = regionFrom([A, V])
    expect(pointInRegion({ x: 2, z: 2 }, region)).toBe(true)
    expect(pointInRegion({ x: 10, z: 2 }, region)).toBe(true)
    expect(pointInRegion({ x: 6, z: 2 }, region)).toBe(false)
  })
})

describe('clampPoseToRegion', () => {
  it('lets a thing at home in both zones cross the line between them', () => {
    const region = regionFrom([A, B])
    expect(clampPoseToRegion(6, 2, 0, CHAIR, region)).toEqual({ x: 6, z: 2 })
  })

  it('stops a thing at home in one zone at that zone’s edge', () => {
    const pose = clampPoseToRegion(6, 2, 0, CHAIR, regionOf(A))
    expect(pose.x).toBeLessThanOrEqual(3.5 + 1e-6)
    expect(pose.z).toBeCloseTo(2, 6)
  })

  it('keeps a target flung far outside inside the zone all the same', () => {
    const pose = clampPoseToRegion(20, 2, 0, CHAIR, regionOf(A))
    expect(poseInsideRegion(pose.x, pose.z, 0, CHAIR, regionOf(A))).toBe(true)
  })
})

// The client's rule: a package at home in A and V, with B between them, may not
// be dragged from one to the other, because the two never touch.
describe('regionAround', () => {
  it('sees two zones with a stranger between them as two places', () => {
    expect(connectedGroups([A, V])).toHaveLength(2)
    expect(connectedGroups([A, B, V])).toHaveLength(1)
  })

  it('will not let a flick of the pointer jump the zone in between', () => {
    const region = regionAround([A, V], 2, 2)
    const pose = clampPoseToRegion(10, 2, 0, CHAIR, region)

    expect(pose.x).toBeLessThanOrEqual(3.5 + 1e-6)
  })

  it('lets the same thing move freely once it is in the far zone', () => {
    const region = regionAround([A, V], 10, 2)
    expect(clampPoseToRegion(9, 2, 0, CHAIR, region)).toEqual({ x: 9, z: 2 })
    expect(clampPoseToRegion(2, 2, 0, CHAIR, region).x).toBeGreaterThanOrEqual(8.5 - 1e-6)
  })

  it('falls back to the whole region when the thing is nowhere in it', () => {
    expect(regionAround([A, V], 6, 2).polygons).toHaveLength(2)
  })
})

describe('footprintFitsRegion', () => {
  it('fits when any one piece can hold it', () => {
    expect(footprintFitsRegion(CHAIR, regionFrom([A, V]))).toBe(true)
    expect(footprintFitsRegion({ width: 6, depth: 1 }, regionFrom([A, V]))).toBe(false)
  })

  it('counts the room two joined zones make, not either one alone', () => {
    expect(footprintFitsRegion({ width: 6, depth: 1 }, regionFrom([A, B]))).toBe(true)
  })
})

// A long edge of one zone can face two smaller zones at once, and only the
// stretch facing a zone we may enter should stop being a boundary.
describe('an edge that faces more than one neighbour', () => {
  const wide = strip(0, 4)
  const lower = [
    { x: 4, z: 0 },
    { x: 8, z: 0 },
    { x: 8, z: 2 },
    { x: 4, z: 2 },
  ]
  const upper = [
    { x: 4, z: 2 },
    { x: 8, z: 2 },
    { x: 8, z: 4 },
    { x: 4, z: 4 },
  ]

  it('opens only the half that faces a zone in the region', () => {
    const all = regionFrom([wide, lower, upper])
    const half = regionFrom([wide, lower])

    // Fully open: both halves of the shared line face a member zone.
    expect(all.edges.some((e) => e.a.x === 4 && e.b.x === 4)).toBe(false)
    // Half open: the stretch facing `upper` is still something to run into.
    expect(half.edges.filter((e) => e.a.x === 4 && e.b.x === 4)).toHaveLength(1)
  })

  // `lower` is a neighbour, so the chair is welcome there; `upper` is not in the
  // region at all, and aiming at the middle of it must not put the chair there.
  it('turns a target in the forbidden half into one in the allowed half', () => {
    const region = regionAround([wide, lower], 2, 3)
    const pose = clampPoseToRegion(6, 3, 0, CHAIR, region)

    expect(pointInPolygon(pose, upper)).toBe(false)
    expect(poseInsideRegion(pose.x, pose.z, 0, CHAIR, region)).toBe(true)
  })
})
