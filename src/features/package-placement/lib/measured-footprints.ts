import type { PackageFootprint } from '@/entities/furniture-package'

/**
 * Real footprints measured from loaded glb bounding boxes (meters).
 * More accurate than the admin-entered estimate; used for clamping,
 * collisions and wall snapping once the model is on the scene.
 */
const measured = new Map<number, PackageFootprint>()

export function setMeasuredFootprint(packageId: number, footprint: PackageFootprint) {
  measured.set(packageId, footprint)
}

export function footprintOf(packageId: number, fallback: PackageFootprint): PackageFootprint {
  return measured.get(packageId) ?? fallback
}
