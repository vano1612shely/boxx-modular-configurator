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

export type Room = {
  key: string
  name: string
  roomType: RoomType
  /** Authored floor area. Either half null means "work that unit out". */
  areaSqFt: number | null
  areaSqM: number | null
  /** Floor outline in the XZ plane; doubles as the interior face of the walls. */
  floorPolygon: RoomVertex[]
  /** Empty for an undivided room, which is every room until someone cuts one. */
  zones: Zone[]
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
