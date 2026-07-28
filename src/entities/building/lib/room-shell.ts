import { ShapeUtils, Vector2 } from 'three'

import type {
  OpeningKind,
  RoomOpening,
  RoomShellConfig,
  RoomVertex,
  ShellSurface,
  WallSide,
} from '../model/types'
import { SHELL_SURFACES, WALL_SIDES } from '../model/types'
import {
  offsetPolygonMitered,
  outwardEdgeNormal,
  polygonSignedArea,
  polygonWindingSign,
  type Point2,
} from './polygon'

/**
 * Procedural room geometry.
 *
 * A focused room is NOT a slice of the building glb — it is generated from the
 * outline the admin drew plus a handful of numbers. That removes the whole
 * class of artefacts a subtractive approach produces (hollow shells, dangling
 * strips, caps hanging across the room) because nothing is ever cut: every
 * wall is a closed solid whose faces are authored, not carved.
 *
 * Pure and world-space (meters, +Y up, XZ ground), so it unit-tests without a
 * renderer and mounts without a transform.
 */

/** Tile size (meters) of one texture repeat, per surface. */
export type SurfaceTiles = Record<ShellSurface, Tile>

export type Tile = { width: number; height: number }

/** What hides together in dollhouse mode. */
export type ShellGroup = WallSide | 'floor' | 'ceiling'

export type ShellPart = {
  /**
   * The toggle this part follows. Not derivable from `surface`: the white trim
   * around the ceiling slab is a wallEdge surface that has to disappear WITH
   * the ceiling, while the trim around the floor never disappears at all.
   */
  group: ShellGroup
  /** Wall surfaces belong to a side; slab surfaces belong to none. */
  side: WallSide | null
  surface: ShellSurface
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
}

export type ShellWarning =
  | { code: 'degenerate-polygon' }
  | { code: 'thickness-clamped'; vertexIndex: number }
  | { code: 'opening-clamped'; openingId: string }
  | { code: 'opening-dropped'; openingId: string }

export type RoomShellPlan = {
  parts: ShellPart[]
  warnings: ShellWarning[]
}

export function defaultTiles(): SurfaceTiles {
  return Object.fromEntries(
    SHELL_SURFACES.map((surface) => [surface, { width: 1, height: 1 }]),
  ) as SurfaceTiles
}

/** Spans thinner than this are drawing noise, not geometry. */
const EPS = 1e-4

// ---------------------------------------------------------------------------
// Mesh accumulation
// ---------------------------------------------------------------------------

type Vec3 = { x: number; y: number; z: number }

class SurfaceBuilder {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly uvs: number[] = []

  get isEmpty(): boolean {
    return this.positions.length === 0
  }

  /**
   * Emits one triangle, correcting the winding against `normal` instead of
   * trusting the caller's vertex order. A face whose winding disagrees with
   * its normal is invisible under backface culling — the most common way
   * hand-built geometry silently goes wrong.
   */
  triangle(a: Vec3, b: Vec3, c: Vec3, normal: Vec3, uvA: Point2, uvB: Point2, uvC: Point2) {
    const ux = b.x - a.x
    const uy = b.y - a.y
    const uz = b.z - a.z
    const vx = c.x - a.x
    const vy = c.y - a.y
    const vz = c.z - a.z
    const cross = {
      x: uy * vz - uz * vy,
      y: uz * vx - ux * vz,
      z: ux * vy - uy * vx,
    }

    const flip = cross.x * normal.x + cross.y * normal.y + cross.z * normal.z < 0
    const points = flip ? [a, c, b] : [a, b, c]
    const coords = flip ? [uvA, uvC, uvB] : [uvA, uvB, uvC]

    for (let i = 0; i < 3; i++) {
      this.positions.push(points[i].x, points[i].y, points[i].z)
      this.normals.push(normal.x, normal.y, normal.z)
      this.uvs.push(coords[i].x, coords[i].z)
    }
  }

  quad(
    corners: [Vec3, Vec3, Vec3, Vec3],
    normal: Vec3,
    coords: [Point2, Point2, Point2, Point2],
  ) {
    this.triangle(corners[0], corners[1], corners[2], normal, coords[0], coords[1], coords[2])
    this.triangle(corners[0], corners[2], corners[3], normal, coords[0], coords[2], coords[3])
  }

  build(group: ShellGroup, side: WallSide | null, surface: ShellSurface): ShellPart {
    return {
      group,
      side,
      surface,
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
    }
  }
}

/** One builder per (group, surface) pair, so the client makes few geometries. */
class PartRegistry {
  private readonly entries = new Map<
    string,
    { group: ShellGroup; side: WallSide | null; surface: ShellSurface; builder: SurfaceBuilder }
  >()

  get(group: ShellGroup, surface: ShellSurface): SurfaceBuilder {
    const id = `${group}:${surface}`
    let entry = this.entries.get(id)
    if (!entry) {
      const side = group === 'floor' || group === 'ceiling' ? null : group
      entry = { group, side, surface, builder: new SurfaceBuilder() }
      this.entries.set(id, entry)
    }
    return entry.builder
  }

  build(): ShellPart[] {
    const parts: ShellPart[] = []
    for (const { group, side, surface, builder } of this.entries.values()) {
      if (!builder.isEmpty) parts.push(builder.build(group, side, surface))
    }
    return parts
  }
}

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

