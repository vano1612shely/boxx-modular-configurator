import 'dotenv/config'

import {
  Document,
  NodeIO,
  getBounds,
  type Node,
  type Primitive,
} from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getPayload, type Payload } from 'payload'

import { SHELL_DEFAULTS } from '../src/modules/shared/room-shell'
import config from '../src/payload.config'

type Side = 'North' | 'South' | 'East' | 'West'

const PERIMETER_NODES = [
  'Object_120', // Basic_Wall_exterior_01 — main exterior walls
  'Object_114', // Wall_Sweep_Trim — corner/edge trim
  'Object_77', // windows_out
  'Object_80', // windows_frame
  'Object_111', // windows_frame (second set)
  'Object_83', // windows_in
  'Object_5', // window glass
  'Object_47', // exterior doors
  'Object_86', // exterior doors (second set)
  'Object_89', // exterior door frames
]

const ROOF_NODES = ['Object_65', 'Object_117', 'Object_44', 'Object_71', 'Object_26', 'Object_32']

/** Suspended-ceiling elements (tiles, grid, lamps, diffusers) at y≈3.2. */
const CEILING_NODES = [
  'Object_50',
  'Object_92',
  'Object_93',
  'Object_96',
  'Object_99',
  'Object_102',
  'Object_105',
  'Object_108',
]

/** The huge site slab — not part of the product. */
const DELETE_NODES = ['Object_56']

/** Facade logo attached to the south exterior wall. */
const SOUTH_WALL_EXTRA = ['Object_144']

function findNode(document: Document, name: string): Node | null {
  return document.getRoot().listNodes().find((node) => node.getName() === name) ?? null
}

function transformPoint(matrix: number[], point: [number, number, number]): [number, number, number] {
  const [x, y, z] = point
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ]
}

type Perimeter = { minX: number; maxX: number; minZ: number; maxZ: number }

function classifySide(point: [number, number, number], perimeter: Perimeter): Side {
  const distances: Array<[Side, number]> = [
    ['West', Math.abs(point[0] - perimeter.minX)],
    ['East', Math.abs(point[0] - perimeter.maxX)],
    ['North', Math.abs(point[2] - perimeter.minZ)],
    ['South', Math.abs(point[2] - perimeter.maxZ)],
  ]
  distances.sort((a, b) => a[1] - b[1])
  return distances[0][0]
}

function readIndices(primitive: Primitive): number[] {
  const indices = primitive.getIndices()
  if (indices) return Array.from(indices.getArray() ?? [])

  const position = primitive.getAttribute('POSITION')
  const count = position?.getCount() ?? 0
  return Array.from({ length: count }, (_, i) => i)
}

function splitNodeBySide(document: Document, node: Node, perimeter: Perimeter) {
  const mesh = node.getMesh()
  if (!mesh) return

  const parent = node.getParentNode() ?? document.getRoot().getDefaultScene()
  const worldMatrix = node.getWorldMatrix()
  const buckets = new Map<Side, { primitive: Primitive; indices: number[] }[]>()

  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    if (!position) continue
    const positions = position.getArray()
    if (!positions) continue

    const indices = readIndices(primitive)
    const sideIndices = new Map<Side, number[]>()

    for (let i = 0; i + 2 < indices.length; i += 3) {
      const centroid: [number, number, number] = [0, 0, 0]
      for (let v = 0; v < 3; v++) {
        const idx = indices[i + v] * 3
        centroid[0] += positions[idx] / 3
        centroid[1] += positions[idx + 1] / 3
        centroid[2] += positions[idx + 2] / 3
      }
      const side = classifySide(transformPoint(Array.from(worldMatrix), centroid), perimeter)
      const bucket = sideIndices.get(side) ?? []
      bucket.push(indices[i], indices[i + 1], indices[i + 2])
      sideIndices.set(side, bucket)
    }

    for (const [side, tri] of sideIndices) {
      const bucket = buckets.get(side) ?? []
      bucket.push({ primitive, indices: tri })
      buckets.set(side, bucket)
    }
  }

  const baseName = node.getName()

  for (const [side, parts] of buckets) {
    const sideMesh = document.createMesh(`Wall_Exterior_${side}_${baseName}`)

    for (const part of parts) {
      const indexAccessor = document
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint32Array(part.indices))
        .setBuffer(document.getRoot().listBuffers()[0])

      const sidePrimitive = document.createPrimitive().setIndices(indexAccessor)
      for (const semantic of part.primitive.listSemantics()) {
        sidePrimitive.setAttribute(semantic, part.primitive.getAttribute(semantic))
      }
      sidePrimitive.setMaterial(part.primitive.getMaterial())
      sideMesh.addPrimitive(sidePrimitive)
    }

    const sideNode = document
      .createNode(`Wall_Exterior_${side}_${baseName}`)
      .setMesh(sideMesh)
      .setTranslation(node.getTranslation())
      .setRotation(node.getRotation())
      .setScale(node.getScale())

    if (parent && 'addChild' in parent) parent.addChild(sideNode)
  }

  node.dispose()
}

