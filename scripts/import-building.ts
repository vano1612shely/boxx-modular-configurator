import 'dotenv/config'

import path from 'node:path'

import { getBounds, type Document, type Node } from '@gltf-transform/core'
import { dedup, prune } from '@gltf-transform/functions'
import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'
import { autoAssignSides, computeSideAxes } from '../src/entities/building/lib/room-shell'
import { SHELL_DEFAULTS } from '../src/modules/shared/room-shell'

import { loadScene, pathsByMaterial } from './analyze-model'
import { auditSpec } from './audit-building'
import { SPECS } from './buildings'
import type { BuildingSpec, Facing, OpeningSpec, RoomSpec, Rect } from './buildings/types'
import { cached, findAllByName, io, keepOnlyNodes, upsertUpload, wrapScene } from './lib/import-tools'

/**
 * Turns a client's building glb into a catalogue entry.
 *
 * The machinery lives here and the numbers live in `scripts/buildings/<slug>.ts`,
 * because every building asks the same questions and answers them differently.
 * Nothing about one building is written into this file.
 *
 *   pnpm import:building <slug> [--reuse]
 *
 * `--reuse` skips re-preparing the glbs when the cache already holds them,
 * which is most of the runtime on a 160 MB source.
 *
 * Coordinates in a spec are the ones `pnpm analyze:model` prints — the source
 * file's own. The recentring offset is applied here, to the geometry and to the
 * rooms together, so the two can never drift apart and nobody has to do the
 * arithmetic by hand.
 */

/** The whole file moved by the offset, under one node. */
function recentre(document: Document, offset: [number, number, number]) {
  wrapScene(document, 'BuildingRoot').setTranslation(offset)
}

/**
 * Degrees to turn something so that what faced `facing` faces +Z — and,
 * negated, to turn a model that faces +Z to face `facing`.
 */
function yawToPlusZ(facing: Facing): number {
  return { '+z': 0, '-z': 180, '+x': -90, '-x': 90 }[facing]
}

/**
 * One assembly of the building — the steps at a door — cut out by node and
 * stood on its own origin.
 *
 * Everything but the named nodes is dropped; what is left is turned so the
 * wall it stood against faces +Z, then moved so the door threshold sits at
 * the origin. Turned first, then moved: the threshold is a point in the
 * original frame, and it has to be carried through the same turn.
 */
async function prepareExteriorOption(
  source: string,
  nodes: string[],
  origin: [number, number, number],
  facing: Facing,
): Promise<Buffer> {
  const document = await (await io()).read(source)
  keepOnlyNodes(document, nodes)

  const yaw = (yawToPlusZ(facing) * Math.PI) / 180
  const turned: [number, number, number] = [
    origin[0] * Math.cos(yaw) + origin[2] * Math.sin(yaw),
    origin[1],
    -origin[0] * Math.sin(yaw) + origin[2] * Math.cos(yaw),
  ]
  wrapScene(document, 'OptionRoot')
    .setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
    .setTranslation([-turned[0], -turned[1], -turned[2]])

  await document.transform(prune(), dedup())
  return Buffer.from(await (await io()).writeBinary(document))
}

/** The main model: the site pad and anything else unwanted taken out, re-centred. */
async function prepareMain(spec: BuildingSpec): Promise<Buffer> {
  const document = await (await io()).read(spec.source.main)

  for (const name of spec.dropNodes) {
    const found = findAllByName(document, name)
    if (found.length === 0) throw new Error(`Main model has no node "${name}" to drop.`)
    for (const node of found) node.dispose()
  }

  recentre(document, spec.offset)
  await document.transform(prune(), dedup())
  return Buffer.from(await (await io()).writeBinary(document))
}

/**
 * The roof and the ceiling under it, taken from the uncut model.
 *
 * Both, not just the roof: standing in the building you look up at the
 * suspended ceiling — tiles, grid, lamps, diffusers — and a model holding only
 * the roof deck shows the bare underside of it instead.
 *
 * Same offset as the building, so this needs no placement of its own: the two
 * files share an origin and `roofModel.position` stays (0, 0, 0). Aligning it
 * by eye in the editor would be a slower way to get a worse answer.
 */
async function prepareRoof(spec: BuildingSpec): Promise<Buffer> {
  const document = await (await io()).read(spec.source.full)
  const cut = await (await io()).read(spec.source.main)

  // What the horizontal cut took away, which is exactly the roof and the
  // suspended ceiling under it — tiles, grid, lamps and diffusers. Anything
  // still in both files is the building itself and stays out of this model.
  //
  // Diffed rather than listed by name for two reasons: the names differ from
  // one size to the next, so a list has to be re-derived per building and is
  // wrong silently when it is not; and the answer is already implied by the
  // pair of files the client sends.
  const inCut = new Set(cut.getRoot().listNodes().map(signature))

  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    if (inCut.has(signature(node))) node.dispose()
  }

  recentre(document, spec.offset)
  await document.transform(prune(), dedup())
  return Buffer.from(await (await io()).writeBinary(document))
}

