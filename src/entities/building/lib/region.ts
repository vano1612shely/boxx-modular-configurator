import {
  closestPointOnSegment,
  footprintSamples,
  lerpAngleDeg,
  nearestEdgeAlignedRotation,
  outwardEdgeNormal,
  pointInPolygon,
  polygonCentroid,
  polygonSignedArea,
  polygonWindingSign,
  supportRadius,
  type Footprint,
  type Point2,
} from './polygon'

/** A piece of boundary a footprint can be stopped by, with the way out of it. */
export type RegionEdge = {
  a: Point2
  b: Point2
  /** Unit XZ direction pointing out of the region. */
  normal: Point2
}

/**
 * The floor a piece of furniture is allowed to stand on.
 *
 * One polygon in the ordinary case — a whole room, or a single zone. Several
 * when a package is at home in more than one zone of a divided room: there the
 * boundary they share is not a boundary at all, and the thing slides across it
 * as if the line were not drawn. Zones it is *not* at home in are simply left
 * out, which is what stops it there as firmly as a wall.
 *
 * Nothing here assumes the polygons touch. Two zones with a third between them
 * make a region in two disconnected pieces, and the clamp keeps a piece of
 * furniture in whichever one it started in — you cannot cross a room you are
 * not allowed to be in.
 */
export type Region = {
  polygons: Point2[][]
  /** Outer boundary only; edges between two member polygons are dropped. */
  edges: RegionEdge[]
}

/** How far off an edge to look for a neighbour, in meters. */
const OUT_STEP = 0.005

/** How close a foreign vertex must be to an edge to count as sitting on it. */
const ON_EDGE = 1e-3

function lerp(a: Point2, b: Point2, t: number): Point2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
}

/**
 * Where a neighbour's corner lands on this edge, as fractions along it.
 *
 * Without this an edge is classified whole, by its middle — and an edge that
 * runs past two zones, only one of which the furniture may enter, would be
 * called entirely open or entirely shut. Cutting it where the neighbours
 * actually start and stop is what keeps the answer local.
 */
function foreignSplits(a: Point2, b: Point2, others: Point2[][]): number[] {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const lengthSq = dx * dx + dz * dz
  if (lengthSq < 1e-12) return []

  const found: number[] = []
  for (const polygon of others) {
    for (const vertex of polygon) {
      const t = ((vertex.x - a.x) * dx + (vertex.z - a.z) * dz) / lengthSq
      if (t <= 1e-6 || t >= 1 - 1e-6) continue
      const on = lerp(a, b, t)
      if (Math.hypot(on.x - vertex.x, on.z - vertex.z) > ON_EDGE) continue
      found.push(t)
    }
  }

  return [...new Set(found)].sort((p, q) => p - q)
}

type Classified = {
  edges: RegionEdge[]
  /** Pairs of polygon indexes that share a stretch of boundary. */
  touching: Array<[number, number]>
}

function classify(polygons: Point2[][]): Classified {
  const edges: RegionEdge[] = []
  const touching: Array<[number, number]> = []

  polygons.forEach((polygon, index) => {
    const sign = polygonWindingSign(polygon)
    const others = polygons.map((other, i) => ({ other, i })).filter(({ i }) => i !== index)

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]
      const b = polygon[(i + 1) % polygon.length]
      if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-9) continue

      const normal = outwardEdgeNormal(a, b, sign)
      const stops = [0, ...foreignSplits(a, b, others.map(({ other }) => other)), 1]

      for (let k = 0; k < stops.length - 1; k++) {
        const from = lerp(a, b, stops[k])
        const to = lerp(a, b, stops[k + 1])
        const outside = {
          x: (from.x + to.x) / 2 + normal.x * OUT_STEP,
          z: (from.z + to.z) / 2 + normal.z * OUT_STEP,
        }

        // A step off this piece lands in a zone we may also stand in, so there
        // is nothing here to run into — and the two are neighbours.
        const neighbour = others.find(({ other }) => pointInPolygon(outside, other))
        if (neighbour) {
          touching.push([index, neighbour.i])
          continue
        }

        edges.push({ a: from, b: to, normal })
      }
    }
  })

  return { edges, touching }
}