async function prepare(sourcePath: string): Promise<{ glb: Buffer; restroom: Perimeter }> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(sourcePath)
  const root = document.getRoot()

  for (const name of DELETE_NODES) findNode(document, name)?.dispose()

  const wallsNode = findNode(document, 'Object_120')
  if (!wallsNode) throw new Error('Exterior wall node Object_120 not found')
  const wallBounds = getBounds(wallsNode)
  const perimeter: Perimeter = {
    minX: wallBounds.min[0],
    maxX: wallBounds.max[0],
    minZ: wallBounds.min[2],
    maxZ: wallBounds.max[2],
  }

  const floorNode = root
    .listNodes()
    .find((node) =>
      node
        .getMesh()
        ?.listPrimitives()
        .some((p) => p.getMaterial()?.getName() === 'Floor_Finish'),
    )
  const floorY = floorNode ? getBounds(floorNode).max[1] : 0

  const restroomNode = root
    .listNodes()
    .find((node) =>
      node
        .getMesh()
        ?.listPrimitives()
        .some((p) => p.getMaterial()?.getName() === 'floor_Restroom'),
    )
  const restroomBounds = restroomNode ? getBounds(restroomNode) : null

  for (const name of ROOF_NODES) {
    const node = findNode(document, name)
    node?.setName(`Roof_${name}`)
    node?.getMesh()?.setName(`Roof_${name}`)
  }
  for (const name of CEILING_NODES) {
    const node = findNode(document, name)
    node?.setName(`Ceiling_${name}`)
    node?.getMesh()?.setName(`Ceiling_${name}`)
  }
  for (const name of SOUTH_WALL_EXTRA) {
    const node = findNode(document, name)
    node?.setName(`Wall_Exterior_South_${name}`)
    node?.getMesh()?.setName(`Wall_Exterior_South_${name}`)
  }

  for (const name of PERIMETER_NODES) {
    const node = findNode(document, name)
    if (node) splitNodeBySide(document, node, perimeter)
  }

  // Re-center: plan center at the origin, interior floor at y=0.
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const offset: [number, number, number] = [
    -(perimeter.minX + perimeter.maxX) / 2,
    -floorY,
    -(perimeter.minZ + perimeter.maxZ) / 2,
  ]
  const buildingRoot = document.createNode('BuildingRoot').setTranslation(offset)
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    buildingRoot.addChild(child)
  }
  scene.addChild(buildingRoot)

  const restroom: Perimeter = restroomBounds
    ? {
        minX: restroomBounds.min[0] + offset[0],
        maxX: restroomBounds.max[0] + offset[0],
        minZ: restroomBounds.min[2] + offset[2],
        maxZ: restroomBounds.max[2] + offset[2],
      }
    : { minX: -3.5, maxX: -1.3, minZ: -4.6, maxZ: -0.4 }

  console.log('Prepared. Offset:', offset.map((v) => v.toFixed(2)).join(', '))
  console.log('Restroom bounds:', restroom)

  const glb = Buffer.from(await io.writeBinary(document))
  console.log(`GLB size before optimization: ${(glb.byteLength / 1024 / 1024).toFixed(1)} MB`)
  return { glb, restroom }
}

