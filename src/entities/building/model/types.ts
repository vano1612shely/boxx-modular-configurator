import type { RoomType } from '@/modules/shared/room-types'
import type {
  OpeningFit,
  OpeningKind,
  ShellSurface,
  SunDirection,
  TexturedSurface,
  WallSide,
} from '@/modules/shared/room-shell'
import {
  OPENING_KINDS,
  SHELL_SURFACES,
  TEXTURED_SURFACES,
  WALL_SIDES,
} from '@/modules/shared/room-shell'

import type { Point2 } from '../lib/polygon'

export type Vec3Tuple = [number, number, number]

/** Axis-aligned zone volume in model space (meters). */
export type ZoneBox = {
  min: Vec3Tuple
  max: Vec3Tuple
}

export type RoofConfig = {
  url: string
  position: Vec3Tuple
  /** Degrees about Y. */
  yawDeg: number
  scale: number
}

/** One storey of a multi-storey building. */
export type BuildingFloor = {
  key: string
  name: string
  /** The volume that stays visible when this storey is picked. */
  box: ZoneBox
  /** Walkable level: where a room drawn on this storey starts. */
  floorY: number
}

/** Floor outline vertex; `side` owns the edge that STARTS at this vertex. */
export type RoomVertex = Point2 & { side: WallSide }

export type RoomOpening = {
  id: string
  side: WallSide
  kind: OpeningKind
  /** Arc length from the start of this side's edge chain (meters). */
  along: number
  width: number
  height: number
  /** Bottom of the opening above the room floor; 0 for a door. */
  sill: number
  /** Extra spin on top of the model's own alignment. Degrees about Y. */
  yawDeg?: number
  /** Handed doors: mirrors the model across the wall, which no rotation can. */
  mirror?: boolean
}

export type SurfaceStyle = {
  url: string | null
  tileWidth: number
  tileHeight: number
}

export type OpeningModelStyle = {
  url: string | null
  fit: OpeningFit
  /** Correction for the direction the source model faces. Degrees about Y. */
  yawDeg: number
  /** Metres from the wall's mid-thickness; positive is out of the room. */
  depth: number
}

export type RoomShellConfig = {
  /** Walkable floor level — the top face of the generated floor slab. */
  floorY: number
  wallHeight: number
  wallThickness: number
  floorThickness: number
  ceilingThickness: number
  /** Unit XZ direction each side faces outward. */
  sideAxes: Record<WallSide, Point2>
  /** Compass point the sun is on, or null to put it outside the glassiest wall. */
  sunDirection: SunDirection | null
}

export type CameraPreset = {
  position: Vec3Tuple
  target: Vec3Tuple
}

export type CameraConfig = CameraPreset & {
  fov: number
  minDistance: number
  maxDistance: number
  minPolarDeg: number
  maxPolarDeg: number
}

/**
 * A slice of one room's floor, with a use of its own.
 *
 * A conference half and a kitchen half of the same room, with nothing built
 * between them: separate types, separate areas, separate furniture, but one
 * shell, one ceiling height and one camera — all of which belong to the room.
 * Zones tile the room they are cut from, so their areas add up to it.
 */
export type Zone = {
  key: string
  name: string
  roomType: RoomType
  /** Authored floor area. Either half null means "work that unit out". */
  areaSqFt: number | null
  areaSqM: number | null
  /** Floor tint, so the halves are tellable apart. Hex, from ZONE_TINTS. */
  color: string
  /** Sub-outline of the room floor. No sides: a zone has no walls of its own. */
  polygon: Point2[]
}

/**
 * One object standing in a room, where the admin put it.
 *
 * Two sources, because a fitting can already exist or not. `node` names a piece
 * of the building's own model by path — the kitchen counter modelled into the
 * glb, which entering the room would otherwise hide along with everything else
 * — and it carries no pose of its own, because it already has one. `model` is a
 * file from the library, and the pose below is the whole of where it stands.
 *
 * `position` is the middle of its footprint in the building's own XZ, and `y`
 * is metres above the room's floor rather than an absolute level, so a
 * microwave sitting on a counter stays on it when the storey is re-levelled.
 */
export type RoomPart = {
  key: string
  source: 'node' | 'model'
  /**
   * Which object to draw, as a child-index path.
   *
   * Into the building's own glb for a 'node' part, and required there. Into the
   * part's own model for a 'model' part, where it is optional: null draws the
   * file whole, and a path draws one object out of a file that holds several —
   * which is how a kitchen sold as one glb becomes a fridge and a microwave
   * that move independently.
   */
  nodePath: string | null
  /** Null unless `source` is 'model'. */
  modelUrl: string | null
  /**
   * What the list calls it, taken from the model on import.
   *
   * Stored rather than looked up: naming a piece means loading its model, and
   * the panel that lists a room's fittings has no business pulling a 20 MB
   * kitchen off the network to write "Microwave" in a row. Null falls back to
   * the file name, which is all a whole-model part ever had.
   */
  name: string | null
  /**
   * Which merged object this belongs to, or null for a fitting standing alone.
   *
   * A water cooler arrives from its file as a base, a bottle and two levers,
   * and an admin arranging a room is arranging a water cooler. Parts sharing a
   * key are selected, moved and turned as one; the parts themselves are kept
   * whole so that merging can be undone and each piece keeps its own model.
   */
  groupKey: string | null
  position: Vec3Tuple
  /** Degrees about Y. */
  yawDeg: number
  /** Uniform: a fitting is bought at the size it is drawn, not stretched. */
  scale: number
}

