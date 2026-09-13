import {
  OPENING_MODEL_SLOTS,
  SHELL_DEFAULTS,
  SHELL_SURFACES,
  SUN_BEARINGS,
  TEXTURED_SURFACES,
  WALL_SIDES,
} from '@/modules/shared/room-shell'
import { roomTypeSlug } from '@/modules/shared/room-types'
import type { BuildingLine, BuildingModel, ExteriorOption, Model } from '@/payload-types'

import type {
  BuildingFloor,
  BuildingScene,
  ExteriorPlacement,
  ExteriorSlot,
  ExteriorVariant,
  FittedSet,
  OpeningFit,
  OpeningKind,
  OpeningModelSlot,
  OpeningModelStyle,
  Point2,
  RoofConfig,
  RoomOpening,
  RoomPart,
  RoomShellConfig,
  RoomVertex,
  Room,
  ShellSurface,
  SunDirection,
  SurfaceStyle,
  Vec3Tuple,
  WallSide,
  Zone,
  ZoneBox,
} from '../model/types'
import { assetUrl, type UploadDoc } from '@/shared/lib'
import { ZONE_TINTS } from '@/shared/three/scene-tokens'

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

/**
 * A catalogue option as the cards need it, without the geometry.
 *
 * Kept apart from the building because the two are fetched apart. The building
 * query runs at depth 1, which resolves the option itself but stops before its
 * thumbnail — so the options are read again, by id, rather than deepening a
 * query that would then also drag every texture and every line's regions along
 * with it.
 */
export type ExteriorOptionInfo = {
  id: number
  title: string
  description: string | null
  price: number | null
  thumbnailUrl: string | null
  /** Null while an option is being written and has no model on it yet. */
  modelUrl: string | null
}

export type ExteriorCatalogue = Map<number, ExteriorOptionInfo>

export function mapExteriorOption(doc: ExteriorOption): ExteriorOptionInfo {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description ?? null,
    price: typeof doc.price === 'number' ? doc.price : null,
    thumbnailUrl: optionalModelUrl(doc.thumbnail),
    // The model belongs to the catalogue entry now; only where it stands is a
    // fact about a particular building.
    modelUrl: optionalModelUrl(doc.model),
  }
}

type SlotDoc = NonNullable<NonNullable<BuildingModel['sceneConfig']>['exteriorSlots']>[number]
type VariantDoc = NonNullable<SlotDoc['variants']>[number]

function exteriorPlacement(value: VariantDoc['placement']): ExteriorPlacement {
  // A zero on any axis flattens the model out of existence, and a negative one
  // turns it inside out. Neither is ever what was meant.
  const scale = toTuple(value?.scale, [1, 1, 1]).map((axis) => (axis > 0 ? axis : 1))

  return {
    position: toTuple(value?.position),
    yawDeg: numberOr(value?.yawDeg, 0),
    scale: [scale[0], scale[1], scale[2]],
  }
}

/**
 * A variant needs a name and a picture to be offered at all, and both come from
 * the catalogue. One whose option has been deleted is dropped rather than shown
 * as a blank card — and a spot left with nothing to choose between is dropped
 * with it, since a picker with one entry is not a choice.
 */
function exteriorVariants(
  value: SlotDoc['variants'],
  catalogue: ExteriorCatalogue,
): ExteriorVariant[] {
  return (value ?? []).flatMap((variant, index) => {
    const option = variant.option
    const id = typeof option === 'number' ? option : option?.id
    const info =
      (typeof id === 'number' ? catalogue.get(id) : undefined) ??
      (option && typeof option === 'object' ? mapExteriorOption(option) : null)
    if (!info) return []

    return [
      {
        key: variant.key || `choice-${index + 1}`,
        title: info.title,
        description: info.description,
        price: info.price,
        thumbnailUrl: info.thumbnailUrl,
        nodes: zoneNodePaths(variant.nodes),
        modelUrl: info.modelUrl,
        placement: exteriorPlacement(variant.placement),
      },
    ]
  })
}

