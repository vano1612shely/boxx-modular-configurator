import 'dotenv/config'

import { pathToFileURL } from 'node:url'

import { Vector3, type Mesh, type Object3D } from 'three'

import { loadScene } from './analyze-model'
import { SPECS } from './buildings'
import type { BuildingSpec, RoomSpec } from './buildings/types'

/**
 * Checks a building spec against the geometry it describes, before anything
 * is uploaded.
 *
 *   pnpm audit:building <slug>
 *
 * A spec is a few dozen coordinates typed by hand, or derived from a sibling
 * by a shift somebody measured once. Either way the ways it can be wrong are
 * few and the same every time: an outline edge that is not on a wall, a wall
 * standing inside an outline, a door declared where there is no door, two
 * rooms claiming the same floor. Each of those used to be found by an agent
 * re-measuring the whole building — an hour a size. Each is a question the
 * geometry answers in a second, so they are asked here, of every room, and
 * the import refuses to run until every answer is clean.
 *
 * Everything is in the source file's own coordinates: the spec's rooms are
 * written in them, and the offset is applied later, to both together.
 */

/** How far off a wall face an outline edge may sit and still count as on it. */
const ON_WALL = 0.025
/** Below this an uncovered stretch is a corner or a batten, not a finding. */
const GAP_WORTH_NAMING = 0.15
/** Beyond half the opening's width, how far its casing may still be found. */
const CASING_SLACK = 0.05
/**
 * How far from where a jamb should stand its casing may be found — beyond
 * the wall's own thickness, which a leaf hung on the far face is away.
 */
const JAMB_SLACK = 0.08
/** Outline edges are stepped this far into the room before looking for walls inside it. */
const INSET = 0.25
/** A wall this close to an interior sample point is inside the room. */
const INSIDE_REACH = 0.06
/** The band of heights the checks look at: above sills and baseboards, below the ceiling. */
const BAND: [number, number] = [1.2, 3.0]

const WALL = 'Basic_Wall_Interior'
/** The EDUPlex modeller's names; a spec from another modeller supplies its own. */
const CASING: Record<'door' | 'window', string[]> = {
  door: ['door_frame'],
  window: ['adskMatWINDOW_frame_interiro', 'adskMatWINDOW_frame'],
}

type Point = [number, number]

/** A vertical-ish triangle flattened to the line it stands on, in XZ. */
type Segment = { material: string; a: Point; b: Point }

class Walls {
  private cells = new Map<string, number[]>()
  readonly segments: Segment[] = []
  private readonly cell = 0.25

