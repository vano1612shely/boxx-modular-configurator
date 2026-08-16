/**
 * Demo entrance models — deck, stairs, ramp, canopy — written straight to glb.
 *
 *   node scripts/make-entrance-models.mjs [outDir]
 *
 * Boxes only, and deliberately so: these stand in for the supplier's real
 * assets during a demo, and the point is that four combinations exist and swap
 * cleanly, not that the handrails have the right profile. Built here rather
 * than exported from a tool so the four share one set of measurements — a deck
 * that shifted by a centimetre between variants would read as a bug in the
 * switching.
 *
 * Origin is the ground at the middle of the deck's outer edge, with +Z pointing
 * away from the building. That is the frame an exterior spot places parts in,
 * so a model dropped on a spot lands with its deck against the wall.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] ?? join(process.cwd(), 'demo-models')

// ---- measurements, in metres ------------------------------------------------

/** Deck height above grade — the sill of a modular unit's door. */
const DECK_Y = 0.92
const DECK_W = 2.0
const DECK_D = 1.4
const SLAB = 0.09

const STEP_RISE = DECK_Y / 4
const STEP_RUN = 0.28
const STEP_W = 1.2

const RAIL_H = 1.05
const POST = 0.05
const RAIL = 0.045

const RAMP_W = 1.1
const RAMP_RUN = 4.4
const RAMP_LANDING = 1.2

const CANOPY_Y = 2.45
const CANOPY_OVER = 0.25

// ---- geometry ---------------------------------------------------------------

/** One material's worth of triangles, accumulated as boxes are added. */
function group() {
  return { positions: [], normals: [], indices: [] }
}

const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
]

/**
 * An axis-aligned box, optionally tilted about X so a ramp or a stringer can
 * run downhill. `centre` is the middle of the box before the tilt.
 */
function box(into, size, centre, tiltX = 0) {
  const [sx, sy, sz] = size.map((v) => v / 2)
  const cos = Math.cos(tiltX)
  const sin = Math.sin(tiltX)
  const base = into.positions.length / 3

  for (const face of FACES) {
    const start = into.positions.length / 3
    for (const [ux, uy, uz] of face.v) {
      const x = ux * sx
      const y = uy * sy
      const z = uz * sz
      into.positions.push(
        centre[0] + x,
        centre[1] + y * cos - z * sin,
        centre[2] + y * sin + z * cos,
      )
    }
    const [nx, ny, nz] = face.n
    for (let i = 0; i < 4; i += 1) {
      into.normals.push(nx, ny * cos - nz * sin, ny * sin + nz * cos)
    }
    into.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }

  return base
}

/** A run of balusters with a top rail, along +Z from `z0` to `z1` at `x`. */
function railing(into, x, z0, z1, y0, y1) {
  const length = Math.hypot(z1 - z0, y1 - y0)
  const tilt = Math.atan2(y1 - y0, z1 - z0)
  const midZ = (z0 + z1) / 2
  const midY = (y0 + y1) / 2

  // Top rail, tilted to follow the run.
  box(into, [RAIL, RAIL, length], [x, midY + RAIL_H, midZ], -tilt)

  const count = Math.max(2, Math.round(length / 0.14))
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    const z = z0 + (z1 - z0) * t
    const y = y0 + (y1 - y0) * t
    box(into, [0.018, RAIL_H, 0.018], [x, y + RAIL_H / 2, z])
  }
}

function deckAndStairs(metal, tread) {
  // Platform. Sits behind the origin, against the building.
  box(tread, [DECK_W, SLAB, DECK_D], [0, DECK_Y - SLAB / 2, -DECK_D / 2])
  for (const x of [-DECK_W / 2 + POST / 2, DECK_W / 2 - POST / 2]) {
    box(metal, [POST, DECK_Y, POST], [x, DECK_Y / 2, -DECK_D + POST / 2])
    box(metal, [POST, DECK_Y, POST], [x, DECK_Y / 2, -POST / 2])
    railing(metal, x, -DECK_D, 0, DECK_Y, DECK_Y)
  }

  // Steps down, away from the building.
  for (let i = 0; i < 4; i += 1) {
    const top = DECK_Y - STEP_RISE * (i + 1)
    const z = STEP_RUN * (i + 0.5)
    box(tread, [STEP_W, 0.045, STEP_RUN], [0, top, z])
    box(metal, [STEP_W, STEP_RISE, 0.03], [0, top - STEP_RISE / 2, z + STEP_RUN / 2])
  }
  for (const x of [-STEP_W / 2, STEP_W / 2]) {
    railing(metal, x, 0, STEP_RUN * 4, DECK_Y, 0)
  }
}

