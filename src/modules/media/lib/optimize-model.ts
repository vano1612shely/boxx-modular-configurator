import { NodeIO, getBounds, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { stat } from 'node:fs/promises'
import sharp from 'sharp'

export type ModelMeta = {
  sizeBefore: number
  sizeAfter: number
  triangles: number
  meshes: number
  materials: number
  textures: number
  bboxMin: [number, number, number]
  bboxMax: [number, number, number]
}

const MAX_TEXTURE_SIZE = 2048

let io: NodeIO | null = null

export async function getModelIO(): Promise<NodeIO> {
  if (io) return io

  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])

  io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    })

  return io
}

function countTriangles(document: Document): number {
  return document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((total, primitive) => {
      const indices = primitive.getIndices()
      const position = primitive.getAttribute('POSITION')
      const vertexCount = indices ? indices.getCount() : (position?.getCount() ?? 0)
      return total + Math.floor(vertexCount / 3)
    }, 0)
}

function readBbox(document: Document): Pick<ModelMeta, 'bboxMin' | 'bboxMax'> {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]

  if (!scene) {
    return { bboxMin: [0, 0, 0], bboxMax: [0, 0, 0] }
  }

  const { min, max } = getBounds(scene)
  return { bboxMin: min as ModelMeta['bboxMin'], bboxMax: max as ModelMeta['bboxMax'] }
}

/** Every external URI a glTF file expects to find beside itself. */
export function externalReferences(gltfJson: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(gltfJson)
  } catch {
    return []
  }

  const doc = parsed as { buffers?: Array<{ uri?: string }>; images?: Array<{ uri?: string }> }
  const uris = [...(doc.buffers ?? []), ...(doc.images ?? [])]
    .map((resource) => resource.uri)
    .filter((uri): uri is string => typeof uri === 'string' && !uri.startsWith('data:'))

  return [...new Set(uris)]
}

export async function optimizeGlb(input: Buffer): Promise<{ output: Buffer; meta: ModelMeta }> {
  const nodeIO = await getModelIO()
  const document = await nodeIO.readBinary(new Uint8Array(input))

  return run(document, input.byteLength)
}

/** Reads from disk so a glTF's relative .bin/texture paths resolve; emits one embedded GLB. */
export async function optimizeModelFile(
  path: string,
): Promise<{ output: Buffer; meta: ModelMeta }> {
  const nodeIO = await getModelIO()
  const document = await nodeIO.read(path)
  const { size } = await stat(path)

  return run(document, size)
}

async function run(
  document: Document,
  sizeBefore: number,
): Promise<{ output: Buffer; meta: ModelMeta }> {
  const nodeIO = await getModelIO()

  await document.transform(
    dedup(),
    prune(),
    weld(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
    }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )

  const output = Buffer.from(await nodeIO.writeBinary(document))
  const root = document.getRoot()

  return {
    output,
    meta: {
      sizeBefore,
      sizeAfter: output.byteLength,
      triangles: countTriangles(document),
      meshes: root.listMeshes().length,
      materials: root.listMaterials().length,
      textures: root.listTextures().length,
      ...readBbox(document),
    },
  }
}