/**
 * What makes a node the same node in the other file.
 *
 * Names are not it — an exporter renumbers them between the cut and uncut
 * versions of the same building. What survives is the material it is drawn
 * with and where it stands, rounded to a centimetre so that floating point
 * does not make two identical objects look different.
 */
function signature(node: Node): string {
  const mesh = node.getMesh()
  if (!mesh) return `empty:${node.getName()}`

  const materials = mesh
    .listPrimitives()
    .map((primitive) => primitive.getMaterial()?.getName() ?? '?')
    .join(',')
  const bounds = getBounds(node)
  const round = (value: number) => Math.round(value * 100) / 100

  return `${materials}|${bounds.min.map(round).join(',')}|${bounds.max.map(round).join(',')}`
}

/** The inverse of a column-major 4x4 with no shear — enough for a glb node. */
function invert(matrix: number[]): number[] {
  const m = matrix
  const inv = new Array<number>(16)
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10]
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10]
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9]
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9]
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10]
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10]
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9]
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9]
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6]
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6]
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5]
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5]
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6]
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6]
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5]
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5]
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]
  if (det === 0) throw new Error('A node with a singular transform cannot be turned.')
  return inv.map((value) => value / det)
}

function apply(matrix: number[], point: [number, number, number]): [number, number, number] {
  const [x, y, z] = point
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ]
}

/**
 * Cuts one door or window out of the building, to be uploaded as its own model.
 *
 * A window is not a node: the exporter merged all fourteen of them, their
 * frames and their glass into one mesh per material. So the cut is by region —
 * every triangle whose centre falls in the box, from the materials that make a
 * window up — and the rest of the mesh is left behind.
 *
 * Which one to cut matters. The viewer expects a model's +Z to point out of the
 * room and re-centres it on its own box, so taking the window from a wall that
 * already faces +Z means no correction anywhere: the spec's `yawDeg` stays 0
 * and stays honest.
 */
