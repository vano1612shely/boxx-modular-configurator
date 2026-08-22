import { describe, expect, it } from 'vitest'

import type { Room, Zone } from '@/entities/building'

import { roomMarkers } from './room-markers'

/** A rectangle of floor, given as an outline. */
function box(fromX: number, toX: number, fromZ = 0, toZ = 4) {
  return [
    { x: fromX, z: fromZ },
    { x: toX, z: fromZ },
    { x: toX, z: toZ },
    { x: fromX, z: toZ },
  ]
}

function zone(key: string, fromX: number, toX: number): Zone {
  return {
    key,
    name: key.toUpperCase(),
    roomType: 'office',
    areaSqFt: null,
    areaSqM: null,
    color: '#fff',
    polygon: box(fromX, toX),
  } as Zone
}

function room(overrides: Partial<Room> & Pick<Room, 'key' | 'name'>): Room {
  return {
    isRestroom: false,
    zones: [],
    floorPolygon: box(0, 12).map((p) => ({ ...p, side: 'w1' as const })),
    ...overrides,
  } as Room
}

describe('roomMarkers', () => {
  it('gives an undivided room one marker, over the middle of it', () => {
    const only = room({ key: 'r1', name: 'Office' })

    expect(roomMarkers([only])).toEqual([
      { key: 'r1', room: only, zone: null, name: 'Office', at: { x: 6, z: 2 }, entry: 'focus' },
    ])
  })

  /**
   * The whole feature. A conference-and-restroom is two places to be, with two
   * uses and two catalogues, and one marker in the middle of both could only
   * name one of them — or the room, and then land the visitor in a mode that
   * was neither half.
   */
  it('gives a divided room one marker per zone, each over its own half', () => {
    const divided = room({
      key: 'r2',
      name: 'Conference + Kitchen',
      zones: [zone('z1', 0, 6), zone('z2', 6, 12)],
    })

    expect(roomMarkers([divided]).map((m) => ({ key: m.key, name: m.name, x: m.at.x }))).toEqual([
      { key: 'r2/z1', name: 'Z1', x: 3 },
      { key: 'r2/z2', name: 'Z2', x: 9 },
    ])
  })

  // The room is still what is entered — the zone only says which half is picked
  // on arrival, and it is the room's key every consumer of focus is keyed on.
  it('carries the room and the zone the marker stands for', () => {
    const divided = room({ key: 'r2', name: 'Split', zones: [zone('z1', 0, 6), zone('z2', 6, 12)] })
    const [first] = roomMarkers([divided])

    expect(first.room).toBe(divided)
    expect(first.zone).toBe(divided.zones[0])
    expect(first.entry).toBe('focus')
  })

  // Nothing is furnished in a restroom, so it is never gone into and its halves
  // — should some old record have any — would offer a way in that does not exist.
  it('leaves a restroom one marker whatever is drawn inside it', () => {
    const loo = room({ key: 'r3', name: 'WC', isRestroom: true, zones: [zone('z1', 0, 6)] })

    expect(roomMarkers([loo])).toMatchObject([{ key: 'r3', name: 'WC', zone: null, entry: 'preview' }])
  })

  it('keeps every marker in the building tellable apart', () => {
    const markers = roomMarkers([
      room({ key: 'r1', name: 'Office' }),
      room({ key: 'r2', name: 'Split', zones: [zone('z1', 0, 6), zone('z2', 6, 12)] }),
      // Zone keys are unique within their own room and nowhere else, so two
      // rooms cut the same way both hold a "z1".
      room({ key: 'r3', name: 'Also split', zones: [zone('z1', 0, 6), zone('z2', 6, 12)] }),
    ])

    expect(new Set(markers.map((m) => m.key)).size).toBe(markers.length)
  })
})
