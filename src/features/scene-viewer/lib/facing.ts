import type { ViewMode } from '@/entities/configurator-session'

const QUARTER = Math.PI / 2

/** How far off square still reads as looking at that face (about 6°). */
const ON_FACE = 0.105

/** Below this elevation the camera is overhead, looking at no side at all. */
const OVERHEAD = 0.6

/**
 * Faces in azimuth order.
 *
 * camera-controls composes the position with `setFromSpherical`, so the azimuth
 * is `atan2(x, z)` off the target: zero puts the camera on +Z, which is the pose
 * `viewModePreset` produces for the front. A quarter turn from there is +X, and
 * so on round.
 */
const FACES = ['side-front', 'side-right', 'side-back', 'side-left'] as const

/**
 * Which side the camera is actually looking at, or null when it is between two.
 *
 * The bar used to name the side from the button last pressed, which stopped
 * being true the moment anyone dragged the view: a camera turned right around
 * still had "Front" spelled out and lit. Reading it off the pose instead means
 * the label is either right or absent.
 */
export function facingSide(azimuth: number, polar: number): ViewMode | null {
  if (polar < OVERHEAD) return null

  const steps = Math.round(azimuth / QUARTER)
  if (Math.abs(azimuth - steps * QUARTER) > ON_FACE) return null

  return FACES[((steps % 4) + 4) % 4]
}
