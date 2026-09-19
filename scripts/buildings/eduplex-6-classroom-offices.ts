import path from 'node:path'

import { SOURCES } from '../lib/import-tools'

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
import { classroom, shifted, type EduplexFaces } from './eduplex-classroom'
import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * EDUPlex "6 classroom" with two offices — the school with a module put in.
 *
 * A 4.217 m module was inserted between the middle classrooms and the eastern
 * pair, and the building re-centred on it: everything west of the module
 * moved 3.607 m west, everything east of it 0.610 m east, each to the
 * millimetre. So the classrooms are the sibling's, all six shifted; only the
 * module is new. It holds an office on each side of the corridor, a kitchen
 * beside the northern one, a windowless store beside the southern one, and a
 * passage on each side that the corridor branches into — a staggered cross.
 *
 * Its offices, kitchen and store have a different door from the classrooms:
 * plain, taller, no vision lite and no closer. It is cut here and the rooms
 * that use it say so.
 */


/** How far the rooms moved: the western ones, and the eastern ones. */
const WEST_SHIFT = -3.607
const EAST_SHIFT = 0.61

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

/** The module: the sibling's second partition on its west, a new one on its east. */
export const MODULE_WEST = -0.178
export const MODULE_EAST = 3.81
/** The passages the corridor branches into, and the doors off them. */
export const MODULE_CORRIDOR = {
  northPassage: [2.273, MODULE_EAST] as [number, number],
  northPassageEnd: -4.714,
  southPassage: [MODULE_WEST, 1.359] as [number, number],
  southPassageEnd: 5.739,
  doors: [
    [3.232, -4.714],
    [2.273, -4.148],
    [1.359, 5.173],
    [0.4, 5.739],
  ] as Array<[number, number]>,
}

/** The office door: 1.02 × 2.19 to the casing, a taller leaf than the classrooms'. */
export function officeDoor(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width: 1.016, height: 2.185, sill: 0, at }
}

function window(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'window', centre: at[0], width: 0.95, height: 1.563, sill: 0.541, at }
}

const OFFICE_DOOR = { door: 'office-door' }

/** The sibling's classrooms, each moved with its end of the building. */
const rooms: RoomSpec[] = CLASSROOMS.map((room) =>
  classroom(FACES, shifted(room, room.x1 <= PARTITION_2[0] ? WEST_SHIFT : EAST_SHIFT)),
)

/**
 * The northern office. A chase on its exterior wall like the classrooms have,
 * with a short bay beside it holding its one window; its door opens south
 * into the passage.
 */
const office1: RoomSpec = {
  key: 'office-1',
  name: 'Office 1',
  roomTypeSlug: 'office',
  polygon: [
    [MODULE_WEST, -8.739],
    [2.571, -8.739],
    [2.571, NORTH],
    [MODULE_EAST, NORTH],
    [MODULE_EAST, -4.828],
    [MODULE_WEST, -4.828],
  ],
  openings: [officeDoor([3.232, -4.828]), window([3.189, NORTH])],
  openingModelKeys: OFFICE_DOOR,
}

/**
 * The kitchen, between the northern office and the corridor, entered from the
 * passage through its east wall. Its counter, cabinets and sink are modelled
 * into the building and named here to be drawn back once inside.
 */
const kitchen: RoomSpec = {
  key: 'kitchen',
  name: 'Kitchen',
  roomTypeSlug: 'kitchen',
  rect: { x0: MODULE_WEST, x1: 2.159, z0: -4.714, z1: NORTH_ROW_INNER },
  openings: [officeDoor([2.159, -4.148])],
  openingModelKeys: OFFICE_DOOR,
  builtInMaterials: ['adskMatkitchen_box', 'adskMatkitchen_Plaine', 'Material__622', 'Material__641'],
}

/**
 * A windowless, empty room beside the southern office, entered from the south
 * passage. The client's plan does not name it; it is offered as somewhere to
 * look at, not somewhere to furnish, until they say what it is.
 */
const store: RoomSpec = {
  key: 'storage',
  name: 'Storage',
  roomTypeSlug: 'other',
  isRestroom: true,
  rect: { x0: 1.473, x1: MODULE_EAST, z0: SOUTH_ROW_INNER, z1: 5.739 },
  openings: [officeDoor([1.473, 5.173])],
  openingModelKeys: OFFICE_DOOR,
}

