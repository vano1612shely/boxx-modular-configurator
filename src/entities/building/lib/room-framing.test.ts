import { describe, expect, it } from 'vitest'

import type { RoomOpening, Room } from '../model/types'
import {
  extentWithoutSite,
  frameBuilding,
  frameRoom,
  orbitable,
  orbitRadius,
  roomArea,
  roomFocusTarget,
  type PartExtent,
} from './room-framing'
import { autoAssignSides, computeSideAxes } from './room-shell'

function room(
  points: Array<[number, number]>,
  overrides: { floorY?: number; wallHeight?: number; openings?: RoomOpening[] } = {},
): Room {
  const plain = points.map(([x, z]) => ({ x, z }))
  const sides = autoAssignSides(plain)
  const polygon = plain.map((p, i) => ({ ...p, side: sides[i] }))

  return {
    key: 'r',
    name: 'R',
    roomType: 'office',
    areaSqFt: null,
    areaSqM: null,
    floorPolygon: polygon,
    zones: [],
    shell: {
      floorY: overrides.floorY ?? 0,
      wallHeight: overrides.wallHeight ?? 2.5,
      wallThickness: 0.12,
      floorThickness: 0.12,
      ceilingThickness: 0.1,
      sideAxes: computeSideAxes(polygon),
      sunDirection: null,
    },
    openings: overrides.openings ?? [],
    surfaces: {} as Room['surfaces'],
    openingModels: {} as Room['openingModels'],
    // Hostile fixture: target 30 cm from position, both far from the room.
    cameraPreset: { position: [-5.63, 2.46, -2.43], target: [-5.43, 2.37, -2.71] },
  }
}

const REAL = room(
  [
    [-3.65, -7.95],
    [-0.95, -7.95],
    [-0.95, -8.2],
    [-0.25, -8.2],
    [-0.25, -4.5],
    [-3.65, -4.5],
  ],
  {
    floorY: 0.81,
    wallHeight: 3.13,
    openings: [
      { id: 'a', side: 'w1', kind: 'window', along: 2.95, width: 1.2, height: 1.2, sill: 0.9 },
      { id: 'b', side: 'w1', kind: 'window', along: 3.21, width: 0.8, height: 1.1, sill: 0.95 },
      { id: 'c', side: 'w3', kind: 'door', along: 2.15, width: 0.9, height: 2.1, sill: 0 },
    ],
  },
)

describe('roomFocusTarget', () => {
  it('sits in the middle of the room, at eye height above ITS floor', () => {
    const [x, y, z] = roomFocusTarget(REAL)

    expect(x).toBeCloseTo(-1.95, 6)
    expect(z).toBeCloseTo(-6.35, 6)
    expect(y).toBeGreaterThan(0.81)
    expect(y).toBeLessThan(0.81 + 3.13)
  })

  it('ignores the stored preset entirely', () => {
    const [x, , z] = roomFocusTarget(REAL)
    const [px, , pz] = REAL.cameraPreset.target

    expect(Math.hypot(x - px, z - pz)).toBeGreaterThan(3)
  })
})

describe('frameRoom', () => {
  it('puts the orbit target far enough from the camera to actually orbit', () => {
    const { position, target } = frameRoom(REAL, 50)
    const distance = Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    )

    expect(distance).toBeGreaterThan(4)
    expect(distance).toBeLessThan(20)
  })

  it('frames the room from outside it, looking down', () => {
    const { position, target } = frameRoom(REAL, 50)

    expect(position[1]).toBeGreaterThan(target[1])
    // Outside the footprint (x -3.65..-0.25, z -8.2..-4.5).
    const outside =
      position[0] < -3.65 || position[0] > -0.25 || position[2] < -8.2 || position[2] > -4.5
    expect(outside).toBe(true)
  })

  it('backs off further for a bigger room', () => {
    const small = frameRoom(room([[0, 0], [3, 0], [3, 3], [0, 3]]), 50)
    const big = frameRoom(room([[0, 0], [12, 0], [12, 9], [0, 9]]), 50)

    const span = (p: ReturnType<typeof frameRoom>) =>
      Math.hypot(p.position[0] - p.target[0], p.position[2] - p.target[2])

    expect(span(big)).toBeGreaterThan(span(small) * 2)
  })

  it('backs off further for a narrower field of view', () => {
    const wide = frameRoom(REAL, 70)
    const narrow = frameRoom(REAL, 30)
    const span = (p: ReturnType<typeof frameRoom>) =>
      Math.hypot(p.position[0] - p.target[0], p.position[2] - p.target[2])

    expect(span(narrow)).toBeGreaterThan(span(wide))
  })

  it('stands opposite the wall carrying the most glass', () => {
    // w1 faces -Z and holds both windows.
    const { position, target } = frameRoom(REAL, 50)

    expect(position[2]).toBeGreaterThan(target[2])
  })

  it('still frames a room with no openings at all', () => {
    const { position, target } = frameRoom(room([[0, 0], [4, 0], [4, 3], [0, 3]]), 50)

    expect(Number.isFinite(position[0])).toBe(true)
    expect(Number.isFinite(position[1])).toBe(true)
    expect(Number.isFinite(position[2])).toBe(true)
    expect(position[1]).toBeGreaterThan(target[1])
  })

  it('rises with the floor it belongs to', () => {
    const ground = frameRoom(room([[0, 0], [4, 0], [4, 3], [0, 3]], { floorY: 0 }), 50)
    const upstairs = frameRoom(room([[0, 0], [4, 0], [4, 3], [0, 3]], { floorY: 3.2 }), 50)

    expect(upstairs.target[1] - ground.target[1]).toBeCloseTo(3.2, 6)
    expect(upstairs.position[1] - ground.position[1]).toBeCloseTo(3.2, 6)
  })
})

