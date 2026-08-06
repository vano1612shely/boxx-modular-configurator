import { describe, expect, it } from 'vitest'

import { fitDistance, orbitRadius } from '@/entities/building'

import {
  farthestPresetRadius,
  roomScope,
  VIEW_MODES,
  viewModePreset,
  type ViewScope,
} from './view-presets'

/** A 12 x 3.2 x 8 m two-module building, sitting on the ground. */
const BUILDING: ViewScope = {
  min: [-6, 0, -4],
  max: [6, 3.2, 4],
  dollhouse: { position: [14, 10, 14], target: [0, 1.44, 0] },
  fov: 50,
}

/** A long single room — the shape that leaves the side views furthest out. */
const LONG_ROOM: ViewScope = {
  min: [0, 0, 0],
  max: [4, 2.6, 12],
  dollhouse: { position: [8, 4, 8], target: [2, 1.17, 6] },
  fov: 50,
}

const RADIUS = (scope: ViewScope) =>
  Math.hypot(
    scope.max[0] - scope.min[0],
    scope.max[1] - scope.min[1],
    scope.max[2] - scope.min[2],
  ) / 2

describe('viewModePreset', () => {
  it('gives every mode an orbitable pose', () => {
    for (const mode of VIEW_MODES) {
      expect(orbitRadius(viewModePreset(mode, BUILDING))).toBeGreaterThan(1)
    }
  })

  it('aims the four sides at the same point from four bearings', () => {
    const sides = ['side-front', 'side-right', 'side-back', 'side-left'] as const
    const bearings = new Set<number>()

    for (const mode of sides) {
      const preset = viewModePreset(mode, BUILDING)
      expect(preset.target).toEqual(viewModePreset('side-front', BUILDING).target)
      bearings.add(
        Math.round(
          Math.atan2(preset.position[0] - preset.target[0], preset.position[2] - preset.target[2]) *
            1e6,
        ),
      )
    }

    expect(bearings.size).toBe(4)
  })

  it('hands the dollhouse mode straight through', () => {
    expect(viewModePreset('dollhouse', BUILDING)).toBe(BUILDING.dollhouse)
  })
})

describe('farthestPresetRadius', () => {
  it('is a side view, which stands off further than the framing', () => {
    const fitted = fitDistance(RADIUS(BUILDING), BUILDING.fov)
    const farthest = farthestPresetRadius(BUILDING)

    expect(farthest).toBeGreaterThan(fitted)
    // The long axis: 12 m across, so the right and left views back off most.
    expect(farthest).toBeCloseTo(orbitRadius(viewModePreset('side-right', BUILDING)), 6)
  })

  // The whole of a 1.35x ceiling used to be swallowed by this on a long room,
  // leaving the wheel dead outwards the moment a side view landed.
  it('exceeds the framing radius by most of the ceiling on a long room', () => {
    const fitted = fitDistance(RADIUS(LONG_ROOM), LONG_ROOM.fov)
    expect(farthestPresetRadius(LONG_ROOM) / fitted).toBeGreaterThan(1.3)
  })

  it('is never smaller than any single preset', () => {
    for (const scope of [BUILDING, LONG_ROOM]) {
      const farthest = farthestPresetRadius(scope)
      for (const mode of VIEW_MODES) {
        expect(orbitRadius(viewModePreset(mode, scope))).toBeLessThanOrEqual(farthest + 1e-9)
      }
    }
  })
})

describe('roomScope', () => {
  const room = (
    points: Array<[number, number]>,
    shell: { floorY: number; wallHeight: number },
  ) =>
    ({
      key: 'r',
      name: 'R',
      roomType: 'office',
      areaSqFt: null,
      floorPolygon: points.map(([x, z]) => ({ x, z, side: 'w1' })),
      shell: {
        ...shell,
        wallThickness: 0.12,
        floorThickness: 0.12,
        ceilingThickness: 0.1,
        sideAxes: {},
        sunDirection: null,
      },
      openings: [],
      surfaces: {},
      openingModels: {},
      cameraPreset: { position: [6, 4, 6], target: [0, 1, 0] },
    }) as unknown as Parameters<typeof roomScope>[0]

  const UPSTAIRS = room(
    [
      [2, 4],
      [8, 4],
      [8, 9],
      [2, 9],
    ],
    { floorY: 3.4, wallHeight: 2.6 },
  )

  it('spans the room, from its own floor to its own ceiling', () => {
    const scope = roomScope(UPSTAIRS, 50)

    expect(scope.min).toEqual([2, 3.4, 4])
    expect(scope.max).toEqual([8, 6, 9])
  })

  // The point of the preview: the top view aims at the room rather than at the
  // middle of the building, which is where the wheel always closed before.
  it('gives the top view a pose over that room alone', () => {
    const { position, target } = viewModePreset('top', roomScope(UPSTAIRS, 50))

    expect(target[0]).toBeCloseTo(5, 6)
    expect(target[2]).toBeCloseTo(6.5, 6)
    expect(position[0]).toBeCloseTo(5, 6)
    expect(position[1]).toBeGreaterThan(6)
  })

  it('frames a bigger room from further up', () => {
    const small = viewModePreset('top', roomScope(UPSTAIRS, 50))
    const large = viewModePreset(
      'top',
      roomScope(
        room(
          [
            [0, 0],
            [20, 0],
            [20, 14],
            [0, 14],
          ],
          { floorY: 0, wallHeight: 2.6 },
        ),
        50,
      ),
    )

    expect(large.position[1]).toBeGreaterThan(small.position[1] * 2)
  })
})