async function importModel(payload: Payload, glb: Buffer, restroom: Perimeter) {
  const existing = await payload.find({
    collection: 'building-models',
    where: { title: { equals: 'BOXXPlex — 4 offices' } },
    limit: 1,
  })

  if (existing.totalDocs > 0) {
    payload.logger.info('BOXXPlex — 4 offices already exists, removing old version first.')
    await payload.delete({ collection: 'building-models', id: existing.docs[0].id })
  }

  payload.logger.info('Uploading glb (optimization pipeline runs now — this takes a while)…')

  const model = await payload.create({
    collection: 'models',
    data: { title: 'BOXXPlex 4-office building (client asset)' },
    file: {
      data: glb,
      mimetype: 'model/gltf-binary',
      name: 'boxxplex-4-offices.glb',
      size: glb.byteLength,
    },
  })

  payload.logger.info(`Model uploaded (id ${model.id}, ${model.filesize} bytes optimized).`)

  const line = await payload.find({
    collection: 'building-lines',
    where: { slug: { equals: 'boxxplex' } },
    limit: 1,
  })
  if (line.totalDocs === 0) throw new Error('boxxplex line missing — run pnpm seed first')

  const building = await payload.create({
    collection: 'building-models',
    data: {
      title: 'BOXXPlex — 4 offices',
      line: line.docs[0].id,
      unitCount: 4,
      restroomCount: 1,
      sqft: 1344,
      dimensions: "24' x 56'",
      model: model.id,
      sceneConfig: {
        camera: {
          position: { x: 13, y: 9, z: 15 },
          target: { x: 0, y: 1, z: 0 },
          fov: 50,
          minDistance: 4,
          maxDistance: 45,
          minPolarDeg: 10,
          maxPolarDeg: 85,
        },
        // Floor at 2.35 so this one volume covers the roof and the per-room
        // ceiling slabs, which sit inside this footprint at y 2.35–2.6.
        roofBlocks: [
          { min: { x: -3.95, y: 2.35, z: -8.85 }, max: { x: 3.95, y: 3.4, z: 8.85 } },
        ],
      },
      rooms: [
        {
          key: 'office-1',
          name: 'Office 1',
          roomType: 'office',
          floorPolygon: [
            { x: -3.45, z: -8.2, side: 'w1' },
            { x: -0.05, z: -8.2, side: 'w2' },
            { x: -0.05, z: -4.75, side: 'w3' },
            { x: -3.45, z: -4.75, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: -1.75, y: 5, z: -1 }, target: { x: -1.75, y: 0.8, z: -6.5 } },
        },
        {
          key: 'office-2',
          name: 'Office 2',
          roomType: 'office',
          floorPolygon: [
            { x: 0.05, z: -8.2, side: 'w1' },
            { x: 3.45, z: -8.2, side: 'w2' },
            { x: 3.45, z: -4.75, side: 'w3' },
            { x: 0.05, z: -4.75, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: 1.75, y: 5, z: -1 }, target: { x: 1.75, y: 0.8, z: -6.5 } },
        },
        {
          key: 'office-3',
          name: 'Office 3',
          roomType: 'office',
          floorPolygon: [
            { x: -3.45, z: 4.4, side: 'w1' },
            { x: -0.05, z: 4.4, side: 'w2' },
            { x: -0.05, z: 8.2, side: 'w3' },
            { x: -3.45, z: 8.2, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: -1.75, y: 5, z: 1 }, target: { x: -1.75, y: 0.8, z: 6.3 } },
        },
        {
          key: 'office-4',
          name: 'Office 4',
          roomType: 'office',
          floorPolygon: [
            { x: 0.05, z: 4.4, side: 'w1' },
            { x: 3.45, z: 4.4, side: 'w2' },
            { x: 3.45, z: 8.2, side: 'w3' },
            { x: 0.05, z: 8.2, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: 1.75, y: 5, z: 1 }, target: { x: 1.75, y: 0.8, z: 6.3 } },
        },
        {
          key: 'restroom',
          name: 'Restroom',
          roomType: 'restroom',
          // Traced from the glb — the only room whose walls are off the grid.
          floorPolygon: [
            { x: restroom.minX, z: restroom.minZ, side: 'w1' },
            { x: restroom.maxX, z: restroom.minZ, side: 'w2' },
            { x: restroom.maxX, z: restroom.maxZ, side: 'w3' },
            { x: restroom.minX, z: restroom.maxZ, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: -0.5, y: 4, z: 1.5 }, target: { x: -2.4, y: 0.8, z: -2.4 } },
        },
        {
          key: 'common',
          name: 'Open Space',
          roomType: 'conference',
          floorPolygon: [
            { x: -1.2, z: -4.5, side: 'w1' },
            { x: 3.45, z: -4.5, side: 'w2' },
            { x: 3.45, z: 4.3, side: 'w3' },
            { x: -1.2, z: 4.3, side: 'w4' },
          ],
          shell: {
            floorY: 0.03,
            wallHeight: 2.47,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: { position: { x: 1, y: 5.5, z: 5 }, target: { x: 1, y: 0.8, z: 0 } },
        },
      ],
    },
  })

  payload.logger.info(`Building created: ${building.title} (id ${building.id}).`)
}

async function main() {
  const sourcePath = process.argv[2]
  if (!sourcePath) {
    console.error('Usage: npx tsx scripts/import-boxxplex.ts <path-to-scene.gltf>')
    process.exit(1)
  }

  const { glb, restroom } = await prepare(sourcePath)
  const payload = await getPayload({ config })
  await importModel(payload, glb, restroom)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
