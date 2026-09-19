import path from 'node:path'

import { SOURCES } from '../lib/import-tools'

import type { BuildingSpec, OpeningSpec, Rect, RoomSpec } from './types'

/**
 * Every BOXXPlex size is the same building with a different number of bays.
 *
 * Two rows of offices down the long sides, a restroom block against the west
 * wall with a kitchen below it, and the rest one open floor. Only the count of
 * bays and the coordinates change, so the shape is written once here and each
 * size supplies its own measurements.
 *
 * The measurements come from `pnpm analyze:model --outline`, which is why they
 * are given as wall faces rather than as widths: a face is a thing the geometry
 * can be asked about again, and a width is a thing somebody worked out once.
 */


/** What a size has to say about itself. Everything else is the same building. */
export type SectionConfig = {
  sections: number
  slug: string
  title: string
  modelTitle: string
  sqft: number
  dimensions: string

  /** Inner faces of the exterior walls. */
  west: number
  east: number
  north: number
  south: number

  /** The corridor: offices stop at the first pair, the open middle starts at the second. */
  northRowInner: number
  southRowInner: number
  commonNorth: number
  commonSouth: number

  /** Each office bay's inner faces, west to east. */
  bays: Array<[number, number]>
  /** Back of the window recess cut into the north wall. */
  alcoveBack: number

  /**
   * The restrooms, one entry per room.
   *
   * A list rather than one block with a partition, because the same block is
   * sometimes divided and sometimes not: the six-section building has two
   * rooms in it and its sibling has one, with both doors opening into it.
   */
  restrooms: Array<{
    west: number
    east: number
    north: number
    south: number
    /** Which wall of the room its doors are in — the one facing the open floor. */
    doorSide: 'w2' | 'w4'
    /** Door centres along that wall, as z in the source model. */
    doors: number[]
  }>

  /**
   * The corners the open floor is cut around, by the blocks' outer faces.
   *
   * Bigger sizes have a second restroom block in the opposite corner, so the
   * middle is not an L but a Z. A size with one block leaves the other out.
   */
  notchNorthWest?: { east: number; south: number }
  notchSouthEast?: { west: number; north: number }

  offset: [number, number, number]

  /**
   * File names, when they do not follow the line's own pattern.
   *
   * Most arrive as `<n>_section_horizontal_cut_...`; the one-restroom variant
   * does not, and guessing at a name that is nearly right fails late and
   * confusingly.
   */
  files?: { main: string; full: string }
}

/**
 * How wide the window recess is, and where its window sits in it.
 *
 * The last bay's is 5 cm narrower than the rest — measured, not rounded off,
 * and true of every size. The recess always runs into the partition, so only
 * its near edge is worked out.
 */
const RECESS_WIDTH = 0.75
const LAST_RECESS_WIDTH = 0.7
const WINDOW_INSET = 0.385
const LAST_WINDOW_INSET = 0.346

/** Doors pair up around each partition: the first bay's is at its far end. */
const FIRST_DOOR_INSET = 0.6
const DOOR_INSET = 0.62

/** Windows, sized to the frame's outside rather than to the glass. */
function window(side: OpeningSpec['side'], centre: number, width = 0.6): OpeningSpec {
  return { side, kind: 'window', centre, width, height: 1.36, sill: 0.755 }
}

/** Doors, sized to the outside of the casing. */
function door(side: OpeningSpec['side'], centre: number, width = 1.07): OpeningSpec {
  return { side, kind: 'door', centre, width, height: 2.2, sill: 0 }
}

/**
 * The exterior doors, one in each end wall of the open floor — the west one
 * in the kitchen, the east one across from it — at the same place in every
 * size, sized to the doorway the lining fills. Placed by point: each is on
 * an end wall, whichever side of the outline that turns out to be.
 */
const ENTRANCE_Z = { west: 3.846, east: -3.453 }

function entrance(x: number, z: number): OpeningSpec {
  return { side: 'w4', kind: 'door', centre: z, width: 1.006, height: 2.18, sill: 0, at: [x, z], entrance: true }
}

