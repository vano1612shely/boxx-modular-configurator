import 'dotenv/config'

import path from 'node:path'

import { getBounds, type Document, type Node } from '@gltf-transform/core'
import { KHRTextureTransform } from '@gltf-transform/extensions'
import { dedup, prune } from '@gltf-transform/functions'
import { getPayload, type Payload } from 'payload'
import { type Box3, type Mesh, type Object3D, Vector3 } from 'three'

import config from '../src/payload.config'

import { islands, loadScene } from './analyze-model'
import { FURNITURE, type FittingSpec, type FurnitureSpec, type PieceSpec } from './furniture/packages'
import {
  catalogueFile,
  findAllByName,
  io,
  keepOnlyNodes,
  readSource,
  SOURCES,
  tidyName,
  wrapScene,
  type CatalogueFile,
} from './lib/import-tools'

/**
 * Turns a client's furniture glb into a catalogue package.
 *
 *   pnpm import:furniture <slug|all> [--recut]
 *
 * The numbers live in `scripts/furniture/packages.ts`; this is the machinery.
 * A one-model package is the file less its render floor; a group is one model
 * per piece, each cut out by object name. Every model is stood with the middle
 * of its footprint on the origin and its height left alone — the app centres
 * a model the same way when it draws one, and a piece that hangs on a wall
 * keeps the height its modeller gave it.
 *
 * The models go in from `catalogue/models/` when they are there — which they
 * are, in the repository, for every package below — and are stored as they
 * are. Cutting from the client's file happens for a model that is not there
 * yet, or for all of a package's with `--recut`; what the upload stores is
 * then written back into `catalogue/` to be committed.
 */

/** The client's file a spec names, in the sources folder. */
const sourceOf = (spec: FurnitureSpec) => path.join(SOURCES, spec.file)

/** The render floor every file carries: a ground plane and a slab under the furniture. */
function isRenderFloor(name: string): boolean {
  return /^(ground|floor)(\d|_|$)/i.test(name)
}

/**
 * The modeller's objects: the children of the last single-child wrapper.
 *
 * An exporter wraps the scene in a chain of one-child nodes and lists the
 * objects side by side under the last of them — the same place the analyzer's
 * `--objects` reads them from.
 */
function objectsOf(document: Document): Node[] {
  const root = document.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  let children = scene.listChildren()
  while (children.length === 1) children = children[0].listChildren()
  return children
}

/**
 * The objects a piece is made of: the ones it names, or — for `rest` — every
 * object no other piece names, less the render floor.
 */
function nodesOf(document: Document, spec: FurnitureSpec, piece: PieceSpec): string[] {
  if (piece.nodes !== 'rest') return piece.nodes
  const claimed = new Set(spec.pieces!.flatMap((other) => (other.nodes === 'rest' ? [] : other.nodes)))
  return objectsOf(document)
    .map((node) => node.getName())
    .filter((name) => !claimed.has(name) && !isRenderFloor(name))
}

/** The tier and the region, as the client writes them into the file name. */
function fromFileName(file: string): { region: string; tier: string } {
  const match = /^([a-z]{2})_(core|plus)_/i.exec(path.basename(file))
  if (!match) throw new Error(`"${file}" does not start with <region>_<core|plus>_ — cannot tell its tier.`)
  return { region: match[1].toLowerCase(), tier: match[2].toLowerCase() }
}

/** The middle of the footprint onto the origin; y left where the modeller put it. */
function centreFootprint(document: Document) {
  const root = document.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const bounds = getBounds(scene)
  const centre = [(bounds.min[0] + bounds.max[0]) / 2, 0, (bounds.min[2] + bounds.max[2]) / 2]
  wrapScene(document, 'PieceRoot').setTranslation([-centre[0], 0, -centre[2]])
}

