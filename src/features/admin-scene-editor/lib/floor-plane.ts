export type PlaneBounds = { minX: number; minZ: number; maxX: number; maxZ: number }

export const DEFAULT_PLANE_BOUNDS: PlaneBounds = { minX: -6, minZ: -6, maxX: 6, maxZ: 6 }

/** Metres; anything smaller is too small a target to drag. */
const MIN_SPAN = 4

function expand(min: number, max: number): [number, number] {
  const short = MIN_SPAN - (max - min)
  if (short <= 0) return [min, max]
  return [min - short / 2, max + short / 2]
}

export function floorPlaneBounds(
  footprint: PlaneBounds | null,
  fallback: PlaneBounds = DEFAULT_PLANE_BOUNDS,
): PlaneBounds {
  if (!footprint) return fallback

  const [minX, maxX] = expand(footprint.minX, footprint.maxX)
  const [minZ, maxZ] = expand(footprint.minZ, footprint.maxZ)

  return { minX, minZ, maxX, maxZ }
}
