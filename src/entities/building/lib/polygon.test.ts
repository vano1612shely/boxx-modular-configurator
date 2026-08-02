import { describe, expect, it } from 'vitest'

import {
  clampPoseToPolygon,
  footprintFitsPolygon,
  nearestEdgeAlignedRotation,
  offsetPolygonMitered,
  outwardEdgeNormal,
  pointInPolygon,
  polygonCentroid,
  polygonWindingSign,
  poseInsidePolygon,
  progressiveEdgeSnap,
  rectifyPolygon,
} from './polygon'

const square = [
  { x: -3, z: -3 },
  { x: 3, z: -3 },
  { x: 3, z: 3 },
  { x: -3, z: 3 },
]

const lShape = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 3 },
  { x: 3, z: 3 },
  { x: 3, z: 6 },
  { x: 0, z: 6 },
]

const footprint = { width: 2, depth: 1 }

describe('pointInPolygon', () => {
  it('classifies points for a square', () => {
    expect(pointInPolygon({ x: 0, z: 0 }, square)).toBe(true)
    expect(pointInPolygon({ x: 4, z: 0 }, square)).toBe(false)
  })

  it('classifies points for an L-shape', () => {
    expect(pointInPolygon({ x: 1, z: 1 }, lShape)).toBe(true)
    expect(pointInPolygon({ x: 5, z: 5 }, lShape)).toBe(false)
  })
})

describe('polygonCentroid', () => {
  it('finds the center of a square', () => {
    const c = polygonCentroid(square)
    expect(c.x).toBeCloseTo(0)
    expect(c.z).toBeCloseTo(0)
  })
})

describe('clampPoseToPolygon', () => {
  it('keeps an inside pose unchanged', () => {
    expect(clampPoseToPolygon(0, 0, 30, footprint, square)).toEqual({ x: 0, z: 0 })
  })

  it('pushes an outside pose back in', () => {
    const pose = clampPoseToPolygon(10, 0, 0, footprint, square)
    expect(poseInsidePolygon(pose.x, pose.z, 0, footprint, square)).toBe(true)
    expect(pose.x).toBeGreaterThan(1.5)
  })

  it('keeps the footprint inside the L-shape near the notch', () => {
    const pose = clampPoseToPolygon(4.4, 4.4, 0, footprint, lShape)
    expect(poseInsidePolygon(pose.x, pose.z, 0, footprint, lShape)).toBe(true)
  })
})

describe('nearestEdgeAlignedRotation', () => {
  it('picks the edge-aligned angle closest to the free rotation', () => {
    expect(nearestEdgeAlignedRotation(48, 0)).toBe(90)
    expect(nearestEdgeAlignedRotation(44, 0)).toBe(0)
    expect(nearestEdgeAlignedRotation(50, 30)).toBe(30)
    expect(nearestEdgeAlignedRotation(80, 30)).toBe(120)
  })
})

describe('progressiveEdgeSnap', () => {
  it('does not snap away from edges', () => {
    const result = progressiveEdgeSnap(0, 0, 48, footprint, square)
    expect(result.snapped).toBe(false)
    expect(result.rotationYDeg).toBe(48)
  })

  it('rotates progressively while pushing into an edge', () => {
    // free-rotated body touches the bottom edge at z ≈ -1.96
    const shallow = progressiveEdgeSnap(0, -2.2, 48, footprint, square)
    const deep = progressiveEdgeSnap(0, -2.8, 48, footprint, square)

    expect(shallow.snapped).toBe(true)
    expect(shallow.rotationYDeg).toBeGreaterThan(48)
    expect(shallow.rotationYDeg).toBeLessThan(deep.rotationYDeg)
    expect(deep.rotationYDeg).toBeCloseTo(90)
    expect(poseInsidePolygon(deep.x, deep.z, deep.rotationYDeg, footprint, square)).toBe(true)
  })

  it('aligns to a slanted edge under its angle', () => {
    const slanted = [
      { x: -3, z: -3 },
      { x: 3, z: -1 }, // bottom edge slanted ~18.4°
      { x: 3, z: 3 },
      { x: -3, z: 3 },
    ]
    const deep = progressiveEdgeSnap(0, -3.5, 10, footprint, slanted)
    expect(deep.snapped).toBe(true)
    const edgeAngle = (Math.atan2(-(3 - -3), -1 - -3) * 180) / Math.PI
    const aligned = nearestEdgeAlignedRotation(10, edgeAngle)
    expect(deep.rotationYDeg).toBeCloseTo(((aligned % 360) + 360) % 360, 0)
  })
})

describe('footprintFitsPolygon', () => {
  it('accepts a fitting footprint and rejects an oversized one', () => {
    expect(footprintFitsPolygon(footprint, square)).toBe(true)
    expect(footprintFitsPolygon({ width: 10, depth: 10 }, square)).toBe(false)
  })
})