/** The spec's texture repeats, written as a texture transform on each material named. */
function retile(document: Document, spec: FurnitureSpec) {
  const repeats = Object.entries(spec.textureRepeat ?? {})
  if (repeats.length === 0) return
  const transforms = document.createExtension(KHRTextureTransform)
  for (const [name, factor] of repeats) {
    const material = document.getRoot().listMaterials().find((candidate) => candidate.getName() === name)
    const info = material?.getBaseColorTextureInfo()
    if (!info) throw new Error(`"${spec.file}" has no textured material "${name}" to retile.`)
    info.setExtension('KHR_texture_transform', transforms.createTransform().setScale([factor, factor]))
  }
}

async function finish(document: Document, spec: FurnitureSpec): Promise<Buffer> {
  retile(document, spec)
  await document.transform(prune(), dedup())
  return Buffer.from(await (await io()).writeBinary(document))
}

/** Everything in the file but the render floor and what the spec leaves out. */
async function prepareWhole(spec: FurnitureSpec): Promise<Buffer> {
  const document = await readSource(sourceOf(spec))

  for (const node of document.getRoot().listNodes()) {
    if (isRenderFloor(node.getName())) node.dispose()
  }
  for (const name of spec.dropNodes ?? []) {
    const found = findAllByName(document, name)
    if (found.length === 0) throw new Error(`"${spec.file}" has no node "${name}" to drop.`)
    for (const node of found) node.dispose()
  }

  centreFootprint(document)
  return finish(document, spec)
}

/** One piece of a group: its objects and nothing else. */
async function preparePiece(spec: FurnitureSpec, piece: PieceSpec): Promise<Buffer> {
  const document = await readSource(sourceOf(spec))
  keepOnlyNodes(document, nodesOf(document, spec, piece))
  centreFootprint(document)
  return finish(document, spec)
}

/*
 * Fitted packages — the kitchens.
 *
 * A kitchen is not carried into a room; it is laid out on the room's counter,
 * once per kitchen of every building, and the visitor takes it or leaves it.
 * The file is uploaded whole, flattened so that each fitting is a root node
 * carrying its own world transform — the app draws a fitting by cloning one
 * node, and a clone keeps no ancestor's transform, so the exporter's wrapper
 * chain (a −90° turn and a 1/100 scale) would otherwise be lost with it.
 */

type Flat = {
  fitting: FittingSpec
  /** The root node's path in the flattened file, as the app resolves it. */
  path: string
  name: string
  /** The object's footprint middle and base in the file's frame. */
  centre: [number, number]
  baseY: number
  size: [number, number]
}

function unionBox(boxes: Array<{ min: number[]; max: number[] }>) {
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const other of boxes) {
    for (let axis = 0; axis < 3; axis += 1) {
      box.min[axis] = Math.min(box.min[axis], other.min[axis])
      box.max[axis] = Math.max(box.max[axis], other.max[axis])
    }
  }
  return box
}

/**
 * The fittings' nodes lifted to the scene root, in spec order, with their
 * world matrices baked in. Everything else in the file goes.
 */
function flattenFittings(document: Document, spec: FurnitureSpec): Flat[] {
  const root = document.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const flat: Array<Flat & { node: Node }> = []

  // Measured and lifted out first, while the wrapper chain still gives each
  // its place in the world.
  for (const fitting of spec.fitted ?? []) {
    for (const name of fitting.nodes) {
      const found = findAllByName(document, name)
      if (found.length === 0) throw new Error(`"${spec.file}" has no object "${name}".`)
      for (const node of found) {
        const bounds = getBounds(node)
        const world = node.getWorldMatrix()
        node.getParentNode()?.removeChild(node)
        node.setMatrix(world)
        flat.push({
          node,
          fitting,
          path: String(flat.length),
          name,
          centre: [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2],
          baseY: bounds.min[1],
          size: [bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]],
        })
      }
    }
  }

  // The wrapper chain and whatever it still holds — the render floor, objects
  // nobody named — goes; the fittings become the scene, in spec order, so a
  // fitting's path is its place in the list.
  for (const child of scene.listChildren()) child.dispose()
  for (const entry of flat) scene.addChild(entry.node)

  return flat.map(({ node: _node, ...entry }) => entry)
}

