import path from 'node:path'

import {
  CLASSROOMS,
  CORRIDOR_EAST,
  CORRIDOR_NORTH,
  CORRIDOR_SOUTH,
  CORRIDOR_WEST as SIBLING_CORRIDOR_WEST,
  EAST,
  NORTH,
  NORTH_ROW_INNER,
  PARTITION_2,
  SOUTH,
  SOUTH_ROW_INNER,
  eduplex6Classroom,
} from './eduplex-6-classroom'
import { classroom, shifted, type EduplexFaces } from './eduplex-classroom'
import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * EDUPlex "6 classroom" with restrooms — the same school with a bay put in.
 *
 * Measured against the plain six-classroom building plane by plane: a 3.607 m
 * bay was inserted between the middle classrooms and the eastern pair, and
 * everything west of it moved west by exactly that, everything east of it
 * stayed where it was, to the millimetre. So the classrooms are the sibling's,
 * four of them shifted; only the bay is new. It holds two restrooms with
 * stalls, a single one for staff, and a fourth small room that is empty in the
 * model and unnamed on the client's plan — offered as somewhere to look at,
 * not somewhere to furnish, until they say what it is.
 *
 * Which restroom is which is read off the fittings: urinals make the men's.
 */

const DOWNLOADS = 'C:/Users/ivan/Downloads'

/** The bay's width, which is also how far the western rooms moved. */
const BAY = 3.607

const WEST = -16.993
const CORRIDOR_WEST = Number((SIBLING_CORRIDOR_WEST - BAY).toFixed(3))

const FACES: EduplexFaces = {
  west: WEST,
  east: EAST,
  north: NORTH,
  south: SOUTH,
  northRowInner: NORTH_ROW_INNER,
  southRowInner: SOUTH_ROW_INNER,
}

/**
 * The bay: the new partition on its west, the old second partition on its
 * east. The big restrooms' west face is a furring layer in front of the
 * partition; the small rooms sit on the partition itself.
 */
export const BAY_WEST = -0.178
const BAY_WEST_FURRED = -0.124
export const BAY_EAST = 3.2
/** The wall down the middle of each half of the bay: small room | vestibule. */
export const SPLIT_WEST = 1.549
export const SPLIT_EAST = 1.663
/** How far the vestibules and the fountain recess reach off the corridor, and the doors in them. */
export const BAY_CORRIDOR = {
  fountainBack: -1.17,
  northVestibuleEnd: -2.469,
  southVestibuleEnd: 3.63,
  doors: [
    [SPLIT_EAST, -1.904],
    [2.229, -2.469],
    [SPLIT_EAST, 2.405],
    [2.229, 3.63],
  ] as Array<[number, number]>,
}

/** Restroom doors are wider and taller than the classrooms', 1.02 × 2.19 to the casing. */
export function restroomDoor(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width: 1.016, height: 2.185, sill: 0, at }
}

/** The sibling's classrooms, the western four moved along with the west wall. */
const rooms: RoomSpec[] = CLASSROOMS.map((room) =>
  classroom(FACES, room.x1 <= PARTITION_2[0] ? shifted(room, -BAY) : room),
)

/**
 * Men's, on the north side of the corridor. An L: the room proper, and a leg
 * beside the closet that reaches the vestibule wall its door is in. Its north
 * face is the front of a mechanical chase, like the classrooms'.
 */
const mensRestroom: RoomSpec = {
  key: 'mens-restroom',
  name: "Men's Restroom",
  roomTypeSlug: 'restroom',
  isRestroom: true,
  polygon: [
    [BAY_WEST_FURRED, -8.739],
    [BAY_EAST, -8.739],
    [BAY_EAST, -2.583],
    [SPLIT_EAST, -2.583],
    [SPLIT_EAST, -3.393],
    [BAY_WEST_FURRED, -3.393],
  ],
  openings: [restroomDoor([2.229, -2.583])],
}

/** Women's, on the south side, the mirror of the men's without the chase. */
const womensRestroom: RoomSpec = {
  key: 'womens-restroom',
  name: "Women's Restroom",
  roomTypeSlug: 'restroom',
  isRestroom: true,
  polygon: [
    [SPLIT_EAST, 3.745],
    [BAY_EAST, 3.745],
    [BAY_EAST, SOUTH],
    [BAY_WEST_FURRED, SOUTH],
    [BAY_WEST_FURRED, 4.773],
    [SPLIT_EAST, 4.773],
  ],
  openings: [restroomDoor([2.229, 3.745])],
}

