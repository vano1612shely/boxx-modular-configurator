import {
  clampPoseToRegion,
  footprintFitsRegion,
  poseInsideRegion,
  regionOf,
  type Point2,
  type Region,
} from '@/entities/building'
import type { PlacedPackage } from '@/entities/configuration'
import type { PackageFootprint } from '@/entities/furniture-package'

export type HalfExtents = { halfW: number; halfD: number }

/** World-axis-aligned half extents of a footprint rotated by rotationYDeg. */
export function rotatedHalfExtents(footprint: PackageFootprint, rotationYDeg: number): HalfExtents {
  const rad = (rotationYDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    halfW: (cos * footprint.width + sin * footprint.depth) / 2,
    halfD: (sin * footprint.width + cos * footprint.depth) / 2,
  }
}

type PlacedWithFootprint = Pick<PlacedPackage, 'x' | 'z' | 'rotationYDeg'> & {
  footprint: PackageFootprint
}

/** AABB overlap test on rotated-footprint extents (conservative for rotated boxes). */
export function overlaps(a: PlacedWithFootprint, b: PlacedWithFootprint): boolean {
  const ea = rotatedHalfExtents(a.footprint, a.rotationYDeg)
  const eb = rotatedHalfExtents(b.footprint, b.rotationYDeg)
  return Math.abs(a.x - b.x) < ea.halfW + eb.halfW && Math.abs(a.z - b.z) < ea.halfD + eb.halfD
}

export function collidesWithAny(
  candidate: PlacedWithFootprint,
  others: PlacedWithFootprint[],
): boolean {
  return others.some((other) => overlaps(candidate, other))
}

/** Preferred spot, else a spiral of offsets around it; null when nothing fits. */
export function findFreeSpotInRegion(
  preferred: { x: number; z: number },
  footprint: PackageFootprint,
  rotationYDeg: number,
  region: Region,
  others: PlacedWithFootprint[],
): { x: number; z: number } | null {
  if (!footprintFitsRegion(footprint, region)) return null

  const step = 0.75
  const candidates: Array<{ x: number; z: number }> = [preferred]

  for (let ring = 1; ring <= 6; ring++) {
    const distance = ring * step
    for (const [dx, dz] of [
      [distance, 0],
      [-distance, 0],
      [0, distance],
      [0, -distance],
      [distance, distance],
      [-distance, distance],
      [distance, -distance],
      [-distance, -distance],
    ]) {
      candidates.push({ x: preferred.x + dx, z: preferred.z + dz })
    }
  }

  for (const candidate of candidates) {
    const clamped = clampPoseToRegion(candidate.x, candidate.z, rotationYDeg, footprint, region)

    if (!poseInsideRegion(clamped.x, clamped.z, rotationYDeg, footprint, region)) continue

    const spot = { ...clamped, rotationYDeg, footprint }
    if (!collidesWithAny(spot, others)) return clamped
  }

  return null
}

/** The single-polygon case, which is every room nobody has divided. */
export function findFreeSpot(
  preferred: { x: number; z: number },
  footprint: PackageFootprint,
  rotationYDeg: number,
  polygon: Point2[],
  others: PlacedWithFootprint[],
): { x: number; z: number } | null {
  return findFreeSpotInRegion(preferred, footprint, rotationYDeg, regionOf(polygon), others)
}
