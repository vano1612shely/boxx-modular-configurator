import type { CameraPreset, RoomZone, Vec3Tuple, WallSide, ZoneBox } from '../model/types'
import { WALL_SIDES } from '../model/types'
import { polygonBounds } from './polygon'

/**
 * Where the camera stands when a room is opened.
 *
 * Derived from the outline every time, never read from the document: the
 * per-room preset was captured from wherever the admin's editor camera
 * happened to be, and a preset whose target lands beside its own position
 * makes the orbit spin on the spot instead of around the room.
 */

/** Above the horizon, in radians (~28°) — high enough to read the plan. */
const ELEVATION = 0.49
/** Swung off the head-on axis so two walls fall away, not one. */
const YAW_OFFSET = Math.PI / 5
/** Breathing room around the fitted bounding sphere. */
const MARGIN = 1.18
/** Eye height inside the room's volume, as a fraction of the wall. */
const EYE = 0.45

/**
 * The wall worth looking at: the one carrying the most opening area.
 *
 * Drives both where the camera stands and where the light comes from, so the
 * two always agree — you look at the windows, and the light comes through
 * them.
 */
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

/**
 * How far back a camera must sit for a sphere of `radius` to fit the frame.
 *
 * Measured against the VERTICAL field of view, the tighter of the two on a
 * landscape viewport — fit that and the horizontal fits for free.
 */
export function fitDistance(radius: number, fovDeg: number): number {
  const half = (Math.max(fovDeg, 1) * Math.PI) / 360
  return (Math.max(radius, 0.1) / Math.max(Math.sin(half), 0.05)) * MARGIN
}

/** Centre of the room's volume — what the camera orbits. */
export function roomFocusTarget(room: RoomZone): Vec3Tuple {
  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const { floorY, wallHeight } = room.shell
  return [(minX + maxX) / 2, floorY + wallHeight * EYE, (minZ + maxZ) / 2]
}

/**
 * A three-quarter view that fits the whole room.
 *
 * @param fovDeg the camera's vertical field of view — the tighter of the two,
 *   so fitting against it fits horizontally as well on any viewport.
 */
export function frameRoom(room: RoomZone, fovDeg: number): CameraPreset {
  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const { wallHeight } = room.shell
  const target = roomFocusTarget(room)

  const radius = Math.hypot(Math.hypot(maxX - minX, maxZ - minZ), wallHeight) / 2 || 1
  const distance = fitDistance(radius, fovDeg)

  // Stand opposite the feature wall so it faces the camera; the walls that end
  // up between the two are exactly the ones dollhouse mode takes away.
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

/**
 * How big the building actually is, according to what the admin authored.
 *
 * Deliberately NOT the glb's bounding box. A site model carries its plot with
 * it — this one measures 73 x 55 m around a 7 x 18 m building — so fitting a
 * view to it puts the camera fifty metres up over an empty field. The rooms and
 * the roof volumes are the parts somebody drew around the building itself, so
 * their union is the building.
 *
 * Returns null when nothing has been authored yet; the glb's box is then the
 * only thing left to go on.
 */
export function buildingExtent(building: {
  rooms: RoomZone[]
  roofBlocks: ZoneBox[]
}): Extent | null {
  const min: Vec3Tuple = [Infinity, Infinity, Infinity]
  const max: Vec3Tuple = [-Infinity, -Infinity, -Infinity]
  let seen = false

  const swallow = (point: Vec3Tuple) => {
    seen = true
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }

  for (const box of building.roofBlocks) {
    swallow(box.min)
    swallow(box.max)
  }

  for (const room of building.rooms) {
    if (room.floorPolygon.length < 3) continue
    const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
    const { floorY, wallHeight } = room.shell
    swallow([minX, floorY, minZ])
    swallow([maxX, floorY + wallHeight, maxZ])
  }

  return seen ? { min, max } : null
}

/**
 * A stored preset is only usable if it orbits the thing it is meant to show.
 *
 * Everything the camera does is measured from the orbit radius: panning moves
 * by a fraction of it, a wheel tick scales it, a drag rotates around it. A
 * preset captured while the admin was standing close to a wall has a radius of
 * a metre or so, which makes all three behave nothing like they do anywhere
 * else — the symptom being that one small drag throws the building off screen.
 */
const MIN_ORBIT_FRACTION = 0.35

function withinBounds(point: Vec3Tuple, min: Vec3Tuple, max: Vec3Tuple, slack: number): boolean {
  return point.every((value, axis) => value >= min[axis] - slack && value <= max[axis] + slack)
}

/**
 * Where the camera stands over the whole building.
 *
 * The admin's stored framing is used as-is whenever it actually frames the
 * building. When it does not — it aims at a point a metre in front of itself,
 * or at something off the site entirely — a fitted three-quarter view is
 * computed from the model's own bounds instead, so the overview orbits the
 * building at a radius proportional to its size. That proportionality is what
 * makes the controls feel the same here as they do inside a room.
 */
export function frameBuilding(
  min: Vec3Tuple,
  max: Vec3Tuple,
  fovDeg: number,
  stored: CameraPreset,
): CameraPreset {
  const size: Vec3Tuple = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const radius = Math.hypot(size[0], size[1], size[2]) / 2
  if (radius < 1e-3) return stored

  const orbit = Math.hypot(
    stored.position[0] - stored.target[0],
    stored.position[1] - stored.target[1],
    stored.position[2] - stored.target[2],
  )
  const aimed = withinBounds(stored.target, min, max, radius * 0.5)
  if (aimed && orbit >= radius * MIN_ORBIT_FRACTION) return stored

  const target: Vec3Tuple = [
    (min[0] + max[0]) / 2,
    min[1] + size[1] * EYE,
    (min[2] + max[2]) / 2,
  ]
  const distance = fitDistance(radius, fovDeg)
  const ground = distance * Math.cos(ELEVATION)
  // Off the cardinal axes, so the view reads as a volume rather than a facade.
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
