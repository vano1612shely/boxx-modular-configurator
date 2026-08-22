import { describe, expect, it } from 'vitest'

import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'
import type { BuildingModel } from '@/payload-types'

import { mapBuildingScene } from './map-building'

type RoomDoc = NonNullable<BuildingModel['rooms']>[number]

const LINE = {
  id: 1,
  name: 'BOXXPlex',
  slug: 'boxxplex',
  unitLabel: 'offices',
  rules: { restroomsRequiredAt: 4, secondRestroomSetAt: 8 },
}

const MODEL = { id: 2, url: '/api/models/file/demo.glb' }

function legacyRoom(overrides: Partial<RoomDoc> = {}): RoomDoc {
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
  } as RoomDoc
}

function doc(rooms: RoomDoc[]): BuildingModel {
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

    expect(room.shell.floorY).toBe(0)
    expect(room.shell.wallHeight).toBe(SHELL_DEFAULTS.wallHeight)
    expect(room.shell.wallThickness).toBe(SHELL_DEFAULTS.wallThickness)
  })

  it('clamps nonsense dimensions instead of emitting inverted geometry', () => {
    const broken = legacyRoom({
      shell: { wallHeight: 0, wallThickness: -1, floorThickness: 0 },
    } as Partial<RoomDoc>)
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
    } as Partial<RoomDoc>)
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
    } as Partial<RoomDoc>)
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
    } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([withOpenings])).rooms

    expect(room.openings.map((o) => o.id)).toEqual(['a'])
  })

  it('fills opening defaults by kind', () => {
    const withOpenings = legacyRoom({
      openings: [{ id: 'w', side: 'w1', kind: 'window', along: 1 }],
    } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([withOpenings])).rooms

    expect(room.openings[0]).toMatchObject({ width: 1.2, height: 1.2, sill: 0.9 })
  })

  it('survives a room whose outline is too short to be a room', () => {
    const broken = legacyRoom({ floorPolygon: [{ x: 0, z: 0 }] } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([broken])).rooms

    expect(room.floorPolygon).toEqual([])
    expect(room.openings).toEqual([])
  })
})

describe('mapBuildingScene — wall assignment', () => {
  it('re-derives sides when every vertex carries the schema default', () => {
    const stamped = legacyRoom({
      floorPolygon: [
        { x: 0, z: 0, side: 'w1' },
        { x: 6, z: 0, side: 'w1' },
        { x: 6, z: 4, side: 'w1' },
        { x: 0, z: 4, side: 'w1' },
      ],
    } as Partial<RoomDoc>)
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
    } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([assigned])).rooms

    expect(room.floorPolygon.map((p) => p.side)).toEqual(['w1', 'w1', 'w2', 'w3', 'w4'])
  })
})

describe('mapBuildingScene — zones', () => {
  const HALVES = [
    {
      key: 'conf',
      name: 'Conference',
      roomType: 'conference',
      color: '#3b82f6',
      polygon: [
        { x: 0, z: 0 },
        { x: 3, z: 0 },
        { x: 3, z: 4 },
        { x: 0, z: 4 },
      ],
    },
    {
      key: 'kitchen',
      name: 'Kitchen',
      roomType: 'kitchen',
      areaSqM: 12,
      polygon: [
        { x: 3, z: 0 },
        { x: 6, z: 0 },
        { x: 6, z: 4 },
        { x: 3, z: 4 },
      ],
    },
  ]

  it('leaves a room nobody cut undivided', () => {
    const [room] = mapBuildingScene(doc([legacyRoom()])).rooms
    expect(room.zones).toEqual([])
  })

  it('reads the halves back with their own type, area and tint', () => {
    const divided = legacyRoom({ zones: HALVES } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([divided])).rooms

    expect(room.zones.map((zone) => zone.roomType)).toEqual(['conference', 'kitchen'])
    expect(room.zones[1].areaSqM).toBe(12)
    expect(room.zones[1].areaSqFt).toBeNull()
    expect(room.zones[0].color).toBe('#3b82f6')
  })

  it('gives a zone stored without a tint one to be going on with', () => {
    const divided = legacyRoom({ zones: HALVES } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([divided])).rooms

    expect(room.zones[1].color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  // A single zone is the room over again under a second name, and it would put
  // a picker on screen with one thing in it.
  it('treats one zone as no zones', () => {
    const divided = legacyRoom({ zones: [HALVES[0]] } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([divided])).rooms

    expect(room.zones).toEqual([])
  })

  it('drops a zone whose outline could not enclose anything', () => {
    const divided = legacyRoom({
      zones: [...HALVES, { key: 'sliver', name: 'Sliver', polygon: [{ x: 0, z: 0 }] }],
    } as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([divided])).rooms

    expect(room.zones.map((zone) => zone.key)).toEqual(['conf', 'kitchen'])
  })

  it('ignores a zones column that is not a list at all', () => {
    const divided = legacyRoom({ zones: { conf: true } } as unknown as Partial<RoomDoc>)
    const [room] = mapBuildingScene(doc([divided])).rooms

    expect(room.zones).toEqual([])
  })
})

describe('mapBuildingScene — the restroom flag', () => {
  const roomOf = (overrides: Partial<RoomDoc> = {}) =>
    mapBuildingScene(doc([legacyRoom(overrides)])).rooms[0]

  // The direction the default has to fail in: a room that quietly refused
  // furniture would be a bug report, where an unmarked restroom is a tick away.
  it('takes a room drawn before the flag existed for an ordinary room', () => {
    expect(roomOf().isRestroom).toBe(false)
  })

  it('takes a null column for an ordinary room too', () => {
    expect(roomOf({ isRestroom: null } as Partial<RoomDoc>).isRestroom).toBe(false)
  })

  it('makes a restroom of an explicit tick', () => {
    expect(roomOf({ isRestroom: true } as Partial<RoomDoc>).isRestroom).toBe(true)
  })

  /**
   * Do not "simplify" this by emptying a restroom's zones in the mapper.
   *
   * It looks like a free tidy — nothing furnishable can be in one, so why carry
   * them — and it breaks saved orders. A quote line stored against a zone whose
   * room has since been flagged would find no place to belong to, and
   * `groupByPlace` heads an orphan with its raw key: a customer's order would
   * read "office-3/z-2" where it used to read "Kitchen". Zones are refused
   * where they are written, in the editor, not where the record is read.
   */
  it('keeps the zones a restroom was drawn with', () => {
    const zones = [
      { key: 'z-1', name: 'A', roomType: 'office', polygon: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }] },
      { key: 'z-2', name: 'B', roomType: 'office', polygon: [{ x: 3, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 4 }] },
    ]

    const room = roomOf({ isRestroom: true, zones } as Partial<RoomDoc>)

    expect(room.isRestroom).toBe(true)
    expect(room.zones).toHaveLength(2)
  })
})
