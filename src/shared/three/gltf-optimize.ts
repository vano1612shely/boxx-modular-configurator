import type { Document, Transform } from '@gltf-transform/core'
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions'

/** Longest edge a texture is allowed to keep, in pixels. */
export const MAX_TEXTURE_SIZE = 2048
export const TEXTURE_QUALITY = 80
export const TARGET_TEXTURE_MIME = 'image/webp'

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

export type EncodedTexture = { data: Uint8Array; mimeType: string }

/**
 * Turns one image into the target format at the capped size, or null to leave it
 * alone. sharp on the server, a canvas in the browser.
 */
export type TextureEncoder = (input: {
  data: Uint8Array
  mimeType: string
  max: number
  quality: number
}) => Promise<EncodedTexture | null>

/**
 * Whether a texture is already in the shape the pipeline would put it in.
 *
 * Load-bearing once the browser optimises before upload: the server runs the
 * same pipeline again on arrival, and re-encoding a lossy image a second time
 * costs quality for nothing. It also makes the server pass nearly free, which
 * is what keeps the upload request short.
 */
export function isAlreadyOptimised(
  mimeType: string | null,
  size: readonly [number, number] | null,
): boolean {
  if (mimeType !== TARGET_TEXTURE_MIME) return false
  if (!size) return false
  return size[0] <= MAX_TEXTURE_SIZE && size[1] <= MAX_TEXTURE_SIZE
}

/** Longest edge capped, aspect ratio kept, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export type TextureProgress = (done: number, total: number) => void

/**
 * Re-encodes every texture that is not already in shape.
 *
 * Written by hand rather than through `textureCompress` so that both platforms
 * share one skip rule; the library's own pass re-encodes unconditionally.
 */
export async function compressTextures(
  document: Document,
  encode: TextureEncoder,
  onProgress?: TextureProgress,
): Promise<number> {
  const textures = document.getRoot().listTextures()
  let done = 0
  let touched = 0

  for (const texture of textures) {
    const data = texture.getImage()
    const mimeType = texture.getMimeType()

    if (data && !isAlreadyOptimised(mimeType, texture.getSize())) {
      const encoded = await encode({
        data,
        mimeType,
        max: MAX_TEXTURE_SIZE,
        quality: TEXTURE_QUALITY,
      })
      if (encoded) {
        texture.setImage(encoded.data).setMimeType(encoded.mimeType)
        const uri = texture.getURI()
        if (uri) texture.setURI(uri.replace(/\.\w+$/, '') + '.webp')
        touched++
      }
    }

    onProgress?.(++done, textures.length)
  }

  return touched
}

export type OptimizeStage = 'geometry' | 'textures' | 'encoding'

export type OptimizeOptions = {
  encode: TextureEncoder
  onStage?: (stage: OptimizeStage) => void
  onTextureProgress?: TextureProgress
}

/**
 * `prune` runs before the textures so that nothing unreferenced is paid for,
 * and `meshopt` last because it rewrites the buffers everything else edits.
 */
export async function optimizeDocument(
  document: Document,
  { encode, onStage, onTextureProgress }: OptimizeOptions,
): Promise<void> {
  onStage?.('geometry')
  await document.transform(dedup(), prune(), weld())

  onStage?.('textures')
  await compressTextures(document, encode, onTextureProgress)

  onStage?.('encoding')
  const { MeshoptEncoder } = await import('meshoptimizer')
  await MeshoptEncoder.ready
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }) as Transform)
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

export async function readModelMeta(
  document: Document,
  sizeBefore: number,
  sizeAfter: number,
): Promise<ModelMeta> {
  const { getBounds } = await import('@gltf-transform/core')
  const root = document.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const bounds = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] }

  return {
    sizeBefore,
    sizeAfter,
    triangles: countTriangles(document),
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    bboxMin: bounds.min as ModelMeta['bboxMin'],
    bboxMax: bounds.max as ModelMeta['bboxMax'],
  }
}
