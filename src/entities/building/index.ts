export type {
  BuildingFloor,
  BuildingLineInfo,
  BuildingLineRules,
  BuildingScene,
  CameraConfig,
  CameraPreset,
  ExteriorPart,
  ExteriorSlot,
  ExteriorVariant,
  OpeningFit,
  OpeningKind,
  OpeningModelStyle,
  Point2,
  RoofConfig,
  RoomOpening,
  RoomShellConfig,
  RoomType,
  RoomVertex,
  Room,
  ShellSurface,
  SunDirection,
  SurfaceStyle,
  TexturedSurface,
  Vec3Tuple,
  WallSide,
  Zone,
  ZoneBox,
} from './model/types'
export { OPENING_KINDS, SHELL_SURFACES, TEXTURED_SURFACES, WALL_SIDES } from './model/types'

export {
  mapBuildingScene,
  mapExteriorOption,
  mapRoom,
  roomOpenings,
  roomVertices,
  roomZones,
  zoneNodePaths,
  type ExteriorCatalogue,
  type ExteriorOptionInfo,
  type RoomDoc,
} from './lib/map-building'
export {
  claimedNodes,
  entranceView,
  hasExteriorChoices,
  hiddenExteriorNodes,
  revealedNodes,
  selectedVariant,
  slotOfNode,
  type ExteriorSelection,
} from './lib/exterior'
export { roomFloorTopY } from './lib/floor'
export {
  containingFloor,
  findFloor,
  floorExtent,
  floorForY,
  roomsOffEveryFloor,
  roomsOnFloor,
  sortFloors,
} from './lib/building-floors'
export { buildingSummary, type SummaryFact } from './lib/building-summary'
export {
  extentWithoutSite,
  fitDistance,
  frameBuilding,
  frameExtent,
  frameRoom,
  orbitable,
  orbitRadius,
  roomArea,
  roomFeatureSide,
  roomFocusTarget,
  type Extent,
  type PartExtent,
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
export { fitRoofToBuilding, type RoofPlacement } from './lib/roof-placement'
export { RoofModel } from './ui/RoofModel'
export { RoomShell } from './ui/RoomShell'
export { SceneLighting } from './ui/SceneLighting'
export {
  resolveBuildingSize,
  type SizingCandidate,
  type SizingInput,
  type SizingResult,
} from './lib/rules-engine'
export {
  closestPointOnPolygon,
  footprintCorners,
  nearestEdgeAlignedRotation,
  pointInPolygon,
  polygonAreaSqFt,
  polygonBounds,
  polygonCentroid,
  polygonSignedArea,
  rectifyPolygon,
  type Footprint,
} from './lib/polygon'
export {
  clampPoseToPolygon,
  clampPoseToRegion,
  footprintFitsPolygon,
  footprintFitsRegion,
  pointInRegion,
  poseInsidePolygon,
  poseInsideRegion,
  progressiveEdgeSnap,
  progressiveEdgeSnapRegion,
  regionFrom,
  regionOf,
  type EdgeSnapResult,
  type Region,
} from './lib/region'
export {
  canCut,
  cutPolygon,
  onOutline,
  OUTLINE_GRAB,
  type CutFailure,
  type CutResult,
  type OutlineHit,
} from './lib/zone-cut'
export {
  acceptingFloor,
  isDivided,
  nextZoneTint,
  reachableFloor,
  reachableGroups,
  zoneAccepts,
  zoneArea,
  zoneAt,
  zoneNamesJoined,
  zoneOf,
} from './lib/zones'
