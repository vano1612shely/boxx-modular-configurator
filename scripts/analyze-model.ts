import 'dotenv/config'

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { Box3, type Mesh, type Object3D, Vector3 } from 'three'

/**
 * Everything needed to author a building, read off its glb.
 *
 * Importing a client's building means answering the same questions every time:
 * where is the floor, which node is the roof, what are the walls' grid lines,
 * which materials carry the textures the generated rooms should wear, and what
 * is the child-index path of the kitchen counter. Answering them by opening the
 * file in a viewer and guessing is how an import takes a day; this answers them
 * in one pass and writes them down.
 *
 *   pnpm analyze:model <file.glb> [--out report.json]
 *   pnpm analyze:model <file.glb> --islands <material>
 *   pnpm analyze:model <file.glb> --region x0,y0,z0,x1,y1,z1
 *   pnpm analyze:model <file.glb> --plan <y> [--window x0,z0,x1,z1] [--cell 0.05]
 *   pnpm analyze:model <file.glb> --outline x0,z0,x1,z1
 *   pnpm analyze:model <file.glb> --uvscale <material>
 *   pnpm analyze:model <file.glb> --objects
 *
 * The second form answers a different question. Exporters merge every object
 * sharing a material into one mesh, so "the window" is not a node — all 40
 * windows are one 18-metre mesh. `--islands` splits that mesh back into the
 * pieces it was made of, by walking the index buffer, and reports each one's
 * box. That is how a single window or door gets found well enough to be cut out
 * of the building and uploaded as a model of its own.
 *
 * Node paths here are the ones the app uses — chains of child indexes as
 * **three.js** builds the scene, which is not the glb's node order. Exporters
 * wrap the scene (Sketchfab writes a `Sketchfab_model` root), so a path read off
 * the glb's node list points at the wrong object. Everything below is measured
 * through the same loader the browser runs, so the paths can be pasted straight
 * into `builtIns`, `hiddenNodePaths` or an exterior slot's `nodes`.
 */

/**
 * The things in the file, one line each: what a furniture package is made of.
 *
 * An exporter wraps the scene in a chain of single-child nodes and then lists
 * the modeller's objects side by side under the last of them — a desk, a chair,
 * the floor it was rendered on. Those objects are what a package is cut into
 * pieces by, so this names each with where it stands and how big it is, in
 * the file's own frame, and the piece list of a spec is read straight off it.
 */
function reportObjects(root: Object3D) {
  let parent = root
  while (parent.children.length === 1) parent = parent.children[0]

  console.log(`
=== OBJECTS under "${parent.name}" (${parent.children.length}) ===`)
  for (const child of parent.children) {
    const box = new Box3().setFromObject(child)
    const centre = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    let triangles = 0
    child.traverse((object) => {
      if ((object as Mesh).isMesh) triangles += triangleCount(object as Mesh)
    })
    console.log(
      `${child.name.padEnd(24)} at(${centre.x.toFixed(3)}, ${centre.z.toFixed(3)})  ` +
        `y[${box.min.y.toFixed(3)}, ${box.max.y.toFixed(3)}]  size(${size.x.toFixed(2)} x ${size.z.toFixed(2)})  ${triangles}t`,
    )
  }
}

/** Waist height: above the skirting, below the window heads. */
const PLAN_Y = 1.2

// GLTFLoader reaches for browser image decoding on any textured model. The
// scene graph — which is all this reads — does not need the pixels, so a stub
// is enough and saves decoding a hundred megabytes of texture to measure boxes.
const globals = globalThis as Record<string, unknown>
globals.self ??= globalThis
globals.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} })

type Box = { min: [number, number, number]; max: [number, number, number] }

type NodeReport = {
  /** Child-index path from the loaded scene root, e.g. "0/0/12". */
  path: string
  name: string
  materials: string[]
  box: Box
  /** Longest horizontal span, to tell a slab from a post at a glance. */
  size: [number, number, number]
  triangles: number
}

type MaterialReport = {
  name: string
  nodes: number
  box: Box
  maps: string[]
}

