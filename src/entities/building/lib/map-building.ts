import {
  OPENING_KINDS,
  SHELL_DEFAULTS,
  SHELL_SURFACES,
  SUN_BEARINGS,
  TEXTURED_SURFACES,
  WALL_SIDES,
} from '@/modules/shared/room-shell'
import type { BuildingLine, BuildingModel, Model } from '@/payload-types'

import type {
  BuildingFloor,
  BuildingScene,
  OpeningFit,
  OpeningKind,
  OpeningModelStyle,
  RoofConfig,
  RoomOpening,
  RoomShellConfig,
  RoomVertex,
  RoomZone,
  ShellSurface,
  SunDirection,
  SurfaceStyle,
  Vec3Tuple,
  WallSide,
  ZoneBox,
} from '../model/types'
import { assetUrl, type UploadDoc } from '@/shared/lib'

import { sortFloors } from './building-floors'
import { autoAssignSides, computeSideAxes } from './room-shell'

type Vec3Group = { x?: number | null; y?: number | null; z?: number | null } | null | undefined
type ZoneBoxGroup = { min?: Vec3Group; max?: Vec3Group } | null | undefined

function toTuple(value: Vec3Group, fallback: Vec3Tuple = [0, 0, 0]): Vec3Tuple {
  if (!value) return fallback
  return [value.x ?? fallback[0], value.y ?? fallback[1], value.z ?? fallback[2]]
}

/** The nodePaths field is a JSON column — trust only an array of strings. */
export function zoneNodePaths(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function toZoneBox(value: ZoneBoxGroup): ZoneBox {
  const min = toTuple(value?.min)
  const max = toTuple(value?.max)
  // Normalize so min <= max on every axis regardless of how corners were dragged.
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
  }
}

type FloorDoc = NonNullable<NonNullable<BuildingModel['sceneConfig']>['floors']>[number]

// Payload regenerates array row ids on every save, so the key is the identity —
// a storey the visitor has picked must survive the admin editing another one.
function mapFloors(value: FloorDoc[] | null | undefined): BuildingFloor[] {
  const floors = (value ?? []).map((floor, index) => {
    const box = toZoneBox(floor.box)
    return {
      key: floor.key || `floor-${index + 1}`,
      name: floor.name || `Floor ${index + 1}`,
      box,
      // The bottom of the volume is where the storey begins, which is the right
      // guess for a storey whose level was never set.
      floorY: numberOr(floor.floorY, box.min[1]),
    }
  })

  return sortFloors(floors)
}

function mapRoofModel(
  value: NonNullable<BuildingModel['sceneConfig']>['roofModel'],
): RoofConfig | null {
  const url = optionalModelUrl(value?.model)
  if (!url) return null

  const scale = numberOr(value?.scale, 1)

  return {
    url,
    position: toTuple(value?.position),
    yawDeg: numberOr(value?.yawDeg, 0),
    scale: scale > 0 ? scale : 1,
  }
}

export type RoomDoc = NonNullable<BuildingModel['rooms']>[number]

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isWallSide(value: unknown): value is WallSide {
  return typeof value === 'string' && (WALL_SIDES as readonly string[]).includes(value)
}

function isSunDirection(value: unknown): value is SunDirection {
  return typeof value === 'string' && value in SUN_BEARINGS
}

// Legacy rows carry no `side`, or the schema default on every vertex; both mean
// unassigned, so the grouping is derived from geometry instead.
export function roomVertices(doc: RoomDoc): RoomVertex[] {
  const points = (doc.floorPolygon ?? []).map((p) => ({ x: p.x, z: p.z }))
  if (points.length < 3) return []

  const stored = (doc.floorPolygon ?? []).map((p) => (p as { side?: unknown }).side)
  const assigned = stored.every(isWallSide) && new Set(stored).size > 1

  const sides = assigned ? (stored as WallSide[]) : autoAssignSides(points)
  return points.map((p, i) => ({ ...p, side: sides[i] }))
}