export type ShellEdge = {
  /** Index in the source polygon. */
  index: number
  side: WallSide
  innerA: Point2
  innerB: Point2
  outerA: Point2
  outerB: Point2
  normal: Point2
  length: number
  /** Arc length from the start of this side's chain to `innerA`. */
  chainStart: number
}

/**
 * The block of wall standing where two walls meet.
 *
 * It belongs to BOTH of them. Owned by one, it would disappear along with that
 * one and leave the other ending in mid-air a thickness short of the corner —
 * so it is emitted twice, once into each side's group. The two copies are
 * generated from the same numbers, so where both walls are up they are exactly
 * coincident and the depth test simply draws the same pixels twice.
 */
export type ShellCorner = {
  /** The wall that ends here, and the one that starts. */
  from: WallSide
  to: WallSide
  /** Inner vertex. */
  v: Point2
  /** Perpendicular outer point of the wall that ends. */
  fromOuter: Point2
  /** Where the two outer faces cross — the outside of the corner. */
  miter: Point2
  /** Perpendicular outer point of the wall that starts. */
  toOuter: Point2
  /** Arc length reached at this corner, so the outer texture carries on. */
  arc: number
}

export type ShellRun = {
  side: WallSide
  edges: ShellEdge[]
  /**
   * The corner at this run's far end, or null when there is nothing to fill.
   *
   * Only a convex turn leaves a gap between two square-cut walls. At a reflex
   * turn the two wall strips already overlap across the corner, so both walls
   * cover it on their own and a filler here would only fight them for depth.
   */
  corner: ShellCorner | null
}

export type ShellTopology = {
  runs: ShellRun[]
  /** Total arc length of each side's edge chain. */
  chainLength: Map<WallSide, number>
  clampedIndexes: number[]
}

function lerp(a: Point2, b: Point2, t: number): Point2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
}

function uv(u: number, v: number, tile: Tile): Point2 {
  return { x: u / (tile.width || 1), z: v / (tile.height || 1) }
}

function normalize2(v: Point2): Point2 {
  const len = Math.hypot(v.x, v.z)
  return len < 1e-9 ? { x: 0, z: 0 } : { x: v.x / len, z: v.z / len }
}

function innerPoint(edge: ShellEdge, u: number): Point2 {
  return lerp(edge.innerA, edge.innerB, u / edge.length)
}

/**
 * The outer face point across from `u`.
 *
 * Mitred vertices are used only AT the corners, where adjacent edges must
 * share a point exactly; everywhere else the outer face is a plain
 * perpendicular offset. Interpolating between the mitred ends instead would
 * fan every cross-section outward, so a door's reveals would come out visibly
 * splayed rather than square to the wall.
 *
 * `u` may run past the edge, which is how a run reaches around its end corner;
 * the perpendicular branch extrapolates, and by construction it lands exactly
 * on the mitre point at the far end of that reach.
 */
function outerPoint(edge: ShellEdge, u: number, thickness: number): Point2 {
  if (u <= EPS) return edge.outerA
  if (Math.abs(u - edge.length) <= EPS) return edge.outerB
  const inner = innerPoint(edge, u)
  return { x: inner.x + edge.normal.x * thickness, z: inner.z + edge.normal.z * thickness }
}

/**
 * Splits the outline into runs of consecutive same-side edges.
 *
 * The edge list is rotated to start at a side boundary, so a wall that wraps
 * across the polygon's first vertex stays ONE run. Without the rotation, a
 * rectangle whose outline happens to start mid-wall would grow a mitred end
 * cap in the middle of a flat wall.
 */
export function buildTopology(polygon: RoomVertex[], thickness: number): ShellTopology {
  const n = polygon.length
  const offset = offsetPolygonMitered(polygon, thickness)
  const sign = polygonWindingSign(polygon)

  let start = 0
  for (let i = 0; i < n; i++) {
    if (polygon[i].side !== polygon[(i - 1 + n) % n].side) {
      start = i
      break
    }
  }

  const runs: ShellRun[] = []
  const chainLength = new Map<WallSide, number>()

  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (length < EPS) continue

    const chainStart = chainLength.get(a.side) ?? 0
    chainLength.set(a.side, chainStart + length)

    const edge: ShellEdge = {
      index: i,
      side: a.side,
      innerA: { x: a.x, z: a.z },
      innerB: { x: b.x, z: b.z },
      outerA: offset.points[i],
      outerB: offset.points[(i + 1) % n],
      normal: outwardEdgeNormal(a, b, sign),
      length,
      chainStart,
    }

    const last = runs[runs.length - 1]
    if (last && last.side === edge.side) last.edges.push(edge)
    else runs.push({ side: edge.side, edges: [edge], corner: null })
  }

  squareOffRunEnds(runs, chainLength, thickness)

  return { runs, chainLength, clampedIndexes: offset.clampedIndexes }
}

/**
 * Re-cuts every run's two ends from bisector bevels to square cross-sections,
 * and works out what has to stand in the corner they leave behind.
 *
 * The mitred ring is left alone — it is still exactly the outside of the room,
 * and the slabs are still traced from it. What changes is where one wall stops
 * and the next begins: both now end on a plain perpendicular offset, which is
 * the square cut, and the corner between them becomes a piece of its own.
 */
