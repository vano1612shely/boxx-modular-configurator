import type { OpeningKind, WallSide } from '../../src/modules/shared/room-shell'

/** An axis-aligned room footprint in the source model's own coordinates. */
export type Rect = { x0: number; x1: number; z0: number; z1: number }

export type ZoneSpec = {
  key: string
  name: string
  roomTypeSlug: string
  /** Floor tint, so the halves of a divided room are tellable apart. */
  color: string
  rect: Rect
}

/**
 * A door or window, placed by where it is rather than by how far along a wall.
 *
 * `centre` is the world x (for w1/w3) or z (for w2/w4) that `analyze-model`
 * reports for the opening in the source file. The arc length the room shell
 * actually wants is derived from it, because deriving it by hand is how an
 * opening ends up in the wrong room.
 */
export type OpeningSpec = {
  side: WallSide
  kind: OpeningKind
  centre: number
  width: number
  height: number
  /** Bottom of the opening above the room floor; 0 for a door. */
  sill: number
  /**
   * The point the opening sits at, when `centre` alone cannot say which wall.
   *
   * One side of a room can be two stretches of wall far apart — the building's
   * west wall and the inner face of a restroom block both face west. A door
   * given only its distance along that side lands on whichever stretch comes
   * first, which is how two doors into the east restrooms ended up in the west
   * kitchen. With a point, the edge is found rather than guessed.
   */
  at?: [number, number]
  /** A door out of the building: drawn with the room's entrance door model. */
  entrance?: boolean
}

export type RoomSpec = {
  key: string
  name: string
  roomTypeSlug: string
  /** Drawn and framed like a room, furnished like nothing at all. */
  isRestroom?: boolean
  rect?: Rect
  /** For a room that is not a rectangle — points in source coordinates. */
  polygon?: Array<[number, number]>
  zones?: ZoneSpec[]
  openings?: OpeningSpec[]
  /**
   * Fittings of the building's own model that belong to this room.
   *
   * Named by material rather than by node path on purpose: paths are chains of
   * child indexes, and dropping the site pad or letting the upload optimiser
   * re-emit the file renumbers them. The path is resolved from the stored model
   * after upload, when it is finally the file the browser will load.
   */
  builtInMaterials?: string[]
  /**
   * Which of the building's opening models this room's openings are drawn
   * with, by key — for a room whose door is not the building's usual one.
   */
  openingModelKeys?: { door?: string; window?: string; entrance?: string }
}

/** Which way a wall looks out, in the source file's axes. */
export type Facing = '+x' | '-x' | '+z' | '-z'

