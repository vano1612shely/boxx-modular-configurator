import path from 'node:path'

import { SOURCES } from '../lib/import-tools'

import type { BuildingSpec, OpeningSpec, RoomSpec } from './types'

/**
 * Mobile Offices — office trailers on a chassis, three sizes and a variant.
 *
 * One modeller for the line, one construction throughout: a wall shell 0.105
 * thick, partitions 0.106, the same window, the same red entrance door, the
 * same interior door, and the same steel steps outside every entrance — with
 * or without a canopy. So the finishes, the doors, the window and both kinds
 * of steps are cut once, from the 12x56, and every unit takes them by name.
 *
 * Every number is an inner wall face measured off the geometry, in the file's
 * own coordinates, checked by a second agent and by the audit. The units are
 * not shifts of each other — each has its own plan — so each is written out.
 *
 * What is new here is the entrance: a customer picks, at each door, between
 * plain steps and steps under a canopy. The building's own steps are dropped
 * and each door gets a spot with the two choices standing on its threshold.
 */


/** Floor top to the ceiling tile, the same in every unit to a millimetre. */
const CEILING_ABOVE_FLOOR = 2.615

/** Openings, sized to the outside of the interior casing. */
function entrance(at: [number, number]): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width: 0.997, height: 2.089, sill: 0, at, entrance: true }
}

function door(at: [number, number], width = 0.949, height = 2.096): OpeningSpec {
  return { side: 'w1', kind: 'door', centre: at[0], width, height, sill: 0, at }
}

function window(at: [number, number], size: [number, number, number] = [0.765, 1.38, 0.711]): OpeningSpec {
  return { side: 'w1', kind: 'window', centre: at[0], width: size[0], height: size[1], sill: size[2], at }
}

const closet = (
  key: string,
  rect: RoomSpec['rect'],
  doorAt: [number, number],
  width = 0.949,
  height = 2.096,
): RoomSpec => ({
  key,
  name: 'Closet',
  roomTypeSlug: 'other',
  isRestroom: true,
  rect,
  openings: [door(doorAt, width, height)],
})

const restroom = (rect: RoomSpec['rect'], doorAt: [number, number], width = 0.948): RoomSpec => ({
  key: 'restroom',
  name: 'Restroom',
  roomTypeSlug: 'restroom',
  isRestroom: true,
  rect,
  openings: [door(doorAt, width)],
})

type Unit = {
  slug: string
  size: string
  files: { main: string; full: string }
  /** Inner faces of the exterior walls, and the siding's outer face on the door side. */
  west: number
  east: number
  north: number
  south: number
  sidingSouth: number
  floorTopY: number
  groundY: number
  /** Where the two entrance doors are along the south wall, west to east, and what stands at each. */
  entrances: Array<{ x: number; steps: 'plain' | 'canopy' }>
  rooms: RoomSpec[]
  offices: number
  sqft: number
  dimensions: string
  dropNodes: string[]
  /** Only the unit the shared assets are cut from carries these. */
  own?: Pick<BuildingSpec, 'textures' | 'openingModels' | 'exteriorOptions'>
}