function squareOffRunEnds(
  runs: ShellRun[],
  chainLength: Map<WallSide, number>,
  thickness: number,
) {
  if (thickness <= EPS) return

  const perpendicular = (at: Point2, edge: ShellEdge): Point2 => ({
    x: at.x + edge.normal.x * thickness,
    z: at.z + edge.normal.z * thickness,
  })

  for (const run of runs) {
    const first = run.edges[0]
    const last = run.edges[run.edges.length - 1]
    if (!first || !last) continue

    const miter = last.outerB
    first.outerA = perpendicular(first.innerA, first)
    last.outerB = perpendicular(last.innerB, last)

    const next = runs[(runs.indexOf(run) + 1) % runs.length]
    const opening = next.edges[0]
    if (!opening) continue

    // Convex or reflex? The mitre point, pulled back off this wall's face,
    // lands on this wall's inner line — ahead of the corner when the walls
    // turn away from each other, behind it when they fold over each other.
    // Only the first case leaves a hole to fill.
    const reach =
      (miter.x - last.normal.x * thickness - last.innerB.x) *
        ((last.innerB.x - last.innerA.x) / last.length) +
      (miter.z - last.normal.z * thickness - last.innerB.z) *
        ((last.innerB.z - last.innerA.z) / last.length)
    if (reach <= EPS) continue

    run.corner = {
      from: run.side,
      to: next.side,
      v: last.innerB,
      fromOuter: last.outerB,
      miter,
      toOuter: perpendicular(opening.innerA, opening),
      arc: chainLength.get(run.side) ?? 0,
    }
  }
}

// ---------------------------------------------------------------------------
// Openings → bands
// ---------------------------------------------------------------------------

export type ResolvedOpening = {
  opening: RoomOpening
  edge: ShellEdge
  /** Offset from the host edge's start (meters). */
  local: number
}

/**
 * Anchors each opening to the one edge it sits on.
 *
 * An opening must fit inside a single straight edge: a door wrapped around a
 * corner is not a thing, and allowing it would make the band decomposition
 * ambiguous. One that overhangs is slid back onto the edge; one that cannot
 * fit is dropped LOUDLY — silently swallowing it is how a dragged handle makes
 * a doorway vanish with nothing to explain it.
 */
export function resolveOpenings(
  topology: ShellTopology,
  openings: RoomOpening[],
  wallHeight: number,
  warnings: ShellWarning[],
): Map<number, ResolvedOpening[]> {
  const edges = topology.runs.flatMap((run) => run.edges)
  const byEdge = new Map<number, ResolvedOpening[]>()

  for (const opening of openings) {
    const chain = edges.filter((edge) => edge.side === opening.side)
    const width = Math.max(opening.width, 0)
    if (chain.length === 0 || width < EPS) {
      warnings.push({ code: 'opening-dropped', openingId: opening.id })
      continue
    }

    const host =
      chain.find(
        (edge) => opening.along >= edge.chainStart && opening.along < edge.chainStart + edge.length,
      ) ?? chain[chain.length - 1]

    const sill = Math.max(opening.sill, 0)
    const height = Math.min(opening.height, wallHeight - sill)
    if (host.length <= width + EPS || height < EPS) {
      warnings.push({ code: 'opening-dropped', openingId: opening.id })
      continue
    }

    const wanted = opening.along - host.chainStart
    const local = Math.min(Math.max(wanted, 0), host.length - width)
    if (
      Math.abs(local - wanted) > 1e-6 ||
      Math.abs(height - opening.height) > 1e-6 ||
      Math.abs(sill - opening.sill) > 1e-6
    ) {
      warnings.push({ code: 'opening-clamped', openingId: opening.id })
    }

    const list = byEdge.get(host.index) ?? []
    list.push({ opening: { ...opening, width, sill, height }, edge: host, local })
    byEdge.set(host.index, list)
  }

  // Overlapping openings would feed the band splitter a contradictory profile.
  for (const [index, list] of byEdge) {
    list.sort((a, b) => a.local - b.local)
    const kept: ResolvedOpening[] = []
    for (const item of list) {
      const previous = kept[kept.length - 1]
      if (previous && item.local < previous.local + previous.opening.width - EPS) {
        warnings.push({ code: 'opening-dropped', openingId: item.opening.id })
        continue
      }
      kept.push(item)
    }
    byEdge.set(index, kept)
  }

  return byEdge
}

/** A vertical span of solid wall. */
export type VSpan = { v0: number; v1: number }

/** A slice of wall along one edge, with the wall material it still has. */
export type Band = { u0: number; u1: number; spans: VSpan[] }

/**
 * Turns an edge plus its openings into a left-to-right sequence of bands.
 *
 * This replaces "extrude a shape with holes". Every band is a closed box, so a
 * door's jambs, sill and soffit are the boxes' own faces: nothing to
 * triangulate, nothing coplanar with the floor, and a door touching the floor
 * is simply a band with one span instead of two.
 */
export function bandsForEdge(
  edge: ShellEdge,
  items: ResolvedOpening[],
  wallHeight: number,
): Band[] {
  const full = (): VSpan[] => [{ v0: 0, v1: wallHeight }]
  if (items.length === 0) return [{ u0: 0, u1: edge.length, spans: full() }]

  const bands: Band[] = []
  let cursor = 0

  for (const { local, opening } of items) {
    if (local - cursor > EPS) bands.push({ u0: cursor, u1: local, spans: full() })

    const head = opening.sill + opening.height
    const spans: VSpan[] = []
    if (opening.sill > EPS) spans.push({ v0: 0, v1: opening.sill })
    if (wallHeight - head > EPS) spans.push({ v0: head, v1: wallHeight })

    bands.push({ u0: local, u1: local + opening.width, spans })
    cursor = local + opening.width
  }

  if (edge.length - cursor > EPS) bands.push({ u0: cursor, u1: edge.length, spans: full() })

  return bands
}