type Report = {
  file: string
  bounds: Box
  /** Plan centre to the origin, walkable floor to y=0 — the app's convention. */
  suggestedOffset: [number, number, number]
  floorLevels: Array<{ y: number; material: string; areaSqM: number; path: string }>
  materials: MaterialReport[]
  nodes: NodeReport[]
}

function boxOf(object: Object3D): Box3 {
  return new Box3().setFromObject(object)
}

function asBox(box: Box3): Box {
  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
  }
}

function round(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0
}

function materialNames(mesh: Mesh): string[] {
  const material = mesh.material
  const list = Array.isArray(material) ? material : [material]
  return [...new Set(list.map((m) => m?.name || '(unnamed)'))]
}

/**
 * Whether a mesh is drawn with the material asked about — by its whole name.
 *
 * It used to be a substring test, and `Basic_Wall_Interior` matched
 * `Basic_Wall_Interior_inside` as well: the wall finish and the door leaves,
 * measured as one, and a UV scale that was neither's. The importer matches
 * whole names, so this does too; a name that matches nothing whole falls back
 * to the old test, for the partial names that were typed on purpose.
 */
function drawnWith(mesh: Mesh, material: string, everyName: Set<string>): boolean {
  const names = materialNames(mesh)
  if (everyName.has(material)) return names.includes(material)
  return names.some((name) => name.includes(material))
}

function allMaterialNames(root: Object3D): Set<string> {
  const names = new Set<string>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) for (const name of materialNames(mesh)) names.add(name)
  })
  return names
}

/** Which texture slots a material actually fills — the ones worth extracting. */
function materialMaps(mesh: Mesh): string[] {
  const material = mesh.material
  const list = Array.isArray(material) ? material : [material]
  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']
  const found = new Set<string>()
  for (const m of list) {
    for (const slot of slots) {
      if ((m as unknown as Record<string, unknown>)?.[slot]) found.add(slot)
    }
  }
  return [...found]
}

function triangleCount(mesh: Mesh): number {
  const geometry = mesh.geometry
  const index = geometry.getIndex()
  const count = index ? index.count : (geometry.getAttribute('position')?.count ?? 0)
  return Math.round(count / 3)
}

export async function loadScene(file: string): Promise<Object3D> {
  const { readFile } = await import('node:fs/promises')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('meshoptimizer')

  const buffer = await readFile(file)
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer

  // A model that has been through the upload pipeline is meshopt-compressed,
  // and the loader refuses one outright without a decoder. Set for every file:
  // the whole point of reading a stored model back is to measure the file the
  // browser gets, and the browser gets the compressed one.
  await MeshoptDecoder.ready
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => resolve(gltf.scene),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    )
  })
}

/**
 * Every mesh drawn with one of the named materials, with its path and its box.
 *
 * The importer's way of saying "the kitchen counter" without writing down a
 * path that the next re-export invalidates. Measured here rather than in the
 * importer so that a path claimed for a `builtIn` and a path printed by `--out`
 * can never be walked two different ways.
 *
 * The box comes back with it because a material is rarely the whole answer:
 * `metal_chrome` is a kitchen tap, a restroom rail and a trim running the
 * length of the building, and only the room's own outline can say which of
 * those is its fitting.
 */
export function pathsByMaterial(
  root: Object3D,
  materials: string[],
): Map<string, Array<{ path: string; box: Box }>> {
  const wanted = new Set(materials)
  const found = new Map<string, Array<{ path: string; box: Box }>>()

  for (const node of collect(root)) {
    for (const material of node.materials) {
      if (!wanted.has(material)) continue
      found.set(material, [...(found.get(material) ?? []), { path: node.path, box: node.box }])
    }
  }

  return found
}

function collect(root: Object3D): NodeReport[] {
  const nodes: NodeReport[] = []

  const walk = (object: Object3D, path: string) => {
    const mesh = object as Mesh
    if (mesh.isMesh) {
      const box = boxOf(object)
      const size = box.getSize(new Vector3())
      nodes.push({
        path,
        name: object.name || '(unnamed)',
        materials: materialNames(mesh),
        box: asBox(box),
        size: [round(size.x), round(size.y), round(size.z)],
        triangles: triangleCount(mesh),
      })
    }
    object.children.forEach((child, index) => walk(child, path ? `${path}/${index}` : `${index}`))
  }

  root.children.forEach((child, index) => walk(child, `${index}`))
  return nodes
}