function mobileOffice(unit: Unit): BuildingSpec {
  const dx = -(unit.west + unit.east) / 2
  const dz = -(unit.north + unit.south) / 2
  const width = unit.east - unit.west
  const depth = unit.south - unit.north

  return {
    slug: unit.slug,
    title: `Mobile Office — ${unit.size}`,
    modelTitle: `Mobile Office ${unit.size} (client asset)`,
    lineSlug: 'mobile-offices',
    unitCount: unit.offices,
    restroomCount: 1,
    sqft: unit.sqft,
    dimensions: unit.dimensions,
    regionCodes: ['us'],
    reuseAssetsFrom: unit.own ? undefined : 'mobile-office-12x56',

    source: {
      main: path.join(SOURCES, unit.files.main),
      full: path.join(SOURCES, unit.files.full),
    },

    // Plan centre of the walls to the origin, the finished floor down to y=0.
    offset: [Number(dx.toFixed(3)), -unit.floorTopY, Number(dz.toFixed(3))],
    // The ground pad, and the building's own steps — those come back as choices.
    dropNodes: unit.dropNodes,

    textures: unit.own?.textures ?? [],
    openingModels: unit.own?.openingModels ?? [],
    exteriorOptions: unit.own?.exteriorOptions,

    // This modeller's names. Interior doors are modelled swung open, so only
    // the hinge side of one stands in its jamb.
    audit: { doorCasings: ['door', 'door_interior'], windowCasings: ['windows_frame', 'Material_303'], jambs: 1 },

    // One spot per entrance door, on its threshold at ground level, facing the
    // way the wall does; both kinds of steps are offered, the model's own first.
    exteriorSpots: unit.entrances.map((entrance, index) => ({
      key: `entrance-${index + 1}`,
      name: `Entrance ${index + 1}`,
      at: [entrance.x, unit.groundY, unit.sidingSouth],
      facing: '+z',
      defaultVariant: entrance.steps,
      variants: [
        { key: 'plain', option: 'steps' },
        { key: 'canopy', option: 'steps-canopy' },
      ],
    })),

    shell: {
      floorY: 0.002,
      wallHeight: CEILING_ABOVE_FLOOR,
      wallThickness: 0.1,
      floorThickness: 0.1,
      ceilingThickness: 0.1,
    },

    camera: {
      position: { x: width * 0.7, y: width * 0.5, z: width * 0.9 + depth },
      target: { x: 0, y: 1, z: 0 },
      fov: 50,
      minDistance: 4,
      maxDistance: Math.round(width * 2.5) + 20,
      minPolarDeg: 10,
      maxPolarDeg: 85,
    },

    rooms: unit.rooms,
  }
}

/**
 * 12x56 — three offices and a restroom; the unit the line's assets come from.
 *
 * The west office has the plain steps at its door, the middle room the steps
 * under a canopy; the east room has no door out. The middle room wraps round
 * the restroom in its north-west corner.
 */