async function prepareOpeningModel(
  source: string,
  region: { min: [number, number, number]; max: [number, number, number] },
  materials: string[],
  /** Boxes that override the main one, per material. */
  perMaterial: Record<string, { min: number[]; max: number[] }> = {},
  /** Squash the cut across the wall by this fraction of its own depth. */
  thinBy: number | null = null,
  /** Swing these materials' vertices about a vertical axis, after the cut. */
  turn: { materials: string[]; axis: [number, number]; yawDeg: number } | null = null,
  /** Which way the wall faced; anything but +Z is turned to +Z here. */
  facing: Facing = '+z',
  /** Base colours written over the named materials, for a file that lost them. */
  paint: Record<string, [number, number, number]> = {},
): Promise<Buffer> {
  const document = await (await io()).read(source)
  const wanted = new Set(materials)

  for (const [name, rgb] of Object.entries(paint)) {
    const painted = document.getRoot().listMaterials().filter((material) => material.getName() === name)
    if (painted.length === 0) throw new Error(`No material "${name}" to paint.`)
    for (const material of painted) material.setBaseColorFactor([...rgb, 1])
  }

  const inside = (point: [number, number, number], box: { min: number[]; max: number[] }) =>
    point[0] >= box.min[0] &&
    point[0] <= box.max[0] &&
    point[1] >= box.min[1] &&
    point[1] <= box.max[1] &&
    point[2] >= box.min[2] &&
    point[2] <= box.max[2]

  let kept = 0
  const extent = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue

    const matrix = node.getWorldMatrix()

    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()?.getName() ?? ''
      if (!wanted.has(material)) {
        mesh.removePrimitive(primitive)
        continue
      }

      const position = primitive.getAttribute('POSITION')
      const indices = primitive.getIndices()
      if (!position || !indices) continue

      const source_ = indices.getArray()
      if (!source_) continue

      const survivors: number[] = []
      for (let t = 0; t < source_.length; t += 3) {
        const corners = [0, 1, 2].map((k) => {
          const vertex = [0, 0, 0] as [number, number, number]
          position.getElement(source_[t + k], vertex)
          return apply(matrix, vertex)
        })
        const centroid: [number, number, number] = [
          (corners[0][0] + corners[1][0] + corners[2][0]) / 3,
          (corners[0][1] + corners[1][1] + corners[2][1]) / 3,
          (corners[0][2] + corners[1][2] + corners[2][2]) / 3,
        ]
        if (inside(centroid, perMaterial[material] ?? region)) survivors.push(source_[t], source_[t + 1], source_[t + 2])
      }

      if (survivors.length === 0) {
        mesh.removePrimitive(primitive)
        continue
      }

      for (const index of survivors) {
        const vertex = [0, 0, 0] as [number, number, number]
        position.getElement(index, vertex)
        const world = apply(matrix, vertex)
        for (let axis = 0; axis < 3; axis += 1) {
          extent.min[axis] = Math.min(extent.min[axis], world[axis])
          extent.max[axis] = Math.max(extent.max[axis], world[axis])
        }
      }

      indices.setArray(new Uint32Array(survivors))
      kept += survivors.length / 3

      // A leaf modelled open is closed here: every vertex of the leaf's
      // materials is swung about the hinge pin. World space in, world space
      // out — the node's own transform is undone and redone around it.
      if (turn && turn.materials.includes(material)) {
        const yaw = (turn.yawDeg * Math.PI) / 180
        const inverse = invert(matrix)
        const [ax, az] = turn.axis
        const moved = new Float32Array(position.getCount() * 3)
        for (let v = 0; v < position.getCount(); v += 1) {
          const local = [0, 0, 0] as [number, number, number]
          position.getElement(v, local)
          const world = apply(matrix, local)
          const dx = world[0] - ax
          const dz = world[2] - az
          const swung: [number, number, number] = [
            ax + dx * Math.cos(yaw) + dz * Math.sin(yaw),
            world[1],
            az - dx * Math.sin(yaw) + dz * Math.cos(yaw),
          ]
          const back = apply(inverse, swung)
          moved.set(back, v * 3)
        }
        position.setArray(moved)
      }
    }

    if (mesh.listPrimitives().length === 0) node.dispose()
  }

  if (kept === 0) throw new Error(`Nothing of [${materials.join(', ')}] falls inside that region.`)

  // Reported because the opening it goes into should be this size. `stretch`
  // squeezes a model into whatever hole it is given, so an opening narrower
  // than the door assembly makes a narrow door rather than a clipped one — a
  // distortion nobody notices until they measure it.
  const size = [0, 1, 2].map((axis) => Number((extent.max[axis] - extent.min[axis]).toFixed(3)))
  console.log(`  cut ${kept} triangles — ${size[0]} wide × ${size[1]} tall × ${size[2]} deep`)

  // A window assembly is deeper than the wall the generated room builds, so at
  // any sensible setting some of it stands out on the far side and shows
  // through the building. Squashed across the wall it fits, and nobody can tell
  // from inside a room how deep its window is — but they can see it poking out.
  if (thinBy !== null && thinBy > 0) {
    const factor = 1 - thinBy
    const root = document.getRoot()
    const scene = root.getDefaultScene() ?? root.listScenes()[0]
    const holder = document.createNode('Flattened').setScale([1, 1, factor])
    for (const child of scene.listChildren()) {
      scene.removeChild(child)
      holder.addChild(child)
    }
    scene.addChild(holder)
    console.log(`  thinned to ${(size[2] * factor).toFixed(3)} deep (×${factor.toFixed(2)})`)
  }

  // Cut from a wall that faces some other way: turned so it faces +Z, which
  // is the one direction the viewer expects — where it stands is immaterial,
  // the viewer centres it by its box.
  if (facing !== '+z') {
    const yaw = (yawToPlusZ(facing) * Math.PI) / 180
    const root = document.getRoot()
    const scene = root.getDefaultScene() ?? root.listScenes()[0]
    const holder = document.createNode('Faced').setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)])
    for (const child of scene.listChildren()) {
      scene.removeChild(child)
      holder.addChild(child)
    }
    scene.addChild(holder)
  }

  await document.transform(prune(), dedup())
  return Buffer.from(await (await io()).writeBinary(document))
}

/** The base-colour image of a named material, as the file it already is. */
async function extractTexture(file: string, material: string) {
  const document = await (await io()).read(file)
  const found = document
    .getRoot()
    .listMaterials()
    .find((candidate) => candidate.getName() === material)

  if (!found) throw new Error(`No material "${material}" in ${path.basename(file)}.`)

  const texture = found.getBaseColorTexture()
  if (!texture) throw new Error(`Material "${material}" has no base colour texture.`)

  const image = texture.getImage()
  if (!image) throw new Error(`Texture of "${material}" carries no image.`)

  const mime = texture.getMimeType() || 'image/png'
  const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
  return { data: Buffer.from(image), mime, extension }
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

type Point = { x: number; z: number }

function rectPoints(rect: Rect): Point[] {
  return [
    { x: rect.x0, z: rect.z0 },
    { x: rect.x1, z: rect.z0 },
    { x: rect.x1, z: rect.z1 },
    { x: rect.x0, z: rect.z1 },
  ]
}

function outline(room: { rect?: Rect; polygon?: Array<[number, number]> }): Point[] {
  if (room.polygon) return room.polygon.map(([x, z]) => ({ x, z }))
  if (room.rect) return rectPoints(room.rect)
  throw new Error('A room needs either a rect or a polygon.')
}

function shift(points: Point[], offset: [number, number, number]): Point[] {
  return points.map((point) => ({
    x: Number((point.x + offset[0]).toFixed(3)),
    z: Number((point.z + offset[2]).toFixed(3)),
  }))
}

function centreOf(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }), { x: 0, z: 0 })
  return { x: sum.x / points.length, z: sum.z / points.length }
}