async function prepareFitted(spec: FurnitureSpec): Promise<Buffer> {
  const document = await readSource(sourceOf(spec))
  flattenFittings(document, spec)
  return finish(document, spec)
}

/**
 * Where each fitting's objects stand, read off the stored file.
 *
 * The stored file is the flattened one: its root nodes are the fittings in
 * spec order, each carrying its world transform, so the reading is the one
 * the cut was made with — and it is there on a machine that has never seen
 * the client's file. Walked against the spec rather than taken on trust: a
 * file that no longer matches the spec is a file to cut again.
 */
async function fittingsOf(spec: FurnitureSpec, file: string): Promise<Flat[]> {
  const document = await (await io()).read(file)
  const root = document.getRoot()
  const nodes = (root.getDefaultScene() ?? root.listScenes()[0]).listChildren()
  const flat: Flat[] = []

  for (const fitting of spec.fitted ?? []) {
    for (const name of fitting.nodes) {
      // As many nodes as the name found in the client's file, side by side.
      const from = flat.length
      while (flat.length < nodes.length && tidyName(nodes[flat.length].getName()) === tidyName(name)) {
        const node = nodes[flat.length]
        const bounds = getBounds(node)
        flat.push({
          fitting,
          path: String(flat.length),
          name,
          centre: [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2],
          baseY: bounds.min[1],
          size: [bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]],
        })
      }
      if (flat.length === from) {
        throw new Error(
          `${path.basename(file)} has no "${name}" at node ${from} — it no longer matches the spec; run with --recut.`,
        )
      }
    }
  }

  return flat
}

type Point = { x: number; z: number }

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = a.z > point.z !== b.z > point.z
    if (crosses && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/**
 * A kitchen, read off its room: the counter, the sink, and a frame to lay
 * things out in.
 *
 * The frame is the kitchen's own: `u` runs along the counter from the wall
 * at one end of it, `v` runs from the wall behind it into the room. Every
 * kitchen of every line is then the same problem — how long is the counter,
 * where is the sink, how far to the open side — whichever way the building
 * happens to face. The corner is the end of the counter that touches a wall;
 * when both do, the end farther from the sink, so the free run of counter
 * lies next to it.
 */
type KitchenFrame = {
  key: string
  corner: Point
  u: Point
  v: Point
  /** The room's extent along u and v from the corner. */
  uLen: number
  vLen: number
  counter: { u0: number; u1: number; depth: number; top: number }
  sink: { u0: number; u1: number } | null
}

const COUNTER_TOPS = ['adskMatkitchen_plane', 'adskMatkitchen_Plaine']

/**
 * The height of the surface a countertop material actually offers: the level
 * with the most floor-facing-up area inside the box.
 *
 * Not the top of the box. Both modellers run the countertop material up a
 * lip along the wall — five and nine centimetres — and a microwave stood on
 * the lip's height hung in the air over the worktop.
 */
function surfaceY(scene: Object3D, materials: string[], box: { min: number[]; max: number[] }): number | null {
  const areas = new Map<number, number>()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const normal = new Vector3()
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const drawn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!drawn.some((material) => materials.includes(material.name))) return
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(position, at(i)).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, at(i + 1)).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, at(i + 2)).applyMatrix4(mesh.matrixWorld)
      const x = (a.x + b.x + c.x) / 3
      const z = (a.z + b.z + c.z) / 3
      if (x < box.min[0] - 0.05 || x > box.max[0] + 0.05 || z < box.min[2] - 0.05 || z > box.max[2] + 0.05) continue
      normal.crossVectors(b.clone().sub(a), c.clone().sub(a))
      const area = normal.length() / 2
      if (area === 0 || normal.y / normal.length() < 0.9) continue
      const y = Math.round(((a.y + b.y + c.y) / 3) * 1000) / 1000
      areas.set(y, (areas.get(y) ?? 0) + area)
    }
  })
  let best: number | null = null
  let most = 0
  for (const [y, area] of areas) {
    if (area > most) {
      most = area
      best = y
    }
  }
  return best
}
const SINKS = ['metal_chrome', 'Material__622']

