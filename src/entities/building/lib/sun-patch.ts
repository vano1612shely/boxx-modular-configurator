import { SUN_BEARINGS } from '@/modules/shared/room-shell'

import type { Point2, RoomZone, Vec3Tuple, WallSide } from '../model/types'

/**
 * Where the sun is, and how big a window's beam is when it gets there.
 *
 * Daylight is thrown into a room by a SPOT LIGHT wearing a window-shaped mask,
 * not by a patch drawn on the floor. A drawn patch can only ever be on the
 * floor: it goes straight through a sofa, which is the one place you most want
 * to see that the light reached. A real light lands on whatever is in the way.
 *
 * These are the numbers that light needs, kept pure so they can be checked
 * without a renderer.
 */

/** Sun height above the horizon, in radians (~35°) — a long afternoon beam. */
export const SUN_ELEVATION = 0.62

/** Swung off square to the wall, so the beam lands skewed rather than head-on. */
export const SUN_YAW = 0.3

/** How far back from the window the light stands, in metres. */
export const SUN_DISTANCE = 7

/**
 * The horizontal direction of the sun from the room, for a compass bearing.
 *
 * Bearings run clockwise from north, and north is -Z.
 */
export function sunHeading(bearingDeg: number): Point2 {
  const radians = (bearingDeg * Math.PI) / 180
  return { x: Math.sin(radians), z: -Math.cos(radians) }
}

/**
 * The direction sunlight TRAVELS for a given bearing: towards the room,
 * downward, and a little off square so beams land skewed rather than head-on.
 */
export function sunRay(bearingDeg: number): Vec3Tuple {
  const heading = sunHeading(bearingDeg)
  const yaw = Math.atan2(-heading.x, -heading.z) + SUN_YAW
  const flat = Math.cos(SUN_ELEVATION)
  return [Math.sin(yaw) * flat, -Math.sin(SUN_ELEVATION), Math.cos(yaw) * flat]
}

/**
 * Does this wall face the sun?
 *
 * Only windows in a wall the sun can actually reach throw a beam. Without this
 * every window in the room lit up, including the ones on the shaded side, and
 * beams crossed each other at odds — which is what several suns looks like.
 */
export function facesSun(axis: Point2, bearingDeg: number): boolean {
  const heading = sunHeading(bearingDeg)
  return axis.x * heading.x + axis.z * heading.z > 0.15
}

/** Compass bearing of a horizontal direction, clockwise from north (-Z). */
export function bearingOf(direction: Point2): number {
  return ((Math.atan2(direction.x, -direction.z) * 180) / Math.PI + 360) % 360
}

/**
 * Which way the sun is for this room.
 *
 * What the admin set, or — until they set it — outside whichever wall carries
 * the most glass, so a freshly drawn room lights itself the way it was
 * obviously meant to.
 */
export function roomSunBearing(room: RoomZone): number {
  const chosen = room.shell.sunDirection
  if (chosen) return SUN_BEARINGS[chosen]

  const glass = new Map<WallSide, number>()
  for (const opening of room.openings) {
    if (opening.kind !== 'window') continue
    glass.set(opening.side, (glass.get(opening.side) ?? 0) + opening.width * opening.height)
  }

  let best: WallSide | null = null
  let most = 0
  for (const [side, area] of glass) {
    if (area > most) {
      most = area
      best = side
    }
  }

  const axis = best ? room.shell.sideAxes[best] : null
  return axis ? bearingOf(axis) : 0
}

/**
 * Half-size of a window's beam as the sun sees it, in metres.
 *
 * The sun looks at the window from an angle, so the opening it has to squeeze
 * through is not its own width and height — it is the window foreshortened
 * onto the plane across the beam. Get this wrong and the mask is the wrong
 * shape, which shows up as a beam that is too narrow or too squat.
 */
export function windowBeamHalfSize(
  ray: Vec3Tuple,
  tangent: Point2,
  width: number,
  height: number,
): { halfWidth: number; halfHeight: number } {
  const alongTangent = ray[0] * tangent.x + ray[2] * tangent.z
  return {
    halfWidth: (width / 2) * Math.sqrt(Math.max(1 - alongTangent * alongTangent, 0)),
    // The window is vertical, so only the sun's height foreshortens it.
    halfHeight: (height / 2) * Math.sqrt(Math.max(1 - ray[1] * ray[1], 0)),
  }
}

/**
 * The cone the light needs, and where the window sits inside it.
 *
 * `angle` is the spot's half-angle; `halfU`/`halfV` are the window's half-size
 * as a fraction of the whole cone, which is exactly the rectangle the mask has
 * to be white inside. Both come from the same distance, so they cannot drift
 * apart.
 */
export function windowBeamCone(
  halfWidth: number,
  halfHeight: number,
  distance: number = SUN_DISTANCE,
): { angle: number; halfU: number; halfV: number } {
  // Room around the window so the mask's soft edge has somewhere to fade, and
  // so a very small window does not need an absurdly narrow cone.
  const reach = Math.max(halfWidth, halfHeight) * 1.8 + 0.25
  const angle = Math.atan2(reach, distance)
  const span = distance * Math.tan(angle)

  return {
    angle,
    halfU: halfWidth / (2 * span),
    halfV: halfHeight / (2 * span),
  }
}
