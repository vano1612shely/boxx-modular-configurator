import {
  clampPoseToRegion,
  footprintFitsRegion,
  poseInsideRegion,
  regionOf,
  type Point2,
  type Region,
} from '@/entities/building'
import type { PlacedPackage } from '@/entities/configuration'
import { shapesCollide, type PackageFootprint, type PackageShape } from '@/entities/furniture-package'

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
  /**
   * What the model really fills, once it has been measured off the glb.
   *
   * Absent or null on everything that has not loaded yet, and on every caller
   * that has no model to measure — auto-placement, the tests below. Those get
   * the footprint rule, unchanged.
   */
  shape?: PackageShape | null
}

/** AABB overlap test on rotated-footprint extents (conservative for rotated boxes). */
export function overlapsExtents(a: PlacedWithFootprint, b: PlacedWithFootprint): boolean {
  const ea = rotatedHalfExtents(a.footprint, a.rotationYDeg)
  const eb = rotatedHalfExtents(b.footprint, b.rotationYDeg)
  return Math.abs(a.x - b.x) < ea.halfW + eb.halfW && Math.abs(a.z - b.z) < ea.halfD + eb.halfD
}

/** Half-extents of a footprint along its own axes, and the axes themselves. */
function rectAxes(item: PlacedWithFootprint) {
  const rad = (item.rotationYDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    hw: item.footprint.width / 2,
    hd: item.footprint.depth / 2,
    // The rectangle's own two directions in world space, from the same Y
    // rotation the meshes use.
    ax: { x: cos, z: -sin },
    az: { x: sin, z: cos },
  }
}

/**
 * Whether the two footprint rectangles themselves overlap.
 *
 * The extents test above circumscribes a turned rectangle with an upright one:
 * a 0.45 m chair at 37° is treated as a 0.64 m square. That is fine as a first
 * pass and hopeless as a verdict — it is most of a chair's width of phantom
 * bulk, and the angle slider hands out every angle there is. Four axes are
 * enough; both boxes are extruded along the same vertical, so the pairs of
 * cross products a full 3D test would add are all degenerate.
 *
 * At right angles it agrees with the extents test exactly, which is why nothing
 * that was placed by the old rule moves.
 */
export function rectsOverlap(a: PlacedWithFootprint, b: PlacedWithFootprint): boolean {
  const ra = rectAxes(a)
  const rb = rectAxes(b)
  const dx = b.x - a.x
  const dz = b.z - a.z

  for (const axis of [ra.ax, ra.az, rb.ax, rb.az]) {
    const gap = Math.abs(dx * axis.x + dz * axis.z)
    const reach =
      Math.abs((ra.ax.x * axis.x + ra.ax.z * axis.z) * ra.hw) +
      Math.abs((ra.az.x * axis.x + ra.az.z * axis.z) * ra.hd) +
      Math.abs((rb.ax.x * axis.x + rb.ax.z * axis.z) * rb.hw) +
      Math.abs((rb.az.x * axis.x + rb.az.z * axis.z) * rb.hd)

    if (gap >= reach) return false
  }

  return true
}

/**
 * Whether two placed packages are in each other's way.
 *
 * Three questions, each only asked when the one before it said yes:
 *
 *   1. do the upright boxes around them overlap — the rule this app has always
 *      used, kept first and unchanged;
 *   2. do the footprint rectangles themselves overlap;
 *   3. do the models, where both have been measured, actually share any air.
 *
 * Written as a conjunction on purpose, because that is the safety property
 * rather than an implementation detail: whatever the measured shapes say, and
 * however wrong a measurement might be, this can only ever *allow* more than
 * the old rule did. Nothing a visitor could place yesterday is refused today.
 *
 * Which is the whole point of the third question. A desk is a top on four legs,
 * and the space under it is space; a chair belongs in it, and until now the
 * rectangle around the desk said otherwise.
 */