function kitchenFrame(
  key: string,
  polygon: Point[],
  scene: Object3D,
): KitchenFrame | null {
  const inside = (box: Box3) =>
    pointInPolygon({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 }, polygon)

  const tops = COUNTER_TOPS.flatMap((material) => islands(scene, material, 0.05)).filter((island) => inside(island.box))
  if (tops.length === 0) return null
  const counter = unionBox(tops.map((island) => ({ min: island.box.min.toArray(), max: island.box.max.toArray() })))
  const top = surfaceY(scene, COUNTER_TOPS, counter) ?? counter.max[1]

  const xs = polygon.map((point) => point.x)
  const zs = polygon.map((point) => point.z)
  const room = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }

  const alongX = counter.max[0] - counter.min[0] >= counter.max[2] - counter.min[2]
  // Along the counter (a) and across it (b), as x/z axis indexes.
  const a = alongX ? 0 : 2
  const b = alongX ? 2 : 0
  const roomA = alongX ? [room.x0, room.x1] : [room.z0, room.z1]
  const roomB = alongX ? [room.z0, room.z1] : [room.x0, room.x1]

  // The wall behind the counter: the room's side nearer its back.
  const backAtLow = Math.abs(counter.min[b] - roomB[0]) <= Math.abs(roomB[1] - counter.max[b])
  const backB = backAtLow ? roomB[0] : roomB[1]
  const vSign = backAtLow ? 1 : -1

  const sinks = SINKS.flatMap((material) => islands(scene, material, 0.05)).filter(
    (island) =>
      island.box.min.y < top + 0.1 &&
      island.box.max.y > top + 0.02 &&
      island.box.min.getComponent(a) > counter.min[a] - 0.05 &&
      island.box.max.getComponent(a) < counter.max[a] + 0.05 &&
      island.box.min.getComponent(b) > counter.min[b] - 0.1 &&
      island.box.max.getComponent(b) < counter.max[b] + 0.1,
  )
  const sink = sinks.length ? unionBox(sinks.map((s) => ({ min: s.box.min.toArray(), max: s.box.max.toArray() }))) : null

  // The corner wall: the counter's end that touches one; both, the end the
  // sink is farther from.
  const touchesLow = Math.abs(counter.min[a] - roomA[0]) < 0.1
  const touchesHigh = Math.abs(roomA[1] - counter.max[a]) < 0.1
  let cornerAtLow: boolean
  if (touchesLow && touchesHigh) {
    const sinkMid = sink ? (sink.min[a] + sink.max[a]) / 2 : (counter.min[a] + counter.max[a]) / 2
    cornerAtLow = sinkMid >= (counter.min[a] + counter.max[a]) / 2
  } else if (touchesLow || touchesHigh) {
    cornerAtLow = touchesLow
  } else {
    return null
  }
  const cornerA = cornerAtLow ? roomA[0] : roomA[1]
  const uSign = cornerAtLow ? 1 : -1

  const along = (value: number) => (value - cornerA) * uSign
  const across = (value: number) => (value - backB) * vSign

  const corner = alongX ? { x: cornerA, z: backB } : { x: backB, z: cornerA }
  return {
    key,
    corner,
    u: alongX ? { x: uSign, z: 0 } : { x: 0, z: uSign },
    v: alongX ? { x: 0, z: vSign } : { x: vSign, z: 0 },
    uLen: roomA[1] - roomA[0],
    vLen: roomB[1] - roomB[0],
    counter: {
      u0: Math.min(along(counter.min[a]), along(counter.max[a])),
      u1: Math.max(along(counter.min[a]), along(counter.max[a])),
      depth: Math.max(across(counter.min[b]), across(counter.max[b])),
      top,
    },
    sink: sink ? { u0: Math.min(along(sink.min[a]), along(sink.max[a])), u1: Math.max(along(sink.min[a]), along(sink.max[a])) } : null,
  }
}

