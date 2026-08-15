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

/** A long single room — the shape whose two presets disagree most about range. */
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

  // The four sides were dropped: the quarter turn reaches every bearing they
  // named, and unlike them it keeps the zoom and the pan on the way.
  it('offers the overview and the plan, and nothing else', () => {
    expect([...VIEW_MODES]).toEqual(['dollhouse', 'top'])
  })

  it('hands the dollhouse mode straight through', () => {
    expect(viewModePreset('dollhouse', BUILDING)).toBe(BUILDING.dollhouse)
  })

  it('looks straight down from the fitted height, over the middle', () => {
    const { position, target } = viewModePreset('top', BUILDING)
    const fitted = fitDistance(RADIUS(BUILDING), BUILDING.fov)

    expect(target).toEqual([0, 0, 0])
    expect(position[1]).toBeCloseTo(fitted, 6)
    expect(Math.hypot(position[0] - target[0], position[2] - target[2])).toBeLessThan(
      position[1] * 0.1,
    )
  })
})

describe('farthestPresetRadius', () => {
  // Neither pose is reliably the further out — the top view is fitted to the
  // subject's height from overhead, the overview to how far back a standing eye
  // has to be — so the ceiling is derived from whichever wins on the day.
  it('takes whichever of the two stands off further', () => {
    expect(farthestPresetRadius(BUILDING)).toBeCloseTo(
      orbitRadius(viewModePreset('dollhouse', BUILDING)),
      6,
    )
    expect(farthestPresetRadius(LONG_ROOM)).toBeCloseTo(
      orbitRadius(viewModePreset('top', LONG_ROOM)),
      6,
    )
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