function mapExteriorSlots(
  value: SlotDoc[] | null | undefined,
  catalogue: ExteriorCatalogue,
): ExteriorSlot[] {
  return (value ?? []).flatMap((slot, index) => {
    const variants = exteriorVariants(slot.variants, catalogue)
    if (variants.length === 0) return []

    // The rest of the app reads the default without checking it, so a key that
    // names nothing — renamed variant, deleted one — is resolved here once.
    const named = variants.find((variant) => variant.key === slot.defaultVariantKey)

    return [
      {
        key: slot.key || `spot-${index + 1}`,
        name: slot.name || `Entrance ${index + 1}`,
        position: toTuple(slot.position),
        yawDeg: numberOr(slot.yawDeg, 0),
        defaultVariantKey: (named ?? variants[0]).key,
        variants,
      },
    ]
  })
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

/**
 * A room with no type, or one whose type was deleted from the catalogue.
 *
 * Not a valid key, so nothing matches it — a package offered for "kitchen"
 * stays out, and one offered for everything still goes in. Which is what an
 * untyped room should do.
 */
const UNTYPED = ''

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
      entrance: opening.entrance === true,
    })
  }
  return openings
}

/**
 * The built-ins JSON column — keep only records that describe a real object.
 *
 * A record is kept when its own source can still answer for it: a node needs a
 * path, a model needs a url. Anything else is a half-written row from an editor
 * session that went wrong, and drawing nothing is better than drawing a
 * mystery at the origin.
 */
export function roomParts(value: unknown): RoomPart[] {
  if (!Array.isArray(value)) return []

  const parts: RoomPart[] = []
  for (const entry of value) {
    const part = entry as Partial<RoomPart> | null
    if (!part || typeof part.key !== 'string' || !part.key) continue

    const source = part.source === 'node' ? 'node' : 'model'
    const nodePath = typeof part.nodePath === 'string' && part.nodePath ? part.nodePath : null
    const modelUrl = typeof part.modelUrl === 'string' && part.modelUrl ? part.modelUrl : null
    if (source === 'node' ? nodePath === null : modelUrl === null) continue

    parts.push({
      key: part.key,
      source,
      nodePath,
      modelUrl,
      name: typeof part.name === 'string' && part.name.trim() ? part.name.trim() : null,
      groupKey:
        typeof part.groupKey === 'string' && part.groupKey.trim() ? part.groupKey.trim() : null,
      position: toTuple(
        { x: part.position?.[0], y: part.position?.[1], z: part.position?.[2] },
        [0, 0, 0],
      ),
      yawDeg: numberOr(part.yawDeg, 0),
      // A zero or a negative would collapse the model to a point, which reads
      // as "the fitting is missing" rather than as the mistake it is.
      scale: numberOr(part.scale, 1) > 0 ? numberOr(part.scale, 1) : 1,
    })
  }

  return parts
}

/**
 * The fitted-sets JSON column.
 *
 * A set with no parts is dropped: it would put a tile in the panel that costs
 * money and puts nothing in the room. The package id is kept as written and
 * resolved against the catalogue by whoever needs the name and the price — a
 * set naming a package that has since been deleted simply stops being offered,
 * which is what happens to any other placement of it.
 */
export function roomFittedSets(value: unknown): FittedSet[] {
  if (!Array.isArray(value)) return []

  const sets: FittedSet[] = []
  for (const entry of value) {
    const set = entry as Partial<FittedSet> | null
    if (!set || typeof set.key !== 'string' || !set.key) continue
    if (typeof set.packageId !== 'number' || !Number.isFinite(set.packageId)) continue

    const parts = roomParts(set.parts)
    if (parts.length === 0) continue

    sets.push({ key: set.key, packageId: set.packageId, parts })
  }

  return sets
}

