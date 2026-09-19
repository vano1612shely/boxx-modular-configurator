import { NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { stat } from 'node:fs/promises'
import sharp from 'sharp'

import {
  fitWithin,
  optimizeDocument,
  readModelMeta,
  TARGET_TEXTURE_MIME,
  type ModelMeta,
  type TextureEncoder,
} from '@/shared/three/gltf-optimize'

export type { ModelMeta }
export { externalReferences } from '@/shared/three/gltf-pack'

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

/** The browser's canvas encoder has the same contract; sharp fills it here. */
const encodeTextureWithSharp: TextureEncoder = async ({ data, max, quality }) => {
  const image = sharp(Buffer.from(data))

  const { width, height } = await image.metadata()
  if (!width || !height) return null

  const target = fitWithin(width, height, max)
  const output = await image
    .resize(target.width, target.height, { fit: 'fill' })
    .webp({ quality })
    .toBuffer()

  return { data: new Uint8Array(output), mimeType: TARGET_TEXTURE_MIME }
}

export async function optimizeGlb(input: Buffer): Promise<{ output: Buffer; meta: ModelMeta }> {
  const nodeIO = await getModelIO()
  const document = await nodeIO.readBinary(new Uint8Array(input))

  return run(document, input.byteLength)
}

/**
 * The same pass for a .gltf, which is JSON and not a GLB container.
 *
 * `readBinary` refuses one, so a .gltf used to fall straight into the caller's
 * catch and be stored exactly as uploaded — no optimisation, no meta, and only
 * a line in the log to say so. Whatever reaches here is self-contained: the
 * upload hook turns away any .gltf that still points at separate files, so
 * every buffer and image left is a data URI, which `readJSON` decodes itself.
 */
export async function optimizeGltfJson(
  input: Buffer,
): Promise<{ output: Buffer; meta: ModelMeta }> {
  const nodeIO = await getModelIO()
  const document = await nodeIO.readJSON({
    json: JSON.parse(input.toString('utf8')),
    resources: {},
  })

  return run(document, input.byteLength)
}

/**
 * The measurements of a glb that is stored as it is, with no pass over it.
 *
 * Before and after are the one size: nothing was saved on this upload, and
 * the row should say so rather than repeat a saving made on another machine.
 */
export async function describeGlb(input: Buffer): Promise<ModelMeta> {
  const nodeIO = await getModelIO()
  const document = await nodeIO.readBinary(new Uint8Array(input))

  return readModelMeta(document, input.byteLength, input.byteLength)
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

  // A model optimised in the browser arrives with its textures already in
  // shape; the shared skip rule means this pass leaves them alone rather than
  // compressing a lossy image a second time.
  await optimizeDocument(document, { encode: encodeTextureWithSharp })

  const output = Buffer.from(await nodeIO.writeBinary(document))

  return {
    output,
    meta: await readModelMeta(document, sizeBefore, output.byteLength),
  }
}
