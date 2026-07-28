export type {
  BuildingLineInfo,
  BuildingLineRules,
  BuildingScene,
  CameraConfig,
  CameraPreset,
  OpeningFit,
  OpeningKind,
  OpeningModelStyle,
  Point2,
  RoomOpening,
  RoomShellConfig,
  RoomType,
  RoomVertex,
  RoomZone,
  ShellSurface,
  SunDirection,
  SurfaceStyle,
  TexturedSurface,
  Vec3Tuple,
  WallSide,
  ZoneBox,
} from './model/types'
export { OPENING_KINDS, SHELL_SURFACES, TEXTURED_SURFACES, WALL_SIDES } from './model/types'

export {
  mapBuildingScene,
  mapRoomZone,
  roomOpenings,
  roomVertices,
  zoneNodePaths,
  type RoomDoc,
} from './lib/map-building'
export { roomFloorTopY } from './lib/floor'
export {
  buildingExtent,
  fitDistance,
  frameBuilding,
  frameRoom,
  roomFeatureSide,
  roomFocusTarget,
  type Extent,
} from './lib/room-framing'
export {
  autoAssignSides,
  computeSideAxes,
  defaultTiles,
  locateOnWalls,
  planOpeningPlacements,
  planRoomShell,
  reanchorOpenings,
  type OpeningPlacement,
  type RoomShellPlan,
  type ShellPart,
  type ShellWarning,
  type SurfaceTiles,
} from './lib/room-shell'
export { resolveRoomVisibility, type RoomVisibility } from './lib/room-visibility'
export { setTreeOpacity } from './lib/fade'
export { bearingOf, facesSun, roomSunBearing, sunHeading, sunRay } from './lib/sun-patch'
export { preloadRoomTextures, useSurfaceTextures } from './lib/use-surface-textures'
export { preloadOpeningModels } from './ui/OpeningModel'
export { RoomShell } from './ui/RoomShell'
export { SceneLighting } from './ui/SceneLighting'
export {
  resolveBuildingSize,
  type SizingCandidate,
  type SizingInput,
  type SizingResult,
} from './lib/rules-engine'
export {
  clampPoseToPolygon,
  closestPointOnPolygon,
  footprintCorners,
  footprintFitsPolygon,
  nearestEdgeAlignedRotation,
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  polygonSignedArea,
  poseInsidePolygon,
  progressiveEdgeSnap,
  rectifyPolygon,
  type EdgeSnapResult,
  type Footprint,
} from './lib/polygon'
