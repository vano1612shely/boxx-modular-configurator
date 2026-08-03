import { describe, expect, it } from 'vitest'

import type { BuildingFloor, RoomZone, Vec3Tuple } from '../model/types'
import {
  containingFloor,
  findFloor,
  floorExtent,
  floorForY,
  roomsOffEveryFloor,
  roomsOnFloor,
  sortFloors,
} from './building-floors'

function floor(key: string, minY: number, maxY: number): BuildingFloor {
  return {
    key,
    name: key,
    box: { min: [-10, minY, -6], max: [10, maxY, 6] },
    floorY: minY,
  }
}

const GROUND = floor('ground', 0, 3)
const UPPER = floor('upper', 3, 6)

function roomAt(key: string, floorY: number): RoomZone {
  return { key, shell: { floorY } } as RoomZone
}

describe('sortFloors', () => {
  it('orders the storeys by height, whatever order they were authored in', () => {
    expect(sortFloors([UPPER, GROUND]).map((f) => f.key)).toEqual(['ground', 'upper'])
  })

  it('does not disturb the array it was given', () => {
    const authored = [UPPER, GROUND]
    sortFloors(authored)
    expect(authored.map((f) => f.key)).toEqual(['upper', 'ground'])
  })
})

describe('findFloor', () => {
  it('reads a null key as the whole building', () => {
    expect(findFloor([GROUND, UPPER], null)).toBeNull()
  })

  it('ignores a key no storey carries', () => {
    expect(findFloor([GROUND, UPPER], 'attic')).toBeNull()
  })
})

describe('containingFloor', () => {
  it('answers nothing for a level no storey covers', () => {
    expect(containingFloor([floor('a', 0, 3), floor('b', 4, 7)], 3.5)).toBeNull()
  })

  // The editor holds the storeys in authoring order, the client in height
  // order; both have to derive the same room assignment.
  it('picks the highest match, whatever order the storeys arrive in', () => {
    const overlapping = [floor('low', 0, 4), floor('high', 3, 7)]
    expect(containingFloor(overlapping, 3.5)?.key).toBe('high')
    expect(containingFloor([...overlapping].reverse(), 3.5)?.key).toBe('high')
  })
})

describe('roomsOffEveryFloor', () => {
  it('has nothing to report while the building has no storeys', () => {
    expect(roomsOffEveryFloor([roomAt('lobby', 0)], [])).toEqual([])
  })

  it('names the rooms whose level lands in no storey at all', () => {
    const floors = [floor('a', 0, 3), floor('b', 4, 7)]
    const rooms = [roomAt('lobby', 0), roomAt('attic', 3.5), roomAt('office', 4)]
    expect(roomsOffEveryFloor(rooms, floors).map((r) => r.key)).toEqual(['attic'])
  })
})

describe('floorForY', () => {
  const floors = [GROUND, UPPER]

  it('has nothing to answer for a single-storey building', () => {
    expect(floorForY([], 0)).toBeNull()
  })

  it('places a level inside a storey', () => {
    expect(floorForY(floors, 1.2)?.key).toBe('ground')
    expect(floorForY(floors, 4)?.key).toBe('upper')
  })

  // floorY is the top of the room's floor slab, so a room on the shared plane
  // stands on the upper storey rather than closing off the lower one.
  it('reads a level on the shared plane as opening the storey above', () => {
    expect(floorForY(floors, 3)?.key).toBe('upper')
  })

  it('keeps a level below the building on the lowest storey', () => {
    expect(floorForY(floors, -1)?.key).toBe('ground')
  })

  it('falls back to the nearest storey when the volumes leave a gap', () => {
    const split = [floor('a', 0, 3), floor('b', 4, 7)]
    expect(floorForY(split, 3.4)?.key).toBe('a')
    expect(floorForY(split, 3.7)?.key).toBe('b')
  })
})

describe('roomsOnFloor', () => {
  const rooms = [roomAt('lobby', 0), roomAt('office', 3), roomAt('store', 0.2)]

  it('keeps every room while no storey is picked', () => {
    expect(roomsOnFloor(rooms, [GROUND, UPPER], null)).toHaveLength(3)
  })

  it('keeps only the rooms standing on the picked storey', () => {
    expect(roomsOnFloor(rooms, [GROUND, UPPER], 'ground').map((r) => r.key)).toEqual([
      'lobby',
      'store',
    ])
    expect(roomsOnFloor(rooms, [GROUND, UPPER], 'upper').map((r) => r.key)).toEqual(['office'])
  })
})

describe('floorExtent', () => {
  const building = { min: [-4, 0, -3] as Vec3Tuple, max: [4, 6, 3] as Vec3Tuple }

  it('takes its height from the storey and its ground from the building', () => {
    expect(floorExtent(UPPER, building)).toEqual({ min: [-4, 3, -3], max: [4, 6, 3] })
  })

  it('falls back to the volume while the building has not been measured', () => {
    expect(floorExtent(UPPER, null)).toEqual({ min: [-10, 3, -6], max: [10, 6, 6] })
  })

  it('keeps the building ground when the volume misses it entirely', () => {
    const offset: BuildingFloor = {
      ...UPPER,
      box: { min: [40, 3, 40], max: [60, 6, 60] },
    }
    expect(floorExtent(offset, building)).toEqual({ min: [-4, 3, -3], max: [4, 6, 3] })
  })
})
