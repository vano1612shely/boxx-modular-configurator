import { boxxplexSection } from './boxxplex-section'

/**
 * The BOXXPlex sizes, as measured.
 *
 * Every number is a wall's inner face in the source file's own coordinates,
 * read with `pnpm analyze:model --outline`. The depths repeat across sizes
 * because the rows do — only the count of bays and the spans across the
 * building change.
 *
 * The five-section building is the one whose textures, door and window the
 * others reuse; it is imported first for that reason.
 */

const SHARED = 'boxxplex-5-section'

export const boxxplex4Section = boxxplexSection(
  {
    sections: 4,
    slug: 'boxxplex-4-section',
    title: 'BOXXPlex — 4 section',
    modelTitle: 'BOXXPlex 4 section (client asset)',
    sqft: 2712,
    dimensions: "48' × 56'",

    west: -7.906,
    east: 6.407,
    north: -7.959,
    south: 8.566,
    northRowInner: -4.509,
    southRowInner: 4.879,
    commonNorth: -4.384,
    commonSouth: 4.766,

    bays: [
      [-7.906, -4.506],
      [-4.306, -0.843],
      [-0.643, 2.807],
      [3.007, 6.407],
    ],
    alcoveBack: -8.184,

    restrooms: [
      { west: -7.893, east: -5.806, north: -4.371, south: -2.371, doorSide: 'w2', doors: [-3.767] },
      { west: -7.893, east: -5.806, north: -2.234, south: -0.234, doorSide: 'w2', doors: [-0.847] },
    ],
    notchNorthWest: { east: -5.656, south: -0.084 },

    // Plan centre of the exterior walls to the origin, finished floor to y=0.
    offset: [0.743, -0.737, -0.1965],
  },
  SHARED,
)

export const boxxplex3Section = boxxplexSection(
  {
    sections: 3,
    slug: 'boxxplex-3-section',
    title: 'BOXXPlex — 3 section',
    modelTitle: 'BOXXPlex 3 section (client asset)',
    sqft: 2034,
    dimensions: "36' × 56'",

    west: -5.217,
    east: 5.445,
    north: -7.959,
    south: 8.566,
    northRowInner: -4.509,
    southRowInner: 4.879,
    commonNorth: -4.384,
    commonSouth: 4.766,

    bays: [
      [-5.217, -1.817],
      [-1.617, 1.845],
      [2.045, 5.445],
    ],
    alcoveBack: -8.184,

    restrooms: [
      { west: -5.205, east: -3.105, north: -4.371, south: -2.371, doorSide: 'w2', doors: [-3.767] },
      { west: -5.205, east: -3.105, north: -2.234, south: -0.234, doorSide: 'w2', doors: [-0.847] },
    ],
    notchNorthWest: { east: -2.955, south: -0.084 },

    offset: [-0.121, -0.737, -0.1965],
  },
  SHARED,
)

export const boxxplex2Section = boxxplexSection(
  {
    sections: 2,
    slug: 'boxxplex-2-section',
    title: 'BOXXPlex — 2 section',
    modelTitle: 'BOXXPlex 2 section (client asset)',
    sqft: 1356,
    dimensions: "24' × 56'",

    // This one sits off to one side in its file rather than around the origin,
    // and its walls are a few millimetres off the others — measured, not copied.
    west: -7.266,
    east: -0.253,
    north: -7.965,
    south: 8.573,
    northRowInner: -4.502,
    southRowInner: 4.885,
    commonNorth: -4.377,
    commonSouth: 4.76,

    bays: [
      [-7.266, -3.866],
      [-3.666, -0.253],
    ],
    alcoveBack: -8.19,

    restrooms: [
      { west: -7.253, east: -5.153, north: -4.377, south: -2.377, doorSide: 'w2', doors: [-3.767] },
      { west: -7.253, east: -5.153, north: -2.227, south: -0.24, doorSide: 'w2', doors: [-0.847] },
    ],
    notchNorthWest: { east: -5.003, south: -0.09 },

    offset: [3.755, -0.737, -0.1945],
  },
  SHARED,
)

/**
 * Six sections, twelve offices, the restroom block divided in two.
 *
 * This one cuts the roof; its sibling below takes the same file, because the
 * two are the same building and differ only in whether that block is one room
 * or two.
 */
