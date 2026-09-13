import path from 'node:path'

import { classroom, door, type Classroom, type EduplexFaces } from './eduplex-classroom'
import type { BuildingSpec, RoomSpec } from './types'

/**
 * EDUPlex "6 classroom" — two rows of three classrooms with a corridor between.
 *
 * Every number is an inner wall face measured off the geometry — a plan raster
 * at 0.0125 m, median first hit from the room's centre line, checked at three
 * heights — in the source file's own coordinates. The importer applies
 * `offset` to the geometry and to these rooms together.
 *
 * The rows are each other's mirror: a classroom's exterior wall carries a
 * mechanical chase 0.35 m deep behind the wall-hung HVAC over part of its
 * width, and a window bay at the wall's own face over the rest; its corridor
 * wall carries one pilaster. The classroom is written once, in
 * `eduplex-classroom.ts`, and each of the six supplies its faces.
 */

const DOWNLOADS = 'C:/Users/ivan/Downloads'

/** Inner faces of the four exterior walls. */
export const WEST = -13.386
export const EAST = 11.582
export const NORTH = -9.076
export const SOUTH = 10.107

/** The corridor: classrooms stop at one face of its walls, it starts at the other. */
export const NORTH_ROW_INNER = -0.818
export const SOUTH_ROW_INNER = 1.849
export const CORRIDOR_NORTH = -0.703
export const CORRIDOR_SOUTH = 1.735
/** Its end walls, which carry the entrance doors — outside space beyond them. */
export const CORRIDOR_WEST = -12.462
export const CORRIDOR_EAST = 10.658

const FACES: EduplexFaces = {
  west: WEST,
  east: EAST,
  north: NORTH,
  south: SOUTH,
  northRowInner: NORTH_ROW_INNER,
  southRowInner: SOUTH_ROW_INNER,
}

/** Partition faces, west to east; the same in both rows. */
export const PARTITION_1: [number, number] = [-5.233, -5.004]
export const PARTITION_2: [number, number] = [3.2, 3.429]

/**
 * The six, as measured in this building. The siblings are this building with
 * a bay inserted, so they take these and shift the rooms west of the bay.
 */
export const CLASSROOMS: Classroom[] = [
  {
    number: 1,
    row: 'north',
    x0: WEST,
    x1: PARTITION_1[0],
    chaseFace: -8.73,
    chase: [WEST, -9.22],
    pilaster: [-9.462, -9.208],
    door: -5.804,
    windows: [-8.305, -6.146],
    endWindows: { wall: 'west', at: [-6.775, -3.127] },
  },
  {
    number: 2,
    row: 'north',
    x0: PARTITION_1[1],
    x1: PARTITION_2[0],
    chaseFace: -8.73,
    chase: [PARTITION_1[1], -0.788],
    pilaster: [-1.029, -0.775],
    door: 2.622,
    windows: [0.128, 2.287],
  },
  {
    number: 3,
    row: 'north',
    x0: PARTITION_2[1],
    x1: EAST,
    // Stands two centimetres further into the room than the western pair's
    // — measured twice, by two methods. Classrooms 4 and 5 are the same.
    chaseFace: -8.708,
    chase: [PARTITION_2[1], 7.658],
    pilaster: [7.366, 7.62],
    door: 10.099,
    windows: [8.561, 10.729],
    endWindows: { wall: 'east', at: [-6.611, -2.954] },
  },
  {
    number: 4,
    row: 'south',
    x0: WEST,
    x1: PARTITION_1[0],
    chaseFace: 9.739,
    chase: [-9.462, PARTITION_1[0]],
    pilaster: [-9.424, -9.17],
    door: -11.903,
    windows: [-12.533, -10.364],
    endWindows: { wall: 'west', at: [3.985, 7.643] },
  },
  {
    number: 5,
    row: 'south',
    x0: PARTITION_1[1],
    x1: PARTITION_2[0],
    chaseFace: 9.739,
    chase: [-1.029, PARTITION_2[0]],
    pilaster: [-1.029, -0.775],
    door: -4.426,
    windows: [-4.091, -1.932],
  },
  {
    number: 6,
    row: 'south',
    x0: PARTITION_2[1],
    x1: EAST,
    chaseFace: 9.761,
    chase: [7.417, EAST],
    pilaster: [7.404, 7.658],
    door: 4.001,
    windows: [4.342, 6.501],
    endWindows: { wall: 'east', at: [4.159, 7.807] },
  },
]

/**
 * The corridor: somewhere to look at, nowhere to furnish.
 *
 * Marked look-only the way a restroom is — that flag is what gives it a marker
 * and a close-up without a room mode behind them — and typed as a hallway so
 * the marker and the facts call it what it is. Its doors are the classrooms'
 * doors seen from this side; the entrance doors in its end walls are the
 * building's, and are left out on purpose.
 */