type Facing = '+u' | '-u' | '+v' | '-v'
type Spot = { u: number; v: number; y: number; facing: Facing }

/**
 * Where a kitchen's things go, in its own frame.
 *
 * The client's picture, in rules: the small appliances stand on the free run
 * of counter, the microwave farthest from the sink; the fridge stands past
 * the counter's open end with the bin beside it, the water cooler against
 * the corner wall beside the counter; the table across the room in front of
 * them, its tray towards the corner wall. Where the counter runs wall to
 * wall there is no open end, and the client asked for the far corner instead:
 * the fridge in it with its back to the corner wall, facing the door, the bin
 * and the cooler beside it along that wall towards the counter, and the
 * table down the middle of the room, clear of the counter and of all of them. Sizes are the fittings'
 * own; a fitting facing `+u` has its file's width along v.
 */
function layoutKitchen(frame: KitchenFrame, sizes: Map<string, [number, number]>): Map<string, Spot> {
  const out = new Map<string, Spot>()
  const { counter, sink } = frame
  const size = (key: string) => sizes.get(key)
  const gap = 0.03

  const free =
    sink === null
      ? [counter.u0, counter.u1]
      : sink.u0 - counter.u0 >= counter.u1 - sink.u1
        ? [counter.u0, sink.u0]
        : [sink.u1, counter.u1]
  const fromLow = free[0] === counter.u0 && sink !== null
  let cursor = fromLow ? free[0] + gap : free[1] - gap
  for (const key of ['microwave', 'coffee', 'toaster']) {
    const fitting = size(key)
    if (!fitting) continue
    const [w, d] = fitting
    out.set(key, { u: fromLow ? cursor + w / 2 : cursor - w / 2, v: Math.max(counter.depth / 2, d / 2 + 0.05), y: counter.top, facing: '+v' })
    cursor = fromLow ? cursor + w + gap : cursor - w - gap
  }

  const openEnd = frame.uLen - counter.u1 >= 0.7
  const fridge = size('fridge')
  const bin = size('bin')
  const cooler = size('cooler')

  if (openEnd) {
    // Along the back wall past the counter: the fridge, then the bin, its
    // long side out from the wall so it asks little of the open side.
    let along = counter.u1 + 0.04
    if (fridge) {
      out.set('fridge', { u: along + fridge[0] / 2, v: fridge[1] / 2 + 0.02, y: 0, facing: '+v' })
      along += fridge[0] + 0.06
    }
    if (bin) out.set('bin', { u: along + bin[1] / 2, v: bin[0] / 2 + 0.03, y: 0, facing: '+u' })
    if (cooler) out.set('cooler', { u: cooler[1] / 2 + 0.03, v: counter.depth + 0.3 + cooler[0] / 2, y: 0, facing: '+u' })
  } else {
    // From the far corner back towards the counter, along the corner wall:
    // the fridge with its back to that wall, facing the room's door, then
    // the bin, then the cooler facing into the room.
    let back = frame.vLen - 0.02
    if (fridge) {
      out.set('fridge', { u: fridge[1] / 2 + 0.02, v: back - fridge[0] / 2, y: 0, facing: '+u' })
      back -= fridge[0] + 0.06
    }
    if (bin) {
      out.set('bin', { u: bin[0] / 2 + 0.03, v: back - bin[1] / 2, y: 0, facing: '-v' })
      back -= bin[1] + 0.08
    }
    if (cooler) out.set('cooler', { u: cooler[1] / 2 + 0.03, v: back - cooler[0] / 2, y: 0, facing: '+u' })
  }

  const table = size('table')
  if (table) {
    const [w, d] = table
    const tray = size('tray')
    if (openEnd) {
      // Across the room in front of the counter; over the open side by a
      // little is fine, there is no wall there.
      const u = 0.06 + w / 2
      const v = counter.depth + 0.85 + d / 2
      out.set('table', { u, v, y: 0, facing: '+v' })
      if (tray) out.set('tray', { u: 0.06 + 0.45, v, y: 0.752, facing: '+v' })
    } else {
      // Down the middle, clear of the counter and of the row along the
      // corner wall; the far end may pass the fridge, which stands beside it.
      const row = Math.max(fridge ? fridge[1] + 0.02 : 0, bin ? bin[0] + 0.03 : 0, cooler ? cooler[1] + 0.03 : 0)
      const u = Math.max(frame.uLen / 2, row + 0.15 + d / 2)
      const v0 = counter.depth + 0.12
      out.set('table', { u, v: v0 + w / 2, y: 0, facing: '+u' })
      if (tray) out.set('tray', { u, v: v0 + 0.45, y: 0.752, facing: '+u' })
    }
  }

  return out
}

