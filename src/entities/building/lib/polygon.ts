/** All coordinates are model-space meters on the XZ plane. */

export type Point2 = { x: number; z: number }

export type Footprint = { width: number; depth: number }

const RAD = Math.PI / 180

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Snaps almost-rectilinear edges onto exact axis alignment; diagonals are left alone. */
export function rectifyPolygon<T extends Point2>(polygon: T[]): T[] {
  if (polygon.length < 3) return polygon
  const points = polygon.map((p) => ({ ...p }))
  const tolerance = (majorSpan: number) => Math.max(0.2, majorSpan * 0.08)

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const dx = Math.abs(a.x - b.x)
      const dz = Math.abs(a.z - b.z)
      if (dx > 0 && dx <= tolerance(dz)) {
        const x = (a.x + b.x) / 2
        a.x = x
        b.x = x
      } else if (dz > 0 && dz <= tolerance(dx)) {
        const z = (a.z + b.z) / 2
        a.z = z
        b.z = z
      }
    }
  }
  return points.map((p) => ({ ...p, x: round3(p.x), z: round3(p.z) }))
}

export function polygonSignedArea(poly: Point2[]): number {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    area += a.x * b.z - b.x * a.z
  }
  return area / 2
}

const SQ_FT_PER_SQ_M = 10.763910416709722

/**
 * Floor area of an outline, in square feet.
 *
 * Sign-free, so which way the outline was drawn does not matter. This is the
 * *interior* face of the walls — what the room polygon traces — so it is usable
 * floor area and will not agree with a gross figure measured to the outside.
 */
export function polygonAreaSqFt(poly: Point2[]): number {
  return Math.abs(polygonSignedArea(poly)) * SQ_FT_PER_SQ_M
}

export function polygonCentroid(poly: Point2[]): Point2 {
  const area = polygonSignedArea(poly)

  if (Math.abs(area) < 1e-9) {
    const n = Math.max(poly.length, 1)
    return {
      x: poly.reduce((s, p) => s + p.x, 0) / n,
      z: poly.reduce((s, p) => s + p.z, 0) / n,
    }
  }

  let cx = 0
  let cz = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a.x * b.z - b.x * a.z
    cx += (a.x + b.x) * cross
    cz += (a.z + b.z) * cross
  }
  return { x: cx / (6 * area), z: cz / (6 * area) }
}

/** +1 when the outline runs counter-clockwise in XZ, -1 when clockwise. */
export function polygonWindingSign(poly: Point2[]): 1 | -1 {
  return polygonSignedArea(poly) >= 0 ? 1 : -1
}

/** Unit outward normal of the edge a → b. */
export function outwardEdgeNormal(a: Point2, b: Point2, windingSign: 1 | -1): Point2 {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return { x: 0, z: 0 }
  return { x: (windingSign * dz) / len, z: (-windingSign * dx) / len }
}

const MIN_MITER_COS = 0.35

export type OffsetPolygonResult = {
  points: Point2[]
  /** Vertices whose miter was clamped — the wall is locally thinner there. */
  clampedIndexes: number[]
}

export function offsetPolygonMitered(poly: Point2[], distance: number): OffsetPolygonResult {
  const n = poly.length
  if (n < 3) return { points: poly.map((p) => ({ x: p.x, z: p.z })), clampedIndexes: [] }

  const sign = polygonWindingSign(poly)
  const normals = poly.map((p, i) => outwardEdgeNormal(p, poly[(i + 1) % n], sign))

  const points: Point2[] = []
  const clampedIndexes: number[] = []

  for (let i = 0; i < n; i++) {
    // Vertex i joins the edge ending here (i-1) and the one starting here.
    const prev = normals[(i - 1 + n) % n]
    const next = normals[i]
    let mx = prev.x + next.x
    let mz = prev.z + next.z
    const mLen = Math.hypot(mx, mz)

    if (mLen < 1e-9) {
      // 180° reversal — a degenerate spike.
      points.push({ x: poly[i].x + next.x * distance, z: poly[i].z + next.z * distance })
      clampedIndexes.push(i)
      continue
    }

    mx /= mLen
    mz /= mLen
    const cos = mx * next.x + mz * next.z
    const clamped = cos < MIN_MITER_COS
    if (clamped) clampedIndexes.push(i)
    const scale = distance / Math.max(cos, MIN_MITER_COS)

    points.push({ x: poly[i].x + mx * scale, z: poly[i].z + mz * scale })
  }

  return { points, clampedIndexes }
}

export function polygonBounds(poly: Point2[]) {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const p of poly) {
    minX = Math.min(minX, p.x)
    minZ = Math.min(minZ, p.z)
    maxX = Math.max(maxX, p.x)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, minZ, maxX, maxZ }
}

export function pointInPolygon(p: Point2, poly: Point2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}

function closestPointOnSegment(p: Point2, a: Point2, b: Point2): Point2 {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lenSq = abx * abx + abz * abz
  if (lenSq < 1e-12) return { x: a.x, z: a.z }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lenSq))
  return { x: a.x + abx * t, z: a.z + abz * t }
}