/** The southern office: a plain rectangle with two windows in the exterior wall. */
const office2: RoomSpec = {
  key: 'office-2',
  name: 'Office 2',
  roomTypeSlug: 'office',
  rect: { x0: MODULE_WEST, x1: MODULE_EAST, z0: 5.853, z1: SOUTH },
  openings: [officeDoor([0.4, 5.853]), window([0.735, SOUTH]), window([2.894, SOUTH])],
  openingModelKeys: OFFICE_DOOR,
}

/**
 * The corridor, with the two passages it branches into: north beside the
 * kitchen to the northern office, south beside the store to the southern one.
 * Neither has a wall or a header at its mouth, so they are the corridor's own
 * arms. Traced clockwise from the north-west corner.
 */
const corridor: RoomSpec = {
  key: 'corridor',
  name: 'Corridor',
  roomTypeSlug: 'hallway',
  isRestroom: true,
  polygon: [
    [CORRIDOR_WEST, CORRIDOR_NORTH],
    [2.273, CORRIDOR_NORTH],
    [2.273, -4.714],
    [MODULE_EAST, -4.714],
    [MODULE_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_NORTH],
    [CORRIDOR_EAST, CORRIDOR_SOUTH],
    [1.359, CORRIDOR_SOUTH],
    [1.359, 5.739],
    [MODULE_WEST, 5.739],
    [MODULE_WEST, CORRIDOR_SOUTH],
    [CORRIDOR_WEST, CORRIDOR_SOUTH],
  ],
  // The classrooms' doors from this side, and the module's from the passages.
  // The entrance doors in the end walls are left out.
  openings: [
    ...rooms.map((room) => room.openings![0]).map((opening) => ({
      ...opening,
      at: [
        opening.at![0],
        opening.at![1] === NORTH_ROW_INNER ? CORRIDOR_NORTH : CORRIDOR_SOUTH,
      ] as [number, number],
    })),
    officeDoor([3.232, -4.714]),
    officeDoor([2.273, -4.148]),
    officeDoor([1.359, 5.173]),
    officeDoor([0.4, 5.739]),
  ],
  openingModelKeys: OFFICE_DOOR,
}

/** The module's rooms, for the size that has this module and the restroom bay both. */
export const OFFICE_MODULE_ROOMS: RoomSpec[] = [office1, kitchen, store, office2]

export const eduplex6ClassroomOffices: BuildingSpec = {
  slug: 'eduplex-6-classroom-offices',
  title: 'EDUPlex — 6 classroom, 2 offices',
  modelTitle: 'EDUPlex 6 classroom with offices (client asset)',
  lineSlug: 'eduplex',
  unitCount: 6,
  restroomCount: 0,
  officeCount: 2,
  // Measured off the siding: 29.55 m × 19.54 m.
  sqft: 6216,
  dimensions: "97' × 64'",
  regionCodes: ['us'],
  reuseAssetsFrom: eduplex6Classroom.slug,

  source: {
    main: path.join(SOURCES, '6classroomoffices_horizontal_cut_-_copy.glb'),
    full: path.join(SOURCES, '6classroomoffices_eduplex_-_copy.glb'),
  },

  offset: [2.401, -0.914, -0.515],
  dropNodes: ['Object_5'],

  textures: [],
  openingModels: [
    {
      // The northern office's door, in the wall between the office (on its −Z
      // side) and the passage (+Z). Three materials: the casing, the leaf —
      // flush with the office's face of the wall — and the lever. No lite, no
      // closer; the baseboard through the opening and the wall's reveals stay
      // behind. The viewer points +Z out of the room, and out of the office is
      // +Z here already, so the office gets the flat leaf without turning.
      kind: 'door',
      key: 'office-door',
      from: 'main',
      materials: ['door_frame', 'Basic_Wall_Interior_inside', 'metal_chrome'],
      region: { min: [2.71, 0.9, -4.905], max: [3.755, 3.115, -4.685] },
      // The client's number for these doors, unlike the classrooms' 0.005.
      intoWall: -0.015,
    },
  ],

  shell: eduplex6Classroom.shell,
  camera: {
    ...eduplex6Classroom.camera,
    position: { x: 22, y: 16, z: 26 },
    maxDistance: 75,
  },

  rooms: [...rooms, corridor, office1, kitchen, store, office2],
}
