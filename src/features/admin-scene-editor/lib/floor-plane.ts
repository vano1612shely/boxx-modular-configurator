export type PlaneBounds = { minX: number; minZ: number; maxX: number; maxZ: number }

/**
 * Footprint of the floor-level plane gizmo.
 *
 * The plane has to be big enough to read as a plane and small enough not to
 * swallow the model. It follows whatever the admin is actually working on:
 * the room's own outline, the outline being traced, or — with nothing drawn
 * yet — the building itself.
 */
export function floorPlaneBounds(
  points: ReadonlyArray<{ x: number; z: number }>,
  pad: number,
  fallback: PlaneBounds,
): PlaneBounds {
  if (points.length === 0) return fallback

  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minZ = Math.min(minZ, point.z)
    maxX = Math.max(maxX, point.x)
    maxZ = Math.max(maxZ, point.z)
  }

  // A single point (the first click of a new outline) has no extent of its
  // own, so the padding alone has to carry it.
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad }
}