/** Parts of `a` not covered by `b` — the wall exposed at a band boundary. */
export function subtractSpans(a: VSpan[], b: VSpan[]): VSpan[] {
  let remaining = a.map((span) => ({ ...span }))
  for (const cut of b) {
    const next: VSpan[] = []
    for (const span of remaining) {
      if (cut.v1 <= span.v0 + EPS || cut.v0 >= span.v1 - EPS) {
        next.push(span)
        continue
      }
      if (cut.v0 - span.v0 > EPS) next.push({ v0: span.v0, v1: cut.v0 })
      if (span.v1 - cut.v1 > EPS) next.push({ v0: cut.v1, v1: span.v1 })
    }
    remaining = next
  }
  return remaining
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type PlanOptions = {
  /**
   * Opening kinds that a 3D model stands in for. Their flat leaf is not
   * generated: the model brings its own frame and glazing, and two of them in
   * the same 12 cm would fight for depth.
   */
  modelledKinds?: ReadonlySet<OpeningKind>
}

export function planRoomShell(
  polygon: RoomVertex[],
  shell: RoomShellConfig,
  openings: RoomOpening[],
  tiles: SurfaceTiles = defaultTiles(),
  options: PlanOptions = {},
): RoomShellPlan {
  if (polygon.length < 3 || Math.abs(polygonSignedArea(polygon)) < 1e-6) {
    return { parts: [], warnings: [{ code: 'degenerate-polygon' }] }
  }

  const warnings: ShellWarning[] = []
  const topology = buildTopology(polygon, shell.wallThickness)
  for (const vertexIndex of topology.clampedIndexes) {
    warnings.push({ code: 'thickness-clamped', vertexIndex })
  }

  const resolved = resolveOpenings(topology, openings, shell.wallHeight, warnings)
  const parts = new PartRegistry()
  const modelled = options.modelledKinds ?? EMPTY_KINDS

  for (const run of topology.runs) {
    buildRun(parts, run, resolved, shell, topology.chainLength.get(run.side) ?? 0, tiles, modelled)
    if (run.corner) buildCorner(parts, run.corner, shell, tiles)
  }
  buildSlabs(parts, polygon, shell, tiles)

  return { parts: parts.build(), warnings }
}

const EMPTY_KINDS: ReadonlySet<OpeningKind> = new Set()

/**
 * Where a door or window model has to stand to fill its hole.
 *
 * Derived from the same topology the shell is built from, so the model and the
 * reveal it sits in can never disagree — including the clamping
 * `resolveOpenings` applies to an opening that overhangs its edge.
 */
export type OpeningPlacement = {
  /** The opening as the shell actually cut it, not as it was authored. */
  opening: RoomOpening
  side: WallSide
  /** Centre of the hole, at the wall's mid-thickness. */
  center: { x: number; y: number; z: number }
  /** Unit outward normal of the host wall, in XZ. */
  normal: Point2
  /**
   * Unit direction of INCREASING `along`, in XZ.
   *
   * The editor needs this to turn a pointer on the wall back into the measure
   * openings are stored in — without it, dragging a door sideways is a guess at
   * which way round the wall runs.
   */
  tangent: Point2
  wallThickness: number
}

export function planOpeningPlacements(
  polygon: RoomVertex[],
  shell: RoomShellConfig,
  openings: RoomOpening[],
): OpeningPlacement[] {
  if (polygon.length < 3 || Math.abs(polygonSignedArea(polygon)) < 1e-6) return []

  const topology = buildTopology(polygon, shell.wallThickness)
  const resolved = resolveOpenings(topology, openings, shell.wallHeight, [])
  const placements: OpeningPlacement[] = []

  for (const run of topology.runs) {
    for (const edge of run.edges) {
      for (const { opening, local } of resolved.get(edge.index) ?? []) {
        const u = local + opening.width / 2
        const mid = lerp(innerPoint(edge, u), outerPoint(edge, u, shell.wallThickness), 0.5)

        placements.push({
          opening,
          side: run.side,
          center: {
            x: mid.x,
            y: shell.floorY + opening.sill + opening.height / 2,
            z: mid.z,
          },
          normal: edge.normal,
          tangent: normalize2({
            x: edge.innerB.x - edge.innerA.x,
            z: edge.innerB.z - edge.innerA.z,
          }),
          wallThickness: shell.wallThickness,
        })
      }
    }
  }

  return placements
}

type PlacedBand = { band: Band; edge: ShellEdge }

/**
 * The block of wall in a corner, emitted into BOTH of the walls that meet
 * there so it stands whichever one of them is hidden.
 *
 * Both copies come out of this one call, so their vertices and UVs are
 * identical to the bit. Coincident identical geometry does not z-fight — the
 * depth test passes on equality and the second draw lands the same pixels.
 */
function buildCorner(
  parts: PartRegistry,
  corner: ShellCorner,
  shell: RoomShellConfig,
  tiles: SurfaceTiles,
) {
  const ring = [corner.v, corner.fromOuter, corner.miter, corner.toOuter]
  if (Math.abs(polygonSignedArea(ring)) < 1e-9) return

  const { floorY, wallHeight } = shell
  const y0 = floorY
  const y1 = floorY + wallHeight
  const sign = polygonWindingSign(ring)

  // Sides 1 and 2 run along the two walls' outer faces and carry on their
  // cladding; sides 0 and 3 are the cuts that face the walls themselves.
  const OUTER_SIDES = new Set([1, 2])

  const emit = (group: WallSide) => {
    const outer = parts.get(group, 'wallOuter')
    const trim = parts.get(group, 'wallEdge')
    let arc = corner.arc

    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (length < EPS) continue

      const isOuter = OUTER_SIDES.has(i)
      const tile = isOuter ? tiles.wallOuter : tiles.wallEdge
      // The outer faces continue the wall's arc around the corner; the cut
      // faces are read across the thickness, exactly like a door reveal.
      const u0 = isOuter ? arc : 0
      const u1 = isOuter ? arc + length : length
      const n = outwardEdgeNormal(a, b, sign)

      ;(isOuter ? outer : trim).quad(
        [
          { x: a.x, y: y0, z: a.z },
          { x: b.x, y: y0, z: b.z },
          { x: b.x, y: y1, z: b.z },
          { x: a.x, y: y1, z: a.z },
        ],
        { x: n.x, y: 0, z: n.z },
        [uv(u0, 0, tile), uv(u1, 0, tile), uv(u1, wallHeight, tile), uv(u0, wallHeight, tile)],
      )
      if (isOuter) arc += length
    }

    for (const y of [y1, y0]) {
      trim.quad(
        [
          { x: ring[0].x, y, z: ring[0].z },
          { x: ring[1].x, y, z: ring[1].z },
          { x: ring[2].x, y, z: ring[2].z },
          { x: ring[3].x, y, z: ring[3].z },
        ],
        { x: 0, y: y === y1 ? 1 : -1, z: 0 },
        [
          uv(ring[0].x, ring[0].z, tiles.wallEdge),
          uv(ring[1].x, ring[1].z, tiles.wallEdge),
          uv(ring[2].x, ring[2].z, tiles.wallEdge),
          uv(ring[3].x, ring[3].z, tiles.wallEdge),
        ],
      )
    }
  }

  emit(corner.from)
  // A room whose whole outline is one wall meets itself at the seam; one copy
  // is then the same copy.
  if (corner.to !== corner.from) emit(corner.to)
}