function doorCentres(config: SectionConfig): number[] {
  return config.bays.map(([x0, x1], index) =>
    index === 0 ? x1 - FIRST_DOOR_INSET : x0 + DOOR_INSET,
  )
}

function rooms(config: SectionConfig): RoomSpec[] {
  const doors = doorCentres(config)
  const last = config.bays.length - 1
  const made: RoomSpec[] = []

  config.bays.forEach(([x0, x1], index) => {
    const number = index + 1
    const recessFrom = x1 - (index === last ? LAST_RECESS_WIDTH : RECESS_WIDTH)
    const windowAt = x1 - (index === last ? LAST_WINDOW_INSET : WINDOW_INSET)

    made.push({
      key: `office-n${number}`,
      name: `Office ${number}`,
      roomTypeSlug: 'office',
      // Stepped, not a rectangle: the window recess is cut into the north wall
      // and runs into the corner, and the window sits on the back of it.
      polygon: [
        [x0, config.north],
        [recessFrom, config.north],
        [recessFrom, config.alcoveBack],
        [x1, config.alcoveBack],
        [x1, config.northRowInner],
        [x0, config.northRowInner],
      ],
      openings: [window('w1', windowAt), door('w3', doors[index])],
    })

    made.push({
      key: `office-s${number}`,
      name: `Office ${number + config.bays.length}`,
      roomTypeSlug: 'office',
      rect: { x0, x1, z0: config.southRowInner, z1: config.south },
      openings: [window('w3', (x0 + x1) / 2), door('w1', doors[index])],
    })
  })

  // The corner offices get a second window, in the end wall beside them.
  const first = made.find((room) => room.key === 'office-n1')
  const firstSouth = made.find((room) => room.key === 'office-s1')
  const lastNorth = made.find((room) => room.key === `office-n${config.bays.length}`)
  const lastSouth = made.find((room) => room.key === `office-s${config.bays.length}`)
  first?.openings?.push(window('w4', -6.231))
  firstSouth?.openings?.push(window('w4', 6.732))
  lastNorth?.openings?.push(window('w2', -6.34))
  lastSouth?.openings?.push(window('w2', 6.746))

  config.restrooms.forEach((restroom, index) => {
    made.push({
      key: `restroom-${index + 1}`,
      name: config.restrooms.length === 1 ? 'Restroom' : `Restroom ${index + 1}`,
      roomTypeSlug: 'restroom',
      isRestroom: true,
      rect: { x0: restroom.west, x1: restroom.east, z0: restroom.north, z1: restroom.south },
      openings: restroom.doors.map((centre) => door(restroom.doorSide, centre)),
    })
  })

  const nw = config.notchNorthWest
  const se = config.notchSouthEast

  // The open middle, cut around whichever corners hold a restroom block. Walked
  // clockwise from the north-west block's east face, so the west arm — the
  // kitchen — is the last thing the outline picks up.
  const outline: Array<[number, number]> = []
  outline.push([nw ? nw.east : config.west, config.commonNorth])
  outline.push([config.east, config.commonNorth])
  if (se) {
    outline.push([config.east, se.north])
    outline.push([se.west, se.north])
    outline.push([se.west, config.commonSouth])
  } else {
    outline.push([config.east, config.commonSouth])
  }
  outline.push([config.west, config.commonSouth])
  if (nw) {
    outline.push([config.west, nw.south])
    outline.push([nw.east, nw.south])
  }

  /**
   * The zones tile the room exactly, which is what makes them three rectangles.
   *
   * A restroom block sits in a corner, and the strip of floor left beside it is
   * a kitchen — one per block. What is left between them is the conference
   * floor, and it is a plain rectangle however many blocks there are.
   */
  const kitchens: Array<{ key: string; name: string; rect: Rect }> = []
  if (nw) {
    kitchens.push({
      key: 'kitchen',
      name: 'Kitchen',
      rect: { x0: config.west, x1: nw.east, z0: nw.south, z1: config.commonSouth },
    })
  }
  if (se) {
    kitchens.push({
      key: 'kitchen-2',
      name: 'Kitchen 2',
      rect: { x0: se.west, x1: config.east, z0: config.commonNorth, z1: se.north },
    })
  }
  if (kitchens.length === 1) kitchens[0].name = 'Kitchen'

  made.push({
    key: 'common',
    name: 'Kitchen & Conference',
    roomTypeSlug: 'conference',
    // The same doorways the offices and restrooms declare, from this side: a
    // room only generates the openings it names, so one left off here is a
    // blank wall to anybody standing in the middle of the building.
    openingModelKeys: { entrance: 'entrance' },
    openings: [
      entrance(config.west, ENTRANCE_Z.west),
      entrance(config.east, ENTRANCE_Z.east),
      ...doors.map((centre) => door('w1', centre)),
      ...doors.map((centre) => door('w3', centre)),
      // Each block's doors, placed by point rather than by distance along a
      // side. Both blocks present their doors on a west-facing wall, so a
      // distance alone puts the east block's pair on the building's own west
      // wall — two doors into a kitchen, and none where the restrooms are.
      ...config.restrooms.flatMap((restroom) =>
        restroom.doors.map((centre) => ({
          ...door('w4', centre),
          at: [restroom.doorSide === 'w2' ? restroom.east : restroom.west, centre] as [
            number,
            number,
          ],
        })),
      ),
    ],
    polygon: outline,
    zones: [
      {
        key: 'conference',
        name: 'Conference',
        roomTypeSlug: 'conference',
        color: '#3b82f6',
        rect: {
          x0: nw ? nw.east : config.west,
          x1: se ? se.west : config.east,
          z0: config.commonNorth,
          z1: config.commonSouth,
        },
      },
      ...kitchens.map((kitchen) => ({
        key: kitchen.key,
        name: kitchen.name,
        roomTypeSlug: 'kitchen',
        color: '#10b981',
        rect: kitchen.rect,
      })),
    ],
    // The counter, its cabinets and the sink are modelled into the building,
    // and entering the room hides the building — so they are named to be drawn
    // back. Resolved to node paths from the stored model, after the upload.
    builtInMaterials: ['adskMatkitchen_plane', 'kitchen_wood', 'metal_chrome'],
  })

  return made
}

