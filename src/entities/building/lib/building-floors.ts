import type { BuildingFloor, Room, Vec3Tuple } from '../model/types'

/** Metres of slack on a storey boundary, so a slab sitting on it counts as in. */
const EDGE = 1e-4

/** Ascending by height, so the client can number the storeys itself. */
export function sortFloors(floors: BuildingFloor[]): BuildingFloor[] {
  return [...floors].sort((a, b) => a.box.min[1] - b.box.min[1])
}

export function findFloor(floors: BuildingFloor[], key: string | null): BuildingFloor | null {
  if (key === null) return null
  return floors.find((floor) => floor.key === key) ?? null
}

/** How far `y` sits outside a storey's range; 0 while it is inside. */
function distanceToFloor(floor: BuildingFloor, y: number): number {
  const [, minY] = floor.box.min
  const [, maxY] = floor.box.max
  if (y < minY) return minY - y
  if (y > maxY) return y - maxY
  return 0
}

/** The storey whose volume the level actually falls in, if any does. */
export function containingFloor(floors: BuildingFloor[], y: number): BuildingFloor | null {
  let match: BuildingFloor | null = null

  // Highest wins rather than last, so the answer does not depend on the order
  // the storeys were authored in — the editor holds them unsorted.
  for (const floor of floors) {
    if (y < floor.box.min[1] - EDGE || y >= floor.box.max[1]) continue
    if (!match || floor.box.min[1] > match.box.min[1]) match = floor
  }

  return match
}

/**
 * Which storey a walkable level belongs to.
 *
 * A room's floorY is the TOP of its floor slab, which is normally where the
 * storey it belongs to begins — so a level sitting on a boundary is read as
 * opening the storey above it, not as closing the one below. Levels that land
 * in no storey at all (a volume drawn with a gap, a room whose level was never
 * set) fall back to the nearest one: a room that shows nowhere is worse than a
 * room that shows on the storey next to its own, and the editor flags them.
 */
export function floorForY(floors: BuildingFloor[], y: number): BuildingFloor | null {
  if (floors.length === 0) return null

  const match = containingFloor(floors, y)
  if (match) return match

  return floors.reduce((nearest, floor) =>
    distanceToFloor(floor, y) < distanceToFloor(nearest, y) ? floor : nearest,
  )
}

/**
 * Rooms whose level falls in no storey at all.
 *
 * The derivation is otherwise unfalsifiable: every room is assigned to
 * something, so a storey volume dragged a few centimetres off would quietly
 * move a whole floor's worth of rooms downstairs. These are what the editor
 * shows the admin.
 */
export function roomsOffEveryFloor(rooms: Room[], floors: BuildingFloor[]): Room[] {
  if (floors.length === 0) return []
  return rooms.filter((room) => containingFloor(floors, room.shell.floorY) === null)
}

/** The rooms a visitor may still reach; every room while no storey is picked. */
export function roomsOnFloor(
  rooms: Room[],
  floors: BuildingFloor[],
  floorKey: string | null,
): Room[] {
  const floor = findFloor(floors, floorKey)
  if (!floor) return rooms
  return rooms.filter((room) => floorForY(floors, room.shell.floorY)?.key === floor.key)
}

export type FloorExtent = { min: Vec3Tuple; max: Vec3Tuple }

/** Overlap of two ranges, or the building's own when the volume misses it. */
function overlap(min: number, max: number, fromMin: number, fromMax: number): [number, number] {
  const lo = Math.max(min, fromMin)
  const hi = Math.min(max, fromMax)
  return hi > lo ? [lo, hi] : [min, max]
}

/**
 * What the camera should frame for a storey: its own height, but only as much
 * ground as the building actually covers. A storey volume is drawn generously
 * wide so that nothing at its edges is clipped, and framing that width would
 * stand the camera off further than the building itself ever needs.
 */
export function floorExtent(floor: BuildingFloor, building: FloorExtent | null): FloorExtent {
  const minY = floor.box.min[1]
  const maxY = floor.box.max[1]

  if (!building) {
    return {
      min: [floor.box.min[0], minY, floor.box.min[2]],
      max: [floor.box.max[0], maxY, floor.box.max[2]],
    }
  }

  const [minX, maxX] = overlap(building.min[0], building.max[0], floor.box.min[0], floor.box.max[0])
  const [minZ, maxZ] = overlap(building.min[2], building.max[2], floor.box.min[2], floor.box.max[2])

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
}
