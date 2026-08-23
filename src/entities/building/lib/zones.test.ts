import { describe, expect, it } from 'vitest'

import { ZONE_TINTS } from '@/shared/three/scene-tokens'

import type { Room, Zone } from '../model/types'
import { clampPoseToRegion, poseInsideRegion } from './region'
import {
  acceptingFloor,
  isDivided,
  nextZoneTint,
  reachableFloor,
  zoneAccepts,
  zoneArea,
  zoneAt,
  zoneNamesJoined,
} from './zones'

function zone(overrides: Partial<Zone> & Pick<Zone, 'key' | 'polygon'>): Zone {
  return {
    name: overrides.key.toUpperCase(),
    roomType: 'office',
    areaSqFt: null,
    areaSqM: null,
    color: ZONE_TINTS[0],
    ...overrides,
  }
}

function strip(fromX: number, toX: number) {
  return [
    { x: fromX, z: 0 },
    { x: toX, z: 0 },
    { x: toX, z: 4 },
    { x: fromX, z: 4 },
  ]
}

/** 12 × 4, cut into three 4 × 4 zones: conference | office | kitchen. */
function room(zones: Zone[]): Room {
  return {
    key: 'r',
    name: 'Room',
    roomType: 'office',
    isRestroom: false,
    areaSqFt: null,
    areaSqM: null,
    floorPolygon: strip(0, 12).map((p) => ({ ...p, side: 'w1' as const })),
    zones,
    builtIns: [],
    fittedSets: [],
    shell: {
      floorY: 0,
      wallHeight: 2.5,
      wallThickness: 0.03,
      floorThickness: 0.03,
      ceilingThickness: 0.03,
      sideAxes: { w1: { x: 0, z: -1 }, w2: { x: 1, z: 0 }, w3: { x: 0, z: 1 }, w4: { x: -1, z: 0 } },
      sunDirection: null,
    },
    openings: [],
    surfaces: {} as Room['surfaces'],
    openingModels: {} as Room['openingModels'],
    cameraPreset: { position: [0, 0, 0], target: [0, 0, 0] },
  }
}

const CONFERENCE = zone({ key: 'a', roomType: 'conference', polygon: strip(0, 4) })
const OFFICE = zone({ key: 'b', roomType: 'office', polygon: strip(4, 8) })
const KITCHEN = zone({ key: 'c', roomType: 'kitchen', polygon: strip(8, 12) })

const DIVIDED = room([CONFERENCE, OFFICE, KITCHEN])
const WHOLE = room([])

const CHAIR = { width: 1, depth: 1 }

describe('isDivided', () => {
  it('is false until somebody cuts the room', () => {
    expect(isDivided(WHOLE)).toBe(false)
    expect(isDivided(DIVIDED)).toBe(true)
  })
})

describe('zoneAt', () => {
  it('names the zone a point stands in', () => {
    expect(zoneAt(DIVIDED, 2, 2)?.key).toBe('a')
    expect(zoneAt(DIVIDED, 6, 2)?.key).toBe('b')
    expect(zoneAt(DIVIDED, 10, 2)?.key).toBe('c')
  })

  it('has nothing to say about an undivided room', () => {
    expect(zoneAt(WHOLE, 2, 2)).toBeNull()
  })
})

describe('zoneArea', () => {
  it('measures the outline when nobody wrote a figure down', () => {
    expect(zoneArea(CONFERENCE, 'sqm')).toBeCloseTo(16, 6)
  })

  it('prefers a figure someone wrote down', () => {
    expect(zoneArea(zone({ ...CONFERENCE, areaSqM: 15 }), 'sqm')).toBe(15)
  })

  it('converts an authored figure rather than falling back to the trace', () => {
    expect(zoneArea(zone({ ...CONFERENCE, areaSqM: 15 }), 'sqft')).toBeCloseTo(161.46, 1)
  })
})

describe('nextZoneTint', () => {
  it('hands out one nobody has taken', () => {
    expect(nextZoneTint([])).toBe(ZONE_TINTS[0])
    expect(nextZoneTint([ZONE_TINTS[0]])).toBe(ZONE_TINTS[1])
    expect(nextZoneTint([ZONE_TINTS[1], ZONE_TINTS[0]])).toBe(ZONE_TINTS[2])
  })
})

describe('zoneNamesJoined', () => {
  it('says what the whole space is', () => {
    expect(zoneNamesJoined([CONFERENCE, KITCHEN])).toBe('A + C')
  })
})

describe('zoneAccepts', () => {
  it('lets a package with no stated rooms in anywhere', () => {
    expect(zoneAccepts(KITCHEN, [])).toBe(true)
    expect(zoneAccepts(KITCHEN, ['kitchen'])).toBe(true)
    expect(zoneAccepts(KITCHEN, ['conference'])).toBe(false)
  })
})

describe('reachableFloor', () => {
  it('is the whole room when the room is undivided', () => {
    const region = reachableFloor(WHOLE, ['office'], 6, 2)
    expect(region.polygons).toHaveLength(1)
    expect(clampPoseToRegion(10, 2, 0, CHAIR, region)).toEqual({ x: 10, z: 2 })
  })

  it('holds a kitchen-only package inside the kitchen', () => {
    const region = reachableFloor(DIVIDED, ['kitchen'], 10, 2)
    const pose = clampPoseToRegion(2, 2, 0, CHAIR, region)

    expect(pose.x).toBeGreaterThanOrEqual(8.5 - 1e-6)
    expect(poseInsideRegion(pose.x, pose.z, 0, CHAIR, region)).toBe(true)
  })

  it('lets a package at home in both halves slide across the line', () => {
    const region = reachableFloor(DIVIDED, ['conference', 'office'], 2, 2)
    expect(clampPoseToRegion(6, 2, 0, CHAIR, region)).toEqual({ x: 6, z: 2 })
  })

  // The client's rule: conference and kitchen never touch, so there is no way
  // from one to the other even for a package welcome in both.
  it('will not carry a package across a zone it may not enter', () => {
    const region = reachableFloor(DIVIDED, ['conference', 'kitchen'], 2, 2)
    const pose = clampPoseToRegion(10, 2, 0, CHAIR, region)

    expect(pose.x).toBeLessThanOrEqual(3.5 + 1e-6)
  })

  it('falls back to the room when a package belongs in none of the zones', () => {
    const region = reachableFloor(DIVIDED, ['restroom'], 6, 2)
    expect(region.polygons).toEqual([DIVIDED.floorPolygon])
  })
})

describe('acceptingFloor', () => {
  it('counts every zone the package is welcome in, reachable or not', () => {
    expect(acceptingFloor(DIVIDED, ['conference', 'kitchen']).polygons).toHaveLength(2)
  })
})