function buildRun(
  parts: PartRegistry,
  run: ShellRun,
  resolved: Map<number, ResolvedOpening[]>,
  shell: RoomShellConfig,
  chainTotal: number,
  tiles: SurfaceTiles,
  modelledKinds: ReadonlySet<OpeningKind>,
) {
  const { floorY, wallHeight, wallThickness } = shell
  const inner = parts.get(run.side, 'wallInner')
  const outer = parts.get(run.side, 'wallOuter')
  const edges = parts.get(run.side, 'wallEdge')

  const placed: PlacedBand[] = []
  for (const edge of run.edges) {
    for (const band of bandsForEdge(edge, resolved.get(edge.index) ?? [], wallHeight)) {
      placed.push({ band, edge })
    }
  }
  if (placed.length === 0) return

  const at = (edge: ShellEdge, u: number, v: number, outward: boolean): Vec3 => {
    const p = outward ? outerPoint(edge, u, wallThickness) : innerPoint(edge, u)
    return { x: p.x, y: floorY + v, z: p.z }
  }

  for (const { band, edge } of placed) {
    const arc0 = edge.chainStart + band.u0
    const arc1 = edge.chainStart + band.u1
    const outwardN = { x: edge.normal.x, y: 0, z: edge.normal.z }
    const inwardN = { x: -edge.normal.x, y: 0, z: -edge.normal.z }

    for (const span of band.spans) {
      const i00 = at(edge, band.u0, span.v0, false)
      const i10 = at(edge, band.u1, span.v0, false)
      const i11 = at(edge, band.u1, span.v1, false)
      const i01 = at(edge, band.u0, span.v1, false)
      const o00 = at(edge, band.u0, span.v0, true)
      const o10 = at(edge, band.u1, span.v0, true)
      const o11 = at(edge, band.u1, span.v1, true)
      const o01 = at(edge, band.u0, span.v1, true)

      // The inner face is mirrored along the chain so its texture is not
      // reversed when read from inside the room.
      inner.quad([i00, i10, i11, i01], inwardN, [
        uv(chainTotal - arc0, span.v0, tiles.wallInner),
        uv(chainTotal - arc1, span.v0, tiles.wallInner),
        uv(chainTotal - arc1, span.v1, tiles.wallInner),
        uv(chainTotal - arc0, span.v1, tiles.wallInner),
      ])
      outer.quad([o00, o10, o11, o01], outwardN, [
        uv(arc0, span.v0, tiles.wallOuter),
        uv(arc1, span.v0, tiles.wallOuter),
        uv(arc1, span.v1, tiles.wallOuter),
        uv(arc0, span.v1, tiles.wallOuter),
      ])

      const capUv: [Point2, Point2, Point2, Point2] = [
        uv(arc0, 0, tiles.wallEdge),
        uv(arc1, 0, tiles.wallEdge),
        uv(arc1, wallThickness, tiles.wallEdge),
        uv(arc0, wallThickness, tiles.wallEdge),
      ]
      // Window sill / door soffit at the top, and the matching face below.
      edges.quad([i01, i11, o11, o01], { x: 0, y: 1, z: 0 }, capUv)
      edges.quad([i00, i10, o10, o00], { x: 0, y: -1, z: 0 }, capUv)
    }
  }

  // Jambs and mitred run ends: emitted only where one side of a boundary has
  // wall and the other does not. Emitting every box end would double up
  // coplanar faces along an otherwise flat wall.
  for (let k = 0; k <= placed.length; k++) {
    const before = placed[k - 1]
    const after = placed[k]
    const host = after ?? before
    if (!host) continue

    const u = after ? after.band.u0 : before.band.u1
    const edge = host.edge
    const dir = normalize2({ x: edge.innerB.x - edge.innerA.x, z: edge.innerB.z - edge.innerA.z })
    const beforeSpans = before ? before.band.spans : []
    const afterSpans = after ? after.band.spans : []

    for (const span of subtractSpans(beforeSpans, afterSpans)) {
      pushJamb(edges, edge, u, span, floorY, { x: dir.x, y: 0, z: dir.z }, wallThickness, tiles)
    }
    for (const span of subtractSpans(afterSpans, beforeSpans)) {
      pushJamb(edges, edge, u, span, floorY, { x: -dir.x, y: 0, z: -dir.z }, wallThickness, tiles)
    }
  }

  buildLeaves(parts, run, resolved, shell, modelledKinds)
}