export const mobileOffice12x56: BuildingSpec = mobileOffice({
  slug: 'mobile-office-12x56',
  size: '12x56',
  files: { main: 'cut_boxx_fss_12x56.glb', full: 'boxx_fss_12x56.glb' },
  west: -8.647,
  east: 8.795,
  north: -1.598,
  south: 1.61,
  sidingSouth: 1.727,
  floorTopY: 1.128,
  groundY: -0.007,
  entrances: [
    { x: -6.114, steps: 'plain' },
    { x: 4.079, steps: 'canopy' },
  ],
  offices: 3,
  sqft: 654,
  dimensions: "12' × 56'",
  dropNodes: [
    'ground_ground_0',
    'Object017_stair_0',
    'Object043_stair_0',
  ],
  rooms: [
    {
      key: 'office-1',
      name: 'Office 1',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: -8.647, x1: -4.824, z0: -1.598, z1: 1.61 },
      openings: [
        entrance([-6.114, 1.61]),
        window([-7.317, 1.61]),
        window([-6.653, -1.598]),
        door([-4.824, 1.036]),
      ],
    },
    {
      key: 'office-2',
      name: 'Office 2',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      polygon: [
        [-2.281, -1.598],
        [4.624, -1.598],
        [4.624, 1.61],
        [-4.718, 1.61],
        [-4.718, 0.413],
        [-2.281, 0.413],
      ],
      openings: [
        entrance([4.079, 1.61]),
        window([-1.939, 1.61]),
        window([0.719, 1.61]),
        window([-1.102, -1.598]),
        window([1.555, -1.598]),
        door([-4.718, 1.036]),
        door([4.624, 1.036]),
        door([-4.129, 0.413], 1.042),
      ],
    },
    restroom({ x0: -4.718, x1: -2.388, z0: -1.598, z1: 0.312 }, [-4.129, 0.312], 1.042),
    {
      key: 'office-3',
      name: 'Office 3',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: 4.73, x1: 8.401, z0: -1.598, z1: 1.61 },
      openings: [door([4.73, 1.036]), window([6.884, 1.61]), window([6.994, -1.598])],
    },
  ],
  own: {
    // Tiling folds in the glTF texture transform the modeller used (floor
    // 0.3225, wall 0.6911): the importer tiles the raw image by metres.
    textures: [
      { surface: 'floor', material: 'floor', from: 'main', tile: [3.101, 3.101] },
      { surface: 'wallInner', material: 'wall_in', from: 'main', tile: [1.447, 1.447] },
      { surface: 'ceiling', material: 'Material_375', from: 'full', tile: [0.72, 0.72] },
    ],
    openingModels: [
      {
        // The east entrance door: casing and reveals on the room side, the
        // frame, the red leaf hung outside flush with the siding, its handle
        // and lite, and the top of the threshold plate. Nothing of the
        // outside: the trim and drip cap stood taller than the casing, so the
        // fit shrank the door under them and their white showed in the head
        // of the hole from the room. The dome light and the siding stay with
        // the building. The wall faces +Z and the room is on −Z, so the
        // casing end is already the room's.
        kind: 'door',
        key: 'entrance',
        from: 'main',
        materials: ['door', 'metal_chrome', 'glass', 'qqqasdw3v', 'floor_cap'],
        region: { min: [3.53, 1.1, 1.58], max: [4.63, 3.27, 1.79] },
        regionByMaterial: {
          // The casing shares its material with the skirting three millimetres
          // east of it, and with the walls' own lining.
          qqqasdw3v: { min: [3.57, 1.1, 1.58], max: [4.583, 3.24, 1.73] },
          // The threshold runs 12 cm down into the floor build-up; its top face
          // alone covers the sill of the hole, which is bare wall otherwise.
          floor_cap: { min: [3.6, 1.12, 1.6], max: [4.56, 1.14, 1.72] },
        },
        // The cut is centred on the wall by its box, and the box reaches
        // further out (handle, leaf) than in (casing): centred, the casing
        // stood 26 mm off the wall, and through that gap the hole showed
        // above the frame head — sky, since the building is hidden in a room.
        // Pushed out until the casing sits on the wall, as a casing does.
        intoWall: 0.03,
      },
      {
        // The partition door between Office 1 and Office 2, modelled swung
        // open into Office 1: the leaf and its hardware are turned back onto
        // the hinge here, the casings on both faces stay. The wall faces +X
        // out of Office 1, so the cut is turned to face +Z before upload; the
        // leaf then hangs on the −Z side, the room's.
        kind: 'door',
        from: 'main',
        materials: ['door_interior', 'metal_chrome', 'qqqasdw3v'],
        region: { min: [-5.68, 1.1, 0.54], max: [-4.69, 3.24, 1.53] },
        regionByMaterial: {
          qqqasdw3v: { min: [-4.85, 1.1, 0.54], max: [-4.69, 3.24, 1.53] },
          door_interior: { min: [-5.68, 1.13, 1.32], max: [-4.8, 3.18, 1.52] },
          metal_chrome: { min: [-5.68, 1.13, 1.32], max: [-4.8, 3.18, 1.52] },
        },
        turn: { materials: ['door_interior', 'metal_chrome'], axis: [-4.822, 1.453], yawDeg: -90 },
        facing: '+x',
        intoWall: -0.01,
      },
      {
        // Office 1's south window: casing, frame, both sashes, glass and the
        // lock. Not the exterior trim and drip cap: wider and taller than the
        // casing, they set the fit, and the shrunken casing left their white
        // showing round the hole from the room. What is left is the casing's
        // own depth, 15 mm more than the generated wall — proud on the room
        // side, as a casing is.
        kind: 'window',
        from: 'main',
        materials: ['qqqasdw3v', 'windows_frame', 'Material_303', 'glass', 'metla_black'],
        region: { min: [-7.73, 1.79, 1.59], max: [-6.9, 3.27, 1.77] },
        intoWall: 0,
      },
    ],
    // The steps at each door, cut by node and stood on the door's threshold
    // — the siding plane at ground level — facing out of the wall. Each name
    // is two same-named nodes, the exporter's split; the importer takes both.
    exteriorOptions: [
      {
        key: 'steps',
        title: 'Steps & landing',
        description: 'Steel steps with a landing and handrails.',
        from: 'main',
        nodes: ['Object017_stair_0'],
        origin: [-6.114, 0, 1.727],
        facing: '+z',
      },
      {
        key: 'steps-canopy',
        title: 'Steps & landing with canopy',
        description: 'Steel steps with a landing, handrails and a canopy over the door.',
        from: 'main',
        nodes: ['Object043_stair_0'],
        origin: [4.079, 0, 1.727],
        facing: '+z',
      },
    ],
  },
})