function byMaterial(root: Object3D, nodes: NodeReport[]): MaterialReport[] {
  const maps = new Map<string, string[]>()
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    for (const name of materialNames(mesh)) {
      if (!maps.has(name)) maps.set(name, materialMaps(mesh))
    }
  })

  const grouped = new Map<string, NodeReport[]>()
  for (const node of nodes) {
    for (const name of node.materials) {
      const list = grouped.get(name) ?? []
      list.push(node)
      grouped.set(name, list)
    }
  }

  return [...grouped.entries()]
    .map(([name, list]) => {
      const box = new Box3()
      for (const node of list) {
        box.expandByPoint(new Vector3(...node.box.min))
        box.expandByPoint(new Vector3(...node.box.max))
      }
      return { name, nodes: list.length, box: asBox(box), maps: maps.get(name) ?? [] }
    })
    .sort((a, b) => b.nodes - a.nodes)
}

/**
 * Horizontal slabs, tallest first — the candidates for a room's walkable level.
 *
 * A floor reads as a node barely any height and a lot of width. The one to set
 * `floorY` to is the highest of these that covers the interior, because a
 * building carries several: the site slab under everything, the chassis, and
 * the finished floor people stand on.
 */
function floorLevels(nodes: NodeReport[]): Report['floorLevels'] {
  return nodes
    .filter((node) => node.size[1] <= 0.12 && node.size[0] > 1 && node.size[2] > 1)
    .map((node) => ({
      y: node.box.max[1],
      material: node.materials.join(', '),
      areaSqM: round(node.size[0] * node.size[2]),
      path: node.path,
    }))
    .sort((a, b) => b.areaSqM - a.areaSqM)
}

/**
 * The separate objects an exporter merged into one mesh.
 *
 * Two passes, because neither alone is right. Shared vertices come first and
 * cost nothing, but they under-group badly: an exporter splits a vertex
 * wherever the normal breaks, so a window frame arrives as a few dozen
 * unconnected quads. `merge` then welds whatever is closer together than the
 * space between two separate objects.
 */
export function islands(root: Object3D, material: string, gap: number) {
  const found: Array<{ box: Box3; triangles: number; mesh: string }> = []
  const everyName = allMaterialNames(root)

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (!drawnWith(mesh, material, everyName)) return

    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!position) return

    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)

    const parent = new Int32Array(position.count)
    for (let i = 0; i < parent.length; i += 1) parent[i] = i
    const find = (i: number): number => {
      let root_ = i
      while (parent[root_] !== root_) root_ = parent[root_]
      while (parent[i] !== root_) {
        const next = parent[i]
        parent[i] = root_
        i = next
      }
      return root_
    }
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[rb] = ra
    }

    for (let t = 0; t < count; t += 3) {
      const a = at(t)
      const b = at(t + 1)
      const c = at(t + 2)
      union(a, b)
      union(b, c)
    }

    const groups = new Map<number, { box: Box3; triangles: number }>()
    const point = new Vector3()
    for (let t = 0; t < count; t += 3) {
      const key = find(at(t))
      let group = groups.get(key)
      if (!group) {
        group = { box: new Box3(), triangles: 0 }
        groups.set(key, group)
      }
      group.triangles += 1
      for (let k = 0; k < 3; k += 1) {
        point.fromBufferAttribute(position, at(t + k)).applyMatrix4(mesh.matrixWorld)
        group.box.expandByPoint(point)
      }
    }

    for (const group of merge([...groups.values()], gap)) {
      found.push({ box: group.box, triangles: group.triangles, mesh: object.name })
    }
  })

  return found.sort((a, b) => b.triangles - a.triangles)
}

/**
 * Welds pieces that sit within `gap` of each other into one.
 *
 * Shared vertices alone are not enough. Exporters split a vertex wherever the
 * normal breaks, so a window frame arrives as a few dozen unconnected quads
 * that merely touch — and a component walk returns the quads. Anything closer
 * together than the space between two windows belongs to the same window, which
 * is a distance the geometry itself supplies: `gap` is the only guess here, and
 * a wrong one is obvious in the output rather than silent.
 */
