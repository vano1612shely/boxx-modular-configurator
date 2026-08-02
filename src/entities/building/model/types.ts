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

export type RoomZone = {
  key: string
  name: string
  roomType: RoomType
  /** Floor outline in the XZ plane; doubles as the interior face of the walls. */
  floorPolygon: RoomVertex[]
  shell: RoomShellConfig
  openings: RoomOpening[]
  surfaces: Record<ShellSurface, SurfaceStyle>
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
  roofBlocks: ZoneBox[]
  roofModel: RoofConfig | null
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