function pushJamb(
  target: SurfaceBuilder,
  edge: ShellEdge,
  u: number,
  span: VSpan,
  floorY: number,
  normal: Vec3,
  thickness: number,
  tiles: SurfaceTiles,
) {
  const i = innerPoint(edge, u)
  const o = outerPoint(edge, u, thickness)

  target.quad(
    [
      { x: i.x, y: floorY + span.v0, z: i.z },
      { x: o.x, y: floorY + span.v0, z: o.z },
      { x: o.x, y: floorY + span.v1, z: o.z },
      { x: i.x, y: floorY + span.v1, z: i.z },
    ],
    normal,
    [
      uv(0, span.v0, tiles.wallEdge),
      uv(thickness, span.v0, tiles.wallEdge),
      uv(thickness, span.v1, tiles.wallEdge),
      uv(0, span.v1, tiles.wallEdge),
    ],
  )
}

/**
 * The door and window panels themselves, at mid-thickness of their wall and
 * emitted from both sides. Opaque: the project has no transparency-sorting
 * story and the post-processing stack is incompatible with this three version,
 * so a tinted glass texture beats real glass.
 *
 * This is the fallback. A kind with a model assigned gets nothing here — the
 * glb supplies the frame, the leaf and the handle, and a flat quad in the same
 * plane would poke through it.
 */
function buildLeaves(
  parts: PartRegistry,
  run: ShellRun,
  resolved: Map<number, ResolvedOpening[]>,
  shell: RoomShellConfig,
  modelledKinds: ReadonlySet<OpeningKind>,
) {
  for (const edge of run.edges) {
    for (const { opening, local } of resolved.get(edge.index) ?? []) {
      if (modelledKinds.has(opening.kind)) continue
      const surface: ShellSurface = opening.kind === 'door' ? 'door' : 'window'
      const builder = parts.get(run.side, surface)

      const mid = (u: number): Point2 =>
        lerp(innerPoint(edge, u), outerPoint(edge, u, shell.wallThickness), 0.5)
      const a = mid(local)
      const b = mid(local + opening.width)
      const y0 = shell.floorY + opening.sill
      const y1 = y0 + opening.height

      const corners: [Vec3, Vec3, Vec3, Vec3] = [
        { x: a.x, y: y0, z: a.z },
        { x: b.x, y: y0, z: b.z },
        { x: b.x, y: y1, z: b.z },
        { x: a.x, y: y1, z: a.z },
      ]
      // A leaf is one image stretched over the opening, not a repeating tile.
      const leafUv: [Point2, Point2, Point2, Point2] = [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 1, z: 1 },
        { x: 0, z: 1 },
      ]

      builder.quad(corners, { x: -edge.normal.x, y: 0, z: -edge.normal.z }, leafUv)
      builder.quad(corners, { x: edge.normal.x, y: 0, z: edge.normal.z }, [
        leafUv[1],
        leafUv[0],
        leafUv[3],
        leafUv[2],
      ])
    }
  }
}

function buildSlabs(
  parts: PartRegistry,
  polygon: RoomVertex[],
  shell: RoomShellConfig,
  tiles: SurfaceTiles,
) {
  const { floorY, wallHeight, wallThickness, floorThickness, ceilingThickness } = shell
  // Slabs span the OUTER ring so they reach under the walls, leaving no seam
  // at the wall foot when a side is hidden.
  const ring = offsetPolygonMitered(polygon, wallThickness).points

  // The floor's top face is exactly floorY: the plane furniture stands on and
  // the drag interaction projects onto. Extruded downward from there.
  pushSlab(parts, ring, polygon, 'floor', floorY, floorY - Math.max(floorThickness, 0.01), tiles)

  // The room's OWN lid — deliberately not a slice of the building's ceiling.
  const ceilingBottom = floorY + wallHeight
  pushSlab(
    parts,
    ring,
    polygon,
    'ceiling',
    ceilingBottom + Math.max(ceilingThickness, 0.01),
    ceilingBottom,
    tiles,
  )
}