function merge(groups: Array<{ box: Box3; triangles: number }>, gap: number) {
  const boxes = groups.map((group) => ({ ...group, box: group.box.clone() }))
  let merged = true

  while (merged) {
    merged = false
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const near = boxes[i].box.clone().expandByScalar(gap)
        if (!near.intersectsBox(boxes[j].box)) continue
        boxes[i].box.union(boxes[j].box)
        boxes[i].triangles += boxes[j].triangles
        boxes.splice(j, 1)
        j -= 1
        merged = true
      }
    }
  }

  return boxes
}

function reportIslands(root: Object3D, material: string, gap: number) {
  const found = islands(root, material, gap)
  console.log(`\n=== ISLANDS OF "${material}" (${found.length}) ===`)

  // Identical pieces repeat — 40 windows of one type are 40 equal boxes. Shown
  // grouped, because the useful question is "what sizes are there", and the
  // answer to "which one do I cut out" is any one of them.
  const bySize = new Map<string, Array<{ box: Box3; triangles: number }>>()
  for (const item of found) {
    const size = item.box.getSize(new Vector3())
    const key = `${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`
    const list = bySize.get(key) ?? []
    list.push(item)
    bySize.set(key, list)
  }

  for (const [size, list] of [...bySize.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = list[0]
    const box = asBox(sample.box)
    console.log(
      `${String(list.length).padStart(3)}×  size ${size}  ${sample.triangles}t  ` +
        `sample x[${box.min[0]}, ${box.max[0]}] y[${box.min[1]}, ${box.max[1]}] z[${box.min[2]}, ${box.max[2]}]`,
    )
  }

  // Sizes alone answer "what is here"; laying out rooms needs "and where". Held
  // back above a threshold because a wall trim splits into 150 identical strips
  // and listing them teaches nothing.
  const LIST_LIMIT = 60
  if (found.length <= LIST_LIMIT) {
    console.log(`\n--- each one, sorted along x then z ---`)
    const sorted = [...found].sort(
      (a, b) => a.box.min.x - b.box.min.x || a.box.min.z - b.box.min.z,
    )
    for (const item of sorted) {
      const box = asBox(item.box)
      console.log(
        `x[${String(box.min[0]).padStart(7)}, ${String(box.max[0]).padStart(7)}]  ` +
          `y[${String(box.min[1]).padStart(6)}, ${String(box.max[1]).padStart(6)}]  ` +
          `z[${String(box.min[2]).padStart(7)}, ${String(box.max[2]).padStart(7)}]  ${item.triangles}t`,
      )
    }
  }
}

/**
 * What actually stands inside a box — every material, with its triangle count.
 *
 * The question asked before cutting a door or a window out of a building. A
 * door is never one material: the leaf is wood, the casing around it is another
 * material entirely and the handle is a third, and cutting by the obvious name
 * alone gets a wooden rectangle with no frame and no handle. This lists what is
 * really there, so the cut names all of it.
 */
function reportRegion(root: Object3D, region: number[]) {
  const [x0, y0, z0, x1, y1, z1] = region
  const inside = (p: Vector3) =>
    p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.z >= z0 && p.z <= z1

  const found = new Map<string, { triangles: number; box: Box3 }>()
  const point = new Vector3()
  const centroid = new Vector3()

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!position) return

    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)
    const name = materialNames(mesh).join(', ')

    for (let t = 0; t < count; t += 3) {
      centroid.set(0, 0, 0)
      for (let k = 0; k < 3; k += 1) {
        point.fromBufferAttribute(position, at(t + k)).applyMatrix4(mesh.matrixWorld)
        centroid.add(point)
      }
      centroid.divideScalar(3)
      if (!inside(centroid)) continue

      let entry = found.get(name)
      if (!entry) {
        entry = { triangles: 0, box: new Box3() }
        found.set(name, entry)
      }
      entry.triangles += 1
      for (let k = 0; k < 3; k += 1) {
        point.fromBufferAttribute(position, at(t + k)).applyMatrix4(mesh.matrixWorld)
        entry.box.expandByPoint(point)
      }
    }
  })

  console.log(`\n=== INSIDE [${region.join(', ')}] ===`)
  if (found.size === 0) {
    console.log('nothing')
    return
  }

  for (const [name, entry] of [...found.entries()].sort((a, b) => b[1].triangles - a[1].triangles)) {
    const box = asBox(entry.box)
    console.log(
      `${String(entry.triangles).padStart(6)}t  ${name.padEnd(30)} ` +
        `x[${box.min[0]}, ${box.max[0]}] y[${box.min[1]}, ${box.max[1]}] z[${box.min[2]}, ${box.max[2]}]`,
    )
  }
}