/**
 * A kitchen's worth of fittings, arranged for one room and sold as one thing.
 *
 * The parts and their poses belong to the room, because "where the fridge
 * stands" is a fact about this building and no other. Everything the visitor
 * reads — the name, the price, the picture, the line on the quote — belongs to
 * the catalogue row this names, which every building shares. A room may offer
 * several, and the visitor may have one of them at a time.
 */
export type FittedSet = {
  key: string
  /** Names a row of the furniture catalogue. */
  packageId: number
  parts: RoomPart[]
}

export type Room = {
  key: string
  name: string
  roomType: RoomType
  /**
   * Drawn, marked and framed like a room; furnished like nothing at all.
   *
   * Its own flag rather than a reading of `roomType`, because room types are
   * catalogue rows an admin can rename or delete, and they already answer a
   * different question — which furniture fits. A restroom's fittings are part
   * of the building's own model, so there is nothing to offer and nothing to
   * put anywhere; all it wants is to be looked at closely.
   */
  isRestroom: boolean
  /** Authored floor area. Either half null means "work that unit out". */
  areaSqFt: number | null
  areaSqM: number | null
  /** Floor outline in the XZ plane; doubles as the interior face of the walls. */
  floorPolygon: RoomVertex[]
  /** Empty for an undivided room, which is every room until someone cuts one. */
  zones: Zone[]
  /** Fittings that are simply there — drawn inside the room, sold with nothing. */
  builtIns: RoomPart[]
  /** Arrangements this room offers, of which the visitor may have one. */
  fittedSets: FittedSet[]
  shell: RoomShellConfig
  openings: RoomOpening[]
  surfaces: Record<ShellSurface, SurfaceStyle>
  openingModels: Record<OpeningKind, OpeningModelStyle>
  cameraPreset: CameraPreset
}

/** Where a choice's model stands, in its spot's own frame. */
export type ExteriorPlacement = {
  position: Vec3Tuple
  /** Degrees about Y, on top of the spot's own facing. */
  yawDeg: number
  /** Per axis, so a deck can be stretched along a wall without growing taller. */
  scale: Vec3Tuple
}

/**
 * One card at an exterior spot — a deck, a deck with stairs, one with a ramp.
 *
 * Built from either source, or both at once: `nodes` are objects the building's
 * own model already contains, which need no placing because a modeller placed
 * them, and `modelUrl` is a catalogue model loaded on top and dragged into
 * place. A choice reusing the built-in deck and adding a bought ramp is the
 * case the pair exists for.
 */
export type ExteriorVariant = {
  key: string
  title: string
  description: string | null
  /** Optional: a spot may be offered with no price on it at all. */
  price: number | null
  thumbnailUrl: string | null
  nodes: string[]
  /** Null for a choice made entirely of objects already in the building. */
  modelUrl: string | null
  placement: ExteriorPlacement
}

/**
 * A place outside the building where the visitor picks one of several choices.
 *
 * Not tied to a door. Rooms carry openings but nothing tells an exit from an
 * internal doorway, so where an entrance is, is a fact only the admin knows —
 * they drop the spot and drag it into place. Its position is what the parts are
 * offset from, and where the visitor's click target sits.
 */
export type ExteriorSlot = {
  key: string
  name: string
  position: Vec3Tuple
  yawDeg: number
  /** Always names a variant in the list — the mapping guarantees it. */
  defaultVariantKey: string
  variants: ExteriorVariant[]
}

/**
 * Regulatory thresholds only. What sizes exist is a fact about the published
 * models, not something to restate here.
 */
export type BuildingLineRules = {
  restroomsRequiredAt: number | null
  secondRestroomSetAt: number | null
}

export type BuildingLineInfo = {
  id: number
  name: string
  slug: string
  unitLabel: 'offices' | 'classrooms'
  rules: BuildingLineRules
}

export type BuildingScene = {
  id: number
  title: string
  line: BuildingLineInfo
  unitCount: number
  restroomCount: number
  sqft: number | null
  sqm: number | null
  dimensions: string | null
  /** Free text, so it cannot be converted — a metric reader sees this or nothing. */
  dimensionsMetric: string | null
  /** Facts for the summary panel. Each is left out of it when null. */
  occupancy: number | null
  estimatedPrice: number | null
  leadTime: string | null
  modelUrl: string
  camera: CameraConfig
  /** Ascending by height; empty for a single-storey building. */
  floors: BuildingFloor[]
  roofBlocks: ZoneBox[]
  roofModel: RoofConfig | null
  hiddenNodePaths: string[]
  rooms: Room[]
  /**
   * Room type keys to the names an admin gave them, for anything on screen that
   * says what a room is for.
   *
   * Carried on the scene because the keys are all a room or a zone stores, and
   * the names live in a collection of their own. A key with no entry here is
   * one whose type was deleted; callers show the key, which is at least true.
   */
  roomTypeNames: Record<string, string>
  /** Empty for a building nobody has set exterior choices up on. */
  exteriorSlots: ExteriorSlot[]
}

export { OPENING_KINDS, SHELL_SURFACES, TEXTURED_SURFACES, WALL_SIDES }
export type {
  OpeningFit,
  OpeningKind,
  Point2,
  RoomType,
  ShellSurface,
  SunDirection,
  TexturedSurface,
  WallSide,
}