describe('rectifyPolygon', () => {
  it('snaps a hand-drawn near-rectangle onto exact axis-aligned edges', () => {
    // Real polygon from doc #4 "Room 1" — every edge is a few cm off-axis.
    const rectified = rectifyPolygon([
      { x: -3.9, z: 4.95 },
      { x: -3.85, z: 8.55 },
      { x: -7.4, z: 8.55 },
      { x: -7.25, z: 4.9 },
    ])
    for (let i = 0; i < rectified.length; i++) {
      const a = rectified[i]
      const b = rectified[(i + 1) % rectified.length]
      const axisAligned = Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.z - b.z) < 1e-9
      expect(axisAligned).toBe(true)
    }
  })

  it('leaves genuinely diagonal edges untouched', () => {
    const diagonal = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 3 },
      { x: 1.5, z: 3 },
      { x: 0, z: 1.5 },
    ]
    const rectified = rectifyPolygon(diagonal)
    expect(rectified[4]).toEqual({ x: 0, z: 1.5 })
    expect(rectified[3]).toEqual({ x: 1.5, z: 3 })
  })

  it('keeps an already-clean rectangle unchanged', () => {
    const clean = [
      { x: -3.6, z: 5 },
      { x: -0.3, z: 5 },
      { x: -0.3, z: 8.5 },
      { x: -3.6, z: 8.5 },
    ]
    expect(rectifyPolygon(clean)).toEqual(clean)
  })

  it('preserves per-vertex metadata through the snap', () => {
    const tagged = [
      { x: -3.9, z: 4.95, side: 'w1' },
      { x: -3.85, z: 8.55, side: 'w2' },
      { x: -7.4, z: 8.55, side: 'w3' },
      { x: -7.25, z: 4.9, side: 'w4' },
    ]
    expect(rectifyPolygon(tagged).map((p) => p.side)).toEqual(['w1', 'w2', 'w3', 'w4'])
  })
})

describe('outwardEdgeNormal', () => {
  it('points away from the interior on a simple square', () => {
    const sign = polygonWindingSign(square)
    const n = outwardEdgeNormal(square[0], square[1], sign)
    expect(n.x).toBeCloseTo(0, 9)
    expect(n.z).toBeCloseTo(-1, 9)
  })

  it('is unaffected by the winding direction of the source outline', () => {
    const reversed = [...square].reverse()
    const forward = outwardEdgeNormal(square[0], square[1], polygonWindingSign(square))
    // In the reversed outline the same physical edge is traversed as 2 -> 3.
    const backward = outwardEdgeNormal(
      reversed[2],
      reversed[3],
      polygonWindingSign(reversed),
    )
    expect(backward.x).toBeCloseTo(forward.x, 9)
    expect(backward.z).toBeCloseTo(forward.z, 9)
  })

  it('stays outward inside a deep notch, where a centroid test inverts', () => {
    // The area centroid of this U sits at ~(5, 3.7), outside the notch wall.
    const u = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 9, z: 10 },
      { x: 9, z: 1 },
      { x: 1, z: 1 },
      { x: 1, z: 10 },
      { x: 0, z: 10 },
    ]
    const n = outwardEdgeNormal(u[3], u[4], polygonWindingSign(u))
    expect(n.x).toBeCloseTo(-1, 9)
    expect(n.z).toBeCloseTo(0, 9)

    const centroid = polygonCentroid(u)
    const mid = { x: 9, z: 5.5 }
    expect(n.x * (mid.x - centroid.x) + n.z * (mid.z - centroid.z)).toBeLessThan(0)
  })
})

describe('offsetPolygonMitered', () => {
  it('grows a rectangle by exactly the offset on every side', () => {
    const { points, clampedIndexes } = offsetPolygonMitered(square, 0.25)
    expect(clampedIndexes).toEqual([])
    expect(points[0].x).toBeCloseTo(-3.25, 9)
    expect(points[0].z).toBeCloseTo(-3.25, 9)
    expect(points[2].x).toBeCloseTo(3.25, 9)
    expect(points[2].z).toBeCloseTo(3.25, 9)
  })

  it('closes a reflex corner where the two offset walls actually meet', () => {
    // The L's reflex corner (3,3): the two offset faces cross at (3.2, 3.2).
    const { points, clampedIndexes } = offsetPolygonMitered(lShape, 0.2)
    expect(points[3].x).toBeCloseTo(3.2, 9)
    expect(points[3].z).toBeCloseTo(3.2, 9)
    expect(clampedIndexes).toEqual([])
  })

  it('clamps a spike instead of letting the miter shoot to infinity', () => {
    const spike = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      // Doubling back almost onto itself: vertex 1 is a needle.
      { x: 5.02, z: 0.1 },
      { x: 0, z: 4 },
    ]
    const { points, clampedIndexes } = offsetPolygonMitered(spike, 0.3)
    expect(clampedIndexes).toContain(1)
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
    }
  })

  it('returns the outline unchanged at zero distance', () => {
    const { points } = offsetPolygonMitered(square, 0)
    points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(square[i].x, 9)
      expect(p.z).toBeCloseTo(square[i].z, 9)
    })
  })
})
