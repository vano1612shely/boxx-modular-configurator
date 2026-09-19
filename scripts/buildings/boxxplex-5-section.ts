import path from 'node:path'

import { SOURCES } from '../lib/import-tools'

import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * BOXXPlex "5 section" — ten offices, two restrooms, one kitchen/conference room.
 *
 * Every number below is the **inner face** of a wall, measured off the geometry
 * with `pnpm analyze:model --plan`, in the source file's own coordinates. The
 * importer applies `offset` to the geometry and to these rooms together.
 *
 * Measured rather than inferred, because inferring was wrong. The partitions
 * between offices run 22 cm into the exterior wall, so where a partition ends
 * is not where the wall's face is; taking one for the other made every office
 * a third of a metre too deep and swallowed the real wall, which then stood
 * inside the generated room looking like an unexplained lump. A wall's face is
 * where the room stops being empty, and only the plan raster says where that is.
 *
 * Two source files, as the client supplies them: the horizontally cut model is
 * the building, and the uncut one is only opened to take the roof out of it.
 */


/** Inner faces of the four exterior walls. */
const WEST = -8.986
const EAST = 8.989
const NORTH = -7.959
const SOUTH = 8.566

/** The corridor walls: offices stop at one face, the open middle starts at the other. */
const NORTH_ROW_INNER = -4.509
const SOUTH_ROW_INNER = 4.879
const COMMON_NORTH = -4.384
const COMMON_SOUTH = 4.766

/** Each office bay, between the partitions. */
const COLUMNS: Array<[number, number]> = [
  [WEST, -5.586],
  [-5.386, -1.924],
  [-1.724, 1.739],
  [1.939, 5.389],
  [5.589, EAST],
]

/**
 * The north row's windows sit in a recess, and the recess is part of the room.
 *
 * 22 cm deep, the width of the window. Left out of the outline it reads as a
 * corner the room ignores — which is exactly how the client described it. The
 * south row has none: its windows are flush with the wall.
 */
const NORTH_ALCOVE_BACK = -8.184

/**
 * Where each recess starts. It ends at the partition — every one of them runs
 * right into the east wall of its office.
 *
 * Only the near edge is listed for a reason. Measuring both ends left each
 * recess a few centimetres short of the partition, and those slivers of wall
 * showed up in the room as little steps nobody could explain. The plan says
 * the free span ends exactly where the partition begins, so that is where the
 * outline should end too.
 */
const NORTH_ALCOVE_FROM = [-6.33, -2.674, 0.976, 4.639, 8.289]

/** The restroom block, and the partition that makes it two rooms. */
const RESTROOM_WEST = -8.974
const RESTROOM_EAST = -6.874
const RESTROOM_NORTH = -4.371
const RESTROOM_SOUTH = -0.234
const RESTROOM_SPLIT: [number, number] = [-2.371, -2.234]

/** The same block seen from the open middle: the faces its notch is cut by. */
const NOTCH_EAST = -6.724
const NOTCH_SOUTH = -0.084

/** The five doorway centres, shared by both rows of offices. */
const DOOR_CENTRES = [-6.186, -4.766, -1.109, 2.549, 6.207]

/**
 * Windows, sized to the whole assembly rather than to the glass.
 *
 * The opening a model is fitted into is stretched to it, so these are the
 * frame's outer measurements — 0.60 × 1.36, sitting 0.755 above the floor.
 * Sizing the hole to the glass instead would squeeze the frame into it.
 */
function window(side: OpeningSpec['side'], centre: number, width = 0.6): OpeningSpec {
  return { side, kind: 'window', centre, width, height: 1.36, sill: 0.755 }
}

/** Doors likewise, to the outside of the casing: 1.07 wide, 2.20 to the head. */
function door(side: OpeningSpec['side'], centre: number, width = 1.07): OpeningSpec {
  return { side, kind: 'door', centre, width, height: 2.2, sill: 0 }
}

/** The exterior doors: one in each end wall of the open floor, sized to the doorway. */
function entrance(x: number, z: number): OpeningSpec {
  return { side: 'w4', kind: 'door', centre: z, width: 1.006, height: 2.18, sill: 0, at: [x, z], entrance: true }
}

/**
 * The ten offices, five to a row.
 *
 * Both rows face the corridor, so their doors are on the wall towards the
 * middle of the building — `w3` for the north row and `w1` for the south one,
 * which is what the winding of each outline makes of "the inner edge".
 */
