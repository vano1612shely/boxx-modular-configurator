import path from 'node:path'

import {
  CLASSROOMS,
  CORRIDOR_EAST,
  CORRIDOR_NORTH,
  CORRIDOR_SOUTH,
  CORRIDOR_WEST,
  EAST as BASE_EAST,
  NORTH,
  NORTH_ROW_INNER,
  SOUTH,
  SOUTH_ROW_INNER,
  WEST as BASE_WEST,
  eduplex6Classroom,
} from './eduplex-6-classroom'
import {
  MODULE_CORRIDOR,
  OFFICE_MODULE_ROOMS,
  eduplex6ClassroomOffices,
  officeDoor,
} from './eduplex-6-classroom-offices'
import {
  BAY_CORRIDOR,
  BAY_EAST,
  BAY_WEST,
  RESTROOM_BAY_ROOMS,
  SPLIT_EAST,
  SPLIT_WEST,
  restroomDoor,
} from './eduplex-6-classroom-restroom'
import { classroom, shiftRoom, shifted, type Classroom, type EduplexFaces } from './eduplex-classroom'
import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * An EDUPlex school of any size, assembled from the pieces the first four
 * were measured as.
 *
 * Every size the client has sent is the same building: two rows of
 * classrooms with a corridor between, and up to two blocks put in along it —
 * a restroom bay, an office module — each identical to the millimetre wherever
 * it appears, only standing at a different x. So a size is a list of
 * classrooms (the base school's, each moved to where it stands here), the
 * position of each block it has, and the ends of its corridor. The corridor is
 * the one room traced fresh, from those positions: a straight run with a
 * recess and dead-end spurs wherever a block puts them.
 *
 * Nothing here is measured — it is derived. That is what `pnpm audit:building`
 * is for: it checks every edge and every door of the result against the glb
 * before the import will run.
 */

const DOWNLOADS = 'C:/Users/ivan/Downloads'

/**
 * A column of the school — one classroom in each row — by which of the base
 * school's three it is, and how far east of there it stands. The base's own
 * columns are at 0. A row of four is west, middle, middle, east.
 */
export type Column = { kind: 'west' | 'middle' | 'east'; at: number }

export type EduplexSchool = {
  slug: string
  title: string
  modelTitle: string
  files: { main: string; full: string }
  /** The classroom columns, west to east. The end walls follow the end columns. */
  columns: Column[]
  /** How far east of its position in the restroom building the bay stands here, if it is here. */
  restroomBayAt?: number
  /** How far east of its position in the office building the module stands here, if it is here. */
  officeModuleAt?: number
  camera?: Partial<BuildingSpec['camera']>
}

const move = (x: number, dx: number) => Number((x + dx).toFixed(3))

/** The base school's classrooms by column: [north, south]. */
const BY_KIND: Record<Column['kind'], [Classroom, Classroom]> = {
  west: [CLASSROOMS[0], CLASSROOMS[3]],
  middle: [CLASSROOMS[1], CLASSROOMS[4]],
  east: [CLASSROOMS[2], CLASSROOMS[5]],
}

/** The classrooms of a row of columns, numbered north row first, west to east. */
function classroomsOf(columns: Column[]): Classroom[] {
  const north = columns.map((column, index) => ({ ...shifted(BY_KIND[column.kind][0], column.at), number: index + 1 }))
  const south = columns.map((column, index) => ({
    ...shifted(BY_KIND[column.kind][1], column.at),
    number: columns.length + index + 1,
  }))
  return [...north, ...south]
}

/** Siding stands this much proud of the wall core on each end; the core is this deep, siding to siding. */
const SIDING = 0.0195
const WALL_CORE = 0.162
const DEPTH = 19.545
const SQFT_PER_SQM = 10.7639
const FEET = 3.28084

/** A notch off the corridor: the run of wall it replaces, and how far it reaches. */
type Notch = { from: number; to: number; depth: number }

export function eduplexSchool(config: EduplexSchool): BuildingSpec {
  const first = config.columns[0]
  const last = config.columns[config.columns.length - 1]
  if (first.kind !== 'west' || last.kind !== 'east') {
    throw new Error(`${config.slug}: a row runs from a west column to an east one.`)
  }

  // The end walls and the corridor's end walls travel with the end columns.
  const west = move(BASE_WEST, first.at)
  const east = move(BASE_EAST, last.at)
  const corridorWest = move(CORRIDOR_WEST, first.at)
  const corridorEast = move(CORRIDOR_EAST, last.at)
  const faces: EduplexFaces = {
    west,
    east,
    north: NORTH,
    south: SOUTH,
    northRowInner: NORTH_ROW_INNER,
    southRowInner: SOUTH_ROW_INNER,
  }

  // Siding to siding, which is what the client quotes; and the plan centre of
  // the walls, which is what the offset brings to the origin.
  const width = east - west + 2 * WALL_CORE + 2 * SIDING
  const sqft = Math.round(width * DEPTH * SQFT_PER_SQM)
  const dimensions = `${Math.round(width * FEET)}' × ${Math.round(DEPTH * FEET)}'`
  const offset: [number, number, number] = [Number((-(west + east) / 2).toFixed(3)), -0.914, -0.515]

  const classrooms = classroomsOf(config.columns)
  const rooms = classrooms.map((room) => classroom(faces, room))
  const bay = config.restroomBayAt === undefined ? [] : RESTROOM_BAY_ROOMS.map((room) => shiftRoom(room, config.restroomBayAt!))
  const offices =
    config.officeModuleAt === undefined ? [] : OFFICE_MODULE_ROOMS.map((room) => shiftRoom(room, config.officeModuleAt!))

  // What each block cuts into the corridor's two long edges, and the doors it
  // hangs on the cuts. Sorted by x on the north edge, and walked backwards on
  // the south one, because that is the way round the outline goes.
  const northNotches: Notch[] = []
  const southNotches: Notch[] = []
  const blockDoors: OpeningSpec[] = []

  if (config.restroomBayAt !== undefined) {
    const dx = config.restroomBayAt
    northNotches.push({ from: move(BAY_WEST, dx), to: move(SPLIT_WEST, dx), depth: BAY_CORRIDOR.fountainBack })
    northNotches.push({ from: move(SPLIT_EAST, dx), to: move(BAY_EAST, dx), depth: BAY_CORRIDOR.northVestibuleEnd })
    southNotches.push({ from: move(SPLIT_EAST, dx), to: move(BAY_EAST, dx), depth: BAY_CORRIDOR.southVestibuleEnd })
    blockDoors.push(...BAY_CORRIDOR.doors.map(([x, z]) => restroomDoor([move(x, dx), z])))
  }
  if (config.officeModuleAt !== undefined) {
    const dx = config.officeModuleAt
    northNotches.push({
      from: move(MODULE_CORRIDOR.northPassage[0], dx),
      to: move(MODULE_CORRIDOR.northPassage[1], dx),
      depth: MODULE_CORRIDOR.northPassageEnd,
    })
    southNotches.push({
      from: move(MODULE_CORRIDOR.southPassage[0], dx),
      to: move(MODULE_CORRIDOR.southPassage[1], dx),
      depth: MODULE_CORRIDOR.southPassageEnd,
    })
    blockDoors.push(...MODULE_CORRIDOR.doors.map(([x, z]) => officeDoor([move(x, dx), z])))
  }
  northNotches.sort((a, b) => a.from - b.from)
  southNotches.sort((a, b) => b.from - a.from)

  const polygon: Array<[number, number]> = [[corridorWest, CORRIDOR_NORTH]]
  for (const notch of northNotches) {
    polygon.push([notch.from, CORRIDOR_NORTH], [notch.from, notch.depth], [notch.to, notch.depth], [notch.to, CORRIDOR_NORTH])
  }
  polygon.push([corridorEast, CORRIDOR_NORTH], [corridorEast, CORRIDOR_SOUTH])
  for (const notch of southNotches) {
    polygon.push([notch.to, CORRIDOR_SOUTH], [notch.to, notch.depth], [notch.from, notch.depth], [notch.from, CORRIDOR_SOUTH])
  }
  polygon.push([corridorWest, CORRIDOR_SOUTH])

  const corridor: RoomSpec = {
    key: 'corridor',
    name: 'Corridor',
    roomTypeSlug: 'hallway',
    isRestroom: true,
    polygon,
    // The classrooms' doors from this side, and the blocks' from their spurs.
    // The entrance doors in the end walls are left out.
    openings: [
      ...rooms.map((room) => room.openings![0]).map((opening) => ({
        ...opening,
        at: [
          opening.at![0],
          opening.at![1] === NORTH_ROW_INNER ? CORRIDOR_NORTH : CORRIDOR_SOUTH,
        ] as [number, number],
      })),
      ...blockDoors,
    ],
    openingModelKeys: config.officeModuleAt === undefined ? undefined : { door: 'office-door' },
  }

  return {
    slug: config.slug,
    title: config.title,
    modelTitle: config.modelTitle,
    lineSlug: 'eduplex',
    unitCount: classrooms.length,
    restroomCount: config.restroomBayAt === undefined ? 0 : 3,
    officeCount: config.officeModuleAt === undefined ? 0 : 2,
    sqft,
    dimensions,
    regionCodes: ['us'],
    // Finishes, the classroom door and the window from the plain school; the
    // office door from the school that first had offices.
    reuseAssetsFrom: [
      eduplex6Classroom.slug,
      ...(config.officeModuleAt === undefined ? [] : [eduplex6ClassroomOffices.slug]),
    ],
    source: {
      main: path.join(DOWNLOADS, config.files.main),
      full: path.join(DOWNLOADS, config.files.full),
    },
    offset,
    dropNodes: ['Object_5'],
    textures: [],
    openingModels: [],
    shell: eduplex6Classroom.shell,
    // Far enough out to take the whole building in, however long it is.
    camera: {
      ...eduplex6Classroom.camera,
      position: { x: width * 0.78, y: width * 0.58, z: width * 0.94 },
      maxDistance: Math.round(width * 2.4),
      ...config.camera,
    },
    rooms: [...rooms, corridor, ...bay, ...offices],
  }
}
