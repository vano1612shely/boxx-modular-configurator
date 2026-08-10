import { pointInPolygon, polygonSignedArea, type Point2 } from './polygon'

/**
 * How far a cut's first or last point may sit from the outline (meters).
 *
 * Generous, because the admin aims at a wall with a mouse: the point is pulled
 * onto the outline rather than rejected. Past this it was not a wall they meant.
 */
const ON_OUTLINE = 0.25

/** Areas under this are slivers, not zones (m²). */
const MIN_AREA = 0.01

/** Sign noise in the orientation tests, in m². */
const EPS = 1e-9

/** Two points closer than this are the same point. */
const SAME = 1e-6

export type PolygonCut = [Point2[], Point2[]]

export type CutFailure =
  | 'short-path'
  | 'ends-off-outline'
  | 'ends-together'
  | 'leaves-the-room'
  | 'crosses-itself'
  | 'empty-side'

export type CutResult =
  | { ok: true; parts: PolygonCut }
  | { ok: false; reason: CutFailure }

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function same(a: Point2, b: Point2): boolean {
  return Math.abs(a.x - b.x) < SAME && Math.abs(a.z - b.z) < SAME
}

/** Twice the signed area of the triangle; the sign says which way `b` turns. */
function turn(o: Point2, a: Point2, b: Point2): number {
  return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
}

/**
 * True only when the segments cross through each other's interiors.
 *
 * Touching at an endpoint is not a crossing: the cut starts and ends *on* the
 * outline, so every valid cut touches it twice by construction.
 */
function properlyCross(a1: Point2, a2: Point2, b1: Point2, b2: Point2): boolean {
  const d1 = turn(a1, a2, b1)
  const d2 = turn(a1, a2, b2)
  const d3 = turn(b1, b2, a1)
  const d4 = turn(b1, b2, a2)

  const straddles = (p: number, q: number) => (p > EPS && q < -EPS) || (p < -EPS && q > EPS)
  return straddles(d1, d2) && straddles(d3, d4)
}

/** Where a point sits on the outline: which edge, and how far along it. */
type Anchor = { index: number; t: number; point: Point2 }

function anchorOn(polygon: Point2[], p: Point2): { anchor: Anchor; distance: number } | null {
  let best: Anchor | null = null
  let bestDistance = Infinity

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const lengthSq = dx * dx + dz * dz
    if (lengthSq < 1e-12) continue

    const t = Math.min(Math.max(((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq, 0), 1)
    const point = { x: a.x + dx * t, z: a.z + dz * t }
    const distance = Math.hypot(point.x - p.x, point.z - p.z)

    if (distance < bestDistance) {
      bestDistance = distance
      best = { index: i, t, point }
    }
  }

  return best ? { anchor: best, distance: bestDistance } : null
}

/**
 * Outline vertices strictly between two anchors, walking the ring forward.
 *
 * Anchors sit *on* edges, so the first vertex met after one on edge `i` is
 * `v[i+1]`, and the last one before an anchor on edge `j` is `v[j]`.
 */
function between(polygon: Point2[], from: Anchor, to: Anchor): Point2[] {
  const n = polygon.length
  if (from.index === to.index && to.t >= from.t) return []

  const out: Point2[] = []
  let k = (from.index + 1) % n

  for (let guard = 0; guard < n; guard++) {
    out.push(polygon[k])
    if (k === to.index) break
    k = (k + 1) % n
  }

  return out
}

function dropRepeats(ring: Point2[]): Point2[] {
  return ring.filter((p, i) => !same(p, ring[(i - 1 + ring.length) % ring.length]) || ring.length < 2)
}

/**
 * Splits a polygon along a cut that runs from one point on its outline to
 * another, through any number of corners in between.
 *
 * The two halves are handed the *same* rounded cut points, so the boundary they
 * share is identical to the last decimal. Everything downstream depends on that:
 * a zone edge is recognised as internal — one furniture may cross, another may
 * not — by stepping off it and landing in the neighbour, and a half-millimetre
 * of daylight between the two would read as a gap in the floor.
 */
export function cutPolygon(polygon: Point2[], path: Point2[]): CutResult {
  if (polygon.length < 3 || path.length < 2) return { ok: false, reason: 'short-path' }

  const head = anchorOn(polygon, path[0])
  const tail = anchorOn(polygon, path[path.length - 1])
  if (!head || !tail) return { ok: false, reason: 'ends-off-outline' }
  if (head.distance > ON_OUTLINE || tail.distance > ON_OUTLINE) {
    return { ok: false, reason: 'ends-off-outline' }
  }

  const from: Anchor = { ...head.anchor, point: rounded(head.anchor.point) }
  const to: Anchor = { ...tail.anchor, point: rounded(tail.anchor.point) }
  if (same(from.point, to.point)) return { ok: false, reason: 'ends-together' }

  const inner = path.slice(1, -1).map(rounded)
  for (const point of inner) {
    if (!pointInPolygon(point, polygon)) return { ok: false, reason: 'leaves-the-room' }
  }

  const line = [from.point, ...inner, to.point]

  for (let i = 0; i < line.length - 1; i++) {
    for (let j = i + 2; j < line.length - 1; j++) {
      if (properlyCross(line[i], line[i + 1], line[j], line[j + 1])) {
        return { ok: false, reason: 'crosses-itself' }
      }
    }

    for (let e = 0; e < polygon.length; e++) {
      const a = polygon[e]
      const b = polygon[(e + 1) % polygon.length]
      if (properlyCross(line[i], line[i + 1], a, b)) {
        return { ok: false, reason: 'leaves-the-room' }
      }
    }
  }

  const near = dropRepeats([from.point, ...between(polygon, from, to), to.point, ...[...inner].reverse()])
  const far = dropRepeats([to.point, ...between(polygon, to, from), from.point, ...inner])

  if (
    near.length < 3 ||
    far.length < 3 ||
    Math.abs(polygonSignedArea(near)) < MIN_AREA ||
    Math.abs(polygonSignedArea(far)) < MIN_AREA
  ) {
    return { ok: false, reason: 'empty-side' }
  }

  return { ok: true, parts: [near, far] }
}

function rounded(p: Point2): Point2 {
  return { x: round3(p.x), z: round3(p.z) }
}

/** Whether a cut drawn so far could be finished at `end`, without building it. */
export function canCut(polygon: Point2[], path: Point2[]): boolean {
  return cutPolygon(polygon, path).ok
}