/**
 * The floor plan, rasterised off the geometry at one height.
 *
 * Rooms are traced from numbers, and the numbers have to come from somewhere.
 * Bounding boxes answer "how far does this wall reach" but never "is there a
 * column in the corner", and hunting for one by orbiting a viewer is slow and
 * misses things — a room came back a plain rectangle twice because a stub wall
 * inside it never showed up in any box.
 *
 * So: every triangle that straddles this height, projected onto the floor and
 * stamped into a grid. What comes out is a plan you can read a room off, walls,
 * recesses, columns and all.
 */
function reportPlan(root: Object3D, y: number, window: number[] | null, cell: number) {
  const bounds = new Box3().setFromObject(root)
  const x0 = window ? window[0] : bounds.min.x
  const z0 = window ? window[1] : bounds.min.z
  const x1 = window ? window[2] : bounds.max.x
  const z1 = window ? window[3] : bounds.max.z

  const cols = Math.ceil((x1 - x0) / cell)
  const rows = Math.ceil((z1 - z0) / cell)
  const grid: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false))

  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!position) return

    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)

    for (let t = 0; t < count; t += 3) {
      a.fromBufferAttribute(position, at(t)).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, at(t + 1)).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, at(t + 2)).applyMatrix4(mesh.matrixWorld)

      // Only what is actually standing at this height. A triangle wholly above
      // or below is ceiling or floor, and stamping those fills the whole plan.
      const lowest = Math.min(a.y, b.y, c.y)
      const highest = Math.max(a.y, b.y, c.y)
      if (y < lowest || y > highest) continue

      const left = Math.min(a.x, b.x, c.x)
      const right = Math.max(a.x, b.x, c.x)
      const top = Math.min(a.z, b.z, c.z)
      const bottom = Math.max(a.z, b.z, c.z)

      const ci0 = Math.max(0, Math.floor((left - x0) / cell))
      const ci1 = Math.min(cols - 1, Math.floor((right - x0) / cell))
      const ri0 = Math.max(0, Math.floor((top - z0) / cell))
      const ri1 = Math.min(rows - 1, Math.floor((bottom - z0) / cell))

      for (let r = ri0; r <= ri1; r += 1) {
        for (let ci = ci0; ci <= ci1; ci += 1) grid[r][ci] = true
      }
    }
  })

  console.log(`\n=== PLAN at y=${y}, cell ${cell} m ===`)
  console.log(`x ${x0.toFixed(2)} … ${x1.toFixed(2)}   z ${z0.toFixed(2)} … ${z1.toFixed(2)}`)

  // A ruler every ten cells, so a wall in the picture can be read back as a number.
  const ruler = Array.from({ length: cols }, (_, i) => (i % 10 === 0 ? '|' : ' ')).join('')
  console.log(`      ${ruler}`)

  grid.forEach((row, r) => {
    const z = (z0 + r * cell).toFixed(2).padStart(6)
    console.log(`${z}${row.map((filled) => (filled ? '#' : '.')).join('')}`)
  })

  console.log(`      ${ruler}`)
  for (let i = 0; i < cols; i += 10) {
    console.log(`  col ${i} → x ${(x0 + i * cell).toFixed(2)}`)
  }
}