/**
 * A size of BOXXPlex, as a spec the importer can run.
 *
 * `shared` names the size whose textures, door and window this one reuses — they
 * are identical across the line. `roofFrom` is for the rare pair of buildings
 * that are the same size and differ only inside: they share a roof too.
 */
export function boxxplexSection(
  config: SectionConfig,
  shared?: string,
  roofFrom?: string,
): BuildingSpec {
  return {
    slug: config.slug,
    title: config.title,
    modelTitle: config.modelTitle,
    lineSlug: 'boxxplex',
    unitCount: config.bays.length * 2,
    restroomCount: config.restrooms.length,
    sqft: config.sqft,
    dimensions: config.dimensions,
    regionCodes: ['us'],
    reuseAssetsFrom: shared,
    reuseRoofFrom: roofFrom,

    source: {
      main: path.join(
        SOURCES,
        config.files?.main ??
          `GLB/${config.sections}_section_horizontal_cut_boxx_modular_boxxplex_office_3d_modeling.glb`,
      ),
      full: path.join(
        SOURCES,
        config.files?.full ?? `GLB/${config.sections}_section_boxx_modular_boxxplex_office_3d_modeling.glb`,
      ),
    },

    offset: config.offset,

    // The site pad: tens of metres of concrete that are not part of the product.
    dropNodes: ['Object_50'],
    // Roof deck, its fascia, and the inner face of the parapet. Same node names
    // in every size, and the one asset that is never shared between them.
    roofNodes: ['Object_65', 'Object_32', 'Object_26'],

    textures: [],
    openingModels: [],

    shell: {
      // A hair above the model's own floor rather than level with it: coplanar
      // faces flicker, and the client asked for higher rather than lower.
      floorY: 0.002,
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

    rooms: rooms(config),
  }
}