  constructor(root: Object3D) {
    root.updateMatrixWorld(true)
    root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const position = mesh.geometry.getAttribute('position')
      const index = mesh.geometry.getIndex()
      if (!position) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const groups = mesh.geometry.groups.length
        ? mesh.geometry.groups
        : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }]

      for (const group of groups) {
        const material = materials[group.materialIndex ?? 0]?.name ?? ''
        const end = group.start + group.count
        for (let i = group.start; i + 2 < end; i += 3) {
          const corners = [0, 1, 2].map((k) => {
            const vertexIndex = index ? index.getX(i + k) : i + k
            return mesh.localToWorld(
              new Vector3(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex)),
            )
          })
          const lowest = Math.min(...corners.map((c) => c.y))
          const highest = Math.max(...corners.map((c) => c.y))
          if (highest < BAND[0] || lowest > BAND[1]) continue
          // Vertical enough: the triangle's spread in y dwarfs its spread on the plan.
          const spreadY = highest - lowest
          const xs = corners.map((c) => c.x)
          const zs = corners.map((c) => c.z)
          const spreadPlan = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
          if (spreadY < 0.05 || spreadPlan > 12) continue
          // The two corners farthest apart on the plan are the line it stands on.
          let a: Point = [xs[0], zs[0]]
          let b: Point = [xs[1], zs[1]]
          let longest = -1
          for (let p = 0; p < 3; p += 1) {
            for (let q = p + 1; q < 3; q += 1) {
              const length = Math.hypot(xs[p] - xs[q], zs[p] - zs[q])
              if (length > longest) {
                longest = length
                a = [xs[p], zs[p]]
                b = [xs[q], zs[q]]
              }
            }
          }
          this.add({ material, a, b })
        }
      }
    })
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cell)}:${Math.floor(z / this.cell)}`
  }

  private add(segment: Segment) {
    const id = this.segments.push(segment) - 1
    const x0 = Math.min(segment.a[0], segment.b[0])
    const x1 = Math.max(segment.a[0], segment.b[0])
    const z0 = Math.min(segment.a[1], segment.b[1])
    const z1 = Math.max(segment.a[1], segment.b[1])
    for (let x = Math.floor(x0 / this.cell); x <= Math.floor(x1 / this.cell); x += 1) {
      for (let z = Math.floor(z0 / this.cell); z <= Math.floor(z1 / this.cell); z += 1) {
        const key = `${x}:${z}`
        const list = this.cells.get(key)
        if (list) list.push(id)
        else this.cells.set(key, [id])
      }
    }
  }

  /** Whether any segment of one of the materials passes within `reach` of the point. */
  near(point: Point, reach: number, materials: string[] | null): boolean {
    const span = Math.ceil(reach / this.cell)
    const cx = Math.floor(point[0] / this.cell)
    const cz = Math.floor(point[1] / this.cell)
    for (let x = cx - span; x <= cx + span; x += 1) {
      for (let z = cz - span; z <= cz + span; z += 1) {
        for (const id of this.cells.get(`${x}:${z}`) ?? []) {
          const segment = this.segments[id]
          if (materials && !materials.includes(segment.material)) continue
          if (distanceToSegment(point, segment.a, segment.b) <= reach) return true
        }
      }
    }
    return false
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const abx = b[0] - a[0]
  const abz = b[1] - a[1]
  const length = abx * abx + abz * abz
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / length))
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * abz))
}

function outline(room: RoomSpec): Point[] {
  if (room.polygon) return room.polygon
  const { x0, x1, z0, z1 } = room.rect!
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
}

function inside(point: Point, polygon: Point[]): boolean {
  let within = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]
    if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) {
      within = !within
    }
  }
  return within
}

function distanceToOutline(point: Point, polygon: Point[]): number {
  let best = Infinity
  for (let i = 0; i < polygon.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]))
  }
  return best
}

/** Unit direction of the outline edge an opening sits on. */
function edgeDirectionAt(point: Point, polygon: Point[]): Point {
  let best: { distance: number; direction: Point } = { distance: Infinity, direction: [1, 0] }
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const distance = distanceToSegment(point, a, b)
    if (distance < best.distance) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      best = { distance, direction: [(b[0] - a[0]) / length, (b[1] - a[1]) / length] }
    }
  }
  return best.direction
}

type Finding = { room: string; what: string }

export async function auditSpec(spec: BuildingSpec): Promise<Finding[]> {
  const walls = new Walls(await loadScene(spec.source.main))
  const findings: Finding[] = []
  const casings: Record<'door' | 'window', string[]> = {
    door: spec.audit?.doorCasings ?? CASING.door,
    window: spec.audit?.windowCasings ?? CASING.window,
  }
  const jambsWanted = spec.audit?.jambs ?? 2
  const jambReach = JAMB_SLACK + (spec.shell.wallThickness ?? 0.1)
  const outlines = spec.rooms.map((room) => ({ room, points: outline(room) }))

  for (const { room, points } of outlines) {
    // A declared opening is where a wall is allowed to be missing: a leaf sits
    // flush with the far face of its wall, so from this side the doorway is air.
    const doorways = (room.openings ?? []).filter((opening) => opening.at)
    const inDoorway = (point: Point) =>
      doorways.some(
        (opening) => Math.hypot(point[0] - opening.at![0], point[1] - opening.at![1]) <= opening.width / 2 + CASING_SLACK,
      )

    // 1. Every edge lies on something vertical — a wall, a casing, a leaf.
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      const steps = Math.max(1, Math.round(length / 0.05))
      let gapFrom: number | null = null
      const report = (to: number) => {
        if (gapFrom !== null && to - gapFrom >= GAP_WORTH_NAMING) {
          const at = (t: number): Point => [a[0] + ((b[0] - a[0]) * t) / length, a[1] + ((b[1] - a[1]) * t) / length]
          const from = at(gapFrom)
          const until = at(to)
          findings.push({
            room: room.key,
            what: `edge ${i + 1} has no wall for ${(to - gapFrom).toFixed(2)} m, (${from[0].toFixed(3)}, ${from[1].toFixed(3)}) → (${until[0].toFixed(3)}, ${until[1].toFixed(3)})`,
          })
        }
        gapFrom = null
      }
      for (let s = 1; s < steps; s += 1) {
        const t = (s / steps) * length
        const point: Point = [a[0] + ((b[0] - a[0]) * t) / length, a[1] + ((b[1] - a[1]) * t) / length]
        if (inDoorway(point) || walls.near(point, ON_WALL, null)) report(t)
        else if (gapFrom === null) gapFrom = t
      }
      report(length)
    }

    // 2. Every declared door and window has a casing at both its jambs — the
    // middle of a door is a leaf, or a vision lite off to one side, and one
    // jamb alone would pass an opening declared half a metre off.
    for (const opening of room.openings ?? []) {
      if (!opening.at) continue
      const along = edgeDirectionAt(opening.at, points)
      const jambs: Point[] = [
        [opening.at[0] - (along[0] * opening.width) / 2, opening.at[1] - (along[1] * opening.width) / 2],
        [opening.at[0] + (along[0] * opening.width) / 2, opening.at[1] + (along[1] * opening.width) / 2],
      ]
      const missing = jambs.filter((jamb) => !walls.near(jamb, jambReach, casings[opening.kind]))
      if (2 - missing.length < jambsWanted) {
        findings.push({
          room: room.key,
          what: `${opening.kind} at (${opening.at[0]}, ${opening.at[1]}) has no ${casings[opening.kind].join('/')} at ${missing.length === 2 ? 'either jamb' : 'one jamb'}`,
        })
      }
    }

    // 3. No wall stands inside the room, and no other room does either.
    const xs = points.map((p) => p[0])
    const zs = points.map((p) => p[1])
    let wallsInside = 0
    let firstWall: Point | null = null
    for (let x = Math.min(...xs) + INSET; x <= Math.max(...xs) - INSET; x += 0.25) {
      for (let z = Math.min(...zs) + INSET; z <= Math.max(...zs) - INSET; z += 0.25) {
        const point: Point = [x, z]
        if (!inside(point, points) || distanceToOutline(point, points) < INSET) continue
        if (walls.near(point, INSIDE_REACH, [WALL])) {
          wallsInside += 1
          firstWall ??= point
        }
        for (const other of outlines) {
          if (other.room === room || !inside(point, other.points)) continue
          findings.push({
            room: room.key,
            what: `overlaps ${other.room.key} at (${x.toFixed(2)}, ${z.toFixed(2)})`,
          })
          break
        }
      }
    }
    if (wallsInside > 0 && firstWall) {
      findings.push({
        room: room.key,
        what: `a wall stands inside the room — ${wallsInside} sample(s), first at (${firstWall[0].toFixed(2)}, ${firstWall[1].toFixed(2)})`,
      })
    }
  }

  // Same finding reported from the same room only once.
  const seen = new Set<string>()
  return findings.filter((finding) => {
    const key = `${finding.room}|${finding.what.replace(/at \([^)]*\)/, '')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function main() {
  const slug = process.argv[2]
  const spec = slug ? SPECS[slug] : undefined
  if (!spec) {
    console.error(`Usage: pnpm audit:building <slug>\nKnown: ${Object.keys(SPECS).join(', ')}`)
    process.exit(1)
  }

  const findings = await auditSpec(spec)
  for (const finding of findings) console.log(`  ${finding.room}: ${finding.what}`)
  console.log(
    findings.length === 0
      ? `${spec.slug}: ${spec.rooms.length} rooms, every edge on a wall, every opening on a casing, nothing inside.`
      : `${spec.slug}: ${findings.length} finding(s).`,
  )
  process.exit(findings.length === 0 ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