export const boxxplex6Section = boxxplexSection(
  {
    sections: 6,
    slug: 'boxxplex-6-section',
    title: 'BOXXPlex — 6 section',
    modelTitle: 'BOXXPlex 6 section (client asset)',
    sqft: 4068,
    dimensions: "72' × 56'",

    west: -11.055,
    east: 10.583,
    north: -7.966,
    south: 8.571,
    northRowInner: -4.504,
    southRowInner: 4.884,
    commonNorth: -4.379,
    commonSouth: 4.759,

    bays: [
      [-11.055, -7.655],
      [-7.455, -3.992],
      [-3.792, -0.33],
      [-0.13, 3.32],
      [3.52, 6.983],
      [7.183, 10.583],
    ],
    alcoveBack: -8.191,

    restrooms: [
      { west: -11.042, east: -8.942, north: -4.379, south: -2.379, doorSide: 'w2', doors: [-3.767] },
      { west: -11.042, east: -8.942, north: -2.229, south: -0.229, doorSide: 'w2', doors: [-0.847] },
      { west: 8.495, east: 10.57, north: 0.634, south: 2.634, doorSide: 'w4', doors: [1.232] },
      { west: 8.495, east: 10.57, north: 2.771, south: 4.746, doorSide: 'w4', doors: [4.158] },
    ],
    notchNorthWest: { east: -8.792, south: -0.079 },
    notchSouthEast: { west: 8.345, north: 0.484 },

    offset: [0.2305, -0.737, -0.1965],
  },
  SHARED,
)

/**
 * The same six sections with one restroom instead of two.
 *
 * The block is not divided: it is one room, and both of the block's doors open
 * into it. Named "no restroom" in the client's files, which is not what it is —
 * it has one.
 *
 * Takes its roof from the building above rather than cutting an identical one.
 */
export const boxxplex6SectionTwoRestrooms = boxxplexSection(
  {
    sections: 6,
    slug: 'boxxplex-6-section-2-restrooms',
    title: 'BOXXPlex — 6 section, 2 restrooms',
    modelTitle: 'BOXXPlex 6 section 2 restrooms (client asset)',
    sqft: 4068,
    dimensions: "72' × 56'",

    west: -10.442,
    east: 11.195,
    north: -7.959,
    south: 8.566,
    northRowInner: -4.509,
    southRowInner: 4.879,
    commonNorth: -4.384,
    commonSouth: 4.766,

    bays: [
      [-10.442, -7.042],
      [-6.842, -3.38],
      [-3.18, 0.283],
      [0.483, 3.933],
      [4.133, 7.595],
      [7.795, 11.195],
    ],
    alcoveBack: -8.184,

    restrooms: [
      { west: -10.43, east: -8.342, north: -4.371, south: -2.371, doorSide: 'w2', doors: [-3.767] },
      { west: -10.43, east: -8.342, north: -2.234, south: -0.234, doorSide: 'w2', doors: [-0.847] },
    ],
    notchNorthWest: { east: -8.192, south: -0.084 },

    offset: [-0.3815, -0.737, -0.1965],

    files: {
      main: '6_section_no_restroom_horizontal_cut_boxx_-_copy.glb',
      full: '6_section_no_restroom_boxxplex_modular_-_copy.glb',
    },
  },
  SHARED,
  'boxxplex-6-section',
)

/**
 * Seven, eight and nine sections.
 *
 * From six sections up the building carries two restroom blocks — one in the
 * north-west corner, one in the south-east — each with a kitchen in the strip
 * of floor beside it. The west end is identical across all of them; only the
 * east end moves, one bay at a time.
 */