/**
 * Which of the four walls each edge belongs to — the app's own answer.
 *
 * `autoAssignSides` is what the Scene Editor's "Auto-assign from geometry"
 * button runs, so an imported room is assigned exactly as a hand-made one. It
 * is imported rather than reimplemented for a reason that cost an iteration:
 * grouping edges by which way they face, which is the obvious rule, splits a
 * recess across two walls. The return at the back of a notch is perpendicular
 * to the stretches either side of it, so the obvious rule files it with the
 * wall it faces — and then that one segment stays behind when the wall it
 * belongs to is hidden. This keeps a recess on the wall it is cut into.
 */
function floorPolygon(points: Point[]) {
  const sides = autoAssignSides(points)
  return points.map((point, index) => ({ x: point.x, z: point.z, side: sides[index] }))
}

/**
 * An opening's distance along its wall, from a centre measured in the model.
 *
 * The spec says where a window is in the building's own coordinates, because
 * that is what the analyzer reports and what anybody can check. `along` — the
 * arc length from the start of that wall's first edge — is derived, since
 * deriving it by hand is how an opening ends up in the wrong room.
 */
/**
 * The wall an opening given as a point belongs to, and how far along it sits.
 *
 * Used where the side alone is ambiguous: the edge is the one whose line the
 * point lies on, so a door into the east restrooms cannot land on the west wall
 * however far along that side it happens to fall.
 */
function placeAt(
  vertices: Array<Point & { side: string }>,
  opening: OpeningSpec & { at: [number, number] },
  offset: [number, number, number],
): { side: string; along: number } {
  const target = { x: opening.at[0] + offset[0], z: opening.at[1] + offset[2] }
  const chains = new Map<string, number>()

  for (let index = 0; index < vertices.length; index += 1) {
    const from = vertices[index]
    const to = vertices[(index + 1) % vertices.length]
    const side = from.side
    const travelled = chains.get(side) ?? 0

    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.z - from.z)
    const start = horizontal ? from.x : from.z
    const end = horizontal ? to.x : to.z
    const across = horizontal ? from.z : from.x
    const point = horizontal ? target.x : target.z
    const offAxis = horizontal ? target.z : target.x
    const length = Math.abs(end - start)

    const onThisLine = Math.abs(offAxis - across) <= 0.2
    const withinSpan = point >= Math.min(start, end) - 0.01 && point <= Math.max(start, end) + 0.01

    if (onThisLine && withinSpan) {
      const into = Math.abs(point - start) - opening.width / 2
      return { side, along: Number(Math.max(0, travelled + into).toFixed(3)) }
    }

    chains.set(side, travelled + length)
  }

  throw new Error(`No wall of this room runs through (${opening.at.join(', ')}).`)
}

function alongOf(
  vertices: Array<Point & { side: string }>,
  opening: OpeningSpec,
  offset: [number, number, number],
): number {
  const points = vertices.map((vertex) => ({ x: vertex.x, z: vertex.z }))
  const centreOnWall =
    opening.centre + (opening.side === 'w1' || opening.side === 'w3' ? offset[0] : offset[2])

  // Walked as a chain, not edge by edge. One wall of an L-shaped room is two
  // stretches with the notch between them, and `along` is measured from the
  // start of the whole chain — so the second stretch begins where the first
  // one left off, and an opening on it that ignored the first would land in
  // the wrong place by the length of it.
  let travelled = 0

  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]
    const to = points[(index + 1) % points.length]
    if (vertices[index].side !== opening.side) continue

    const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.z - from.z)
    const start = horizontal ? from.x : from.z
    const end = horizontal ? to.x : to.z
    const length = Math.abs(end - start)

    const low = Math.min(start, end)
    const high = Math.max(start, end)
    if (centreOnWall >= low - 0.01 && centreOnWall <= high + 0.01) {
      const into = Math.abs(centreOnWall - start) - opening.width / 2
      return Number(Math.max(0, travelled + into).toFixed(3))
    }

    travelled += length
  }

  throw new Error(
    `Opening on ${opening.side} centred at ${opening.centre} is not on that wall of the room.`,
  )
}

/**
 * Whether a mesh belongs to a room: standing in it, and small enough to be a
 * fitting rather than part of the building.
 *
 * Corners-all-inside was the first rule and it was too strict. An exporter
 * merges by material, so a building with a kitchen at each end has both in one
 * node whose box spans the whole width — legitimately a fitting of the room,
 * but with corners reaching over a restroom block where the room is not.
 *
 * The centre alone was the rule before that and too loose: a trim running the
 * length of the building has its centre in the middle of the open floor, and
 * the room ended up owning a strip of the building's own skin.
 *
 * So: centred in the room, and covering a small enough part of its floor to be
 * furniture. The threshold is a judgement — a kitchen run comes to about a
 * tenth of the room it is in, the building trim to nine tenths — and the two
 * are far enough apart that the line between them is not delicate.
 */
const FITTING_MAX_SHARE = 0.3