function yawOf(frame: KitchenFrame, facing: Facing): number {
  const dir =
    facing === '+u' ? frame.u : facing === '-u' ? { x: -frame.u.x, z: -frame.u.z } : facing === '+v' ? frame.v : { x: -frame.v.x, z: -frame.v.z }
  return Math.round((Math.atan2(dir.x, dir.z) * 180) / Math.PI)
}

/** An offset in the file's frame, turned the way the fitting faces, as (u, v). */
function turned(offset: [number, number], facing: Facing): [number, number] {
  const [x, z] = offset
  switch (facing) {
    case '+v':
      return [x, z]
    case '+u':
      return [z, -x]
    case '-u':
      return [-z, x]
    case '-v':
      return [-x, -z]
  }
}

/**
 * Lays the package out in every kitchen of every building, as a fitted set on
 * the room. A set already there for this package is replaced; the others stay.
 */
async function fitKitchens(
  payload: Payload,
  spec: FurnitureSpec,
  packageId: number,
  model: { url: string; file: string },
): Promise<number> {
  const flat = await fittingsOf(spec, model.file)
  const byFitting = new Map<string, Flat[]>()
  for (const entry of flat) byFitting.set(entry.fitting.key, [...(byFitting.get(entry.fitting.key) ?? []), entry])

  const anchors = new Map<string, { centre: [number, number]; baseY: number; size: [number, number] }>()
  for (const [key, entries] of byFitting) {
    const box = unionBox(
      entries.map((entry) => ({
        min: [entry.centre[0] - entry.size[0] / 2, entry.baseY, entry.centre[1] - entry.size[1] / 2],
        max: [entry.centre[0] + entry.size[0] / 2, entry.baseY, entry.centre[1] + entry.size[1] / 2],
      })),
    )
    anchors.set(key, {
      centre: [(box.min[0] + box.max[0]) / 2, (box.min[2] + box.max[2]) / 2],
      baseY: box.min[1],
      size: [box.max[0] - box.min[0], box.max[2] - box.min[2]],
    })
  }
  const sizes = new Map([...anchors].map(([key, anchor]) => [key, anchor.size]))

  const types = await payload.find({ collection: 'room-types', limit: 200, depth: 0 })
  const kitchenType = types.docs.find((type) => type.slug === 'kitchen')?.id

  const buildings = await payload.find({ collection: 'building-models', limit: 200, depth: 0 })
  let fitted = 0

  for (const building of buildings.docs) {
    const rooms = (building.rooms ?? []) as Array<Record<string, unknown>>
    const frames: Array<{ room: Record<string, unknown>; key: string; polygon: Point[] }> = []
    for (const room of rooms) {
      const polygon = (room.floorPolygon as Point[] | undefined) ?? []
      if (room.roomType === kitchenType) frames.push({ room, key: 'room', polygon })
      for (const zone of (room.zones as Array<{ key: string; roomType: string; polygon: Point[] }> | undefined) ?? []) {
        if (zone.roomType === 'kitchen') frames.push({ room, key: zone.key, polygon: zone.polygon })
      }
    }
    if (frames.length === 0) continue

    const modelDoc = await payload.findByID({ collection: 'models', id: building.model as number, depth: 0 })
    const scene = await loadScene(path.resolve('models', modelDoc.filename as string))
    scene.updateMatrixWorld(true)
    let changed = false

    for (const { room, key, polygon } of frames) {
      const frame = kitchenFrame(key, polygon, scene)
      if (!frame) {
        payload.logger.warn(`${building.title}: no counter found in kitchen "${key}" of "${room.name}" — skipped.`)
        continue
      }
      const spots = layoutKitchen(frame, sizes)
      const floorY = ((room.shell as { floorY?: number } | undefined)?.floorY ?? 0)

      const parts = flat.flatMap((entry) => {
        const spot = spots.get(entry.fitting.key)
        const anchor = anchors.get(entry.fitting.key)
        if (!spot || !anchor) return []
        const [du, dv] = turned([entry.centre[0] - anchor.centre[0], entry.centre[1] - anchor.centre[1]], spot.facing)
        const u = spot.u + du
        const v = spot.v + dv
        const x = frame.corner.x + frame.u.x * u + frame.v.x * v
        const z = frame.corner.z + frame.u.z * u + frame.v.z * v
        return [
          {
            key: `${spec.slug}-${key}-${entry.path}`,
            source: 'model' as const,
            nodePath: entry.path,
            modelUrl: model.url,
            name: entry.fitting.nodes.length > 1 ? `${entry.fitting.name} — ${entry.name}` : entry.fitting.name,
            groupKey: entry.fitting.nodes.length > 1 ? `${spec.slug}-${key}-${entry.fitting.key}` : null,
            position: [Number(x.toFixed(3)), Number((spot.y - floorY + (entry.baseY - anchor.baseY)).toFixed(3)), Number(z.toFixed(3))],
            yawDeg: yawOf(frame, spot.facing),
            scale: 1,
          },
        ]
      })

      const setKey = `${spec.slug}-${key}`
      const sets = ((room.fittedSets as Array<{ key: string }> | undefined) ?? []).filter((set) => set.key !== setKey)
      room.fittedSets = [...sets, { key: setKey, packageId, parts }]
      changed = true
      fitted += 1
    }

    if (changed) {
      await payload.update({ collection: 'building-models', id: building.id, data: { rooms: rooms as never } })
      payload.logger.info(`${building.title}: ${frames.length} kitchen(s) fitted with ${spec.slug}.`)
    }
  }

  return fitted
}

