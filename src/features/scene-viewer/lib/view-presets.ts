import { fitDistance, orbitRadius, type CameraPreset } from '@/entities/building'
import type { ViewMode } from '@/entities/configurator-session'

export type ViewScope = {
  min: [number, number, number]
  max: [number, number, number]
  dollhouse: CameraPreset
  fov: number
}

export const VIEW_MODES = [
  'dollhouse',
  'top',
  'side-front',
  'side-right',
  'side-back',
  'side-left',
] as const satisfies readonly ViewMode[]

export function viewModePreset(mode: ViewMode, scope: ViewScope): CameraPreset {
  const [minX, minY, minZ] = scope.min
  const [maxX, maxY, maxZ] = scope.max
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const spread = Math.max(maxX - minX, maxZ - minZ)
  const height = maxY - minY
  const target: [number, number, number] = [cx, minY + height * 0.45, cz]
  const fitted = fitDistance(Math.hypot(maxX - minX, height, maxZ - minZ) / 2, scope.fov)

  switch (mode) {
    case 'top':
      // Slight tilt: polar 0 degenerates camera-controls' orbit math.
      return {
        position: [cx, minY + fitted, cz + spread * 0.08],
        target: [cx, minY, cz],
      }
    case 'side-front':
      return { position: [cx, minY + height * 1.1, maxZ + fitted], target }
    case 'side-back':
      return { position: [cx, minY + height * 1.1, minZ - fitted], target }
    case 'side-right':
      return { position: [maxX + fitted, minY + height * 1.1, cz], target }
    case 'side-left':
      return { position: [minX - fitted, minY + height * 1.1, cz], target }
    case 'dollhouse':
    default:
      return scope.dollhouse
  }
}

/**
 * The largest orbit radius any view button can produce for this scope.
 *
 * The side views stand off by the fitted distance *plus* half the depth, so
 * they arrive further out than the framing radius the zoom ceiling used to be
 * derived from — on a long room, by the whole of its headroom. Measuring the
 * poses themselves is what keeps a preset from landing on the ceiling with the
 * wheel already dead in one direction.
 */
export function farthestPresetRadius(scope: ViewScope): number {
  let farthest = 0
  for (const mode of VIEW_MODES) {
    farthest = Math.max(farthest, orbitRadius(viewModePreset(mode, scope)))
  }
  return farthest
}
