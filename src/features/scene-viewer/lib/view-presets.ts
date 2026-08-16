import {
  fitDistance,
  frameRoom,
  orbitRadius,
  polygonBounds,
  type CameraPreset,
  type Room,
} from '@/entities/building'
import type { ViewMode } from '@/entities/configurator-session'

export type ViewScope = {
  min: [number, number, number]
  max: [number, number, number]
  dollhouse: CameraPreset
  fov: number
}

/**
 * What the camera is looking at when the subject is one room.
 *
 * Used for a room the visitor is standing in and for one they are only looking
 * down at from outside — the subject is the same either way, and it is the view
 * mode that decides where they look at it from.
 *
 * Anchored at the room's own floor level, not y=0: the model sits on a base
 * that belongs to no room.
 */
export function roomScope(room: Room, fov: number): ViewScope {
  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const { floorY, wallHeight } = room.shell

  return {
    min: [minX, floorY, minZ],
    max: [maxX, floorY + wallHeight, maxZ],
    dollhouse: frameRoom(room, fov),
    fov,
  }
}

export const VIEW_MODES = ['dollhouse', 'top'] as const satisfies readonly ViewMode[]

export function viewModePreset(mode: ViewMode, scope: ViewScope): CameraPreset {
  const [minX, minY, minZ] = scope.min
  const [maxX, maxY, maxZ] = scope.max
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const spread = Math.max(maxX - minX, maxZ - minZ)
  const height = maxY - minY
  const fitted = fitDistance(Math.hypot(maxX - minX, height, maxZ - minZ) / 2, scope.fov)

  switch (mode) {
    case 'top':
      // Slight tilt: polar 0 degenerates camera-controls' orbit math.
      return {
        position: [cx, minY + fitted, cz + spread * 0.08],
        target: [cx, minY, cz],
      }
    case 'dollhouse':
    default:
      return scope.dollhouse
  }
}

/**
 * The largest orbit radius any view button can produce for this scope.
 *
 * The two poses are fitted to different things — one to the subject's height
 * from overhead, the other to a standing eye's distance from it — so neither is
 * reliably the further out. Measuring both is what keeps a preset from landing
 * on the zoom ceiling with the wheel already dead in one direction.
 */
export function farthestPresetRadius(scope: ViewScope): number {
  let farthest = 0
  for (const mode of VIEW_MODES) {
    farthest = Math.max(farthest, orbitRadius(viewModePreset(mode, scope)))
  }
  return farthest
}