async function lookups(payload: Payload, spec: FurnitureSpec) {
  const { region, tier } = fromFileName(spec.file)

  const tiers = await payload.find({ collection: 'furniture-tiers', where: { slug: { equals: tier } }, limit: 1, depth: 0 })
  if (tiers.docs.length === 0) throw new Error(`No furniture tier "${tier}" — add it before importing.`)

  const regions = await payload.find({ collection: 'regions', where: { code: { equals: region } }, limit: 1, depth: 0 })
  if (regions.docs.length === 0) throw new Error(`No region "${region}" — add it before importing.`)

  return { tier: tiers.docs[0].id, region: regions.docs[0].id }
}

/** The room types a spec names, as ids; null when it names none. */
async function roomTypeIds(payload: Payload, rooms: FurnitureSpec['rooms']): Promise<number[] | null> {
  if (!rooms) return null
  const types = await payload.find({ collection: 'room-types', limit: 200, depth: 0 })
  const known = new Map(types.docs.map((type) => [type.slug, type.id]))
  const wanted = Array.isArray(rooms) ? rooms : [...known.keys()].filter((slug) => !rooms.except.includes(slug))
  for (const slug of Array.isArray(rooms) ? rooms : rooms.except) {
    if (!known.has(slug)) throw new Error(`No room type "${slug}" — add it before importing.`)
  }
  return wanted.map((slug) => known.get(slug)!)
}

