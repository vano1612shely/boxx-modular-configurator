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

/**
 * Floor outline vertex. `side` owns the edge that STARTS at this vertex.
 *
 * A room has exactly four logical walls, but a wall is not necessarily one
 * straight edge: a recess, an L-return or a chamfer belongs to the wall it
 * faces. The four groups are what the dollhouse hides and shows.
 */
export type RoomVertex = Point2 & { side: WallSide }

/**
 * A door or window carved out of one wall side. Addressed by arc length along
 * that side's edge chain rather than by edge index, so inserting or dragging a
 * polygon vertex can be compensated for without the opening jumping.
 */
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
  /**
   * Extra spin for this one opening, on top of the model's own alignment —
   * the difference between a door that opens into the room and one that opens
   * out of it. Degrees about Y.
   */
  yawDeg?: number
  /** Handed doors: mirrors the model across the wall, which no rotation can. */
  mirror?: boolean
}

/** Texture assigned to one surface, plus the real-world size of one tile. */
export type SurfaceStyle = {
  url: string | null
  tileWidth: number
  tileHeight: number
}

/**
 * The 3D model that fills one kind of opening, and how it sits in the wall.
 *
 * A door is a frame, a leaf and a handle — things a flat image cannot be, from
 * any angle that is not straight on. The transform lives here rather than per
 * opening because it describes the SOURCE FILE (which way it was authored, how
 * deep it sits), not the hole; per-opening tweaks ride on `RoomOpening`.
 */
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
  /**
   * Unit XZ direction each side faces outward. Stored rather than derived:
   * the length-weighted mean normal of a deeply recessed side points the wrong
   * way, and the admin has already told us which wall is which.
   */
  sideAxes: Record<WallSide, Point2>
  /**
   * Compass point the sun is on, or null to put it outside whichever wall
   * carries the most glass.
   *
   * One sun for the whole room, named in world terms rather than by wall: two
   * rooms on opposite sides of a building share a sun, and naming it by wall
   * gave each of them their own.
   */
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

export type RoomZone = {
  key: string
  name: string
  roomType: RoomType
  /**
   * Floor outline drawn point-by-point in the admin editor (XZ plane). Doubles
   * as the interior face of the generated walls, so furniture clamping and the
   * room shell agree by construction.
   */
  floorPolygon: RoomVertex[]
  /** Parameters the room geometry is generated from. */
  shell: RoomShellConfig
  openings: RoomOpening[]
  surfaces: Record<ShellSurface, SurfaceStyle>
  /** Door and window models. A kind without a model falls back to a flat leaf. */
  openingModels: Record<OpeningKind, OpeningModelStyle>
  cameraPreset: CameraPreset
}

export type BuildingLineRules = {
  restroomsRequiredAt: number | null
  secondRestroomSetAt: number | null
  maxUnits: number | null
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
  dimensions: string | null
  modelUrl: string
  camera: CameraConfig
  /** Building-level roof volumes — hidden in the overview unless toggled on. */
  roofBlocks: ZoneBox[]
  /** Model node paths removed from the scene by the admin — never rendered. */
  hiddenNodePaths: string[]
  rooms: RoomZone[]
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
