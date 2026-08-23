import type { PackageFootprint, PackageShape } from '@/entities/furniture-package'

/**
 * What one fitting fills, ready to be handed to the collision test.
 *
 * The same record a placed package produces — a rectangle, a facing and, once
 * its model has been read, the shape it really fills — so a chair being dragged
 * cannot tell a fridge that was bought from a counter that came with the
 * building, and neither can the code that stops it.
 */
export type PartObstacle = {
  x: number
  z: number
  rotationYDeg: number
  footprint: PackageFootprint
  shape: PackageShape | null
}

/**
 * Fittings measured so far, by the geometry they draw.
 *
 * Module scope, like the package registries next door and for the same reason:
 * what a model fills is a fact about the file, not about the room it happens to
 * be standing in, and measuring it once per room would be measuring it again
 * for every building that uses it.
 */
const byKey = new Map<string, PartObstacle>()

let version = 0

/**
 * Bumped whenever a fitting is measured.
 *
 * A drag takes the room apart once and holds the answer, because nothing can
 * move while a piece is in the air. A fitting arriving is the one thing that
 * can change it mid-drag — a kitchen measured a frame late would otherwise let
 * a chair through the fridge for the whole of that drag and never recover.
 */
export function partObstaclesVersion(): number {
  return version
}

export function setPartObstacle(key: string, obstacle: PartObstacle) {
  byKey.set(key, obstacle)
  version += 1
}

export function hasPartObstacle(key: string): boolean {
  return byKey.has(key)
}

/**
 * What a fitting fills, or null while its model is still on its way.
 *
 * Null means "leave it out", not "it fills nothing you can walk through": for
 * the handful of frames before a model lands, a fitting stops nothing. The
 * alternative — a guessed rectangle — would refuse poses that are perfectly
 * legal, and the room's fittings are warmed with the catalogue precisely so
 * that this window stays a window.
 */
export function partObstacleOf(key: string): PartObstacle | null {
  return byKey.get(key) ?? null
}
