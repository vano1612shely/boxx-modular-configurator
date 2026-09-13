import path from 'node:path'

import {
  CLASSROOMS,
  CORRIDOR_EAST as SIBLING_CORRIDOR_EAST,
  CORRIDOR_NORTH,
  CORRIDOR_SOUTH,
  CORRIDOR_WEST as SIBLING_CORRIDOR_WEST,
  EAST as SIBLING_EAST,
  NORTH,
  NORTH_ROW_INNER,
  PARTITION_2,
  SOUTH,
  SOUTH_ROW_INNER,
  eduplex6Classroom,
} from './eduplex-6-classroom'
import { OFFICE_MODULE_ROOMS, eduplex6ClassroomOffices } from './eduplex-6-classroom-offices'
import { RESTROOM_BAY_ROOMS } from './eduplex-6-classroom-restroom'
import { classroom, shiftRoom, shifted, type EduplexFaces } from './eduplex-classroom'
import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * EDUPlex "6 classroom" with restrooms and two offices — both insertions at once.
 *
 * Measured plane by plane against the other three: the restroom bay sits
 * exactly where it does in the restroom building, the office module exactly
 * where it does in the office building moved one bay east, and the eastern
 * classrooms moved east by both. Nothing in the middle is new, so the rooms
 * are borrowed from the two buildings that first had them; only the corridor
 * — one straight run with a dead-end spur into each half of each block, and
 * the fountain recess — is traced here.
 */

const DOWNLOADS = 'C:/Users/ivan/Downloads'

/** How far the rooms moved: the western ones, and the eastern ones. */
const WEST_SHIFT = -3.607
const EAST_SHIFT = 4.216
/** The office module sits one restroom bay further east than in its own building. */
const MODULE_SHIFT = 3.607

const WEST = -16.993
const EAST = Number((SIBLING_EAST + EAST_SHIFT).toFixed(3))
const CORRIDOR_WEST = Number((SIBLING_CORRIDOR_WEST + WEST_SHIFT).toFixed(3))
const CORRIDOR_EAST = Number((SIBLING_CORRIDOR_EAST + EAST_SHIFT).toFixed(3))

const FACES: EduplexFaces = {
  west: WEST,
  east: EAST,
  north: NORTH,
  south: SOUTH,
  northRowInner: NORTH_ROW_INNER,
  southRowInner: SOUTH_ROW_INNER,
}

/** The bay: its west partition, its splitting walls, and the wall it shares with the module. */
const BAY_WEST = -0.178
const BAY_SPLIT_WEST = 1.549
const BAY_SPLIT_EAST = 1.663
const BAY_EAST = 3.2
/** The module: its west face, its splitting walls, and its east partition. */
const MODULE_WEST = 3.429
const MODULE_SPLIT_SOUTH = 4.965
const MODULE_SPLIT_NORTH = 5.88
const MODULE_EAST = 7.416

function door(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width: 1.016, height: 2.185, sill: 0, at }
}

/** The sibling's classrooms, each moved with its end of the building. */
const rooms: RoomSpec[] = CLASSROOMS.map((room) =>
  classroom(FACES, shifted(room, room.x1 <= PARTITION_2[0] ? WEST_SHIFT : EAST_SHIFT)),
)

const bay: RoomSpec[] = RESTROOM_BAY_ROOMS
const officeModule: RoomSpec[] = OFFICE_MODULE_ROOMS.map((room) => shiftRoom(room, MODULE_SHIFT))

/**
 * The corridor: the straight run, the fountain recess, and four spurs — one
 * into each half of each block, each ending at the doors it serves. Traced
 * clockwise from the north-west corner.
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
    [BAY_SPLIT_WEST, -1.17],
    [BAY_SPLIT_WEST, CORRIDOR_NORTH],
    [BAY_SPLIT_EAST, CORRIDOR_NORTH],
    [BAY_SPLIT_EAST, -2.469],
    [BAY_EAST, -2.469],
    [BAY_EAST, CORRIDOR_NORTH],
    [MODULE_SPLIT_NORTH, CORRIDOR_NORTH],
    [MODULE_SPLIT_NORTH, -4.714],
    [MODULE_EAST, -4.714],
    [MODULE_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_SOUTH],
    [MODULE_SPLIT_SOUTH, CORRIDOR_SOUTH],
    [MODULE_SPLIT_SOUTH, 5.739],
    [MODULE_WEST, 5.739],
    [MODULE_WEST, CORRIDOR_SOUTH],
    [BAY_EAST, CORRIDOR_SOUTH],
    [BAY_EAST, 3.63],
    [BAY_SPLIT_EAST, 3.63],
    [BAY_SPLIT_EAST, CORRIDOR_SOUTH],
    [CORRIDOR_WEST, CORRIDOR_SOUTH],
  ],
  // The classrooms' doors from this side, and the blocks' from the spurs. The
  // entrance doors in the end walls are left out.
  openings: [
    ...rooms.map((room) => room.openings![0]).map((opening) => ({
      ...opening,
      at: [
        opening.at![0],
        opening.at![1] === NORTH_ROW_INNER ? CORRIDOR_NORTH : CORRIDOR_SOUTH,
      ] as [number, number],
    })),
    door([BAY_SPLIT_EAST, -1.904]),
    door([2.229, -2.469]),
    door([MODULE_SPLIT_NORTH, -4.148]),
    door([6.839, -4.714]),
    door([BAY_SPLIT_EAST, 2.405]),
    door([2.229, 3.63]),
    door([MODULE_SPLIT_SOUTH, 5.173]),
    door([4.007, 5.739]),
  ],
  openingModelKeys: { door: 'office-door' },
}

export const eduplex6ClassroomRestroomOffices: BuildingSpec = {
  slug: 'eduplex-6-classroom-restroom-offices',
  title: 'EDUPlex — 6 classroom, 2 offices, restrooms',
  modelTitle: 'EDUPlex 6 classroom with offices and restrooms (client asset)',
  lineSlug: 'eduplex',
  unitCount: 6,
  restroomCount: 3,
  officeCount: 2,
  // Measured off the siding: 33.15 m × 19.55 m.
  sqft: 6975,
  dimensions: "109' × 64'",
  regionCodes: ['us'],
  // Finishes, classroom door and window from the plain school; the office
  // door from the school that first had offices.
  reuseAssetsFrom: [eduplex6Classroom.slug, eduplex6ClassroomOffices.slug],

  source: {
    main: path.join(DOWNLOADS, '6classroomrestroomoffices_horizontal_cut_-_copy.glb'),
    full: path.join(DOWNLOADS, '6classroomrestroomoffices_eduplex_-_copy.glb'),
  },

  offset: [0.597, -0.914, -0.515],
  dropNodes: ['Object_5'],

  textures: [],
  openingModels: [],

  shell: eduplex6Classroom.shell,
  camera: {
    ...eduplex6Classroom.camera,
    position: { x: 24, y: 18, z: 28 },
    maxDistance: 80,
  },

  rooms: [...rooms, corridor, ...bay, ...officeModule],
}