/** The openings JSON column — keep only well-formed records. */
export function roomOpenings(value: unknown): RoomOpening[] {
  if (!Array.isArray(value)) return []

  const openings: RoomOpening[] = []
  for (const entry of value) {
    const opening = entry as Partial<RoomOpening> | null
    const kind: OpeningKind = opening?.kind === 'door' ? 'door' : 'window'
    if (
      !opening ||
      typeof opening.id !== 'string' ||
      !isWallSide(opening.side) ||
      typeof opening.along !== 'number' ||
      !Number.isFinite(opening.along)
    ) {
      continue
    }

    openings.push({
      id: opening.id,
      side: opening.side,
      kind,
      along: opening.along,
      width: numberOr(opening.width, kind === 'door' ? SHELL_DEFAULTS.doorWidth : SHELL_DEFAULTS.windowWidth),
      height: numberOr(
        opening.height,
        kind === 'door' ? SHELL_DEFAULTS.doorHeight : SHELL_DEFAULTS.windowHeight,
      ),
      sill: numberOr(opening.sill, kind === 'door' ? 0 : SHELL_DEFAULTS.windowSill),
      yawDeg: numberOr(opening.yawDeg, 0),
      mirror: opening.mirror === true,
    })
  }
  return openings
}

function isOpeningFit(value: unknown): value is OpeningFit {
  return value === 'stretch' || value === 'contain' || value === 'none'
}

function optionalModelUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return assetUrl(value as UploadDoc)
}

function roomOpeningModels(doc: RoomDoc): Record<OpeningKind, OpeningModelStyle> {
  const group = doc.openingModels

  return Object.fromEntries(
    OPENING_KINDS.map((kind) => {
      const entry = group?.[kind]
      return [
        kind,
        {
          url: optionalModelUrl(entry?.model),
          fit: isOpeningFit(entry?.fit) ? entry.fit : 'stretch',
          yawDeg: numberOr(entry?.yawDeg, 0),
          depth: numberOr(entry?.depth, 0),
        } satisfies OpeningModelStyle,
      ]
    }),
  ) as Record<OpeningKind, OpeningModelStyle>
}

function roomSideAxes(value: unknown, polygon: RoomVertex[]): RoomShellConfig['sideAxes'] {
  const derived = computeSideAxes(polygon)
  if (!value || typeof value !== 'object') return derived

  const stored = value as Record<string, unknown>
  for (const side of WALL_SIDES) {
    const axis = stored[side] as { x?: unknown; z?: unknown } | undefined
    if (axis && typeof axis.x === 'number' && typeof axis.z === 'number') {
      derived[side] = { x: axis.x, z: axis.z }
    }
  }
  return derived
}

function roomShell(doc: RoomDoc, polygon: RoomVertex[]): RoomShellConfig {
  const shell = doc.shell as Record<string, unknown> | null | undefined

  return {
    floorY: numberOr(shell?.floorY, 0),
    wallHeight: Math.max(numberOr(shell?.wallHeight, SHELL_DEFAULTS.wallHeight), 0.1),
    wallThickness: Math.max(numberOr(shell?.wallThickness, SHELL_DEFAULTS.wallThickness), 0.01),
    floorThickness: Math.max(numberOr(shell?.floorThickness, SHELL_DEFAULTS.floorThickness), 0.01),
    ceilingThickness: Math.max(
      numberOr(shell?.ceilingThickness, SHELL_DEFAULTS.ceilingThickness),
      0.01,
    ),
    sideAxes: roomSideAxes(shell?.sideAxes, polygon),
    sunDirection: isSunDirection(shell?.sunDirection) ? shell.sunDirection : null,
  }
}

function optionalTextureUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return assetUrl(value as UploadDoc)
}

