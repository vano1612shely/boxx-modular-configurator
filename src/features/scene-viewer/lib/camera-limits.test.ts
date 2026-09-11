import { describe, expect, it } from 'vitest'

import { orbitRadius } from '@/entities/building'

import {
  cameraLimits,
  LIMITS,
  nearPlaneFor,
  type AuthoredCamera,
  type LimitScope,
} from './camera-limits'
import { farthestPresetRadius, VIEW_MODES, viewModePreset } from './view-presets'

/** building-models/4 as stored, every field at its schema default. */
const AUTHORED: AuthoredCamera = {
  minDistance: 2,
  maxDistance: 30,
  position: [23.69, 19.32, 17.66],
  target: [-5.51, 1.97, 0.94],
}

/** The same document's building, measured off the glb without the site. */
const BUILDING: LimitScope = {
  min: [-9.1, -0.06, -8.94],
  max: [3.25, 3.91, 8.92],
  dollhouse: { position: AUTHORED.position, target: AUTHORED.target },
  fov: 50,
}

const ROOM: LimitScope = {
  min: [-7.25, 0.75, -8.2],
  max: [-3.85, 3.25, -4.5],
  dollhouse: { position: [-5.24, 6.75, -2.88], target: [-5.24, 1.35, -6.88] },
  fov: 50,
}

/** The shape that used to swallow the ceiling whole: long and shallow. */
const LONG_ROOM: LimitScope = {
  min: [0, 0, 0],
  max: [4, 2.6, 12],
  dollhouse: { position: [8, 4, 8], target: [2, 1.17, 6] },
  fov: 50,
}

const RADIUS = Math.hypot(12.35, 3.97, 17.86) / 2
const ORBIT = Math.hypot(29.2, 17.35, 16.72)

/** One Chrome-on-Windows wheel notch, as a distance multiplier. */
const NOTCH = 1.11

describe('cameraLimits, building scope', () => {
  it('never clamps closer than the view it opens on', () => {
    const { max } = cameraLimits(BUILDING, AUTHORED, false)

    expect(ORBIT).toBeGreaterThan(AUTHORED.maxDistance)
    expect(max).toBeGreaterThan(ORBIT)
  })

  it('leaves real room to pull back, unlike a room', () => {
    const building = cameraLimits(BUILDING, AUTHORED, false)
    expect(building.max / ORBIT).toBeGreaterThan(1.25)
    expect(LIMITS.building.zoomOut).toBeGreaterThan(LIMITS.room.zoomOut)
    expect(LIMITS.building.panSlack).toBeGreaterThan(LIMITS.room.panSlack)
  })

  it('lets the poses decide the ceiling, not the untouched schema default', () => {
    const { max } = cameraLimits(BUILDING, AUTHORED, false)
    const farthest = farthestPresetRadius(BUILDING)

    expect(max).toBeCloseTo(Math.min(farthest * 1.4, farthest * LIMITS.building.zoomOut), 6)
    expect(farthest).toBeGreaterThan(AUTHORED.maxDistance)
  })

  it('keeps the pan target inside the frame, not merely inside the site', () => {
    const { boundary } = cameraLimits(BUILDING, AUTHORED, false)!
    const slack = RADIUS * LIMITS.building.panSlack
    const halfWidth = (BUILDING.max[0] - BUILDING.min[0]) / 2

    expect(slack).toBeLessThan(halfWidth)
    expect(boundary!.max[0]).toBeCloseTo(BUILDING.max[0] + slack, 6)
  })

  it('barely gives downward, whatever the subject measures', () => {
    const { boundary } = cameraLimits(BUILDING, AUTHORED, false)

    expect(BUILDING.min[1] - boundary!.min[1]).toBeCloseTo(0.5, 6)
    expect(boundary!.max[1]).toBeGreaterThan(BUILDING.max[1] + 4)
  })

  it('admits the authored view while the model is still downloading', () => {
    const { min, max, boundary } = cameraLimits(null, AUTHORED, false)

    expect(boundary).toBeNull()
    expect(min).toBe(AUTHORED.minDistance)
    expect(max).toBeGreaterThan(ORBIT)
  })
})

describe('cameraLimits, room scope', () => {
  it('is fitted at the room’s own scale, and lets the room in close', () => {
    const { min, max } = cameraLimits(ROOM, AUTHORED, true)

    expect(max).toBeCloseTo(farthestPresetRadius(ROOM) * LIMITS.room.zoomOut, 6)
    expect(min).toBe(0.4)
  })

  it('holds the target close, so a room cannot be panned away from', () => {
    const { boundary } = cameraLimits(ROOM, AUTHORED, true)
    const slack = (Math.hypot(3.4, 2.5, 3.7) / 2) * LIMITS.room.panSlack

    expect(boundary!.max[0]).toBeCloseTo(ROOM.max[0] + slack, 6)
    expect(slack).toBeLessThan(1)
  })
})

// Every view button used to be able to land on the ceiling — on a long room,
// within one wheel notch of it — so the wheel was inert in one direction the
// moment the flight ended.
describe('every preset arrives with somewhere left to go', () => {
  const CASES: Array<[string, LimitScope, boolean]> = [
    ['building', BUILDING, false],
    ['room', ROOM, true],
    ['long room', LONG_ROOM, true],
  ]

  for (const [name, scope, focused] of CASES) {
    it(`gives ${name} presets at least a notch of zoom out and plenty in`, () => {
      const { min, max } = cameraLimits(scope, AUTHORED, focused)

      for (const mode of VIEW_MODES) {
        const radius = orbitRadius(viewModePreset(mode, scope))

        expect(radius).toBeLessThanOrEqual(max + 1e-9)
        expect(radius).toBeGreaterThanOrEqual(min - 1e-9)
        expect(max / radius).toBeGreaterThan(NOTCH)
        expect(radius / min).toBeGreaterThan(NOTCH)
      }
    })
  }
})

describe('nearPlaneFor', () => {
  it('keeps the room camera able to stand close to a wall', () => {
    expect(nearPlaneFor(0.4)).toBe(0.1)
    expect(nearPlaneFor(4)).toBe(0.1)
  })

  it('moves the plane out with the orbit, and stops at a metre', () => {
    expect(nearPlaneFor(25)).toBeCloseTo(0.5)
    expect(nearPlaneFor(60)).toBe(1)
    expect(nearPlaneFor(84)).toBe(1)
  })

  it('resolves the floor finish from the timber under it at the far limit', () => {
    // 24-bit depth: metres per step at distance d is about d² / (near · 2²⁴).
    const stepAt = (d: number) => (d * d) / (nearPlaneFor(d) * 2 ** 24)
    const separation = 0.0063
    expect(separation / stepAt(84)).toBeGreaterThan(10)
  })
})