export function overlaps(a: PlacedWithFootprint, b: PlacedWithFootprint): boolean {
  if (!overlapsExtents(a, b)) return false
  if (!rectsOverlap(a, b)) return false
  if (!a.shape || !b.shape) return true

  return shapesCollide(
    { shape: a.shape, x: a.x, z: a.z, rotationYDeg: a.rotationYDeg },
    { shape: b.shape, x: b.x, z: b.z, rotationYDeg: b.rotationYDeg },
  )
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
 * How many already-placed pieces contribute standing positions of their own.
 *
 * Every one of them adds two coordinates per axis, and the two axes are crossed
 * — so this is squared, and a room filling up with chairs would grind. The
 * nearest are the ones a gap is actually being looked for between; past those
 * the sweep is the answer, and by then the pieces are small enough that it is
 * a fine one.
 */
const CONTACT_BLOCKERS = 16

/** Clear of what it stands against — the overlap test is strict, so this only
 *  has to survive the rounding. A tenth of a millimetre. */
const CLEARANCE = 1e-4

/** One axis of a blocker, as the piece meets it. */
type Span = { centre: number; half: number }

/**
 * How far the piece could slide along one axis before something stopped it.
 *
 * Only what is actually in the way counts: a blocker the piece passes clear of
 * on the other axis is not in this corridor at all.
 */
function slideRange(
  centre: number,
  half: number,
  lo: number,
  hi: number,
  blockers: Span[],
): { lo: number; hi: number } {
  let low = lo + half
  let high = hi - half

  for (const blocker of blockers) {
    const clear = blocker.half + half
    if (blocker.centre < centre) low = Math.max(low, blocker.centre + clear)
    else high = Math.min(high, blocker.centre - clear)
  }

  return { lo: low, hi: high }
}

/** Where a piece of this size stands flush against something, along one axis. */
function contactCoords(
  lo: number,
  hi: number,
  half: number,
  blockers: Array<{ centre: number; half: number }>,
  preferred: number,
): number[] {
  const coords = [preferred, lo + half + CLEARANCE, hi - half - CLEARANCE]

  for (const blocker of blockers) {
    coords.push(blocker.centre - blocker.half - half - CLEARANCE)
    coords.push(blocker.centre + blocker.half + half + CLEARANCE)
  }

  return coords
}

/**
 * Somewhere in the region this package can stand without hitting anything.
 *
 * The preferred point first, then everywhere it could stand flush against a
 * wall or against something already there, then a sweep of the whole floor —
 * all of it nearest-first, so furniture still lands as close to the middle as
 * it can.
 *
 * It used to be the sweep alone, on a grid half a footprint across. That reads
 * as thorough and is at its coarsest exactly where it needs to be finest: a
 * premium office is deeper than a 2.8 m room, so it stands sideways or not at
 * all, and sideways it clears the walls by 15 cm a side. Its grid step was
 * 1.24 m. The sweep stepped over the band of positions that work, every time,
 * and the room reported itself full with half its floor bare. An empty room hid
 * it, because the preferred point is tried first and an empty room accepts it.
 *
 * The contact positions are what makes this answer properly rather than more
 * finely: anything that fits somewhere can be pushed back until it touches two
 * things, and that pose is in the list by construction. The sweep stays for
 * regions the pushing does not describe — a zone cut off a room at an angle,
 * where the walls are not the box the contacts are taken from.
 */
export function findFreeSpotInRegion(
  preferred: { x: number; z: number },
  footprint: PackageFootprint,
  rotationYDeg: number,
  region: Region,
  others: PlacedWithFootprint[],
): { x: number; z: number } | null {
  if (!footprintFitsRegion(footprint, region)) return null

  const bounds = regionBounds(region)
  const { halfW, halfD } = rotatedHalfExtents(footprint, rotationYDeg)

  const near = [...others]
    .sort(
      (a, b) =>
        (a.x - preferred.x) ** 2 +
        (a.z - preferred.z) ** 2 -
        ((b.x - preferred.x) ** 2 + (b.z - preferred.z) ** 2),
    )
    .slice(0, CONTACT_BLOCKERS)
    .map((other) => ({ ...other, ...rotatedHalfExtents(other.footprint, other.rotationYDeg) }))

  const xs = contactCoords(
    bounds.minX,
    bounds.maxX,
    halfW,
    near.map((other) => ({ centre: other.x, half: other.halfW })),
    preferred.x,
  )
  const zs = contactCoords(
    bounds.minZ,
    bounds.maxZ,
    halfD,
    near.map((other) => ({ centre: other.z, half: other.halfD })),
    preferred.z,
  )

  const candidates: Array<{ x: number; z: number }> = []
  for (const x of xs) for (const z of zs) candidates.push({ x, z })

  // Half the narrow side while there is room to spare, and no coarser than the
  // slack itself — a piece with 15 cm to give cannot be looked for in strides
  // of a metre. Floored so a large room stays a few hundred candidates.
  const slack = Math.min(
    bounds.maxX - bounds.minX - 2 * halfW,
    bounds.maxZ - bounds.minZ - 2 * halfD,
  )
  const step = Math.min(
    0.5,
    Math.max(0.1, Math.min(Math.min(footprint.width, footprint.depth) / 2, slack / 2)),
  )

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
  // where the piece is meant to go, and the rest of the list covers everywhere
  // else.
  const first = clampPoseToRegion(preferred.x, preferred.z, rotationYDeg, footprint, region)

  for (const candidate of [first, ...candidates]) {
    if (!poseInsideRegion(candidate.x, candidate.z, rotationYDeg, footprint, region)) continue
    if (collidesWithAny({ ...candidate, rotationYDeg, footprint }, others)) continue

    return middleOfTheGap(candidate, footprint, rotationYDeg, region, others, bounds)
  }

  return null
}

/**
 * The same free space, taken in the middle of it rather than at the edge.
 *
 * What the search finds is a pose that works, and the ones that work are found
 * flush against things — so left alone a package arrives pressed up against
 * whatever was nearest. Sliding it to the middle of the run it has costs
 * nothing and is where anyone would have put it: the first package into an
 * empty room stands in the middle of the room, and the next stands in the
 * middle of what is left.
 *
 * Each axis in turn, because centring on one changes what is in the way on the
 * other. Checked at the end rather than trusted: the corridors are measured
 * against the region's own box, which is not the region itself once a room has
 * been cut into zones.
 */
function middleOfTheGap(
  found: { x: number; z: number },
  footprint: PackageFootprint,
  rotationYDeg: number,
  region: Region,
  others: PlacedWithFootprint[],
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number },
): { x: number; z: number } {
  const { halfW, halfD } = rotatedHalfExtents(footprint, rotationYDeg)
  const spans = others.map((other) => ({
    ...other,
    ...rotatedHalfExtents(other.footprint, other.rotationYDeg),
  }))

  const across = slideRange(
    found.x,
    halfW,
    bounds.minX,
    bounds.maxX,
    spans
      .filter((other) => Math.abs(found.z - other.z) < halfD + other.halfD)
      .map((other) => ({ centre: other.x, half: other.halfW })),
  )
  const x = across.lo <= across.hi ? (across.lo + across.hi) / 2 : found.x

  const along = slideRange(
    found.z,
    halfD,
    bounds.minZ,
    bounds.maxZ,
    spans
      .filter((other) => Math.abs(x - other.x) < halfW + other.halfW)
      .map((other) => ({ centre: other.z, half: other.halfD })),
  )
  const z = along.lo <= along.hi ? (along.lo + along.hi) / 2 : found.z

  if (!poseInsideRegion(x, z, rotationYDeg, footprint, region)) return found
  if (collidesWithAny({ x, z, rotationYDeg, footprint }, others)) return found

  return { x, z }
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
