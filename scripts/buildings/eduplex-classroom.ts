import type { OpeningSpec, RoomSpec } from './types'

/**
 * The EDUPlex classroom, written once.
 *
 * Every EDUPlex size is two rows of classrooms with a corridor between them,
 * and every classroom is the same shape: a mechanical chase on its exterior
 * wall behind the wall-hung HVAC, a window bay beside it at the wall's own
 * face, one pilaster on its corridor wall, one door to the corridor. Only the
 * faces change from room to room, so each supplies its own and the outline
 * is traced here.
 */

/** Faces a building shares among all its classrooms. */
export type EduplexFaces = {
  /** Inner faces of the four exterior walls. */
  west: number
  east: number
  north: number
  south: number
  /** The classroom-side faces of the two corridor walls. */
  northRowInner: number
  southRowInner: number
}

/** How far the corridor-wall pilasters stand into a room. */
export const PILASTER_DEPTH = 0.127

/**
 * Doors and windows, sized to the outside of the frame: the hole is stretched
 * to the model, so a hole the size of the leaf would make a leaf-sized door.
 * Door 0.99 × 2.07 to the casing; window 0.95 × 1.56 to the casing, its
 * bottom 0.54 above the floor. Placed by point, so the wall is found rather
 * than guessed — `side` here is a placeholder the importer overwrites.
 */
export function door(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width: 0.991, height: 2.071, sill: 0, at }
}

export function window(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'window', centre: at[0], width: 0.95, height: 1.563, sill: 0.541, at }
}

export type Classroom = {
  number: number
  row: 'north' | 'south'
  /** West and east inner faces — an exterior wall or a partition. */
  x0: number
  x1: number
  /** The chase along the exterior wall: its room-facing face and the span it covers. */
  chaseFace: number
  chase: [number, number]
  /** The pilaster on the corridor wall, by its two flanks. */
  pilaster: [number, number]
  /** Door centre along the corridor wall. */
  door: number
  /** Window centres along the exterior wall, in its bay. */
  windows: number[]
  /** Windows in the end wall, for the corner rooms: which wall, and where along it. */
  endWindows?: { wall: 'west' | 'east'; at: number[] }
}

/**
 * One classroom, traced clockwise from its north-west corner.
 *
 * The chase is treated as wall — the room's face is its front — and the window
 * bay beside it as room: a recess that closes again is floor you can stand on,
 * and one left out of the outline reads as a corner the room ignores. The
 * pilaster is a notch the other way, into the room.
 */
export function classroom(faces: EduplexFaces, room: Classroom): RoomSpec {
  const { x0, x1, chaseFace, chase, pilaster } = room
  const [chaseFrom, chaseTo] = chase
  const [pilasterFrom, pilasterTo] = pilaster

  const polygon: Array<[number, number]> =
    room.row === 'north'
      ? [
          // The chase runs from the west partition; the bay takes the rest.
          [x0, chaseFace],
          [chaseTo, chaseFace],
          [chaseTo, faces.north],
          [x1, faces.north],
          [x1, faces.northRowInner],
          [pilasterTo, faces.northRowInner],
          [pilasterTo, faces.northRowInner - PILASTER_DEPTH],
          [pilasterFrom, faces.northRowInner - PILASTER_DEPTH],
          [pilasterFrom, faces.northRowInner],
          [x0, faces.northRowInner],
        ]
      : [
          // Mirrored: the bay runs from the west, the chase to the east partition.
          [x0, faces.southRowInner],
          [pilasterFrom, faces.southRowInner],
          [pilasterFrom, faces.southRowInner + PILASTER_DEPTH],
          [pilasterTo, faces.southRowInner + PILASTER_DEPTH],
          [pilasterTo, faces.southRowInner],
          [x1, faces.southRowInner],
          [x1, chaseFace],
          [chaseFrom, chaseFace],
          [chaseFrom, faces.south],
          [x0, faces.south],
        ]

  const corridorWall = room.row === 'north' ? faces.northRowInner : faces.southRowInner
  const exteriorWall = room.row === 'north' ? faces.north : faces.south
  const endWall = room.endWindows?.wall === 'west' ? faces.west : faces.east

  return {
    key: `classroom-${room.number}`,
    name: `Classroom ${room.number}`,
    roomTypeSlug: 'classroom',
    polygon,
    openings: [
      door([room.door, corridorWall]),
      ...room.windows.map((x) => window([x, exteriorWall])),
      ...(room.endWindows?.at ?? []).map((z) => window([endWall, z])),
    ],
  }
}

/**
 * The same classroom, moved along the building by `dx`.
 *
 * A sibling size is this building with a bay inserted somewhere along the
 * corridor: every room west of the insertion keeps its shape to the millimetre
 * and moves by the bay's width, every room east of it stays put. Measured, not
 * assumed — the agents that measured the first sibling checked it plane by
 * plane — and it is what lets a sibling be four numbers instead of forty.
 */
export function shifted(room: Classroom, dx: number): Classroom {
  const move = (x: number) => Number((x + dx).toFixed(3))
  return {
    ...room,
    x0: move(room.x0),
    x1: move(room.x1),
    chase: [move(room.chase[0]), move(room.chase[1])],
    pilaster: [move(room.pilaster[0]), move(room.pilaster[1])],
    door: move(room.door),
    windows: room.windows.map(move),
  }
}

/**
 * A finished room moved along the building by `dx` — outline and openings
 * alike. For the rooms of an inserted module, which the next size up carries
 * whole at a different place along the corridor.
 */
export function shiftRoom(room: RoomSpec, dx: number): RoomSpec {
  const move = (x: number) => Number((x + dx).toFixed(3))
  return {
    ...room,
    rect: room.rect ? { ...room.rect, x0: move(room.rect.x0), x1: move(room.rect.x1) } : undefined,
    polygon: room.polygon?.map(([x, z]) => [move(x), z] as [number, number]),
    zones: room.zones?.map((zone) => ({
      ...zone,
      rect: { ...zone.rect, x0: move(zone.rect.x0), x1: move(zone.rect.x1) },
    })),
    openings: room.openings?.map((opening) => ({
      ...opening,
      centre: opening.side === 'w1' || opening.side === 'w3' ? move(opening.centre) : opening.centre,
      at: opening.at ? ([move(opening.at[0]), opening.at[1]] as [number, number]) : undefined,
    })),
  }
}