function boxInside(points: Point[], box: { min: number[]; max: number[] }): boolean {
  const centre = { x: (box.min[0] + box.max[0]) / 2, z: (box.min[2] + box.max[2]) / 2 }
  if (!contains(points, centre)) return false

  const footprint = (box.max[0] - box.min[0]) * (box.max[2] - box.min[2])
  const xs = points.map((point) => point.x)
  const zs = points.map((point) => point.z)
  const room = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs))

  return room <= 0 || footprint / room <= FITTING_MAX_SHARE
}

/**
 * Whether a point is inside the outline — the ray-crossing test.
 *
 * Rooms here are rectangles and one six-cornered L, and a box test would put
 * anything in the L's missing corner inside it. The restroom block sits exactly
 * in that corner, so the cheap test is the wrong one.
 *
 * Edges are grown by a hand's width first: a counter is built against a wall,
 * and its centre landing a millimetre outside its own room is a rounding
 * accident, not an answer.
 */
function contains(points: Point[], point: Point, slack = 0.15): boolean {
  const centre = centreOf(points)
  const grown = points.map((corner) => ({
    x: corner.x + Math.sign(corner.x - centre.x) * slack,
    z: corner.z + Math.sign(corner.z - centre.z) * slack,
  }))

  let inside = false
  for (let i = 0, j = grown.length - 1; i < grown.length; j = i, i += 1) {
    const a = grown[i]
    const b = grown[j]
    const straddles = a.z > point.z !== b.z > point.z
    if (!straddles) continue
    const crossing = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    if (point.x < crossing) inside = !inside
  }
  return inside
}

/**
 * Where the camera sits when this room is focused.
 *
 * Derived rather than authored: thirteen hand-written camera presets is
 * thirteen chances to put one inside a wall, and every room here wants the same
 * shot — the whole floor, from above the middle of the room's longer axis,
 * looking down at standing height. A room that deserves better can still say so
 * in its spec.
 */
function defaultCamera(points: Point[], wallHeight: number) {
  const xs = points.map((point) => point.x)
  const zs = points.map((point) => point.z)
  const centre = centreOf(points)
  const width = Math.max(...xs) - Math.min(...xs)
  const depth = Math.max(...zs) - Math.min(...zs)
  const reach = Math.max(width, depth)

  return {
    position: {
      x: Number(centre.x.toFixed(3)),
      y: Number((wallHeight + reach * 0.55).toFixed(3)),
      z: Number((centre.z + depth * 0.75).toFixed(3)),
    },
    target: { x: Number(centre.x.toFixed(3)), y: 0.9, z: Number(centre.z.toFixed(3)) },
  }
}

function openingModelFor(chosen: { model: number; depth: number; yawDeg: number } | undefined) {
  return {
    model: chosen?.model ?? null,
    fit: 'stretch' as const,
    yawDeg: chosen?.yawDeg ?? 0,
    depth: chosen?.depth ?? 0,
  }
}