/** Fills a polygon (with optional holes) with flat triangles at height `y`. */
function fillFace(
  builder: SurfaceBuilder,
  contour: Point2[],
  holes: Point2[][],
  y: number,
  up: boolean,
  size: Tile,
) {
  // triangulateShape pops duplicated end points off the arrays it is handed,
  // and indexes its result into contour-then-holes, so both get throwaway
  // copies and a matching flat lookup.
  const faces = ShapeUtils.triangulateShape(
    contour.map((p) => new Vector2(p.x, p.z)),
    holes.map((hole) => hole.map((p) => new Vector2(p.x, p.z))),
  )
  const points = [...contour, ...holes.flat()]

  for (const [ia, ib, ic] of faces) {
    const a = points[ia]
    const b = points[ib]
    const c = points[ic]
    if (!a || !b || !c) continue
    builder.triangle(
      { x: a.x, y, z: a.z },
      { x: b.x, y, z: b.z },
      { x: c.x, y, z: c.z },
      { x: 0, y: up ? 1 : -1, z: 0 },
      uv(a.x, a.z, size),
      uv(b.x, b.z, size),
      uv(c.x, c.z, size),
    )
  }
}

/**
 * A slab, with its cut edges trimmed rather than wrapped.
 *
 * The face you stand on carries the floor material only INSIDE the room. The
 * band the walls stand on — the slab reaches under them so no seam opens at
 * their foot — is trimmed white along with the rim and the back. That band is
 * what you look straight down at wherever a wall has stepped aside, and
 * floorboards running out past the room reads as a mistake; the white strip
 * reads as the thickness of the wall that used to be there.
 */
function pushSlab(
  parts: PartRegistry,
  ring: Point2[],
  inner: Point2[],
  group: 'floor' | 'ceiling',
  topY: number,
  bottomY: number,
  tiles: SurfaceTiles,
) {
  const facesUp = group === 'floor'
  const material = parts.get(group, group)
  const trim = parts.get(group, 'wallEdge')
  const tile = tiles[group]
  const trimTile = tiles.wallEdge

  const shownY = facesUp ? topY : bottomY
  const hiddenY = facesUp ? bottomY : topY

  fillFace(material, inner, [], shownY, facesUp, tile)
  fillFace(trim, ring, [inner], shownY, facesUp, trimTile)
  fillFace(trim, ring, [], hiddenY, !facesUp, trimTile)

  // Rim, so the slab reads as a solid instead of a sheet of paper.
  const sign = polygonWindingSign(ring)
  let arc = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const n = outwardEdgeNormal(a, b, sign)
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    trim.quad(
      [
        { x: a.x, y: bottomY, z: a.z },
        { x: b.x, y: bottomY, z: b.z },
        { x: b.x, y: topY, z: b.z },
        { x: a.x, y: topY, z: a.z },
      ],
      { x: n.x, y: 0, z: n.z },
      [
        uv(arc, bottomY, trimTile),
        uv(arc + length, bottomY, trimTile),
        uv(arc + length, topY, trimTile),
        uv(arc, topY, trimTile),
      ],
    )
    arc += length
  }
}

// ---------------------------------------------------------------------------
// Side assignment
// ---------------------------------------------------------------------------

/** Outward directions of the four walls, in WALL_SIDES order. */
const SIDE_DIRECTIONS: Point2[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
]

function nearestAxisIndex(direction: Point2): number {
  let best = 0
  let bestDot = -Infinity
  SIDE_DIRECTIONS.forEach((dir, index) => {
    const dot = direction.x * dir.x + direction.z * dir.z
    if (dot > bestDot) {
      bestDot = dot
      best = index
    }
  })
  return best
}

type SideRun = { side: WallSide; edges: number[]; length: number }

/**
 * Contiguous stretches of edges sharing a wall, rotated so a wall that wraps
 * the polygon's first vertex counts once.
 */
function runsOf(sides: WallSide[], lengths: number[]): SideRun[] {
  const n = sides.length
  let start = 0
  for (let i = 0; i < n; i++) {
    if (sides[i] !== sides[(i - 1 + n) % n]) {
      start = i
      break
    }
  }

  const runs: SideRun[] = []
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    const last = runs[runs.length - 1]
    if (last && last.side === sides[i]) {
      last.edges.push(i)
      last.length += lengths[i]
    } else {
      runs.push({ side: sides[i], edges: [i], length: lengths[i] })
    }
  }
  return runs
}

/**
 * Assigns every edge to one of the four walls.
 *
 * Snapping each outward normal to the nearest axis gets rectilinear rooms
 * right, but it shatters detail: the two short returns of a door recess face
 * ±X and land on the side walls, so hiding the wall the recess belongs to
 * leaves them behind as floating posts. So short runs are absorbed into their
 * larger neighbour until only the four walls remain — a recess stays part of
 * the wall it is cut into, which is what "four walls, complex geometry" means.
 *
 * Deep features that are not detail (a full U-shaped return) survive as their
 * own run; the admin reassigns those by hand.
 */