/** The zones JSON column — keep only records that describe a real piece of floor. */
export function roomZones(value: unknown): Zone[] {
  if (!Array.isArray(value)) return []

  const zones: Zone[] = []
  for (const entry of value) {
    const zone = entry as Partial<Zone> | null
    if (!zone || typeof zone.key !== 'string' || !Array.isArray(zone.polygon)) continue

    const polygon = zone.polygon
      .filter((p): p is Point2 => typeof p?.x === 'number' && typeof p?.z === 'number')
      .map((p) => ({ x: p.x, z: p.z }))
    if (polygon.length < 3) continue

    zones.push({
      key: zone.key,
      name: typeof zone.name === 'string' && zone.name ? zone.name : zone.key,
      // Zones live in a JSON column, so this is already the key itself.
      roomType: roomTypeSlug(zone.roomType) ?? UNTYPED,
      // Zero is a figure someone typed; only an empty field means "work it out".
      areaSqFt: typeof zone.areaSqFt === 'number' ? zone.areaSqFt : null,
      areaSqM: typeof zone.areaSqM === 'number' ? zone.areaSqM : null,
      color: typeof zone.color === 'string' && zone.color ? zone.color : ZONE_TINTS[0],
      polygon,
    })
  }

  // A lone zone is the room over again, under a second name — and it would put
  // a picker on screen with one thing in it.
  return zones.length > 1 ? zones : []
}

function isOpeningFit(value: unknown): value is OpeningFit {
  return value === 'stretch' || value === 'contain' || value === 'none'
}

function optionalModelUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  return assetUrl(value as UploadDoc)
}

function roomOpeningModels(doc: RoomDoc): Record<OpeningModelSlot, OpeningModelStyle> {
  const group = doc.openingModels

  const styles = Object.fromEntries(
    OPENING_MODEL_SLOTS.map((slot) => {
      const entry = group?.[slot]
      return [
        slot,
        {
          url: optionalModelUrl(entry?.model),
          fit: isOpeningFit(entry?.fit) ? entry.fit : 'stretch',
          yawDeg: numberOr(entry?.yawDeg, 0),
          depth: numberOr(entry?.depth, 0),
        } satisfies OpeningModelStyle,
      ]
    }),
  ) as Record<OpeningModelSlot, OpeningModelStyle>

  // An entrance with no model of its own is drawn with the door's: a room
  // authored before there were entrances still gets the door it always had.
  if (styles.entrance.url === null) styles.entrance = styles.door
  return styles
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

export function mapRoom(room: RoomDoc): Room {
  const floorPolygon = roomVertices(room)

  return {
    key: room.key,
    name: room.name,
    // Populated at depth 1; an id on its own cannot be resolved to a key here.
    roomType: roomTypeSlug(room.roomType) ?? UNTYPED,
    // Absent on every room drawn before the flag existed, and null on any row
    // Payload rewrote without it. Only a tick makes a restroom — the other way
    // round would be a room that quietly refused furniture.
    isRestroom: room.isRestroom === true,
    // Zero is a figure someone typed; only an empty field means "work it out".
    areaSqFt: typeof room.areaSqFt === 'number' ? room.areaSqFt : null,
    areaSqM: typeof room.areaSqM === 'number' ? room.areaSqM : null,
    floorPolygon,
    zones: roomZones((room as { zones?: unknown }).zones),
    builtIns: roomParts((room as { builtIns?: unknown }).builtIns),
    fittedSets: roomFittedSets((room as { fittedSets?: unknown }).fittedSets),
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

export function mapBuildingScene(
  doc: BuildingModel,
  catalogue: ExteriorCatalogue = new Map(),
  roomTypeNames: Record<string, string> = {},
): BuildingScene {
  const line = assertDoc<BuildingLine>(doc.line, 'line')
  const model = assertDoc<Model>(doc.model, 'model')

  const modelUrl = assetUrl(model)
  if (!modelUrl) {
    throw new Error(`Building model "${doc.title}" has no file URL.`)
  }

  const camera = doc.sceneConfig?.camera
  const hiddenNodePaths = zoneNodePaths(doc.sceneConfig?.hiddenNodePaths)

  const rooms: Room[] = (doc.rooms ?? []).map(mapRoom)

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
    officeCount: doc.officeCount ?? 0,
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
    roomTypeNames,
    exteriorSlots: mapExteriorSlots(doc.sceneConfig?.exteriorSlots, catalogue),
  }
}