export function regionOf(polygon: Point2[]): Region {
  return regionFrom([polygon])
}

export function regionFrom(polygons: Point2[][]): Region {
  const usable = polygons.filter((polygon) => polygon.length >= 3)
  return { polygons: usable, edges: classify(usable).edges }
}

/**
 * The pieces of the region that are actually reachable from one another.
 *
 * Two zones on either side of a third the furniture may not enter are one
 * region but two places, and nothing may pass between them.
 */
export function connectedGroups(polygons: Point2[][]): Point2[][][] {
  const usable = polygons.filter((polygon) => polygon.length >= 3)
  const owner = usable.map((_, i) => i)

  const rootOf = (i: number): number => (owner[i] === i ? i : (owner[i] = rootOf(owner[i])))
  for (const [a, b] of classify(usable).touching) owner[rootOf(a)] = rootOf(b)

  const groups = new Map<number, Point2[][]>()
  usable.forEach((polygon, i) => {
    const key = rootOf(i)
    const group = groups.get(key)
    if (group) group.push(polygon)
    else groups.set(key, [polygon])
  })

  return [...groups.values()]
}

/**
 * The region reachable from where the thing already stands.
 *
 * A drag reports where the pointer *is*, not how far it moved, so a flick of
 * the mouse across a forbidden zone would otherwise land inside an allowed one
 * on the far side and read as legal. Narrowing to the piece the furniture is
 * standing in is what makes the forbidden zone a wall rather than a gap to be
 * jumped. Falls back to everything when the thing is nowhere it should be.
 */
export function regionAround(polygons: Point2[][], x: number, z: number): Region {
  const groups = connectedGroups(polygons)
  const home = groups.find((group) => group.some((polygon) => pointInPolygon({ x, z }, polygon)))
  return regionFrom(home ?? polygons)
}

export function pointInRegion(p: Point2, region: Region): boolean {
  return region.polygons.some((polygon) => pointInPolygon(p, polygon))
}

export function closestPointOnRegion(p: Point2, region: Region): Point2 {
  let best: Point2 = p
  let bestDistSq = Infinity

  for (const edge of region.edges) {
    const candidate = closestPointOnSegment(p, edge.a, edge.b)
    const dx = candidate.x - p.x
    const dz = candidate.z - p.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = candidate
    }
  }

  return best
}

export function poseInsideRegion(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  region: Region,
): boolean {
  return footprintSamples(x, z, rotationYDeg, footprint).every((p) => pointInRegion(p, region))
}

/** The middle of the biggest piece that holds the point, else of the biggest piece. */
function homeCentroid(region: Region, x: number, z: number): Point2 {
  const inside = region.polygons.filter((polygon) => pointInPolygon({ x, z }, polygon))
  const pick = (inside.length ? inside : region.polygons).reduce<Point2[] | null>(
    (best, polygon) =>
      !best || Math.abs(polygonSignedArea(polygon)) > Math.abs(polygonSignedArea(best))
        ? polygon
        : best,
    null,
  )
  return pick ? polygonCentroid(pick) : { x, z }
}

/** Approximate: falls back to a centre when the footprint cannot fit locally. */
export function clampPoseToRegion(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  region: Region,
): Point2 {
  let px = x
  let pz = z

  for (let iteration = 0; iteration < 10; iteration++) {
    let worst: { dx: number; dz: number; distSq: number } | null = null

    for (const sample of footprintSamples(px, pz, rotationYDeg, footprint)) {
      if (pointInRegion(sample, region)) continue
      const boundary = closestPointOnRegion(sample, region)
      const dx = boundary.x - sample.x
      const dz = boundary.z - sample.z
      const distSq = dx * dx + dz * dz
      if (!worst || distSq > worst.distSq) worst = { dx, dz, distSq }
    }

    if (!worst) return { x: px, z: pz }

    px += worst.dx * 1.02
    pz += worst.dz * 1.02
  }

  if (poseInsideRegion(px, pz, rotationYDeg, footprint, region)) return { x: px, z: pz }

  return homeCentroid(region, x, z)
}