/** 12x46 — two offices, a restroom and a closet; plain steps west, canopy east. */
export const mobileOffice12x46: BuildingSpec = mobileOffice({
  slug: 'mobile-office-12x46',
  size: '12x46',
  files: { main: 'cut_boxx_fss_12x46.glb', full: 'boxx_fss_12x46.glb' },
  west: -7.866,
  east: 5.896,
  north: -1.598,
  south: 1.61,
  sidingSouth: 1.727,
  floorTopY: 1.126,
  groundY: -0.007,
  entrances: [
    { x: -5.333, steps: 'plain' },
    { x: 2.043, steps: 'canopy' },
  ],
  offices: 2,
  sqft: 517,
  dimensions: "12' × 46'",
  dropNodes: [
    'ground001_Material_#324_0',
    'Object017_stair_0',
    'Object043_stair_0',
  ],
  rooms: [
    {
      key: 'office-1',
      name: 'Office 1',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: -7.866, x1: -4.043, z0: -1.598, z1: 1.61 },
      openings: [
        entrance([-5.333, 1.61]),
        window([-6.536, 1.61]),
        window([-5.871, -1.598]),
        door([-4.043, 1.036]),
      ],
    },
    {
      key: 'office-2',
      name: 'Office 2',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      polygon: [
        [-0.363, -1.598],
        [5.502, -1.598],
        [5.502, 1.61],
        [-3.937, 1.61],
        [-3.937, 0.413],
        [-1.607, 0.413],
        [-1.607, -0.21],
        [-0.363, -0.21],
      ],
      openings: [
        entrance([2.043, 1.61]),
        window([-1.157, 1.61]),
        window([4.187, 1.61]),
        window([0.746, -1.598]),
        window([3.385, -1.598]),
        window([4.652, -1.598]),
        door([-3.937, 1.036]),
        door([-3.396, 0.413]),
        door([-1.094, -0.21]),
      ],
    },
    restroom({ x0: -3.937, x1: -1.713, z0: -1.598, z1: 0.312 }, [-3.396, 0.312]),
    closet('closet', { x0: -1.607, x1: -0.47, z0: -1.598, z1: -0.311 }, [-1.094, -0.311]),
  ],
})