/**
 * One room's four wall faces, plus any recess or obstruction, from a seed box.
 *
 * The box given is a guess that only has to start inside the room; the faces
 * come out of the geometry. Each is the **median** first hit over many scan
 * lines, because a window recess or a doorway is a minority of the lines and
 * would drag a nearest-or-furthest reading off the wall.
 *
 * The runs that disagree with the median are then reported on their own: a
 * shallow one is a recess and belongs in the outline, a deep one is a doorway
 * and does not. Trust the recess's depth but not its ends — near a corner the
 * junction reads as flat, and a recess that really runs into the partition
 * comes back a few centimetres short, which leaves a sliver of wall standing
 * in the room that nobody can explain.
 */
function reportOutline(root: Object3D, seed: number[], cell: number) {
  const [sx0, sz0, sx1, sz1] = seed
  const bounds = new Box3().setFromObject(root)
  const x0 = bounds.min.x
  const z0 = bounds.min.z
  const cols = Math.ceil((bounds.max.x - x0) / cell)
  const rows = Math.ceil((bounds.max.z - z0) / cell)
  const grid = new Uint8Array(cols * rows)

  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    if (!position) return
    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)

    for (let t = 0; t < count; t += 3) {
      a.fromBufferAttribute(position, at(t)).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, at(t + 1)).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, at(t + 2)).applyMatrix4(mesh.matrixWorld)
      if (PLAN_Y < Math.min(a.y, b.y, c.y) || PLAN_Y > Math.max(a.y, b.y, c.y)) continue

      const ci0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - x0) / cell))
      const ci1 = Math.min(cols - 1, Math.floor((Math.max(a.x, b.x, c.x) - x0) / cell))
      const ri0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - z0) / cell))
      const ri1 = Math.min(rows - 1, Math.floor((Math.max(a.z, b.z, c.z) - z0) / cell))
      for (let r = ri0; r <= ri1; r += 1) {
        for (let ci = ci0; ci <= ci1; ci += 1) grid[r * cols + ci] = 1
      }
    }
  })

  const solid = (ci: number, r: number) =>
    ci < 0 || ci >= cols || r < 0 || r >= rows || grid[r * cols + ci] === 1

  const ci0 = Math.floor((sx0 - x0) / cell)
  const ci1 = Math.floor((sx1 - x0) / cell)
  const r0 = Math.floor((sz0 - z0) / cell)
  const r1 = Math.floor((sz1 - z0) / cell)

  const hit = (from: number, step: number, along: number, horizontal: boolean) => {
    let at = from
    for (let n = 0; n < 600; n += 1) {
      if (solid(horizontal ? at : along, horizontal ? along : at)) return at
      at += step
    }
    return at
  }

  const west: number[] = []
  const east: number[] = []
  for (let r = r0; r <= r1; r += 1) {
    west.push(hit(ci0, -1, r, true))
    east.push(hit(ci1, +1, r, true))
  }

  const north: number[] = []
  const south: number[] = []
  for (let ci = ci0; ci <= ci1; ci += 1) {
    north.push(hit(r0, -1, ci, false))
    south.push(hit(r1, +1, ci, false))
  }

  const median = (values: number[]) => [...values].sort((p, q) => p - q)[values.length >> 1]
  const wCol = median(west)
  const eCol = median(east)
  const nRow = median(north)
  const sRow = median(south)

  const xOf = (ci: number) => x0 + ci * cell
  const zOf = (r: number) => z0 + r * cell

  console.log(
    `\n=== OUTLINE ===\nx[${xOf(wCol).toFixed(3)}, ${xOf(eCol).toFixed(3)}] ` +
      `z[${zOf(nRow).toFixed(3)}, ${zOf(sRow).toFixed(3)}]  ` +
      `${(xOf(eCol) - xOf(wCol)).toFixed(3)} x ${(zOf(sRow) - zOf(nRow)).toFixed(3)} m`,
  )

  const runs = (hits: number[], face: number, sign: number, start: number, alongIsX: boolean) => {
    let open: number | null = null
    let deepest = face

    const flush = (endedAt: number) => {
      if (open === null) return
      const metres = Math.abs(deepest - face) * cell
      if (metres >= 0.05) {
        const p0 = alongIsX ? xOf(start + open) : zOf(start + open)
        const p1 = alongIsX ? xOf(start + endedAt) : zOf(start + endedAt)
        const back = alongIsX ? zOf(deepest) : xOf(deepest)
        console.log(
          `  ${metres <= 0.6 ? 'recess ' : 'doorway'} ${alongIsX ? 'x' : 'z'}` +
            `[${p0.toFixed(3)}, ${p1.toFixed(3)}] back to ${back.toFixed(3)} (${metres.toFixed(3)} deep)`,
        )
      }
      open = null
      deepest = face
    }

    hits.forEach((value, i) => {
      if (sign > 0 ? value > face : value < face) {
        if (open === null) open = i
        deepest = sign > 0 ? Math.max(deepest, value) : Math.min(deepest, value)
      } else flush(i - 1)
    })
    flush(hits.length - 1)
  }

  runs(north, nRow, -1, ci0, true)
  runs(south, sRow, +1, ci0, true)
  runs(west, wCol, -1, r0, false)
  runs(east, eCol, +1, r0, false)
}