async function importPackage(payload: Payload, spec: FurnitureSpec, recut: boolean) {
  const { tier, region } = await lookups(payload, spec)
  const glb = (name: string, data: Buffer) => ({ data, name: `${name}.glb`, mimetype: 'model/gltf-binary' })

  // The row is the title at this tier: a Core and a Plus package can share a
  // name, and the card tells them apart by the grade.
  const existing = await payload.find({
    collection: 'furniture-packages',
    where: { and: [{ title: { equals: spec.title } }, { tier: { equals: tier } }] },
    limit: 1,
    depth: 0,
  })
  const current = existing.docs[0]

  let model: number | null = null
  let members: Array<{ id?: string; model: number; name: string; x: number; z: number; rotationYDeg: number }> = []
  let fittedModel: CatalogueFile | null = null

  if (spec.fitted?.length) {
    // The whole file, flattened, and no model on the row: a fitted package's
    // geometry lives on the rooms it is arranged in, by path into this file.
    fittedModel = await catalogueFile(
      payload,
      'models',
      spec.slug,
      spec.slug,
      async () => glb(spec.slug, await prepareFitted(spec)),
      recut,
    )
  } else if (spec.pieces?.length) {
    // A piece keeps its row id across imports: a saved order names a piece by
    // it, and a fresh id would leave that order pointing at nothing.
    const rows = (current?.members ?? []) as Array<{ id?: string | null; name?: string | null }>

    for (const piece of spec.pieces) {
      const doc = await catalogueFile(
        payload,
        'models',
        `${spec.slug} — ${piece.key}`,
        `${spec.slug}-${piece.key}`,
        async () => glb(`${spec.slug}-${piece.key}`, await preparePiece(spec, piece)),
        recut,
      )
      const kept = rows.find((row) => row.name === piece.name)?.id ?? undefined
      members.push({
        ...(kept ? { id: kept } : {}),
        model: doc.id,
        name: piece.name,
        x: Number(piece.at[0].toFixed(3)),
        z: Number(piece.at[1].toFixed(3)),
        rotationYDeg: piece.rotationYDeg ?? 0,
      })
    }
  } else {
    const doc = await catalogueFile(
      payload,
      'models',
      spec.slug,
      spec.slug,
      async () => glb(spec.slug, await prepareWhole(spec)),
      recut,
    )
    model = doc.id
    members = []
  }

  // Only what the spec says. Price, picture and description — and the rooms,
  // when the spec is silent — are the client's to set in the admin, and a
  // re-import must not undo them.
  const rooms = await roomTypeIds(payload, spec.rooms)
  const data = {
    title: spec.title,
    tier,
    regions: [region],
    model,
    members,
    fitted: fittedModel !== null,
    ...(rooms ? { compatibleRoomTypes: rooms } : {}),
  }

  const row = current
    ? await payload.update({ collection: 'furniture-packages', id: current.id, data })
    : await payload.create({ collection: 'furniture-packages', data })

  if (fittedModel) {
    const fitted = await fitKitchens(payload, spec, row.id, fittedModel)
    payload.logger.info(`${spec.title} (${fromFileName(spec.file).tier}): fitted in ${fitted} kitchens (id ${row.id}).`)
    return
  }

  const footprint = row.footprint as { width?: number; depth?: number } | undefined
  payload.logger.info(
    `${spec.title}: ${members.length ? `${members.length} pieces` : 'one model'}, ` +
      `footprint ${footprint?.width?.toFixed(2)} x ${footprint?.depth?.toFixed(2)} m (id ${row.id}).`,
  )
}

async function main() {
  const which = process.argv[2]
  const specs = which === 'all' ? Object.values(FURNITURE) : which ? [FURNITURE[which]] : []
  if (specs.length === 0 || specs.some((spec) => !spec)) {
    console.error(`Usage: pnpm import:furniture <slug|all> [--recut]\nKnown: ${Object.keys(FURNITURE).join(', ')}`)
    process.exit(1)
  }

  const recut = process.argv.includes('--recut')
  const payload = await getPayload({ config })

  for (const spec of specs) await importPackage(payload, spec, recut)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
