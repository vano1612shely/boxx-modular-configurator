import type { PackageFootprint } from '../model/types'

// Measured from loaded glb bounding boxes, in metres; overrides the admin estimate.
const measured = new Map<number, PackageFootprint>()

export function setMeasuredFootprint(packageId: number, footprint: PackageFootprint) {
  measured.set(packageId, footprint)
}

export function footprintOf(packageId: number, fallback: PackageFootprint): PackageFootprint {
  return measured.get(packageId) ?? fallback
}