/**
 * How many metres one repeat of a material's texture covers in the source.
 *
 * The generated rooms tile by a number of metres per repeat, and that number
 * has to come from somewhere. Guessing it gives a floor whose speckle is too
 * fine to read or so coarse it looks like gravel; the model already knows,
 * because its own UVs say how far the texture is stretched.
 *
 * Read per triangle edge as world length over UV length, then the median —
 * degenerate slivers and seam edges give wild ratios and would drag a mean.
 */
function reportUvScale(root: Object3D, material: string) {
  const across: number[] = []
  const down: number[] = []

  const a = new Vector3()
  const b = new Vector3()

  const everyName = allMaterialNames(root)
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (!drawnWith(mesh, material, everyName)) return

    const position = mesh.geometry.getAttribute('position')
    const uvs = mesh.geometry.getAttribute('uv')
    const index = mesh.geometry.getIndex()
    if (!position || !uvs) return

    const count = index ? index.count : position.count
    const at = (i: number) => (index ? index.getX(i) : i)

    for (let t = 0; t < count; t += 3) {
      for (const [p, q] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ]) {
        const ia = at(t + p)
        const ib = at(t + q)
        a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
        b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)

        const du = uvs.getX(ib) - uvs.getX(ia)
        const dv = uvs.getY(ib) - uvs.getY(ia)
        const world = a.distanceTo(b)
        if (world < 1e-4) continue

        // Only edges that run mostly along one UV axis say anything clean
        // about that axis's scale.
        if (Math.abs(du) > 1e-3 && Math.abs(dv) < Math.abs(du) / 8) across.push(world / Math.abs(du))
        if (Math.abs(dv) > 1e-3 && Math.abs(du) < Math.abs(dv) / 8) down.push(world / Math.abs(dv))
      }
    }
  })

  const median = (values: number[]) =>
    values.length === 0 ? null : [...values].sort((p, q) => p - q)[values.length >> 1]

  const u = median(across)
  const v = median(down)
  console.log(`\n=== UV SCALE of "${material}" ===`)
  console.log(`samples: ${across.length} across, ${down.length} down`)
  console.log(
    `one repeat covers ${u === null ? '?' : u.toFixed(3)} m across ` +
      `× ${v === null ? '?' : v.toFixed(3)} m down`,
  )
}