describe('extentWithoutSite', () => {
  const part = (
    min: [number, number, number],
    max: [number, number, number],
  ): PartExtent => ({ min, max })

  const wall = (x: number, z: number) => part([x, 0, z], [x + 7, 3.5, z + 18])

  it('drops the ground the building stands on', () => {
    const parts = [
      part([-40, -0.06, -26], [33, -0.06, 28]),
      wall(-9, -9),
      wall(-9, -9),
      part([-2, 0, -1], [1, 2.2, 2]),
      part([-1, 0, 4], [0.5, 1.1, 5]),
    ]

    const extent = extentWithoutSite(parts)!

    expect(extent.min[0]).toBe(-9)
    expect(extent.max[0]).toBe(1)
    expect(extent.min[2]).toBe(-9)
    expect(extent.max[2]).toBe(9)
  })

  it('keeps a roof slab, which is wide but not flat against its own building', () => {
    const roof = part([-9, 3.4, -9], [-2, 3.9, 9])
    const parts = [wall(-9, -9), wall(-9, -9), roof, part([-2, 0, -1], [1, 2.2, 2])]

    const extent = extentWithoutSite(parts)!

    expect(extent.max[1]).toBe(3.9)
  })

  it('keeps a flat part that is not wide — a paving slab is not a site', () => {
    const parts = [wall(-9, -9), wall(-9, -9), part([20, 0, 20], [21, 0.02, 21]), wall(-9, -9)]

    const extent = extentWithoutSite(parts)!

    expect(extent.max[0]).toBe(21)
  })

  it('still spots the ground when half the parts are plate-sized', () => {
    const parts = [
      part([-40, 0, -26], [33, 0, 28]),
      part([-40, 0.01, -26], [33, 0.01, 28]),
      wall(-9, -9),
      part([-2, 0, -1], [1, 2.2, 2]),
    ]

    const extent = extentWithoutSite(parts)!

    expect(extent.min[0]).toBe(-9)
    expect(extent.max[0]).toBe(1)
  })

  it('trusts the whole box on a model too small to have a typical part', () => {
    const parts = [part([-40, 0, -26], [33, 0, 28]), wall(-9, -9), part([0, 0, 0], [1, 1, 1])]

    const extent = extentWithoutSite(parts)!

    expect(extent.min[0]).toBe(-40)
  })

  it('reports nothing when there is nothing to measure', () => {
    expect(extentWithoutSite([])).toBeNull()
  })

  it('falls back to the whole box rather than return nothing measurable', () => {
    const parts = [
      part([0, 0, 0], [50, 0, 50]),
      part([0, 0, 0], [50, 0, 50]),
      part([0, 0, 0], [50, 0, 50]),
      part([0, 0, 0], [50, 0, 50]),
    ]

    expect(extentWithoutSite(parts)).toEqual({ min: [0, 0, 0], max: [50, 0, 50] })
  })
})

describe('orbitRadius', () => {
  it('measures the distance a preset stands from what it looks at', () => {
    expect(orbitRadius({ position: [3, 4, 0], target: [0, 0, 0] })).toBeCloseTo(5, 9)
  })
})

describe('orbitable', () => {
  it('rejects the shape an unframed document carries', () => {
    expect(orbitable({ position: [0, 0, 0], target: [0, 0, 0] })).toBe(false)
  })

  it('rejects a target close enough to the eye to spin on the spot', () => {
    expect(orbitable({ position: [4, 2, 4], target: [4.2, 1.95, 4.35] })).toBe(false)
  })

  it('accepts a close-up, which is a different complaint', () => {
    expect(orbitable({ position: [-2.08, 1.55, -6.95], target: [-3.42, 1.17, -6.49] })).toBe(true)
  })

  it('accepts an overview', () => {
    expect(orbitable({ position: [23.69, 19.32, 17.66], target: [-5.51, 1.97, 0.94] })).toBe(true)
  })
})