/** The empty room beside the men's, entered from the north vestibule. */
const closet: RoomSpec = {
  key: 'closet',
  name: 'Closet',
  roomTypeSlug: 'other',
  isRestroom: true,
  rect: { x0: BAY_WEST, x1: SPLIT_WEST, z0: -3.224, z1: -1.338 },
  openings: [restroomDoor([SPLIT_WEST, -1.904])],
}

/** Single-user, beside the women's, entered from the south vestibule. */
const staffRestroom: RoomSpec = {
  key: 'faculty-staff-restroom',
  name: 'Faculty & Staff Restroom',
  roomTypeSlug: 'restroom',
  isRestroom: true,
  rect: { x0: BAY_WEST, x1: SPLIT_WEST, z0: SOUTH_ROW_INNER, z1: 4.659 },
  openings: [restroomDoor([SPLIT_WEST, 2.405])],
}

/**
 * The corridor, with what the bay adds to it: a recess for the drinking
 * fountains on its north side, and a vestibule into each half of the bay —
 * dead ends the restroom doors open off, so they are notches of the corridor
 * rather than rooms. Traced clockwise from the north-west corner.
 */
const corridor: RoomSpec = {
  key: 'corridor',
  name: 'Corridor',
  roomTypeSlug: 'hallway',
  isRestroom: true,
  polygon: [
    [CORRIDOR_WEST, CORRIDOR_NORTH],
    [BAY_WEST, CORRIDOR_NORTH],
    [BAY_WEST, -1.17],
    [SPLIT_WEST, -1.17],
    [SPLIT_WEST, CORRIDOR_NORTH],
    [SPLIT_EAST, CORRIDOR_NORTH],
    [SPLIT_EAST, -2.469],
    [BAY_EAST, -2.469],
    [BAY_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_SOUTH],
    [BAY_EAST, CORRIDOR_SOUTH],
    [BAY_EAST, 3.63],
    [SPLIT_EAST, 3.63],
    [SPLIT_EAST, CORRIDOR_SOUTH],
    [CORRIDOR_WEST, CORRIDOR_SOUTH],
  ],
  // The classrooms' doors from this side, and the bay's from theirs. The
  // entrance doors in the end walls are left out.
  openings: [
    ...rooms.map((room) => room.openings![0]).map((opening) => ({
      ...opening,
      at: [
        opening.at![0],
        opening.at![1] === NORTH_ROW_INNER ? CORRIDOR_NORTH : CORRIDOR_SOUTH,
      ] as [number, number],
    })),
    restroomDoor([2.229, -2.469]),
    restroomDoor([SPLIT_EAST, -1.904]),
    restroomDoor([SPLIT_EAST, 2.405]),
    restroomDoor([2.229, 3.63]),
  ],
}

/** The bay's rooms, for the size that has this bay and the office module both. */
export const RESTROOM_BAY_ROOMS: RoomSpec[] = [mensRestroom, closet, womensRestroom, staffRestroom]

export const eduplex6ClassroomRestroom: BuildingSpec = {
  slug: 'eduplex-6-classroom-restroom',
  title: 'EDUPlex — 6 classroom, restrooms',
  modelTitle: 'EDUPlex 6 classroom with restrooms (client asset)',
  lineSlug: 'eduplex',
  unitCount: 6,
  restroomCount: 3,
  // Measured off the siding: 28.94 m × 19.55 m.
  sqft: 6088,
  dimensions: "95' × 64'",
  regionCodes: ['us'],
  reuseAssetsFrom: eduplex6Classroom.slug,

  source: {
    main: path.join(DOWNLOADS, '6classroomrestroom_horizontal_cut_-_copy.glb'),
    full: path.join(DOWNLOADS, '6classroomrestroom_eduplex_-_copy.glb'),
  },

  offset: [2.705, -0.914, -0.515],
  dropNodes: ['Object_5'],

  textures: [],
  openingModels: [],

  shell: eduplex6Classroom.shell,
  camera: {
    ...eduplex6Classroom.camera,
    position: { x: 22, y: 16, z: 26 },
    maxDistance: 75,
  },

  rooms: [...rooms, corridor, mensRestroom, closet, womensRestroom, staffRestroom],
}