export const boxxplex7Section = boxxplexSection(
  {
    sections: 7,
    slug: 'boxxplex-7-section',
    title: 'BOXXPlex — 7 section',
    modelTitle: 'BOXXPlex 7 section (client asset)',
    sqft: 4704,
    dimensions: "84' × 56'",

    west: -11.055,
    east: 14.245,
    north: -7.967,
    south: 8.571,
    northRowInner: -4.504,
    southRowInner: 4.883,
    commonNorth: -4.379,
    commonSouth: 4.759,

    bays: [
      [-11.055, -7.655],
      [-7.455, -3.992],
      [-3.792, -0.33],
      [-0.13, 3.32],
      [3.52, 6.983],
      [7.183, 10.633],
      [10.833, 14.245],
    ],
    alcoveBack: -8.192,

    restrooms: [
      { west: -11.042, east: -8.942, north: -4.379, south: -2.379, doorSide: 'w2', doors: [-3.767] },
      { west: -11.042, east: -8.942, north: -2.229, south: -0.229, doorSide: 'w2', doors: [-0.847] },
      { west: 12.158, east: 14.233, north: 0.633, south: 2.633, doorSide: 'w4', doors: [1.232] },
      { west: 12.158, east: 14.233, north: 2.771, south: 4.746, doorSide: 'w4', doors: [4.158] },
    ],
    notchNorthWest: { east: -8.792, south: -0.079 },
    notchSouthEast: { west: 12.008, north: 0.483 },

    offset: [-1.598, -0.737, -0.1965],
  },
  SHARED,
)

export const boxxplex8Section = boxxplexSection(
  {
    sections: 8,
    slug: 'boxxplex-8-section',
    title: 'BOXXPlex — 8 section',
    modelTitle: 'BOXXPlex 8 section (client asset)',
    sqft: 5376,
    dimensions: "96' × 56'",

    west: -11.055,
    east: 17.895,
    north: -7.967,
    south: 8.571,
    northRowInner: -4.504,
    southRowInner: 4.883,
    commonNorth: -4.379,
    commonSouth: 4.759,

    bays: [
      [-11.055, -7.655],
      [-7.455, -3.992],
      [-3.792, -0.33],
      [-0.13, 3.32],
      [3.52, 6.983],
      [7.183, 10.633],
      [10.833, 14.295],
      [14.495, 17.895],
    ],
    alcoveBack: -8.192,

    restrooms: [
      { west: -11.042, east: -8.942, north: -4.379, south: -2.379, doorSide: 'w2', doors: [-3.767] },
      { west: -11.042, east: -8.942, north: -2.229, south: -0.229, doorSide: 'w2', doors: [-0.847] },
      { west: 15.808, east: 17.883, north: 0.633, south: 2.633, doorSide: 'w4', doors: [1.232] },
      { west: 15.808, east: 17.883, north: 2.771, south: 4.746, doorSide: 'w4', doors: [4.158] },
    ],
    notchNorthWest: { east: -8.792, south: -0.079 },
    notchSouthEast: { west: 15.658, north: 0.483 },

    offset: [-3.427, -0.737, -0.1965],
  },
  SHARED,
)

export const boxxplex9Section = boxxplexSection(
  {
    sections: 9,
    slug: 'boxxplex-9-section',
    title: 'BOXXPlex — 9 section',
    modelTitle: 'BOXXPlex 9 section (client asset)',
    sqft: 6048,
    dimensions: "108' × 56'",

    west: -11.052,
    east: 21.56,
    north: -7.958,
    south: 8.567,
    northRowInner: -4.508,
    southRowInner: 4.879,
    commonNorth: -4.384,
    commonSouth: 4.766,

    bays: [
      [-11.052, -7.652],
      [-7.452, -3.99],
      [-3.79, -0.34],
      [-0.14, 3.323],
      [3.523, 6.985],
      [7.185, 10.635],
      [10.835, 14.298],
      [14.498, 17.948],
      [18.148, 21.56],
    ],
    alcoveBack: -8.183,

    restrooms: [
      { west: -11.04, east: -8.94, north: -4.384, south: -2.384, doorSide: 'w2', doors: [-3.767] },
      { west: -11.04, east: -8.94, north: -2.234, south: -0.234, doorSide: 'w2', doors: [-0.847] },
      { west: 19.473, east: 21.548, north: 0.642, south: 2.629, doorSide: 'w4', doors: [1.232] },
      { west: 19.473, east: 21.548, north: 2.779, south: 4.754, doorSide: 'w4', doors: [4.158] },
    ],
    notchNorthWest: { east: -8.79, south: -0.084 },
    notchSouthEast: { west: 19.323, north: 0.492 },

    offset: [-5.256, -0.737, -0.1945],
  },
  SHARED,
)