export type BuildingSpec = {
  slug: string
  title: string
  modelTitle: string
  lineSlug: string
  unitCount: number
  restroomCount: number
  /** Offices on top of the units — a school's, not an office line's. */
  officeCount?: number
  sqft?: number
  dimensions?: string

  /**
   * Region codes this building is sold in, spelled out rather than inherited.
   *
   * The product line is scoped too, so leaving this empty would still not offer
   * the building where the line is not sold — but empty means "sold everywhere"
   * to every reader of the catalogue, and a record that says the opposite of
   * what it means is the kind that survives until it is wrong.
   */
  regionCodes: string[]

  /**
   * Take textures and opening models from this building instead of cutting
   * new ones, naming it by slug — or from several, in order, when what a
   * building needs was cut in more than one place: a school with offices takes
   * its finishes, classroom door and window from the plain school and its
   * office door from the school that first had offices.
   *
   * The line shares its doors, windows and wall finishes across every size, so
   * cutting them again per building would upload the same 2 MB door four times
   * and leave four rows an admin has to tell apart. The roof is never shared:
   * it is the one part that is a different shape on every size.
   */
  reuseAssetsFrom?: string | string[]

  /**
   * Take the roof from this building rather than cutting one, by slug.
   *
   * Normally the roof is the one thing a size never shares, because it is a
   * different shape on every size. Two buildings of the same size that differ
   * only inside are the exception: their roofs are the same object, and both
   * are centred on the origin by their own offsets, so one file fits both.
   */
  reuseRoofFrom?: string

  /**
   * The client's two files: the model cut open horizontally, and the whole
   * thing for its roof and ceiling. Under `SOURCES` — the folder
   * `MODEL_SOURCES` names, or Downloads. Only cutting opens them; an import
   * from `catalogue/` does not.
   */
  source: { main: string; full: string }

  /**
   * Moves the source into the app's frame: plan centre on the origin, walkable
   * floor at y=0. Applied to the geometry and to every room together.
   */
  offset: [number, number, number]

  /**
   * Nodes of the main model to drop, by name — the site pad and its like. A
   * name takes every node carrying it: an exporter splits a big mesh into
   * same-named siblings, and half a staircase left behind is worse than none.
   */
  dropNodes: string[]
  /**
   * Unused: the roof and ceiling are worked out by diffing the uncut model
   * against the cut one. Kept so the four specs written before that still
   * type-check; nothing reads it.
   */
  roofNodes?: string[]

  /** Left empty when `reuseAssetsFrom` supplies them. */
  textures: Array<{
    surface: 'wallInner' | 'floor' | 'ceiling'
    material: string
    from: 'main' | 'full'
    /** Metres covered by one repeat, horizontally and vertically. */
    tile: [number, number]
  }>

  /**
   * Real 3D doors and windows, cut out of the building and offered back to it.
   *
   * Cut from a wall that already faces +Z, which is the direction the viewer
   * expects a model to face out of a room — so no rotation has to be guessed.
   */
  openingModels?: Array<{
    kind: OpeningKind
    /**
     * What a room asks for this model by, when a building has more than one
     * of a kind. A school's classrooms have one door — with a vision lite and
     * a closer — and its offices another, plain and taller. Defaults to the
     * kind, which is what every room asks for unless it says otherwise.
     */
    key?: string
    from: 'main' | 'full'
    materials: string[]
    region: { min: [number, number, number]; max: [number, number, number] }
    /**
     * A tighter box for one material than the rest of the cut gets.
     *
     * The threshold needs this. It is a strip of the building's own floor, and
     * the floor is made of triangles far larger than a doorway — keeping every
     * one whose middle falls in the door's box drags the model 18 cm wider
     * than its casing, and  then squeezes the whole door to fit.
     */
    regionByMaterial?: Record<
      string,
      { min: [number, number, number]; max: [number, number, number] }
    >
    /**
     * The admin panel's "Into wall m": 0 centres the model in the wall,
     * positive pushes it outward. Doors want a little so the casing is not
     * sunk flush; windows want less.
     */
    intoWall: number
    /**
     * The panel's "Facing °": turns the model so its front points out of the
     * room. Zero when it was cut from a wall that already faced that way.
     */
    facingDeg?: number
    /**
     * Which way the wall it was cut from faces. The viewer sizes a model by
     * its box, width along x and depth along z, so a door cut from a wall
     * that faces +X is turned here to face +Z before it is uploaded — turning
     * it only in the viewer would stretch its thickness across the opening.
     * Defaults to +Z, the wall every model was cut from until now.
     */
    facing?: Facing
    /**
     * Swing part of the cut about a vertical axis after cutting it.
     *
     * For a door the modeller left standing open: the leaf and its hardware
     * are turned back onto the hinge line — `axis` is [x, z] of the hinge
     * pin, `yawDeg` the turn that closes it — while the casing stays put.
     */
    turn?: { materials: string[]; axis: [number, number]; yawDeg: number }
    /**
     * Squash the model across the wall by this fraction of its depth.
     *
     * A window assembly is deeper than the generated wall, so some of it shows
     * through from outside. Thinning it is invisible from inside a room — but
     * only up to a point: squashed to fit exactly it stops reading as a window
     * frame at all, which is what 0.8 looked like. 0.4 is the client's number.
     */
    thinBy?: number
    /**
     * Base colours to write over the named materials, as linear RGB.
     *
     * For a file that lost one: the client's later export of the BOXXPlex
     * buildings carries the exterior door in black where the one they
     * approved, and the stored buildings still show, has it red.
     */
    paint?: Record<string, [number, number, number]>
  }>

  /**
   * Things a visitor picks between at an entrance — steps with a canopy, steps
   * without — cut out of the building's own model and offered back to it.
   *
   * Each is cut by node, moved so that `origin` (the door threshold at ground
   * level, on the wall's outer face) becomes its own origin, and turned so
   * that `facing` — the way that wall looks out — becomes +Z. That is what
   * lets one model stand at any entrance of any building in the line: a spot
   * says where its threshold is and which way its wall faces, and nothing else.
   *
   * Written once, on the building they were cut from; every other building of
   * the line finds them by title through `reuseAssetsFrom`.
   */
  exteriorOptions?: Array<{
    key: string
    title: string
    description?: string
    from: 'main' | 'full'
    /** Node names, as the analyzer lists them; a name takes every node carrying it. */
    nodes: string[]
    origin: [number, number, number]
    facing: Facing
  }>

  /**
   * Where those choices are made on this building: one spot per entrance.
   *
   * `at` is the door threshold at ground level on the wall's outer face, in
   * the source file's coordinates, and `facing` the way the wall looks out —
   * the same two things the options were cut against. Each variant names an
   * option by key; the model is placed at the spot as it is.
   */
  exteriorSpots?: Array<{
    key: string
    name: string
    at: [number, number, number]
    facing: Facing
    defaultVariant: string
    variants: Array<{ key: string; option: string }>
  }>

  /**
   * What the audit looks for at an opening's jambs, when this modeller names
   * things differently from the last one. Left out, the EDUPlex names apply.
   * `jambs` is how many of the two must have a casing: one, where a door is
   * modelled swung open and only its hinge side is in the wall.
   */
  audit?: { doorCasings: string[]; windowCasings: string[]; jambs: 1 | 2 }

  shell: {
    floorY: number
    wallHeight: number
    wallThickness?: number
    floorThickness?: number
    ceilingThickness?: number
  }

  camera: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov: number
    minDistance: number
    maxDistance: number
    minPolarDeg: number
    maxPolarDeg: number
  }

  rooms: RoomSpec[]
}