function summarise(report: Report) {
  const fmt = (box: Box) =>
    `min(${box.min.join(', ')})  max(${box.max.join(', ')})`

  console.log(`\n=== ${report.file} ===`)
  console.log(`bounds            ${fmt(report.bounds)}`)
  console.log(`suggested offset  ${report.suggestedOffset.join(', ')}`)

  console.log(`\n=== FLOOR CANDIDATES (biggest first) ===`)
  for (const level of report.floorLevels.slice(0, 10)) {
    console.log(
      `y=${level.y.toFixed(3)}  ${level.areaSqM.toFixed(1)} m²  ${level.path}  ${level.material}`,
    )
  }

  console.log(`\n=== MATERIALS (${report.materials.length}) ===`)
  for (const material of report.materials) {
    const maps = material.maps.length ? `  maps:[${material.maps.join(',')}]` : ''
    console.log(`${String(material.nodes).padStart(3)}×  ${material.name}${maps}`)
  }

  console.log(`\n=== NODES (${report.nodes.length}) ===`)
  for (const node of report.nodes) {
    console.log(
      `${node.path.padEnd(10)} ${node.name.padEnd(14)} ${String(node.triangles).padStart(8)}t  ` +
        `size(${node.size.join(', ')})  ${node.materials.join(', ')}`,
    )
  }
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: pnpm analyze:model <file.glb> [--out report.json]')
    process.exit(1)
  }

  const root = await loadScene(file)

  const planIndex = process.argv.indexOf('--plan')
  if (planIndex !== -1 && process.argv[planIndex + 1]) {
    const y = Number(process.argv[planIndex + 1])
    const windowIndex = process.argv.indexOf('--window')
    const window =
      windowIndex === -1 || !process.argv[windowIndex + 1]
        ? null
        : process.argv[windowIndex + 1].split(',').map(Number)
    const cellIndex = process.argv.indexOf('--cell')
    const cell = cellIndex === -1 ? 0.1 : Number(process.argv[cellIndex + 1])
    reportPlan(root, y, window, cell)
    return
  }

  if (process.argv.includes('--objects')) {
    reportObjects(root)
    return
  }

  const uvIndex = process.argv.indexOf('--uvscale')
  if (uvIndex !== -1 && process.argv[uvIndex + 1]) {
    reportUvScale(root, process.argv[uvIndex + 1])
    return
  }

  const outlineIndex = process.argv.indexOf('--outline')
  if (outlineIndex !== -1 && process.argv[outlineIndex + 1]) {
    const seed = process.argv[outlineIndex + 1].split(',').map(Number)
    if (seed.length !== 4 || seed.some(Number.isNaN)) {
      console.error('--outline wants x0,z0,x1,z1 — a box starting inside the room')
      process.exit(1)
    }
    const cellAt = process.argv.indexOf('--cell')
    reportOutline(root, seed, cellAt === -1 ? 0.0125 : Number(process.argv[cellAt + 1]))
    return
  }

  const regionIndex = process.argv.indexOf('--region')
  if (regionIndex !== -1 && process.argv[regionIndex + 1]) {
    const numbers = process.argv[regionIndex + 1].split(',').map(Number)
    if (numbers.length !== 6 || numbers.some(Number.isNaN)) {
      console.error('--region wants x0,y0,z0,x1,y1,z1')
      process.exit(1)
    }
    reportRegion(root, numbers)
    return
  }

  const islandIndex = process.argv.indexOf('--islands')
  if (islandIndex !== -1 && process.argv[islandIndex + 1]) {
    const gapIndex = process.argv.indexOf('--gap')
    const gap = gapIndex === -1 ? 0.05 : Number(process.argv[gapIndex + 1])
    reportIslands(root, process.argv[islandIndex + 1], gap)
    return
  }

  const nodes = collect(root)
  const bounds = boxOf(root)
  const floors = floorLevels(nodes)

  // The convention every imported building follows: plan centre at the origin,
  // walkable floor at y=0. The biggest slab is the site pad more often than the
  // finished floor, so this is a starting point to check, not an answer.
  const centre = bounds.getCenter(new Vector3())
  const report: Report = {
    file,
    bounds: asBox(bounds),
    suggestedOffset: [round(-centre.x), round(-(floors[0]?.y ?? 0)), round(-centre.z)],
    floorLevels: floors,
    materials: byMaterial(root, nodes),
    nodes,
  }

  summarise(report)

  const outIndex = process.argv.indexOf('--out')
  if (outIndex !== -1 && process.argv[outIndex + 1]) {
    writeFileSync(process.argv[outIndex + 1], JSON.stringify(report, null, 2))
    console.log(`\nWritten to ${process.argv[outIndex + 1]}`)
  }
}

/**
 * Only when run as a command. The loader and the path walk above are imported
 * by the building importer, which must resolve node paths in exactly the way
 * this file measures them.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
