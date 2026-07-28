import { describe, expect, it } from 'vitest'

import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'
import type { BuildingModel } from '@/payload-types'

import { mapBuildingScene } from './map-building'

type Room = NonNullable<BuildingModel['rooms']>[number]

const LINE = {
  id: 1,
  name: 'BOXXPlex',
  slug: 'boxxplex',
  unitLabel: 'offices',
  rules: { restroomsRequiredAt: 4, secondRestroomSetAt: 8, maxUnits: 12 },
}

const MODEL = { id: 2, url: '/api/models/file/demo.glb' }

/** A room with only the required fields — no shell, no sides authored. */
function legacyRoom(overrides: Partial<Room> = {}): Room {
  return {
    key: 'office-1',
    name: 'Office 1',
    roomType: 'office',
    floorPolygon: [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 4 },
      { x: 0, z: 4 },
    ],
    cameraPreset: { position: { x: 3, y: 5, z: 9 }, target: { x: 3, y: 0.8, z: 2 } },
    ...overrides,
  } as Room
}

function doc(rooms: Room[]): BuildingModel {
  return {
    id: 7,
    title: 'Demo',
    line: LINE,
    model: MODEL,
    unitCount: 2,
    restroomCount: 0,
    rooms,
  } as unknown as BuildingModel
}

describe('mapBuildingScene — generated room parameters', () => {
  it('falls back to a renderable shell when none is authored', () => {
    const [room] = mapBuildingScene(doc([legacyRoom()])).rooms

    // Against the constant, not a copy of it: what matters is that an
    // unauthored room lands on the defaults, whatever they are today.
    expect(room.shell.floorY).toBe(0)
    expect(room.shell.wallHeight).toBe(SHELL_DEFAULTS.wallHeight)
    expect(room.shell.wallThickness).toBe(SHELL_DEFAULTS.wallThickness)
  })

  it('clamps nonsense dimensions instead of emitting inverted geometry', () => {
    const broken = legacyRoom({
      shell: { wallHeight: 0, wallThickness: -1, floorThickness: 0 },
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([broken])).rooms

    expect(room.shell.wallHeight).toBe(0.1)
    expect(room.shell.wallThickness).toBe(0.01)
    expect(room.shell.floorThickness).toBe(0.01)
  })

  it('assigns a wall to every edge of an outline with no sides authored', () => {
    const [room] = mapBuildingScene(doc([legacyRoom()])).rooms
    expect(room.floorPolygon).toHaveLength(4)
    expect(new Set(room.floorPolygon.map((p) => p.side)).size).toBe(4)
  })

  it('prefers stored values over derived ones', () => {
    const stored = legacyRoom({
      shell: { floorY: 0.5, wallHeight: 3.2, wallThickness: 0.2 },
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([stored])).rooms

    expect(room.shell.floorY).toBe(0.5)
    expect(room.shell.wallHeight).toBe(3.2)
    expect(room.shell.wallThickness).toBe(0.2)
  })

  it('keeps an unset texture slot as null instead of throwing', () => {
    const [room] = mapBuildingScene(doc([legacyRoom()])).rooms

    expect(room.surfaces.wallInner.url).toBeNull()
    expect(room.surfaces.floor.tileWidth).toBe(1)
  })

  it('reads a populated texture relationship', () => {
    const textured = legacyRoom({
      surfaces: {
        wallInner: { texture: { id: 4, url: '/api/textures/file/oak.webp' }, tileWidth: 2 },
      },
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([textured])).rooms

    expect(room.surfaces.wallInner.url).toBe('/api/textures/file/oak.webp')
    expect(room.surfaces.wallInner.tileWidth).toBe(2)
  })

  it('drops malformed openings rather than feeding the generator garbage', () => {
    const withOpenings = legacyRoom({
      openings: [
        { id: 'a', side: 'w1', kind: 'door', along: 2, width: 0.9, height: 2.1, sill: 0 },
        { id: 'b', side: 'nope', along: 1 },
        { side: 'w2', along: 1 },
        'not an opening',
      ],
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([withOpenings])).rooms

    expect(room.openings.map((o) => o.id)).toEqual(['a'])
  })

  it('fills opening defaults by kind', () => {
    const withOpenings = legacyRoom({
      openings: [{ id: 'w', side: 'w1', kind: 'window', along: 1 }],
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([withOpenings])).rooms

    expect(room.openings[0]).toMatchObject({ width: 1.2, height: 1.2, sill: 0.9 })
  })

  it('survives a room whose outline is too short to be a room', () => {
    const broken = legacyRoom({ floorPolygon: [{ x: 0, z: 0 }] } as Partial<Room>)
    const [room] = mapBuildingScene(doc([broken])).rooms

    expect(room.floorPolygon).toEqual([])
    expect(room.openings).toEqual([])
  })
})

describe('mapBuildingScene — wall assignment', () => {
  it('re-derives sides when every vertex carries the schema default', () => {
    // Adding the column stamps 'w1' on every existing row, which would claim
    // the whole outline is one wall and leave the dollhouse with nothing to
    // hide. A uniform assignment means "nobody has set this yet".
    const stamped = legacyRoom({
      floorPolygon: [
        { x: 0, z: 0, side: 'w1' },
        { x: 6, z: 0, side: 'w1' },
        { x: 6, z: 4, side: 'w1' },
        { x: 0, z: 4, side: 'w1' },
      ],
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([stamped])).rooms

    expect(new Set(room.floorPolygon.map((p) => p.side)).size).toBe(4)
  })

  it('trusts a genuine assignment, including a wall spanning two edges', () => {
    const assigned = legacyRoom({
      floorPolygon: [
        { x: 0, z: 0, side: 'w1' },
        { x: 3, z: 0, side: 'w1' },
        { x: 6, z: 0, side: 'w2' },
        { x: 6, z: 4, side: 'w3' },
        { x: 0, z: 4, side: 'w4' },
      ],
    } as Partial<Room>)
    const [room] = mapBuildingScene(doc([assigned])).rooms

    expect(room.floorPolygon.map((p) => p.side)).toEqual(['w1', 'w1', 'w2', 'w3', 'w4'])
  })
})