describe('frameBuilding', () => {
  const MIN: [number, number, number] = [-7.5, 0.8, -8.6]
  const MAX: [number, number, number] = [0, 3.9, 9]
  const FOV = 50

  it('keeps a preset that already frames the building', () => {
    const stored = { position: [20, 12, 24] as const, target: [-3.7, 2.3, 0.2] as const }
    const framed = frameBuilding(MIN, MAX, FOV, {
      position: [...stored.position],
      target: [...stored.target],
    })

    expect(framed.position).toEqual([...stored.position])
    expect(framed.target).toEqual([...stored.target])
  })

  it('replaces a preset that orbits a point a metre in front of itself', () => {
    const framed = frameBuilding(MIN, MAX, FOV, {
      position: [-2.08, 1.55, -6.95],
      target: [-3.42, 1.17, -6.49],
    })

    const orbit = Math.hypot(
      framed.position[0] - framed.target[0],
      framed.position[1] - framed.target[1],
      framed.position[2] - framed.target[2],
    )
    const radius = Math.hypot(MAX[0] - MIN[0], MAX[1] - MIN[1], MAX[2] - MIN[2]) / 2

    expect(orbit).toBeGreaterThan(radius)
    expect(framed.target[0]).toBeCloseTo((MIN[0] + MAX[0]) / 2, 6)
    expect(framed.target[2]).toBeCloseTo((MIN[2] + MAX[2]) / 2, 6)
  })

  it('keeps the authored overview of the real document', () => {
    const stored = {
      position: [23.69, 19.32, 17.66] as [number, number, number],
      target: [-5.51, 1.97, 0.94] as [number, number, number],
    }

    const framed = frameBuilding([-9.1, -0.06, -8.94], [3.25, 3.91, 8.92], FOV, {
      position: [...stored.position] as [number, number, number],
      target: [...stored.target] as [number, number, number],
    })

    expect(framed.target).toEqual(stored.target)
    expect(framed.position).toEqual(stored.position)
  })

  it('replaces a preset aiming somewhere off the site entirely', () => {
    const framed = frameBuilding(MIN, MAX, FOV, {
      position: [60, 30, 60],
      target: [80, 0, 80],
    })

    expect(framed.target[0]).toBeCloseTo((MIN[0] + MAX[0]) / 2, 6)
  })

  it('gives the two scopes orbit radii in proportion to their subjects', () => {
    const building = frameBuilding(MIN, MAX, FOV, { position: [0, 0, 0], target: [0, 0, 0] })
    const buildingRadius = Math.hypot(MAX[0] - MIN[0], MAX[1] - MIN[1], MAX[2] - MIN[2]) / 2
    const buildingOrbit = Math.hypot(
      building.position[0] - building.target[0],
      building.position[1] - building.target[1],
      building.position[2] - building.target[2],
    )

    const zone = room([[0, 0], [3.4, 0], [3.4, 3.45], [0, 3.45]], { wallHeight: 2.32 })
    const framed = frameRoom(zone, FOV)
    const roomRadius = Math.hypot(3.4, 2.32, 3.45) / 2
    const roomOrbit = Math.hypot(
      framed.position[0] - framed.target[0],
      framed.position[1] - framed.target[1],
      framed.position[2] - framed.target[2],
    )

    expect(buildingOrbit / buildingRadius).toBeCloseTo(roomOrbit / roomRadius, 2)
  })
})

describe('roomArea', () => {
  const fourByFive = room([
    [0, 0],
    [4, 0],
    [4, 5],
    [0, 5],
  ])

  // The outline is in metres, so m² is the figure it measures directly.
  it('measures the outline in whichever unit is asked for', () => {
    expect(roomArea(fourByFive, 'sqm')).toBeCloseTo(20, 9)
    expect(roomArea(fourByFive, 'sqft')).toBeCloseTo(215.278, 3)
  })

  // Outlines are traced over the model by hand and snapped to the nearest axis,
  // so someone holding the real drawing has to be able to overrule them.
  it('lets an authored figure win', () => {
    expect(roomArea({ ...fourByFive, areaSqFt: 208 }, 'sqft')).toBe(208)
    expect(roomArea({ ...fourByFive, areaSqM: 19 }, 'sqm')).toBe(19)
  })

  // The unauthored unit follows the authored one, not the trace — otherwise the
  // panel would show 208 ft² beside a traced 20 m², which disagree.
  it('converts the other unit from what was authored', () => {
    expect(roomArea({ ...fourByFive, areaSqFt: 208 }, 'sqm')).toBeCloseTo(19.32, 2)
    expect(roomArea({ ...fourByFive, areaSqM: 19 }, 'sqft')).toBeCloseTo(204.51, 2)
  })

  it('shows both exactly as typed when both were authored', () => {
    const both = { ...fourByFive, areaSqFt: 215, areaSqM: 20 }
    expect(roomArea(both, 'sqft')).toBe(215)
    expect(roomArea(both, 'sqm')).toBe(20)
  })

  // Not `?? 0 ||`: a room genuinely authored as zero is still an answer.
  it('takes zero as an answer', () => {
    expect(roomArea({ ...fourByFive, areaSqFt: 0 }, 'sqft')).toBe(0)
  })

  // Rounding belongs at the point of display, or a figure is rounded twice.
  it('does not round', () => {
    expect(roomArea(fourByFive, 'sqft') % 1).not.toBe(0)
  })
})
