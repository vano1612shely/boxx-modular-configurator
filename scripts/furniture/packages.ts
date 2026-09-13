/**
 * The furniture packages, one entry per client file.
 *
 * A package is either one model — everything in the file but the floor it was
 * rendered on — or a group of pieces, each cut out of the file by object name
 * and stood at its own place in the group. A visitor adds a group whole and
 * then moves its pieces one by one, which is what the client asks for when a
 * package has a desk here and a table there: the pieces are the parts they
 * want a customer to be able to rearrange.
 *
 * Object names are read off `pnpm analyze:model <file> --objects` — every
 * object with where it stands in the file's own frame. A piece stands where
 * the modeller put it unless `at` says otherwise: metres right and towards
 * the viewer of the middle of the group, looked at from above; `rotationYDeg`
 * turns it about its own middle.
 *
 * The tier and the region are in the file name — `us_plus_…`, `us_core_…` —
 * and are read from it. What a package costs is not here: the client sets the
 * price in the admin, and an import leaves it alone. Where a package is offered
 * is: none of these belongs in a kitchen, which is furnished with fitted
 * packages only.
 */

export type PieceSpec = {
  /** Stable key, part of the model's title in the catalogue. */
  key: string
  /** What the piece is called in the room and the arranger. */
  name: string
  /**
   * Objects of the file that make this piece, as the analyzer lists them —
   * or `rest`: every object no other piece claims, less the render floor.
   */
  nodes: string[] | 'rest'
  /** Where its middle stands in the group; the file's own place if left out. */
  at?: [number, number]
  rotationYDeg?: number
}

/**
 * One thing of a fitted package — a fridge, a water cooler — and the objects
 * of the file it is made of. Several objects become several parts sharing a
 * group, which the editor moves as one: a cooler is a base, a bottle and two
 * levers, and nobody arranges a lever.
 */
export type FittingSpec = {
  key: string
  name: string
  nodes: string[]
}

export type FurnitureSpec = {
  slug: string
  /** The file, in Downloads. */
  file: string
  /** What the card says. The same at both tiers; the card carries the grade. */
  title: string
  /**
   * Objects to leave out, on top of the render floor, which always goes: every
   * file carries a ground plane and a floor slab under the furniture.
   */
  dropNodes?: string[]
  /**
   * Materials whose texture should repeat more often than the file says, by
   * factor. A Sketchfab export drops the tiling the artist set in its own
   * material editor, and a wire-mesh tray whose hexagons are meant to be a
   * centimetre across comes out with them the size of a hand.
   */
  textureRepeat?: Record<string, number>
  /** The pieces of a group; leave out for a package that is one model. */
  pieces?: PieceSpec[]
  /**
   * The fittings of a fitted package — one arranged in every kitchen of every
   * building rather than carried in by the visitor. Its file is uploaded whole
   * and each fitting drawn out of it by path.
   */
  fitted?: FittingSpec[]
  /**
   * Room types the package is offered in, by slug — or every type but the
   * ones named. Left out, the row keeps whatever the admin set.
   */
  rooms?: string[] | { except: string[] }
}

/** Kitchens take fitted packages only. */
const NOT_KITCHEN = { except: ['kitchen'] }

const CHAIR = (numbers: string[]) => numbers.map((n) => `Guest_Chair_${n}`)
const FOLDING = (numbers: string[]) => numbers.map((n) => `Folding_Chair_${n}`)