function buildRoom(
  room: RoomSpec,
  spec: BuildingSpec,
  roomTypeId: (slug: string) => number,
  textureIds: Record<string, number | undefined>,
  tiles: Record<string, [number, number]>,
  openingModelIds: Record<string, { model: number; depth: number; yawDeg: number } | undefined>,
  builtIns: Map<string, Array<{ path: string; box: { min: number[]; max: number[] } }>>,
) {
  const points = shift(outline(room), spec.offset)
  const vertices = floorPolygon(points)
  const shell = spec.shell

  const tile = (surface: string) => tiles[surface] ?? [1, 1]

  // Meshes drawn with a material this room claims, kept only where they stand
  // inside it. A material names a look, not a place: `metal_chrome` is the
  // kitchen tap, a restroom rail and a trim along the whole building, and
  // claiming it wholesale would draw the restroom's fittings in the kitchen.
  // One part per node, with no pose — each is already where the building put it.
  const parts = (room.builtInMaterials ?? []).flatMap((material) =>
    (builtIns.get(material) ?? [])
      .filter((node) => boxInside(points, node.box))
      .map((node, index) => ({
        key: `${room.key}-${material}-${index + 1}`,
        source: 'node' as const,
        nodePath: node.path,
        modelUrl: null,
        name: material,
        groupKey: room.key,
        position: [0, 0, 0] as [number, number, number],
        yawDeg: 0,
        scale: 1,
      })),
  )

  return {
    key: room.key,
    name: room.name,
    roomType: roomTypeId(room.roomTypeSlug),
    isRestroom: room.isRestroom ?? false,
    floorPolygon: vertices,
    zones: (room.zones ?? []).map((zone) => ({
      key: zone.key,
      name: zone.name,
      roomType: zone.roomTypeSlug,
      areaSqFt: null,
      areaSqM: null,
      color: zone.color,
      polygon: shift(rectPoints(zone.rect), spec.offset),
    })),
    builtIns: parts,
    fittedSets: [],
    shell: {
      floorY: shell.floorY,
      wallHeight: shell.wallHeight,
      wallThickness: shell.wallThickness ?? SHELL_DEFAULTS.wallThickness,
      floorThickness: shell.floorThickness ?? SHELL_DEFAULTS.floorThickness,
      ceilingThickness: shell.ceilingThickness ?? SHELL_DEFAULTS.ceilingThickness,
      sunDirection: null,
      sideAxes: computeSideAxes(vertices as never),
    },
    openings: (room.openings ?? []).map((opening, index) => {
      const placed = opening.at
        ? placeAt(vertices, opening as OpeningSpec & { at: [number, number] }, spec.offset)
        : { side: opening.side, along: alongOf(vertices, opening, spec.offset) }
      return {
        id: `${room.key}-${opening.kind}-${index + 1}`,
        side: placed.side,
        kind: opening.kind,
        along: placed.along,
        width: opening.width,
        height: opening.height,
        sill: opening.sill,
        ...(opening.entrance ? { entrance: true } : {}),
      }
    }),
    surfaces: {
      wallInner: {
        texture: textureIds.wallInner ?? null,
        tileWidth: tile('wallInner')[0],
        tileHeight: tile('wallInner')[1],
      },
      floor: {
        texture: textureIds.floor ?? null,
        tileWidth: tile('floor')[0],
        tileHeight: tile('floor')[1],
      },
      ceiling: {
        texture: textureIds.ceiling ?? null,
        tileWidth: tile('ceiling')[0],
        tileHeight: tile('ceiling')[1],
      },
    },
    openingModels: {
      door: openingModelFor(openingModelIds[room.openingModelKeys?.door ?? 'door']),
      window: openingModelFor(openingModelIds[room.openingModelKeys?.window ?? 'window']),
      entrance: openingModelFor(openingModelIds[room.openingModelKeys?.entrance ?? 'entrance']),
    },
    cameraPreset: defaultCamera(points, shell.wallHeight),
  }
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

async function roomTypeLookup(payload: Payload) {
  const types = await payload.find({ collection: 'room-types', limit: 200, depth: 0 })
  const bySlug = new Map(types.docs.map((type) => [type.slug, type.id]))

  return (slug: string) => {
    const id = bySlug.get(slug)
    if (id === undefined) {
      throw new Error(`No room type "${slug}" in the catalogue — add it before importing.`)
    }
    return id
  }
}

async function main() {
  const slug = process.argv[2]
  const spec = SPECS[slug]
  if (!spec) {
    console.error(`Usage: pnpm import:building <slug>\nKnown: ${Object.keys(SPECS).join(', ')}`)
    process.exit(1)
  }

  // Nothing is uploaded on the strength of a number somebody typed: every
  // edge, door and window of the spec is checked against the glb first.
  if (!process.argv.includes('--no-audit')) {
    const findings = await auditSpec(spec)
    if (findings.length > 0) {
      for (const finding of findings) console.error(`  ${finding.room}: ${finding.what}`)
      throw new Error(`${slug}: ${findings.length} finding(s) against the geometry — fix the spec, or pass --no-audit.`)
    }
    console.log(`audited: ${spec.rooms.length} rooms against the geometry, nothing to report`)
  }

  const reuse = process.argv.includes('--reuse')
  const mainGlb = await cached(slug, 'main.glb', () => prepareMain(spec), reuse)()
  const roofGlb = await cached(slug, 'roof.glb', () => prepareRoof(spec), reuse)()

  const payload = await getPayload({ config })
  const roomType = await roomTypeLookup(payload)

  const line = await payload.find({
    collection: 'building-lines',
    where: { slug: { equals: spec.lineSlug } },
    limit: 1,
    depth: 0,
  })
  if (line.docs.length === 0) throw new Error(`No product line "${spec.lineSlug}" — run pnpm catalogue.`)

  // Named in the spec rather than inherited from the line. Both are scoped, so
  // the catalogue would behave either way — but an empty `regions` reads as
  // "sold everywhere" to anybody looking at the row, and a record that says the
  // opposite of what it means is the kind that survives until it is wrong.
  const regions = await payload.find({ collection: 'regions', limit: 100, depth: 0 })
  const regionByCode = new Map(regions.docs.map((region) => [region.code, region.id]))
  const soldIn = spec.regionCodes.map((code) => {
    const id = regionByCode.get(code)
    if (id === undefined) throw new Error(`No region "${code}" — run pnpm catalogue first.`)
    return id
  })

  // Everything a size shares with the rest of its line: the wall finishes, the
  // door, the window. Named after the building they were cut from, so pointing
  // at the same rows rather than making more is a lookup, not a copy.
  const sharedSlugs = [spec.reuseAssetsFrom ?? []].flat()
  const sharedFrom = sharedSlugs.map((sharedSlug) => {
    const found = SPECS[sharedSlug]
    if (!found) throw new Error(`No building "${sharedSlug}" to take shared assets from.`)
    return found
  })
  const shared = sharedFrom[0] ?? null

  const findByTitle = async (collection: 'models' | 'textures', title: string) => {
    const found = await payload.find({
      collection,
      where: { title: { equals: title } },
      limit: 1,
      depth: 0,
    })
    if (found.docs.length === 0) {
      throw new Error(`No ${collection} row titled "${title}" — import ${shared?.slug} first.`)
    }
    return found.docs[0].id
  }

  const textureIds: Record<string, number> = {}
  for (const donor of sharedFrom) {
    for (const texture of donor.textures) {
      textureIds[texture.surface] = await findByTitle('textures', `${donor.slug} — ${texture.surface}`)
      payload.logger.info(`textures: reusing "${donor.slug} — ${texture.surface}"`)
    }
  }

  for (const texture of spec.textures) {
    const source = texture.from === 'full' ? spec.source.full : spec.source.main
    const image = await extractTexture(source, texture.material)
    const doc = await upsertUpload(payload, 'textures', `${spec.slug} — ${texture.surface}`, {
      data: image.data,
      name: `${spec.slug}-${texture.surface}.${image.extension}`,
      mimetype: image.mime,
    })
    textureIds[texture.surface] = doc.id
  }

  const model = await upsertUpload(payload, 'models', spec.modelTitle, {
    data: mainGlb,
    name: `${spec.slug}.glb`,
    mimetype: 'model/gltf-binary',
  })

  const sharedRoof = spec.reuseRoofFrom ? SPECS[spec.reuseRoofFrom] : null
  if (spec.reuseRoofFrom && !sharedRoof) {
    throw new Error(`No building "${spec.reuseRoofFrom}" to take a roof from.`)
  }

  const roofId = sharedRoof
    ? await findByTitle('models', `${sharedRoof.modelTitle} — roof`)
    : (
        await upsertUpload(payload, 'models', `${spec.modelTitle} — roof`, {
          data: roofGlb,
          name: `${spec.slug}-roof.glb`,
          mimetype: 'model/gltf-binary',
        })
      ).id
  if (sharedRoof) payload.logger.info(`models: reusing "${sharedRoof.modelTitle} — roof"`)

  // By key, which is the kind unless a building has two of a kind. A shared
  // building's models come first; the building's own may add to or replace them.
  const openingModelIds: Record<string, { model: number; depth: number; yawDeg: number }> = {}
  for (const donor of sharedFrom) {
    for (const opening of donor.openingModels ?? []) {
      const key = opening.key ?? opening.kind
      openingModelIds[key] = {
        model: await findByTitle('models', `${donor.modelTitle} — ${key}`),
        depth: opening.intoWall,
        yawDeg: opening.facingDeg ?? 0,
      }
      payload.logger.info(`models: reusing "${donor.modelTitle} — ${key}"`)
    }
  }

  for (const opening of spec.openingModels ?? []) {
    const key = opening.key ?? opening.kind
    const source = opening.from === 'full' ? spec.source.full : spec.source.main
    console.log(`cutting the ${key} out of the building…`)

    const glb = await cached(
      slug,
      `${key}.glb`,
      () => prepareOpeningModel(
          source,
          opening.region,
          opening.materials,
          opening.regionByMaterial ?? {},
          opening.thinBy ?? null,
          opening.turn ?? null,
          opening.facing ?? '+z',
          opening.paint ?? {},
        ),
      reuse,
    )()
    const doc = await upsertUpload(payload, 'models', `${spec.modelTitle} — ${key}`, {
      data: glb,
      name: `${spec.slug}-${key}.glb`,
      mimetype: 'model/gltf-binary',
    })
    payload.logger.info(`  ${key}: sits ${opening.intoWall} m out of the wall's middle`)
    openingModelIds[key] = {
      model: doc.id,
      depth: opening.intoWall,
      yawDeg: opening.facingDeg ?? 0,
    }
  }

  // The entrance choices, by key: the line's own, cut here, and any a donor
  // building cut before — both found by title, so re-running replaces rather
  // than duplicates.
  const exteriorOptionIds: Record<string, number> = {}
  const optionRow = async (title: string, description: string | undefined, model: number) => {
    const found = await payload.find({
      collection: 'exterior-options',
      where: { title: { equals: title } },
      limit: 1,
      depth: 0,
    })
    const data = { title, model, ...(description ? { description } : {}) }
    const row =
      found.docs.length > 0
        ? await payload.update({ collection: 'exterior-options', id: found.docs[0].id, data })
        : await payload.create({ collection: 'exterior-options', data })
    return row.id
  }
  for (const donor of sharedFrom) {
    for (const option of donor.exteriorOptions ?? []) {
      const found = await payload.find({
        collection: 'exterior-options',
        where: { title: { equals: option.title } },
        limit: 1,
        depth: 0,
      })
      if (found.docs.length === 0) throw new Error(`No exterior option "${option.title}" — import ${donor.slug} first.`)
      exteriorOptionIds[option.key] = found.docs[0].id
      payload.logger.info(`exterior-options: reusing "${option.title}"`)
    }
  }
  for (const option of spec.exteriorOptions ?? []) {
    const source = option.from === 'full' ? spec.source.full : spec.source.main
    console.log(`cutting the ${option.key} out of the building…`)
    const glb = await cached(
      slug,
      `${option.key}.glb`,
      () => prepareExteriorOption(source, option.nodes, option.origin, option.facing),
      reuse,
    )()
    const doc = await upsertUpload(payload, 'models', `${spec.modelTitle} — ${option.key}`, {
      data: glb,
      name: `${spec.slug}-${option.key}.glb`,
      mimetype: 'model/gltf-binary',
    })
    exteriorOptionIds[option.key] = await optionRow(option.title, option.description, doc.id)
    payload.logger.info(`exterior-options: "${option.title}" → model ${doc.id}`)
  }

  // Read back what was stored, not what was sent. The upload hook re-optimises
  // the file, and anything that re-emits a glb may renumber its nodes — so a
  // child-index path is only true of the file the browser will actually load.
  const wanted = [...new Set(spec.rooms.flatMap((room) => room.builtInMaterials ?? []))]
  const builtIns = wanted.length
    ? pathsByMaterial(await loadScene(path.resolve('models', model.filename as string)), wanted)
    : new Map<string, Array<{ path: string; box: { min: number[]; max: number[] } }>>()

  for (const material of wanted) {
    const nodes = builtIns.get(material) ?? []
    if (nodes.length === 0) throw new Error(`No mesh uses "${material}" in the stored model.`)
    payload.logger.info(
      `built-in "${material}": ${nodes.length} candidate(s) — ${nodes.map((node) => node.path).join(', ')}`,
    )
  }

  // Tiling travels with the texture. A size that reuses another's finishes has
  // no `textures` of its own, and reading tiles only from its own list left
  // every reusing building at one metre per repeat — the same wrong scale the
  // measured values were there to fix, in the three buildings nobody looked at.
  const tiles = Object.fromEntries(
    [...sharedFrom.flatMap((donor) => donor.textures), ...spec.textures].map((texture) => [
      texture.surface,
      texture.tile,
    ]),
  )

  const data = {
    title: spec.title,
    line: line.docs[0].id,
    unitCount: spec.unitCount,
    restroomCount: spec.restroomCount,
    officeCount: spec.officeCount ?? 0,
    sqft: spec.sqft,
    dimensions: spec.dimensions,
    model: model.id,
    regions: soldIn,
    sceneConfig: {
      camera: spec.camera,
      floorY: spec.shell.floorY,
      roofBlocks: [],
      roofModel: {
        model: roofId,
        // Same offset was baked into both files, so the roof is already home.
        position: { x: 0, y: 0, z: 0 },
        yawDeg: 0,
        scale: 1,
      },
      // One spot per entrance, at the threshold, turned the way its wall faces;
      // every choice's model stands on the spot as cut, so its placement is nil.
      exteriorSlots: (spec.exteriorSpots ?? []).map((spot) => ({
        key: spot.key,
        name: spot.name,
        position: {
          x: spot.at[0] + spec.offset[0],
          y: spot.at[1] + spec.offset[1],
          z: spot.at[2] + spec.offset[2],
        },
        yawDeg: -yawToPlusZ(spot.facing),
        defaultVariantKey: spot.defaultVariant,
        variants: spot.variants.map((variant) => {
          const option = exteriorOptionIds[variant.option]
          if (option === undefined) {
            throw new Error(`Spot "${spot.key}" names an exterior option "${variant.option}" this building does not have.`)
          }
          return {
            key: variant.key,
            option,
            nodes: [],
            placement: { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, yawDeg: 0 },
          }
        }),
      })),
    },
    rooms: spec.rooms.map((room) => buildRoom(room, spec, roomType, textureIds, tiles, openingModelIds, builtIns)),
  }

  const existing = await payload.find({
    collection: 'building-models',
    where: { title: { equals: spec.title } },
    limit: 1,
    depth: 0,
  })

  // A room keeps the arrangements it offers: the fitted sets are placed after
  // the building is in — by the furniture import, or by an admin in the Scene
  // Editor — and a re-cut of the geometry is no reason to lose them.
  const before = (existing.docs[0]?.rooms ?? []) as Array<{ key?: string; fittedSets?: unknown }>
  for (const room of data.rooms) {
    const kept = before.find((was) => was.key === room.key)?.fittedSets
    if (Array.isArray(kept) && kept.length > 0) room.fittedSets = kept as never
  }

  // Rooms carry four `json` fields — zones, built-ins, fitted sets, openings —
  // which the generated types widen to `unknown`, so the shape built above
  // cannot be checked against them here. It is checked where it matters: the
  // app reads these back through `map-building`, which is typed and tested.
  const written = data as never

  const building = (
    existing.docs.length > 0
      ? await payload.update({ collection: 'building-models', id: existing.docs[0].id, data: written })
      : await payload.create({ collection: 'building-models', data: written })
  ) as { id: number; rooms?: unknown[] }

  payload.logger.info(`${spec.title}: ${building.rooms?.length ?? 0} rooms (id ${building.id}).`)
  process.exit(0)
}

await main()