export type EdgeSnapResult = {
  x: number
  z: number
  rotationYDeg: number
  snapped: boolean
}

/** `ramp` is the push past contact, in meters, for full alignment with the edge. */
export function progressiveEdgeSnapRegion(
  rawX: number,
  rawZ: number,
  freeRotationDeg: number,
  footprint: Footprint,
  region: Region,
  ramp = 0.55,
): EdgeSnapResult {
  let best: { penetration: number; edgeAngleDeg: number } | null = null

  for (const edge of region.edges) {
    const abx = edge.b.x - edge.a.x
    const abz = edge.b.z - edge.a.z
    const len = Math.hypot(abx, abz)
    if (len < 1e-9) continue

    const dirX = abx / len
    const dirZ = abz / len
    const { x: nx, z: nz } = edge.normal

    // Only edges the center faces, i.e. projecting within the segment span.
    const along = (rawX - edge.a.x) * dirX + (rawZ - edge.a.z) * dirZ
    const margin = Math.max(footprint.width, footprint.depth) / 2
    if (along < -margin || along > len + margin) continue

    const signedDist = (rawX - edge.a.x) * nx + (rawZ - edge.a.z) * nz
    const support = supportRadius(footprint, freeRotationDeg, (Math.atan2(-nx, nz) * 180) / Math.PI)
    const penetration = signedDist + support

    if (penetration > 0 && (!best || penetration > best.penetration)) {
      best = { penetration, edgeAngleDeg: (Math.atan2(-dirX, dirZ) * 180) / Math.PI }
    }
  }

  if (!best) {
    const clamped = clampPoseToRegion(rawX, rawZ, freeRotationDeg, footprint, region)
    return { ...clamped, rotationYDeg: freeRotationDeg, snapped: false }
  }

  const t = Math.min(best.penetration / ramp, 1)
  const target = nearestEdgeAlignedRotation(freeRotationDeg, best.edgeAngleDeg)
  const rotationYDeg = lerpAngleDeg(freeRotationDeg, target, t)
  const clamped = clampPoseToRegion(rawX, rawZ, rotationYDeg, footprint, region)

  return { ...clamped, rotationYDeg, snapped: true }
}

/** Whether the footprint fits anywhere in the region, tried from each piece. */
export function footprintFitsRegion(footprint: Footprint, region: Region): boolean {
  return region.polygons.some((polygon) => {
    const centroid = polygonCentroid(polygon)
    return [0, 90].some((rotation) => {
      const pose = clampPoseToRegion(centroid.x, centroid.z, rotation, footprint, region)
      return poseInsideRegion(pose.x, pose.z, rotation, footprint, region)
    })
  })
}

export function poseInsidePolygon(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  poly: Point2[],
): boolean {
  return poseInsideRegion(x, z, rotationYDeg, footprint, regionOf(poly))
}

export function clampPoseToPolygon(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  poly: Point2[],
): Point2 {
  return clampPoseToRegion(x, z, rotationYDeg, footprint, regionOf(poly))
}

export function progressiveEdgeSnap(
  rawX: number,
  rawZ: number,
  freeRotationDeg: number,
  footprint: Footprint,
  poly: Point2[],
  ramp = 0.55,
): EdgeSnapResult {
  return progressiveEdgeSnapRegion(rawX, rawZ, freeRotationDeg, footprint, regionOf(poly), ramp)
}

export function footprintFitsPolygon(footprint: Footprint, poly: Point2[]): boolean {
  return footprintFitsRegion(footprint, regionOf(poly))
}
