import { describe, expect, it } from 'vitest'

import type { FittedSet, Room, RoomPart, Zone } from '../model/types'
import { fittedSetOf, fittedSetsIn, partGeometryKey, partsCentre } from './fittings'

function modelPart(key: string, x: number, z: number, url = '/a.glb'): RoomPart {
  return {
    key,
    source: 'model',
    nodePath: null,
    modelUrl: url,
    name: null,
    groupKey: null,
    position: [x, 0, z],
    yawDeg: 0,
    scale: 1,
  }
}

function nodePart(key: string, nodePath: string): RoomPart {
  return {
    key,
    source: 'node',
    nodePath,
    modelUrl: null,
    name: null,
    groupKey: null,
    position: [0, 0, 0],
    yawDeg: 0,
    scale: 1,
  }
}

function set(key: string, packageId: number, parts: RoomPart[]): FittedSet {
  return { key, packageId, parts }
}

function zone(key: string, fromX: number, toX: number): Zone {
  return {
    key,
    name: key,
    roomType: 'kitchen',
    areaSqFt: null,
    areaSqM: null,
    color: '#fff',
    polygon: [
      { x: fromX, z: 0 },
      { x: toX, z: 0 },
      { x: toX, z: 4 },
      { x: fromX, z: 4 },
    ],
  }
}

function room(fittedSets: FittedSet[], zones: Zone[] = []): Room {
  return { key: 'r', name: 'R', zones, fittedSets, builtIns: [] } as unknown as Room
}

describe('partsCentre', () => {
  it('is the mean of the parts', () => {
    expect(partsCentre([modelPart('a', 0, 0), modelPart('b', 4, 2)])).toEqual({ x: 2, z: 1 })
  })

  /**
   * The quote works out which half of a divided room a thing is in from where
   * it stands. A set that reported the origin would be quoted under whichever
   * room happens to sit at the building's origin — or under none at all.
   */
  it('answers for an empty arrangement without pretending it is somewhere', () => {
    expect(partsCentre([])).toEqual({ x: 0, z: 0 })
  })
})

describe('fittedSetOf', () => {
  const kitchen = set('s-1', 7, [modelPart('a', 1, 1)])

  it('finds the arrangement a placement stands for', () => {
    expect(fittedSetOf(room([kitchen]), 7)).toBe(kitchen)
  })

  // The whole reason nothing had to be added to an order: a line names a
  // package and a room, and that pair is the question this answers.
  it('answers nothing for an ordinary package', () => {
    expect(fittedSetOf(room([kitchen]), 8)).toBeNull()
  })

  it('answers nothing in a room nobody fitted out', () => {
    expect(fittedSetOf(room([]), 7)).toBeNull()
  })

  // One open room with a kitchen at each end offers the same package twice;
  // the placement stands where it was put from, and that says which.
  it('tells two arrangements of one package apart by where the placement stands', () => {
    const west = set('s-1', 7, [modelPart('a', 1, 1)])
    const east = set('s-2', 7, [modelPart('b', 9, 1)])
    const both = room([west, east])
    expect(fittedSetOf(both, 7, { x: 8.5, z: 1 })).toBe(east)
    expect(fittedSetOf(both, 7, { x: 2, z: 1 })).toBe(west)
    expect(fittedSetOf(both, 7)).toBe(west)
  })
})

describe('fittedSetsIn', () => {
  const west = set('s-1', 1, [modelPart('a', 1, 2)])
  const east = set('s-2', 2, [modelPart('b', 9, 2)])
  const divided = room([west, east], [zone('z-1', 0, 5), zone('z-2', 5, 10)])

  it('offers every arrangement when the whole room is on show', () => {
    expect(fittedSetsIn(divided, null)).toEqual([west, east])
  })

  // A kitchen arranged along the kitchen end is not on offer from the
  // conference end: they are two places, and the panel is showing one of them.
  it('offers a divided room only what stands in the half being looked at', () => {
    expect(fittedSetsIn(divided, divided.zones[0])).toEqual([west])
    expect(fittedSetsIn(divided, divided.zones[1])).toEqual([east])
  })
})

describe('partGeometryKey', () => {
  it('names a library model by its file', () => {
    expect(partGeometryKey(modelPart('a', 0, 0, '/fridge.glb'), '/b.glb')).toBe('/fridge.glb')
  })

  // A path is a chain of child indexes, so it means nothing without the file it
  // indexes into — two buildings both have a "47/0" and they are not the same
  // thing.
  it('names a piece of the building by the building as well as the path', () => {
    expect(partGeometryKey(nodePart('a', '47/0'), '/boxx.glb')).toBe('/boxx.glb#47/0')
  })

  // Nine fittings imported out of one kitchen name one file between them, and a
  // key that stopped at the file made them one shape to everything downstream.
  it('tells two pieces of the same model apart', () => {
    const fridge = { ...modelPart('a', 0, 0, '/kitchen.glb'), nodePath: '3' }
    const microwave = { ...modelPart('b', 0, 0, '/kitchen.glb'), nodePath: '5' }

    expect(partGeometryKey(fridge, '/boxx.glb')).toBe('/kitchen.glb#3')
    expect(partGeometryKey(microwave, '/boxx.glb')).toBe('/kitchen.glb#5')
    expect(partGeometryKey(fridge, '/boxx.glb')).not.toBe(partGeometryKey(microwave, '/boxx.glb'))
  })
})
