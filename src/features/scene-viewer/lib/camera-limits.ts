import { orbitRadius, type CameraPreset, type Extent } from '@/entities/building'

import { farthestPresetRadius, type ViewScope } from './view-presets'

/** Closest the camera may orbit while a room is focused, in metres. */
const ROOM_MIN_DISTANCE = 0.4

/** Headroom multiplier on the ceiling, over the pose it has to admit. */
const CEILING_SLACK = 1.4

/** Most the pan boundary ever gives downward, in metres. */
const MAX_DROP = 0.5

// zoomOut: multiple of the farthest preset distance (1 = it is already the wall).
// panSlack: fraction of subject radius; well under 1 or the subject pans off screen.
export const LIMITS = {
  room: { zoomOut: 1.35, panSlack: 0.3 },
  building: { zoomOut: 1.6, panSlack: 0.5 },
} as const

export type LimitScope = ViewScope

export type CameraLimits = {
  min: number
  max: number
  /** Bounds for the orbit target, or null while there is nothing measured. */
  boundary: Extent | null
}

export type AuthoredCamera = {
  minDistance: number
  maxDistance: number
  position: [number, number, number]
  target: [number, number, number]
}

/** Max orbit distance, never closer than the pose it has to admit. */
function ceiling(authored: AuthoredCamera, radius: number): number {
  return Math.max(authored.maxDistance, radius) * CEILING_SLACK
}

export function cameraLimits(
  scope: LimitScope | null,
  authored: AuthoredCamera,
  focusedRoom: boolean,
): CameraLimits {
  const min = focusedRoom
    ? Math.min(authored.minDistance, ROOM_MIN_DISTANCE)
    : authored.minDistance

  if (!scope) {
    const authoredPose: CameraPreset = { position: authored.position, target: authored.target }
    return { min, max: ceiling(authored, orbitRadius(authoredPose)), boundary: null }
  }

  const [minX, minY, minZ] = scope.min
  const [maxX, maxY, maxZ] = scope.max
  const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2
  const { zoomOut, panSlack } = focusedRoom ? LIMITS.room : LIMITS.building
  const slack = radius * panSlack

  // The ceiling is headroom past the *poses the view buttons produce*, not past
  // the framing radius: the side views stand off further than the framing, so
  // deriving it from the framing left them arriving with the wheel already at
  // the stop in the zoom-out direction.
  const farthest = farthestPresetRadius(scope)

  return {
    min,
    max: Math.min(ceiling(authored, farthest), farthest * zoomOut),
    // Bounds the orbit target, not the camera: downward slack is slack the
    // camera follows the target through, below the ground.
    boundary: {
      min: [minX - slack, minY - Math.min(slack, MAX_DROP), minZ - slack],
      max: [maxX + slack, maxY + slack, maxZ + slack],
    },
  }
}