function ramp(metal, tread) {
  // A switchback, because a straight run at a usable slope is eleven metres.
  const rise = DECK_Y / 2
  const x0 = -DECK_W / 2 - RAMP_W / 2

  // Upper run, from the deck out.
  const upperMid = RAMP_RUN / 2
  box(
    tread,
    [RAMP_W, 0.06, Math.hypot(RAMP_RUN, rise)],
    [x0, DECK_Y - rise / 2, upperMid],
    -Math.atan2(-rise, RAMP_RUN),
  )
  railing(metal, x0 - RAMP_W / 2, 0, RAMP_RUN, DECK_Y, DECK_Y - rise)
  railing(metal, x0 + RAMP_W / 2, 0, RAMP_RUN, DECK_Y, DECK_Y - rise)

  // Landing at the turn.
  const landingZ = RAMP_RUN + RAMP_LANDING / 2
  box(tread, [RAMP_W * 2, 0.06, RAMP_LANDING], [x0 - RAMP_W / 2, DECK_Y - rise, landingZ])

  // Lower run, back towards the building.
  const x1 = x0 - RAMP_W
  box(
    tread,
    [RAMP_W, 0.06, Math.hypot(RAMP_RUN, rise)],
    [x1, rise / 2, upperMid],
    -Math.atan2(rise, RAMP_RUN),
  )
  railing(metal, x1 - RAMP_W / 2, 0, RAMP_RUN, 0, DECK_Y - rise)
  railing(metal, x1 + RAMP_W / 2, 0, RAMP_RUN, 0, DECK_Y - rise)
}

function canopy(metal, tread) {
  for (const x of [-DECK_W / 2 + POST, DECK_W / 2 - POST]) {
    for (const z of [-DECK_D + POST, -POST]) {
      box(metal, [0.07, CANOPY_Y - DECK_Y, 0.07], [x, (CANOPY_Y + DECK_Y) / 2, z])
    }
  }
  box(
    tread,
    [DECK_W + CANOPY_OVER * 2, 0.08, DECK_D + CANOPY_OVER * 2],
    [0, CANOPY_Y, -DECK_D / 2],
  )
}

// ---- glb ---------------------------------------------------------------------

const MATERIALS = [
  { name: 'Metalwork', colour: [0.09, 0.09, 0.1, 1], metallic: 0.85, roughness: 0.42 },
  { name: 'Decking', colour: [0.17, 0.17, 0.18, 1], metallic: 0.25, roughness: 0.72 },
]

function pad(length) {
  return (4 - (length % 4)) % 4
}

function writeGlb(path, groups) {
  const chunks = []
  const accessors = []
  const bufferViews = []
  const meshes = []
  let offset = 0

  const push = (data, target) => {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length, target }
    bufferViews.push(view)
    chunks.push(bytes)
    offset += bytes.length
    const fill = pad(bytes.length)
    if (fill) {
      chunks.push(Buffer.alloc(fill))
      offset += fill
    }
    return bufferViews.length - 1
  }

  const primitives = []
  groups.forEach((data, material) => {
    if (data.positions.length === 0) return

    const positions = new Float32Array(data.positions)
    const normals = new Float32Array(data.normals)
    const indices = new Uint32Array(data.indices)

    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i])
      maxX = Math.max(maxX, positions[i])
      minY = Math.min(minY, positions[i + 1])
      maxY = Math.max(maxY, positions[i + 1])
      minZ = Math.min(minZ, positions[i + 2])
      maxZ = Math.max(maxZ, positions[i + 2])
    }

    const posView = push(positions, 34962)
    const normView = push(normals, 34962)
    const idxView = push(indices, 34963)

    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: positions.length / 3,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    })
    accessors.push({
      bufferView: normView,
      componentType: 5126,
      count: normals.length / 3,
      type: 'VEC3',
    })
    accessors.push({
      bufferView: idxView,
      componentType: 5125,
      count: indices.length,
      type: 'SCALAR',
    })

    primitives.push({
      attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 },
      indices: accessors.length - 1,
      material,
    })
  })

  meshes.push({ name: 'Entrance', primitives })

  const json = {
    asset: { version: '2.0', generator: 'boxx-entrance-demo' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Entrance' }],
    meshes,
    materials: MATERIALS.map((m) => ({
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: m.colour,
        metallicFactor: m.metallic,
        roughnessFactor: m.roughness,
      },
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  }

  const bin = Buffer.concat(chunks)
  let jsonText = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonFill = pad(jsonText.length)
  if (jsonFill) jsonText = Buffer.concat([jsonText, Buffer.alloc(jsonFill, 0x20)])

  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonText.length + 8 + bin.length, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonText.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(bin.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  writeFileSync(path, Buffer.concat([header, jsonHeader, jsonText, binHeader, bin]))
  return 12 + 8 + jsonText.length + 8 + bin.length
}

const VARIANTS = [
  { file: 'deck-stairs.glb', ramp: false, canopy: false },
  { file: 'deck-canopy-stairs.glb', ramp: false, canopy: true },
  { file: 'deck-stairs-ramp.glb', ramp: true, canopy: false },
  { file: 'deck-canopy-stairs-ramp.glb', ramp: true, canopy: true },
]

mkdirSync(OUT, { recursive: true })

for (const variant of VARIANTS) {
  const metal = group()
  const tread = group()

  deckAndStairs(metal, tread)
  if (variant.ramp) ramp(metal, tread)
  if (variant.canopy) canopy(metal, tread)

  const size = writeGlb(join(OUT, variant.file), [metal, tread])
  console.log(`${variant.file.padEnd(30)} ${(size / 1024).toFixed(1)} KB`)
}

console.log(`\nwritten to ${OUT}`)