const corridor: RoomSpec = {
  key: 'corridor',
  name: 'Corridor',
  roomTypeSlug: 'hallway',
  isRestroom: true,
  rect: { x0: CORRIDOR_WEST, x1: CORRIDOR_EAST, z0: CORRIDOR_NORTH, z1: CORRIDOR_SOUTH },
  openings: CLASSROOMS.map((room) =>
    door([room.door, room.row === 'north' ? CORRIDOR_NORTH : CORRIDOR_SOUTH]),
  ),
}

export const eduplex6Classroom: BuildingSpec = {
  slug: 'eduplex-6-classroom',
  title: 'EDUPlex — 6 classroom',
  modelTitle: 'EDUPlex 6 classroom (client asset)',
  lineSlug: 'eduplex',
  unitCount: 6,
  restroomCount: 0,
  // Measured off the siding: 25.33 m × 19.55 m.
  sqft: 5329,
  dimensions: "83' × 64'",
  regionCodes: ['us'],

  source: {
    main: path.join(DOWNLOADS, '6classroom_horizontal_cut_-_copy.glb'),
    full: path.join(DOWNLOADS, '6classroom_eduplex_-_copy.glb'),
  },

  // Plan centre of the exterior walls to the origin; the finished floor of the
  // classrooms, which sits at 0.914 in the source, down to y=0.
  offset: [0.902, -0.914, -0.515],

  // The site pad: 113 × 103 m of concrete that is not part of the product.
  dropNodes: ['Object_5'],

  openingModels: [
    {
      // The fifth south window from the west, casing, frame, sashes and glass.
      // The south wall faces +Z, which is where the viewer expects a model's
      // front, so it needs no turning. The siding around it and the wall's
      // own reveals share the box but not the materials, and stay behind.
      kind: 'window',
      from: 'main',
      materials: ['adskMatWINDOW_frame', 'adskMatWINDOW_frame_interiro', 'glass'],
      region: { min: [6.006, 1.435, 10.068], max: [6.996, 3.038, 10.317] },
      // The line's own numbers, from the client: windows centred in the wall,
      // doors half a centimetre out of it.
      intoWall: 0,
      thinBy: 0.4,
    },
    {
      // Classroom 6's door, in the corridor wall — the classroom on its +Z
      // side, the corridor on its −Z side. Five materials: the casing, the
      // leaf (which happens to share a material with the wall tops, well
      // outside this box), the vision lite, the lever, and the closer on the
      // corridor face. The baseboard runs straight through the opening and
      // the wall's reveals sit behind the casing; neither is listed.
      //
      // Turned round because the viewer points a model's +Z out of the room,
      // and the face this door shows a classroom — the flat leaf, no closer —
      // is its +Z face in the source. Zero would hand the classroom the
      // corridor's view of its own door.
      kind: 'door',
      from: 'main',
      materials: ['door_frame', 'Basic_Wall_Interior_inside', 'glass', 'metal_chrome', 'Aluminum'],
      region: { min: [3.49, 0.9, 1.66], max: [4.511, 3.0, 1.925] },
      intoWall: 0.005,
      facingDeg: 180,
    },
  ],

  // Tiling is the source model's own, read with `--uvscale`: three metres per
  // repeat on the floor and the walls, a foot and a half on the ceiling grid.
  textures: [
    { surface: 'floor', material: 'adskMatFloor_Finish', from: 'main', tile: [3, 3] },
    { surface: 'wallInner', material: 'Basic_Wall_Interior', from: 'main', tile: [3, 3] },
    // The cut model has no ceiling — it was cut away to see in from above.
    { surface: 'ceiling', material: 'adskMatarmstrong_tile', from: 'full', tile: [1.5, 1.5] },
  ],

  shell: {
    // A hair above the model's own floor rather than level with it: coplanar
    // faces flicker, and the client asked for higher rather than lower.
    floorY: 0.002,
    // Floor to the underside of the ceiling tile, measured in the full model.
    wallHeight: 2.589,
    wallThickness: 0.1,
    floorThickness: 0.1,
    ceilingThickness: 0.1,
  },

  camera: {
    position: { x: 20, y: 15, z: 24 },
    target: { x: 0, y: 1, z: 0 },
    fov: 50,
    minDistance: 5,
    maxDistance: 70,
    minPolarDeg: 10,
    maxPolarDeg: 85,
  },

  rooms: [...CLASSROOMS.map((room) => classroom(FACES, room)), corridor],
}