function offices(): RoomSpec[] {
  const northWindows = [-5.969, -2.312, 1.347, 5.005, 8.643]
  const southWindows = [-7.277, -3.647, 0.011, 3.668, 7.298]

  const rooms: RoomSpec[] = []

  COLUMNS.forEach(([x0, x1], index) => {
    const number = index + 1

    const alcoveFrom = NORTH_ALCOVE_FROM[index]
    const north: OpeningSpec[] = [window('w1', northWindows[index])]
    if (index === 0) north.push(window('w4', -6.231))
    if (index === 4) north.push(window('w2', -6.34))
    north.push(door('w3', DOOR_CENTRES[index]))

    rooms.push({
      key: `office-n${number}`,
      name: `Office ${number}`,
      roomTypeSlug: 'office',
      // Traced rather than a rectangle: the window recess is stepped into the
      // north wall and runs into the corner, and the window sits on its back.
      polygon: [
        [x0, NORTH],
        [alcoveFrom, NORTH],
        [alcoveFrom, NORTH_ALCOVE_BACK],
        [x1, NORTH_ALCOVE_BACK],
        [x1, NORTH_ROW_INNER],
        [x0, NORTH_ROW_INNER],
      ],
      openings: north,
    })

    const south: OpeningSpec[] = [window('w3', southWindows[index])]
    if (index === 0) south.push(window('w4', 6.732))
    if (index === 4) south.push(window('w2', 6.746))
    south.push(door('w1', DOOR_CENTRES[index]))

    rooms.push({
      key: `office-s${number}`,
      name: `Office ${number + 5}`,
      roomTypeSlug: 'office',
      rect: { x0, x1, z0: SOUTH_ROW_INNER, z1: SOUTH },
      openings: south,
    })
  })

  return rooms
}

/**
 * The two restrooms, which are one block in the model with a wall across it.
 *
 * `isRestroom` rather than a room type: they are drawn, marked and framed like
 * rooms, and furnished like nothing at all — their fittings are modelled into
 * the building already. Both doors are on the block's east face, towards the
 * open space.
 */
const restrooms: RoomSpec[] = [
  {
    key: 'restroom-1',
    name: 'Restroom 1',
    roomTypeSlug: 'restroom',
    isRestroom: true,
    rect: { x0: RESTROOM_WEST, x1: RESTROOM_EAST, z0: RESTROOM_NORTH, z1: RESTROOM_SPLIT[0] },
    openings: [door('w2', -3.767)],
  },
  {
    key: 'restroom-2',
    name: 'Restroom 2',
    roomTypeSlug: 'restroom',
    isRestroom: true,
    rect: { x0: RESTROOM_WEST, x1: RESTROOM_EAST, z0: RESTROOM_SPLIT[1], z1: RESTROOM_SOUTH },
    openings: [door('w2', -0.847)],
  },
]

/**
 * The open middle of the building: a conference floor with a kitchen off it.
 *
 * One room rather than two, because nothing is built between them — which is
 * exactly what zones are for. The outline is the middle band with the restroom
 * block cut out of its north-west corner, so it has six corners rather than
 * four; the two zones tile it, and their areas add back up to it.
 */
const commonRoom: RoomSpec = {
  key: 'common',
  name: 'Kitchen & Conference',
  roomTypeSlug: 'conference',
  openingModelKeys: { entrance: 'entrance' },
  // The same twelve doorways the offices and restrooms declare, from this side.
  // A room only generates the openings it names, so a door left off here is a
  // blank wall to anybody standing in the middle of the building. And the two
  // doors out: the red one in the kitchen's west wall, and its twin across
  // the floor in the east wall.
  openings: [
    entrance(WEST, 3.846),
    entrance(EAST, -3.453),
    ...DOOR_CENTRES.map((centre) => door('w1', centre)),
    ...DOOR_CENTRES.map((centre) => door('w3', centre)),
    door('w4', -3.767),
    door('w4', -0.847),
  ],
  polygon: [
    [NOTCH_EAST, COMMON_NORTH],
    [EAST, COMMON_NORTH],
    [EAST, COMMON_SOUTH],
    [WEST, COMMON_SOUTH],
    [WEST, NOTCH_SOUTH],
    [NOTCH_EAST, NOTCH_SOUTH],
  ],
  zones: [
    {
      key: 'conference',
      name: 'Conference',
      roomTypeSlug: 'conference',
      color: '#3b82f6',
      rect: { x0: NOTCH_EAST, x1: EAST, z0: COMMON_NORTH, z1: COMMON_SOUTH },
    },
    {
      key: 'kitchen',
      name: 'Kitchen',
      roomTypeSlug: 'kitchen',
      color: '#10b981',
      rect: { x0: WEST, x1: NOTCH_EAST, z0: NOTCH_SOUTH, z1: COMMON_SOUTH },
    },
  ],
  // The counter, its cabinets and the sink are modelled into the building, and
  // entering the room hides the building — so they are named here to be drawn
  // back. Resolved to node paths from the stored model, after the upload.
  builtInMaterials: ['adskMatkitchen_plane', 'kitchen_wood', 'metal_chrome'],
}