// Only TEXTURED_SURFACES are stored, but the planner needs a tile size for every
// surface, so untextured ones still get an entry.
function roomSurfaces(doc: RoomDoc): Record<ShellSurface, SurfaceStyle> {
  const group = (doc.surfaces ?? {}) as Record<string, unknown>
  const textured = new Set<string>(TEXTURED_SURFACES)

  return Object.fromEntries(
    SHELL_SURFACES.map((surface) => {
      const entry = textured.has(surface)
        ? (group[surface] as
            | { texture?: unknown; tileWidth?: unknown; tileHeight?: unknown }
            | undefined)
        : undefined
      return [
        surface,
        {
          url: optionalTextureUrl(entry?.texture),
          tileWidth: Math.max(numberOr(entry?.tileWidth, 1), 0.01),
          tileHeight: Math.max(numberOr(entry?.tileHeight, 1), 0.01),
        } satisfies SurfaceStyle,
      ]
    }),
  ) as Record<ShellSurface, SurfaceStyle>
}

export function mapRoomZone(room: RoomDoc): RoomZone {
  const floorPolygon = roomVertices(room)

  return {
    key: room.key,
    name: room.name,
    roomType: room.roomType,
    // Zero is a figure someone typed; only an empty field means "work it out".
    areaSqFt: typeof room.areaSqFt === 'number' ? room.areaSqFt : null,
    areaSqM: typeof room.areaSqM === 'number' ? room.areaSqM : null,
    floorPolygon,
    shell: roomShell(room, floorPolygon),
    openings: roomOpenings(room.openings),
    surfaces: roomSurfaces(room),
    openingModels: roomOpeningModels(room),
    cameraPreset: {
      position: toTuple(room.cameraPreset?.position, [6, 4, 6]),
      target: toTuple(room.cameraPreset?.target),
    },
  }
}

function assertDoc<T>(value: number | T | null | undefined, label: string): T {
  if (!value || typeof value === 'number') {
    throw new Error(`Expected populated "${label}" relationship — fetch with depth >= 1.`)
  }
  return value
}

export function mapBuildingScene(doc: BuildingModel): BuildingScene {
  const line = assertDoc<BuildingLine>(doc.line, 'line')
  const model = assertDoc<Model>(doc.model, 'model')

  const modelUrl = assetUrl(model)
  if (!modelUrl) {
    throw new Error(`Building model "${doc.title}" has no file URL.`)
  }

  const camera = doc.sceneConfig?.camera
  const hiddenNodePaths = zoneNodePaths(doc.sceneConfig?.hiddenNodePaths)

  const rooms: RoomZone[] = (doc.rooms ?? []).map(mapRoomZone)

  return {
    id: doc.id,
    title: doc.title,
    line: {
      id: line.id,
      name: line.name,
      slug: line.slug,
      unitLabel: line.unitLabel,
      rules: {
        restroomsRequiredAt: line.rules?.restroomsRequiredAt ?? null,
        secondRestroomSetAt: line.rules?.secondRestroomSetAt ?? null,
      },
    },
    unitCount: doc.unitCount,
    restroomCount: doc.restroomCount ?? 0,
    sqft: doc.sqft ?? null,
    sqm: typeof doc.sqm === 'number' ? doc.sqm : null,
    dimensions: doc.dimensions ?? null,
    dimensionsMetric: doc.dimensionsMetric ?? null,
    occupancy: doc.occupancy ?? null,
    estimatedPrice: doc.estimatedPrice ?? null,
    leadTime: doc.leadTime ?? null,
    modelUrl,
    camera: {
      position: toTuple(camera?.position, [10, 8, 12]),
      target: toTuple(camera?.target, [0, 1, 0]),
      fov: camera?.fov ?? 50,
      minDistance: camera?.minDistance ?? 2,
      maxDistance: camera?.maxDistance ?? 30,
      minPolarDeg: camera?.minPolarDeg ?? 15,
      // Held under the horizontal: past it the orbit alone puts the eye below
      // the target, and the pan's ground guard has no say in where orbiting
      // goes. The field itself is unbounded, so authored data has to be caught.
      maxPolarDeg: Math.min(camera?.maxPolarDeg ?? 85, 89),
    },
    floors: mapFloors(doc.sceneConfig?.floors),
    roofBlocks: (doc.sceneConfig?.roofBlocks ?? []).map(toZoneBox),
    roofModel: mapRoofModel(doc.sceneConfig?.roofModel),
    hiddenNodePaths,
    rooms,
  }
}