export function closestPointOnPolygon(p: Point2, poly: Point2[]): Point2 {
  let best: Point2 = poly[0]
  let bestDistSq = Infinity
  for (let i = 0; i < poly.length; i++) {
    const candidate = closestPointOnSegment(p, poly[i], poly[(i + 1) % poly.length])
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

export function footprintCorners(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
): Point2[] {
  const hw = footprint.width / 2
  const hd = footprint.depth / 2
  const cos = Math.cos(rotationYDeg * RAD)
  const sin = Math.sin(rotationYDeg * RAD)

  return [
    { dx: -hw, dz: -hd },
    { dx: hw, dz: -hd },
    { dx: hw, dz: hd },
    { dx: -hw, dz: hd },
  ].map(({ dx, dz }) => ({
    x: x + dx * cos + dz * sin,
    z: z - dx * sin + dz * cos,
  }))
}

function samplePoints(corners: Point2[]): Point2[] {
  const samples = [...corners]
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % corners.length]
    samples.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })
  }
  return samples
}

export function poseInsidePolygon(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  poly: Point2[],
): boolean {
  return samplePoints(footprintCorners(x, z, rotationYDeg, footprint)).every((p) =>
    pointInPolygon(p, poly),
  )
}

/** Approximate: falls back to the centroid when the footprint cannot fit locally. */
export function clampPoseToPolygon(
  x: number,
  z: number,
  rotationYDeg: number,
  footprint: Footprint,
  poly: Point2[],
): Point2 {
  let px = x
  let pz = z

  for (let iteration = 0; iteration < 10; iteration++) {
    const samples = samplePoints(footprintCorners(px, pz, rotationYDeg, footprint))
    let worst: { dx: number; dz: number; distSq: number } | null = null

    for (const sample of samples) {
      if (pointInPolygon(sample, poly)) continue
      const boundary = closestPointOnPolygon(sample, poly)
      const dx = boundary.x - sample.x
      const dz = boundary.z - sample.z
      const distSq = dx * dx + dz * dz
      if (!worst || distSq > worst.distSq) worst = { dx, dz, distSq }
    }

    if (!worst) return { x: px, z: pz }

    px += worst.dx * 1.02
    pz += worst.dz * 1.02
  }

  if (poseInsidePolygon(px, pz, rotationYDeg, footprint, poly)) return { x: px, z: pz }

  const centroid = polygonCentroid(poly)
  return { x: centroid.x, z: centroid.z }
}

/** Half-extent of the rotated footprint projected onto a direction (by angle). */
function supportRadius(footprint: Footprint, rotationYDeg: number, dirAngleDeg: number): number {
  const rel = (rotationYDeg - dirAngleDeg) * RAD
  return (Math.abs(Math.cos(rel)) * footprint.width) / 2 + (Math.abs(Math.sin(rel)) * footprint.depth) / 2
}

function lerpAngleDeg(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return from + delta * t
}

/** Rotation aligned with the edge (edge angle + k·90°) nearest to `fromDeg`. */
export function nearestEdgeAlignedRotation(fromDeg: number, edgeAngleDeg: number): number {
  let best = fromDeg
  let bestDist = Infinity
  for (let k = 0; k < 4; k++) {
    const candidate = edgeAngleDeg + k * 90
    const dist = Math.abs(((candidate - fromDeg + 540) % 360) - 180)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return ((best % 360) + 360) % 360
}

export type EdgeSnapResult = {
  x: number
  z: number
  rotationYDeg: number
  snapped: boolean
}

/** `ramp` is the push past contact, in meters, for full alignment with the edge. */
export function progressiveEdgeSnap(
  rawX: number,
  rawZ: number,
  freeRotationDeg: number,
  footprint: Footprint,
  poly: Point2[],
  ramp = 0.55,
): EdgeSnapResult {
  const centroid = polygonCentroid(poly)
  let best: { penetration: number; edgeAngleDeg: number } | null = null

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const len = Math.hypot(abx, abz)
    if (len < 1e-9) continue

    const dirX = abx / len
    const dirZ = abz / len
    let nx = abz / len
    let nz = -abx / len
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    if (nx * (midX - centroid.x) + nz * (midZ - centroid.z) < 0) {
      nx = -nx
      nz = -nz
    }

    // Only edges the center faces, i.e. projecting within the segment span.
    const along = (rawX - a.x) * dirX + (rawZ - a.z) * dirZ
    const margin = Math.max(footprint.width, footprint.depth) / 2
    if (along < -margin || along > len + margin) continue

    const signedDist = (rawX - a.x) * nx + (rawZ - a.z) * nz
    const support = supportRadius(footprint, freeRotationDeg, (Math.atan2(-nx, nz) * 180) / Math.PI)
    const penetration = signedDist + support

    if (penetration > 0 && (!best || penetration > best.penetration)) {
      best = {
        penetration,
        edgeAngleDeg: (Math.atan2(-dirX, dirZ) * 180) / Math.PI,
      }
    }
  }

  if (!best) {
    const clamped = clampPoseToPolygon(rawX, rawZ, freeRotationDeg, footprint, poly)
    return { ...clamped, rotationYDeg: freeRotationDeg, snapped: false }
  }

  const t = Math.min(best.penetration / ramp, 1)
  const target = nearestEdgeAlignedRotation(freeRotationDeg, best.edgeAngleDeg)
  const rotationYDeg = lerpAngleDeg(freeRotationDeg, target, t)
  const clamped = clampPoseToPolygon(rawX, rawZ, rotationYDeg, footprint, poly)

  return { ...clamped, rotationYDeg, snapped: true }
}

export function footprintFitsPolygon(footprint: Footprint, poly: Point2[]): boolean {
  const centroid = polygonCentroid(poly)
  return [0, 90].some((rotation) => {
    const pose = clampPoseToPolygon(centroid.x, centroid.z, rotation, footprint, poly)
    return poseInsidePolygon(pose.x, pose.z, rotation, footprint, poly)
  })
}