export const boxxplex5Section: BuildingSpec = {
  slug: 'boxxplex-5-section',
  title: 'BOXXPlex — 5 section',
  modelTitle: 'BOXXPlex 5 section (client asset)',
  lineSlug: 'boxxplex',
  unitCount: 10,
  restroomCount: 2,
  // Measured off the exterior walls: 18.37 m × 17.15 m.
  sqft: 3390,
  dimensions: "60' × 56'",
  regionCodes: ['us'],

  source: {
    main: path.join(SOURCES, 'GLB/5_section_horizontal_cut_boxx_modular_boxxplex_office_3d_modeling.glb'),
    full: path.join(SOURCES, 'GLB/5_section_boxx_modular_boxxplex_office_3d_modeling.glb'),
  },

  // Plan centre of the exterior walls to the origin; the finished floor of the
  // rooms, which sits at 0.737 in the source, down to y=0.
  offset: [-0.009, -0.737, -0.1965],

  // The site pad: 80 × 65 m of concrete that is not part of the product.
  dropNodes: ['Object_50'],
  // Roof deck, its fascia, and the inner face of the parapet above the ceiling.
  roofNodes: ['Object_65', 'Object_32', 'Object_26'],

  openingModels: [
    {
      // The south-westmost window, frames and glass together. The south wall
      // faces +Z, which is where the viewer expects a model's front, so this
      // one needs no correction to face out of every room it is put in.
      kind: 'window',
      from: 'main',
      materials: ['adskMatwindows_in', 'adskMatwindows_out', 'adskMatwindows_frame', 'glass'],
      region: { min: [-7.7, 1.4, 8.5], max: [-6.85, 3.0, 8.9] },
      // Negative: pulled a centimetre towards the room, which puts the frame
      // flush with the wall outside and standing slightly proud inside.
      intoWall: -0.01,
      thinBy: 0.4,
    },
    {
      // One interior leaf, from the wall between the second north office and
      // the open space — again a wall whose outward direction is +Z.
      kind: 'door',
      from: 'main',
      // A door is three materials, not one: the leaf is wood, the casing that
      // lines the opening is 'plastic', and the handle is 'metal_chrome'. The
      // light switch beside it shares neither, so it stays in the wall.
      materials: ['adskMatdoor_interior', 'plastic', 'metal_chrome'],
      region: { min: [-5.32, 0.68, -4.62], max: [-4.20, 3.0, -4.24] },
      intoWall: -0.015,
      facingDeg: 180,
    },
    {
      // The red exterior door in the kitchen's west wall — the same door at
      // both ends of every size. The leaf with its lite and push bar, the
      // threshold, and the lining of the doorway, which is what the room sees
      // round it. The wall faces −X, so the cut is turned to face +Z before
      // upload. Pushed out until the lining's room end sits on the wall: the
      // cut is centred on the wall by its box, and the bar outside reaches
      // further than the lining inside.
      kind: 'door',
      key: 'entrance',
      from: 'main',
      materials: [
        'door_exterior',
        'adskMatdoor_frame_exterior',
        'glass',
        'metal_chrome',
        'plastic',
        'adskMatBasic_Wall_Interior_slope',
      ],
      region: { min: [-9.3, 0.7, 3.32], max: [-8.95, 2.95, 4.37] },
      facing: '-x',
      intoWall: 0.07,
      // The red of the door in the file the buildings were imported from; the
      // later export the cut comes from has it black.
      paint: { door_exterior: [0.314, 0, 0.027] },
    },
  ],

  // Tiling is the source model's own, read with `--uvscale`. Guessed values
  // were 3.5x too fine on the floor: the speckle fell below a pixel and the
  // whole thing averaged out to flat grey.
  textures: [
    { surface: 'floor', material: 'Floor_Finish', from: 'main', tile: [4.2, 4.2] },
    { surface: 'wallInner', material: 'adskMatBasic_Wall_Interior', from: 'main', tile: [4.5, 4.5] },
    // The cut model has no ceiling — it was cut away to see in from above.
    { surface: 'ceiling', material: 'armstrong_tile', from: 'full', tile: [1, 1] },
  ],

  shell: {
    // A hair above the model's own floor rather than level with it: coplanar
    // faces flicker, and the client asked for higher rather than lower.
    floorY: 0.002,
    // Floor to the underside of the ceiling, measured in the model.
    wallHeight: 2.43,
    wallThickness: 0.1,
    floorThickness: 0.1,
    ceilingThickness: 0.1,
  },

  camera: {
    position: { x: 16, y: 13, z: 19 },
    target: { x: 0, y: 1, z: 0 },
    fov: 50,
    minDistance: 5,
    maxDistance: 60,
    minPolarDeg: 10,
    maxPolarDeg: 85,
  },

  rooms: [...offices(), ...restrooms, commonRoom],
}
