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

/** The box the region lies in, to sweep across. */
function regionBounds(region: Region) {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity

  for (const polygon of region.polygons) {
    for (const point of polygon) {
      if (point.x < minX) minX = point.x
      if (point.x > maxX) maxX = point.x
      if (point.z < minZ) minZ = point.z
      if (point.z > maxZ) maxZ = point.z
    }
  }

  return { minX, minZ, maxX, maxZ }
}

/**
 * Somewhere in the region this package can stand without hitting anything.
 *
 * The preferred point first, then the rest of the floor, nearest first.
 *
 * It used to try eight compass directions out from the preferred point in
 * rings — nine and forty candidates in all, along two lines and two diagonals.
 * In a small room that is most of the floor; in an eighty-square-metre one it
 * is a star drawn through the middle of an empty room, and once those few spots
 * were taken the room reported itself full while three quarters of it stood
 * bare. The chairs added in a visible cross, which is exactly the shape of the
 * search.
 *
 * Now the whole region is swept on a grid half a footprint across, so a gap
 * anywhere is found — and the sort keeps the old behaviour where it mattered:
 * furniture still lands as close to the middle as it can.
 */
export function findFreeSpotInRegion(
  preferred: { x: number; z: number },
  footprint: PackageFootprint,
  rotationYDeg: number,
  region: Region,
  others: PlacedWithFootprint[],
): { x: number; z: number } | null {
  if (!footprintFitsRegion(footprint, region)) return null

  // Half the narrow side: fine enough to find a gap a piece actually fits in,
  // coarse enough that a large room is still a few hundred candidates and not
  // a few hundred thousand.
  const step = Math.max(0.3, Math.min(footprint.width, footprint.depth) / 2)
  const bounds = regionBounds(region)

  const candidates: Array<{ x: number; z: number }> = []
  for (let x = bounds.minX; x <= bounds.maxX; x += step) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += step) {
      candidates.push({ x, z })
    }
  }

  candidates.sort(
    (a, b) =>
      (a.x - preferred.x) ** 2 +
      (a.z - preferred.z) ** 2 -
      ((b.x - preferred.x) ** 2 + (b.z - preferred.z) ** 2),
  )

  // The asked-for spot is the only one worth pulling into the region: it is
  // where the piece is meant to go, and the sweep below covers everywhere else.
  const first = clampPoseToRegion(preferred.x, preferred.z, rotationYDeg, footprint, region)

  for (const candidate of [first, ...candidates]) {
    if (!poseInsideRegion(candidate.x, candidate.z, rotationYDeg, footprint, region)) continue
    if (collidesWithAny({ ...candidate, rotationYDeg, footprint }, others)) continue

    return { x: candidate.x, z: candidate.z }
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
