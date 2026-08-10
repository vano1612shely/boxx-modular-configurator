import { SUN_BEARINGS } from '@/modules/shared/room-shell'

import type { Point2, Room, Vec3Tuple, WallSide } from '../model/types'

/** Sun height above the horizon, in radians (~35°). */
export const SUN_ELEVATION = 0.62

/** Swing off square to the wall, in radians. */
export const SUN_YAW = 0.3

/** How far back from the window the light stands, in metres. */
export const SUN_DISTANCE = 7

/** Bearings run clockwise from north, and north is -Z. */
export function sunHeading(bearingDeg: number): Point2 {
  const radians = (bearingDeg * Math.PI) / 180
  return { x: Math.sin(radians), z: -Math.cos(radians) }
}

/** The direction sunlight TRAVELS for a bearing: towards the room, downward. */
export function sunRay(bearingDeg: number): Vec3Tuple {
  const heading = sunHeading(bearingDeg)
  const yaw = Math.atan2(-heading.x, -heading.z) + SUN_YAW
  const flat = Math.cos(SUN_ELEVATION)
  return [Math.sin(yaw) * flat, -Math.sin(SUN_ELEVATION), Math.cos(yaw) * flat]
}

export function facesSun(axis: Point2, bearingDeg: number): boolean {
  const heading = sunHeading(bearingDeg)
  return axis.x * heading.x + axis.z * heading.z > 0.15
}

export function bearingOf(direction: Point2): number {
  return ((Math.atan2(direction.x, -direction.z) * 180) / Math.PI + 360) % 360
}

/** What the admin set, or the wall carrying the most glass. */
export function roomSunBearing(room: Room): number {
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

/** The window foreshortened onto the plane across the beam, in metres. */
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

/** `angle` is the spot's half-angle; `halfU`/`halfV` the window as a fraction of the cone. */
export function windowBeamCone(
  halfWidth: number,
  halfHeight: number,
  distance: number = SUN_DISTANCE,
): { angle: number; halfU: number; halfV: number } {
  // Room around the window so the mask's soft edge has somewhere to fade.
  const reach = Math.max(halfWidth, halfHeight) * 1.8 + 0.25
  const angle = Math.atan2(reach, distance)
  const span = distance * Math.tan(angle)

  return {
    angle,
    halfU: halfWidth / (2 * span),
    halfV: halfHeight / (2 * span),
  }
}