export function autoAssignSides(polygon: Point2[]): WallSide[] {
  const n = polygon.length
  if (n < 3) return polygon.map(() => WALL_SIDES[0])

  const sign = polygonWindingSign(polygon)
  const sides = polygon.map(
    (p, i) => WALL_SIDES[nearestAxisIndex(outwardEdgeNormal(p, polygon[(i + 1) % n], sign))],
  )
  const lengths = polygon.map((p, i) => {
    const q = polygon[(i + 1) % n]
    return Math.hypot(q.x - p.x, q.z - p.z)
  })

  let runs = runsOf(sides, lengths)
  // Bounded by the edge count: every pass removes at least one run.
  for (let guard = 0; guard < n && runs.length > WALL_SIDES.length; guard++) {
    let shortest = 0
    for (let i = 1; i < runs.length; i++) {
      if (runs[i].length < runs[shortest].length) shortest = i
    }

    const previous = runs[(shortest - 1 + runs.length) % runs.length]
    const next = runs[(shortest + 1) % runs.length]
    const absorbing = previous.length >= next.length ? previous : next

    for (const edge of runs[shortest].edges) sides[edge] = absorbing.side
    runs = runsOf(sides, lengths)
  }

  return sides
}

/**
 * The outward direction of each side, snapped to an axis.
 *
 * Length-weighted so a short return does not outvote the main face, and
 * snapped because a deeply recessed side's raw mean normal can point at the
 * opposite wall — which would hide that wall from exactly the wrong angle.
 */
export function computeSideAxes(polygon: RoomVertex[]): Record<WallSide, Point2> {
  const sign = polygonWindingSign(polygon)
  const sums = new Map<WallSide, Point2>()

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    const n = outwardEdgeNormal(a, b, sign)
    const acc = sums.get(a.side) ?? { x: 0, z: 0 }
    sums.set(a.side, { x: acc.x + n.x * length, z: acc.z + n.z * length })
  }

  const axes = {} as Record<WallSide, Point2>
  WALL_SIDES.forEach((side, index) => {
    const sum = sums.get(side)
    axes[side] =
      sum && Math.hypot(sum.x, sum.z) > 1e-9
        ? SIDE_DIRECTIONS[nearestAxisIndex(sum)]
        : SIDE_DIRECTIONS[index]
  })

  return axes
}

/**
 * Keeps openings where they physically are when the outline is edited.
 *
 * Openings are addressed by arc length along their side's chain, and every
 * polygon edit (drag a vertex, insert a midpoint, reassign an edge) changes
 * that measure. Without re-anchoring, moving one corner slides every door on
 * the room.
 */
export function reanchorOpenings(
  previous: RoomVertex[],
  next: RoomVertex[],
  openings: RoomOpening[],
): RoomOpening[] {
  if (previous.length < 3 || next.length < 3) return openings

  const before = buildTopology(previous, 0)
  const after = buildTopology(next, 0)

  return openings.map((opening) => {
    const world = pointAtChain(before, opening.side, opening.along)
    if (!world) return opening
    const along = chainAtPoint(after, opening.side, world)
    return along === null ? opening : { ...opening, along }
  })
}

/**
 * Which wall a world point sits on, and how far along it.
 *
 * The editor's placement gesture: click anywhere on a generated wall and the
 * click has to come back as the (wall, arc length) pair openings are addressed
 * by. Measured against the inner faces, which are the floor polygon itself.
 */
export function locateOnWalls(
  polygon: RoomVertex[],
  point: Point2,
): { side: WallSide; along: number } | null {
  if (polygon.length < 3) return null

  const edges = buildTopology(polygon, 0).runs.flatMap((run) => run.edges)
  let best: { side: WallSide; along: number } | null = null
  let bestDistance = Infinity

  for (const edge of edges) {
    const dx = edge.innerB.x - edge.innerA.x
    const dz = edge.innerB.z - edge.innerA.z
    const lengthSq = dx * dx + dz * dz
    if (lengthSq < 1e-12) continue

    const t = Math.min(
      Math.max(((point.x - edge.innerA.x) * dx + (point.z - edge.innerA.z) * dz) / lengthSq, 0),
      1,
    )
    const projected = lerp(edge.innerA, edge.innerB, t)
    const distance = Math.hypot(projected.x - point.x, projected.z - point.z)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { side: edge.side, along: edge.chainStart + t * edge.length }
    }
  }

  return best
}

function chainEdges(topology: ShellTopology, side: WallSide): ShellEdge[] {
  return topology.runs.flatMap((run) => run.edges).filter((edge) => edge.side === side)
}

function pointAtChain(topology: ShellTopology, side: WallSide, along: number): Point2 | null {
  const edges = chainEdges(topology, side)
  if (edges.length === 0) return null
  const host =
    edges.find((edge) => along >= edge.chainStart && along < edge.chainStart + edge.length) ??
    edges[edges.length - 1]
  const local = Math.min(Math.max(along - host.chainStart, 0), host.length)
  return lerp(host.innerA, host.innerB, local / host.length)
}

function chainAtPoint(topology: ShellTopology, side: WallSide, point: Point2): number | null {
  const edges = chainEdges(topology, side)
  if (edges.length === 0) return null

  let best: number | null = null
  let bestDistance = Infinity

  for (const edge of edges) {
    const dx = edge.innerB.x - edge.innerA.x
    const dz = edge.innerB.z - edge.innerA.z
    const lengthSq = dx * dx + dz * dz
    if (lengthSq < 1e-12) continue
    const t = Math.min(
      Math.max(((point.x - edge.innerA.x) * dx + (point.z - edge.innerA.z) * dz) / lengthSq, 0),
      1,
    )
    const projected = lerp(edge.innerA, edge.innerB, t)
    const distance = Math.hypot(projected.x - point.x, projected.z - point.z)
    if (distance < bestDistance) {
      bestDistance = distance
      best = edge.chainStart + t * edge.length
    }
  }

  return best
}
