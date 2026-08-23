import type { Vec3Tuple } from '../model/types'

export type SunBounds = { min: Vec3Tuple; max: Vec3Tuple }

export type SunPlacement = {
  /** Where the light stands, far enough out to read as a sun. */
  position: Vec3Tuple
  /** What it points at: the middle of whatever it is lighting. */
  target: Vec3Tuple
  /** Half-extent its shadow camera has to cover. */
  extent: number
  /** How far it can see, which has to reach past the far side of the subject. */
  far: number
}

/** The direction the sun comes from, over the shoulder and to the left. */
const DIRECTION: Vec3Tuple = [0.45, 0.85, 0.4]

const LENGTH = Math.hypot(...DIRECTION)

/** Widest half-extent the shadow camera is allowed to cover, in metres. */
const MAX_SHADOW_EXTENT = 24

/** What to light when nothing has been measured yet. */
const FALLBACK_RADIUS = 20

/**
 * Where the sun stands for a given subject, worked out rather than remembered.
 *
 * It used to be set on the light imperatively, once, by an effect keyed on the
 * bounds — and a value written once onto an object somebody else owns is a
 * value that can be lost. Losing this one puts the light at the origin looking
 * at the origin, which is a direction of zero length: the sun then contributes
 * nothing, the scene is left with only its hemisphere light, and every surface
 * that was lit reads as near black until the page is reloaded.
 *
 * As a function it can be handed to the light as an ordinary prop, re-applied
 * as often as anything else, and checked here rather than on screen.
 */
export function sunPlacement(bounds: SunBounds | null): SunPlacement {
  let centre: Vec3Tuple = [0, 0, 0]
  let radius = FALLBACK_RADIUS

  if (bounds) {
    const [minX, minY, minZ] = bounds.min
    const [maxX, maxY, maxZ] = bounds.max
    centre = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
    radius = Math.max(Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2, 1)
  }

  const reach = (radius * 3) / LENGTH

  return {
    position: [
      centre[0] + DIRECTION[0] * reach,
      centre[1] + DIRECTION[1] * reach,
      centre[2] + DIRECTION[2] * reach,
    ],
    target: centre,
    // three's default shadow frustum is a 10 m box at the world origin.
    extent: Math.min(radius * 1.25, MAX_SHADOW_EXTENT),
    far: radius * 8,
  }
}