/** 12x46 Britco — three offices in a row, a restroom and a small closet; plain steps at both doors. */
export const mobileOffice12x46Britco: BuildingSpec = mobileOffice({
  slug: 'mobile-office-12x46-britco',
  size: '12x46 Britco',
  files: { main: 'cut_boxx_fss_12x46_britco.glb', full: 'boxx_fss_12x46_britco.glb' },
  west: -7.866,
  east: 5.896,
  north: -1.598,
  south: 1.61,
  sidingSouth: 1.727,
  floorTopY: 1.126,
  groundY: -0.007,
  entrances: [
    { x: -5.333, steps: 'plain' },
    { x: 0.971, steps: 'plain' },
  ],
  offices: 3,
  sqft: 517,
  dimensions: "12' × 46'",
  dropNodes: [
    'ground001_Material_#324_0',
    'Object017_stair_0',
    'Object222_stair_0',
  ],
  rooms: [
    {
      key: 'office-1',
      name: 'Office 1',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: -7.866, x1: -4.043, z0: -1.598, z1: 1.61 },
      openings: [
        entrance([-5.333, 1.61]),
        window([-6.536, 1.61]),
        window([-6.537, -1.598]),
        door([-4.043, 1.036]),
      ],
    },
    {
      key: 'office-2',
      name: 'Office 2',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      polygon: [
        [-0.745, -1.598],
        [1.682, -1.598],
        [1.682, 1.61],
        [-3.937, 1.61],
        [-3.937, 0.413],
        [-1.607, 0.413],
        [-1.607, -0.354],
        [-0.745, -0.354],
      ],
      openings: [
        entrance([0.971, 1.61]),
        window([-1.157, 1.61]),
        // A transom high in the north wall — the line's one odd window.
        window([0.922, -1.598], [1.276, 0.761, 1.023]),
        door([-3.937, 1.036]),
        door([-3.396, 0.413]),
        door([-0.745, -1.085]),
        door([1.682, 1.036]),
      ],
    },
    restroom({ x0: -3.937, x1: -1.713, z0: -1.598, z1: 0.312 }, [-3.396, 0.312]),
    closet('closet', { x0: -1.607, x1: -0.847, z0: -1.598, z1: -0.46 }, [-0.847, -1.085]),
    {
      key: 'office-3',
      name: 'Office 3',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: 1.788, x1: 5.63, z0: -1.598, z1: 1.61 },
      openings: [door([1.788, 1.036]), window([4.187, 1.61]), window([4.652, -1.598])],
    },
  ],
})

/** 10x36 — two offices, a narrow restroom and a closet; plain steps at both doors. */
export const mobileOffice10x36: BuildingSpec = mobileOffice({
  slug: 'mobile-office-10x36',
  size: '10x36',
  files: { main: 'cut_boxx_fss_10x36.glb', full: 'boxx_fss_10x36.glb' },
  west: -5.749,
  east: 4.978,
  north: -1.362,
  south: 1.373,
  sidingSouth: 1.494,
  floorTopY: 1.129,
  groundY: 0,
  entrances: [
    { x: -2.704, steps: 'plain' },
    { x: 1.25, steps: 'plain' },
  ],
  offices: 2,
  sqft: 350,
  dimensions: "10' × 36'",
  dropNodes: [
    'ground_ground_0',
    'Object017_stair_0',
    'Object058_stair_0',
  ],
  rooms: [
    {
      key: 'office-1',
      name: 'Office 1',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      rect: { x0: -5.749, x1: -2.169, z0: -1.362, z1: 1.373 },
      openings: [
        entrance([-2.704, 1.373]),
        window([-4.216, 1.373]),
        window([-4.216, -1.362]),
        window([-5.749, 0.006]),
        door([-2.169, 0.092]),
      ],
    },
    {
      key: 'office-2',
      name: 'Office 2',
      roomTypeSlug: 'office',
      openingModelKeys: { entrance: 'entrance' },
      polygon: [
        [0.076, -1.362],
        [4.585, -1.362],
        [4.585, 1.373],
        [-1.168, 1.373],
        [-1.168, 0.607],
        [-2.063, 0.607],
        [-2.063, -0.464],
        [0.076, -0.464],
      ],
      openings: [
        entrance([1.25, 1.373]),
        window([3.284, 1.373]),
        window([1.323, -1.362]),
        window([3.284, -1.362]),
        door([-2.063, 0.092]),
        door([-0.991, -0.464]),
        door([-1.655, 0.607], 0.782, 1.966),
      ],
    },
    restroom({ x0: -2.063, x1: -0.031, z0: -1.362, z1: -0.565 }, [-0.991, -0.565]),
    closet('closet', { x0: -2.063, x1: -1.247, z0: 0.695, z1: 1.373 }, [-1.655, 0.695], 0.782, 1.966),
  ],
})
