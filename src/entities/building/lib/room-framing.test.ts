import { describe, expect, it } from 'vitest'

import type { RoomOpening, RoomZone } from '../model/types'
import { buildingExtent, frameBuilding, frameRoom, roomFocusTarget } from './room-framing'
import { autoAssignSides, computeSideAxes } from './room-shell'

function room(
  points: Array<[number, number]>,
  overrides: { floorY?: number; wallHeight?: number; openings?: RoomOpening[] } = {},
): RoomZone {
  const plain = points.map(([x, z]) => ({ x, z }))
  const sides = autoAssignSides(plain)
  const polygon = plain.map((p, i) => ({ ...p, side: sides[i] }))

  return {
    key: 'r',
    name: 'R',
    roomType: 'office',
    floorPolygon: polygon,
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
    surfaces: {} as RoomZone['surfaces'],
    openingModels: {} as RoomZone['openingModels'],
    // Deliberately hostile: the stored preset is exactly the broken shape that
    // made the orbit spin on the spot — target 30 cm from position, both
    // nowhere near the room.
    cameraPreset: { position: [-5.63, 2.46, -2.43], target: [-5.43, 2.37, -2.71] },
  }
}

/** The room the user reported the spin on. */
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
    // Between the floor and the ceiling of this room — not of the world.
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

    // The bug: the authored preset left 0.35 m between the two, so dragging
    // rotated the camera on the spot instead of around the room.
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
    // w1 faces -Z and holds both windows, so the camera belongs on the +Z side
    // of the room — looking at the windows, not through them from behind.
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

describe('buildingExtent', () => {
  const box = (min: [number, number, number], max: [number, number, number]) => ({ min, max })

  it('measures the building from what was authored, not from the glb', () => {
    const extent = buildingExtent({
      rooms: [room([[0, 0], [6, 0], [6, 4], [0, 4]], { floorY: 0.8, wallHeight: 2.5 })],
      roofBlocks: [box([-1, 3.1, -1], [8, 3.9, 9])],
    })!

    expect(extent.min).toEqual([-1, 0.8, -1])
    expect(extent.max).toEqual([8, 3.9, 9])
  })

  it('reports nothing when the scene has not been authored yet', () => {
    expect(buildingExtent({ rooms: [], roofBlocks: [] })).toBeNull()
  })

  it('ignores a room with no usable outline', () => {
    const extent = buildingExtent({
      rooms: [room([[0, 0], [1, 0]])],
      roofBlocks: [box([0, 0, 0], [2, 2, 2])],
    })!

    expect(extent.max).toEqual([2, 2, 2])
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
    // The real failure: captured from a close-up, so one drag threw the whole
    // building off screen and pan crawled, because every action is scaled by
    // the orbit radius.
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

  it('replaces a preset aiming somewhere off the site entirely', () => {
    const framed = frameBuilding(MIN, MAX, FOV, {
      position: [60, 30, 60],
      target: [80, 0, 80],
    })

    expect(framed.target[0]).toBeCloseTo((MIN[0] + MAX[0]) / 2, 6)
  })

  it('gives the two scopes orbit radii in proportion to their subjects', () => {
    // What "the controls feel the same in both" reduces to: pan is a fraction
    // of the orbit radius and a wheel tick scales it, so the ratio of radius to
    // subject size has to match.
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
