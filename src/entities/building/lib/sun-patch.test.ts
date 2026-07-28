import { describe, expect, it } from 'vitest'

import {
  bearingOf,
  facesSun,
  SUN_DISTANCE,
  sunHeading,
  sunRay,
  windowBeamCone,
  windowBeamHalfSize,
} from './sun-patch'

describe('sunRay', () => {
  it('travels into the room and downward', () => {
    // Sun in the north (-Z): light travels towards +Z, and downward.
    const [x, y, z] = sunRay(0)

    expect(y).toBeLessThan(0)
    expect(z).toBeGreaterThan(0)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
  })

  it('turns with the compass bearing', () => {
    expect(sunRay(0)[2]).toBeGreaterThan(0)
    expect(sunRay(180)[2]).toBeLessThan(0)
    expect(sunRay(90)[0]).toBeLessThan(0)
    expect(sunRay(270)[0]).toBeGreaterThan(0)
  })

  it('is not square to the wall, so the beam lands skewed', () => {
    const [x, , z] = sunRay(0)
    expect(Math.abs(x)).toBeGreaterThan(0.05 * Math.abs(z))
  })
})

describe('windowBeamHalfSize', () => {
  const ray = sunRay(0)
  /** The wall faces -Z, so it runs along X. */
  const tangent = { x: 1, z: 0 }

  it('foreshortens the height by the sun’s elevation', () => {
    const { halfHeight } = windowBeamHalfSize(ray, tangent, 1.2, 1.4)
    expect(halfHeight).toBeCloseTo(0.7 * Math.cos(0.62), 6)
    expect(halfHeight).toBeLessThan(0.7)
  })

  it('barely foreshortens the width, which the sun is nearly square to', () => {
    const { halfWidth } = windowBeamHalfSize(ray, tangent, 1.2, 1.4)
    expect(halfWidth).toBeLessThanOrEqual(0.6)
    expect(halfWidth).toBeGreaterThan(0.5)
  })

  it('never goes negative or NaN, whatever angle the sun comes from', () => {
    for (const bearing of [0, 90, 180, 270]) {
      const { halfWidth, halfHeight } = windowBeamHalfSize(sunRay(bearing), tangent, 0.65, 1.4)
      expect(halfWidth).toBeGreaterThanOrEqual(0)
      expect(halfHeight).toBeGreaterThan(0)
      expect(Number.isFinite(halfWidth)).toBe(true)
    }
  })
})

describe('windowBeamCone', () => {
  it('puts the window inside the cone, with room for the soft edge', () => {
    const { halfU, halfV } = windowBeamCone(0.6, 0.7)

    // Comfortably inside the mask, never spilling past its edge.
    expect(halfU).toBeGreaterThan(0)
    expect(halfU).toBeLessThan(0.5)
    expect(halfV).toBeLessThan(0.5)
  })

  it('keeps the window’s proportions in the mask', () => {
    const { halfU, halfV } = windowBeamCone(0.6, 1.2)
    expect(halfV / halfU).toBeCloseTo(2, 6)
  })

  it('agrees with the cone it reports', () => {
    // The mask fraction and the cone angle are only meaningful together: at the
    // stated distance the window must span exactly `2 * halfU` of the cone.
    const halfWidth = 0.45
    const { angle, halfU } = windowBeamCone(halfWidth, 0.7)
    const span = SUN_DISTANCE * Math.tan(angle)

    expect(halfU * 2 * span).toBeCloseTo(halfWidth, 6)
  })

  it('opens wider for a bigger window rather than clipping it', () => {
    const small = windowBeamCone(0.3, 0.4)
    const big = windowBeamCone(1.5, 1.1)

    expect(big.angle).toBeGreaterThan(small.angle)
    expect(big.halfU).toBeLessThan(0.5)
  })
})

describe('compass bearings', () => {
  it('puts north at -Z and east at +X', () => {
    expect(sunHeading(0).z).toBeCloseTo(-1, 6)
    expect(sunHeading(90).x).toBeCloseTo(1, 6)
    expect(sunHeading(180).z).toBeCloseTo(1, 6)
    expect(sunHeading(270).x).toBeCloseTo(-1, 6)
  })

  it('reads a direction back as the bearing it came from', () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      expect(bearingOf(sunHeading(bearing))).toBeCloseTo(bearing, 4)
    }
  })

  it('lights only the walls turned towards the sun', () => {
    // Sun in the south: the wall facing south catches it, the north one is in
    // its own shade and the two flanks are edge-on.
    expect(facesSun({ x: 0, z: 1 }, 180)).toBe(true)
    expect(facesSun({ x: 0, z: -1 }, 180)).toBe(false)
    expect(facesSun({ x: 1, z: 0 }, 180)).toBe(false)
    expect(facesSun({ x: -1, z: 0 }, 180)).toBe(false)
  })

  it('lights both walls of a corner when the sun is on the diagonal', () => {
    expect(facesSun({ x: 0, z: 1 }, 135)).toBe(true)
    expect(facesSun({ x: 1, z: 0 }, 135)).toBe(true)
  })
})
