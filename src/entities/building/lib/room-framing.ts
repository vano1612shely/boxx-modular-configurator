import type { CameraPreset, RoomZone, Vec3Tuple, WallSide } from '../model/types'
import { WALL_SIDES } from '../model/types'
import { polygonBounds } from './polygon'

/** Elevation above the horizon, in radians (~28°). */
const ELEVATION = 0.49
const YAW_OFFSET = Math.PI / 5
const MARGIN = 1.18
/** Eye height as a fraction of the wall height. */
const EYE = 0.45

/** The wall carrying the most opening area. */
export function roomFeatureSide(room: RoomZone): WallSide {
  let best = WALL_SIDES[0]
  let bestArea = -1

  for (const side of WALL_SIDES) {
    let area = 0
    for (const opening of room.openings) {
      if (opening.side === side) area += opening.width * opening.height
    }
    if (area > bestArea) {
      bestArea = area
      best = side
    }
  }

  return best
}

/** `fovDeg` is the vertical field of view, the tighter one on a landscape viewport. */
export function fitDistance(radius: number, fovDeg: number): number {
  const half = (Math.max(fovDeg, 1) * Math.PI) / 360
  return (Math.max(radius, 0.1) / Math.max(Math.sin(half), 0.05)) * MARGIN
}

export function roomFocusTarget(room: RoomZone): Vec3Tuple {
  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const { floorY, wallHeight } = room.shell
  return [(minX + maxX) / 2, floorY + wallHeight * EYE, (minZ + maxZ) / 2]
}

export function frameRoom(room: RoomZone, fovDeg: number): CameraPreset {
  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const { wallHeight } = room.shell
  const target = roomFocusTarget(room)

  const radius = Math.hypot(Math.hypot(maxX - minX, maxZ - minZ), wallHeight) / 2 || 1
  const distance = fitDistance(radius, fovDeg)

  const axis = room.shell.sideAxes[roomFeatureSide(room)] ?? { x: 0, z: 1 }
  const yaw = Math.atan2(-axis.z, -axis.x) + YAW_OFFSET
  const ground = distance * Math.cos(ELEVATION)

  return {
    position: [
      target[0] + Math.cos(yaw) * ground,
      target[1] + distance * Math.sin(ELEVATION),
      target[2] + Math.sin(yaw) * ground,
    ],
    target,
  }
}

export type Extent = { min: Vec3Tuple; max: Vec3Tuple }

/** One measured piece of the loaded model, in world space. */
export type PartExtent = Extent

/** Flatness threshold, as a fraction of the model's own height. */
const SITE_FLATNESS = 0.05
/** Site footprint threshold, as a multiple of the median of the other parts. */
const SITE_SPREAD = 4
const MIN_PARTS = 4

function footprint(part: PartExtent): number {
  return (part.max[0] - part.min[0]) * (part.max[2] - part.min[2])
}

function unite(parts: ReadonlyArray<PartExtent>): Extent {
  const min: Vec3Tuple = [Infinity, Infinity, Infinity]
  const max: Vec3Tuple = [-Infinity, -Infinity, -Infinity]

  for (const part of parts) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], part.min[axis])
      max[axis] = Math.max(max[axis], part.max[axis])
    }
  }

  return { min, max }
}

function medianOfOthers(areas: number[], index: number): number {
  const others = areas.filter((_, i) => i !== index).sort((a, b) => a - b)
  return others[Math.floor((others.length - 1) / 2)]
}

/** Parts are axis-aligned boxes, so a tilted site plate measures tall and is kept. */
export function extentWithoutSite(parts: ReadonlyArray<PartExtent>): Extent | null {
  if (parts.length === 0) return null
  if (parts.length < MIN_PARTS) return unite(parts)

  const full = unite(parts)
  const height = full.max[1] - full.min[1]
  const areas = parts.map(footprint)

  const standing = parts.filter((part, index) => {
    const flat = part.max[1] - part.min[1] < height * SITE_FLATNESS
    return !(flat && areas[index] > medianOfOthers(areas, index) * SITE_SPREAD)
  })

  return standing.length ? unite(standing) : full
}

const MIN_ORBIT_FRACTION = 0.35

export function orbitRadius(preset: CameraPreset): number {
  return Math.hypot(
    preset.position[0] - preset.target[0],
    preset.position[1] - preset.target[1],
    preset.position[2] - preset.target[2],
  )
}

/** camera-controls spins on the spot when target and position coincide. */
export function orbitable(preset: CameraPreset): boolean {
  return orbitRadius(preset) >= 1
}

function withinBounds(point: Vec3Tuple, min: Vec3Tuple, max: Vec3Tuple, slack: number): boolean {
  return point.every((value, axis) => value >= min[axis] - slack && value <= max[axis] + slack)
}

export function frameBuilding(
  min: Vec3Tuple,
  max: Vec3Tuple,
  fovDeg: number,
  stored: CameraPreset,
): CameraPreset {
  const size: Vec3Tuple = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const radius = Math.hypot(size[0], size[1], size[2]) / 2
  if (radius < 1e-3) return stored

  const orbit = orbitRadius(stored)
  const aimed = withinBounds(stored.target, min, max, radius * 0.5)
  if (aimed && orbit >= radius * MIN_ORBIT_FRACTION) return stored

  const target: Vec3Tuple = [
    (min[0] + max[0]) / 2,
    min[1] + size[1] * EYE,
    (min[2] + max[2]) / 2,
  ]
  const distance = fitDistance(radius, fovDeg)
  const ground = distance * Math.cos(ELEVATION)
  const yaw = Math.PI * 0.25

  return {
    position: [
      target[0] + Math.cos(yaw) * ground,
      target[1] + distance * Math.sin(ELEVATION),
      target[2] + Math.sin(yaw) * ground,
    ],
    target,
  }
}