export const FURNITURE: Record<string, FurnitureSpec> = {
  /**
   * Plus construction office: a workstation, a big table made of two desks
   * pushed together, and a blueprint rack. Laid out as the client's picture
   * has them — the workstation on the right with its chair towards the table,
   * the table below left, the rack above it — only closer together.
   */
  'us-plus-construction-office-01': {
    slug: 'us-plus-construction-office-01',
    file: 'us_plus_construction_office_package_01.glb',
    title: 'Construction Office',
    rooms: NOT_KITCHEN,
    pieces: [
      {
        key: 'workstation',
        name: 'Desk, chair and cabinet',
        nodes: ['Planning_Table_01', 'stool_002', 'file_cabinet_002'],
        at: [0.7, 0.1],
        rotationYDeg: 90,
      },
      {
        key: 'table',
        name: 'Large table',
        nodes: ['Desk_01', 'Desk_002'],
        at: [-0.9, 0.7],
        rotationYDeg: 90,
      },
      {
        key: 'rack',
        name: 'Blueprint rack',
        nodes: ['Box004'],
        at: [-0.85, -1.1],
      },
    ],
  },

  /** Core construction office: the big table, and the workstation. */
  'us-core-construction-office-01': {
    slug: 'us-core-construction-office-01',
    file: 'us_core_construction_office_package_01.glb',
    title: 'Construction Office',
    rooms: NOT_KITCHEN,
    pieces: [
      {
        key: 'workstation',
        name: 'Desk, chair and cabinet',
        nodes: ['Planning_Table_002', 'file_cabinet_002', 'stool_002'],
      },
      { key: 'table', name: 'Large table', nodes: ['Desk_01'] },
    ],
  },

  /** Core large seating: two folding tables with eight chairs each, and a bin. */
  'us-core-large-seating-01': {
    slug: 'us-core-large-seating-01',
    file: 'us_core_large_seating_package_01.glb',
    title: 'Large Seating',
    rooms: NOT_KITCHEN,
    pieces: [
      {
        key: 'table-1',
        name: 'Table with chairs',
        nodes: ['8_Foot_6_Foot_Folding_Table001', ...FOLDING(['02', '004', '006', '008', '033', '034', '035', '036'])],
      },
      {
        key: 'table-2',
        name: 'Second table with chairs',
        nodes: ['8_Foot_6_Foot_Folding_Table002', ...FOLDING(['037', '038', '039', '040', '041', '042', '043', '044'])],
      },
      { key: 'bin', name: 'Waste basket', nodes: ['BOXX_Office_waste_basket001'] },
    ],
  },

  'us-core-small-seating-01': {
    slug: 'us-core-small-seating-01',
    file: 'us_core_small_seating_package_01.glb',
    title: 'Small Seating',
    rooms: NOT_KITCHEN,
  },

  /** Plus conference: two tables with six chairs each, and the whiteboard with the bin. */
  'us-plus-conference-01': {
    slug: 'us-plus-conference-01',
    file: 'us_plus_conference_package_01.glb',
    title: 'Conference Room',
    rooms: NOT_KITCHEN,
    pieces: [
      {
        key: 'table-1',
        name: 'Table with chairs',
        nodes: ['Desk_01', ...CHAIR(['02', '004', '026', '027', '028', '029'])],
      },
      {
        key: 'table-2',
        name: 'Second table with chairs',
        nodes: ['Desk_002', ...CHAIR(['030', '031', '032', '033', '034', '035'])],
      },
      { key: 'board', name: 'Whiteboard and waste basket', nodes: ['Whiteboard_02', 'BOXX_Office_waste_basket'] },
    ],
  },

  'us-core-conference-01': {
    slug: 'us-core-conference-01',
    file: 'us_core_conference_package_01.glb',
    title: 'Conference Room',
    rooms: NOT_KITCHEN,
  },

  /** Plus office: the whiteboard on its own, and the desk with everything round it. */
  'us-plus-office-01': {
    slug: 'us-plus-office-01',
    file: 'us_plus_office_package_01.glb',
    title: 'Office',
    rooms: NOT_KITCHEN,
    // The desk first: a group with no picture of its own is shown by its first piece.
    pieces: [
      { key: 'desk', name: 'Desk and seating', nodes: 'rest' },
      { key: 'board', name: 'Whiteboard', nodes: ['Whiteboard_02'] },
    ],
  },

  'us-core-office-01': {
    slug: 'us-core-office-01',
    file: 'us_core_office_package_01.glb',
    title: 'Office',
    rooms: NOT_KITCHEN,
  },

  /**
   * The kitchens: fitted, so they are laid out on every building's counter by
   * the import rather than dragged in. What goes where is decided per kitchen
   * from its counter and its walls — see `layoutKitchen` in the importer.
   */
  'us-plus-kitchen-01': {
    slug: 'us-plus-kitchen-01',
    file: 'us_plus_kitchen_package_01.glb',
    title: 'Kitchen',
    rooms: ['kitchen'],
    // The tray's wire mesh, at the client's picture's fineness: cells two millimetres across.
    textureRepeat: { Table_Top_Storage_01_greed: 24 },
    fitted: [
      { key: 'microwave', name: 'Microwave', nodes: ['Microwave_004'] },
      { key: 'coffee', name: 'Coffee maker', nodes: ['Coffee_Maker_004'] },
      { key: 'toaster', name: 'Toaster', nodes: ['Toaster_003'] },
      { key: 'fridge', name: 'Fridge', nodes: ['Full_Size_Fridge_004'] },
      { key: 'cooler', name: 'Water cooler', nodes: ['Tap1_Low002', 'Bottle_Low003', 'Object3048', 'Object3049'] },
      { key: 'table', name: 'Folding table', nodes: ['8_Foot_6_Foot_Folding_Table002'] },
      { key: 'tray', name: 'Table-top storage', nodes: ['Table_Top_Storage_003'] },
      { key: 'bin', name: 'Garbage can', nodes: ['Garbage_Can_01'] },
    ],
  },

  'us-core-kitchen-01': {
    slug: 'us-core-kitchen-01',
    file: 'us_core_kitchen_package_01.glb',
    title: 'Kitchen',
    rooms: ['kitchen'],
    fitted: [
      { key: 'microwave', name: 'Microwave', nodes: ['Microwave_004'] },
      { key: 'coffee', name: 'Coffee maker', nodes: ['Coffee_Maker_003'] },
      { key: 'fridge', name: 'Dorm fridge', nodes: ['Dorm_Fridge_02'] },
      { key: 'cooler', name: 'Water cooler', nodes: ['Tap1_Low001', 'Bottle_Low002', 'Object3046', 'Object3047'] },
      { key: 'table', name: 'Folding table', nodes: ['6_Foot_8_Foot_Folding_Table001'] },
      { key: 'bin', name: 'Garbage can', nodes: ['Garbage_Can_01'] },
    ],
  },
}
