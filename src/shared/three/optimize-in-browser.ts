import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

import { encodeTextureOnCanvas } from './canvas-texture-encoder'
import {
  optimizeDocument,
  readModelMeta,
  type ModelMeta,
  type OptimizeStage,
} from './gltf-optimize'
import {
  basename,
  findModelEntry,
  missingResourcesError,
  resolveGltfResources,
  type FolderFile,
} from './gltf-pack'

export type OptimizeProgress = {
  stage: OptimizeStage | 'reading'
  /** Textures encoded so far, while the stage is 'textures'. */
  done?: number
  total?: number
}

export type OptimizedModel = {
  data: Uint8Array
  name: string
  meta: ModelMeta
}

async function browserIO(): Promise<WebIO> {
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer')
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])

  // The decoder is needed to READ a file this pipeline has already produced —
  // re-uploading an optimised model is an ordinary thing to do.
  return new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })
}

/**
 * Packs a picked folder and optimises it, entirely on the visitor's machine.
 *
 * This is the same pipeline the server runs on upload. Doing it here first is
 * about the wire: a source runs to hundreds of megabytes and the result to ten,
 * and the upload is what the wait was actually made of.
 */
export async function packAndOptimize(
  files: ReadonlyArray<FolderFile>,
  onProgress?: (progress: OptimizeProgress) => void,
): Promise<OptimizedModel> {
  onProgress?.({ stage: 'reading' })

  const entry = findModelEntry(files)
  const name = basename(entry.path)
  const io = await browserIO()

  const document = name.toLowerCase().endsWith('.glb')
    ? await io.readBinary(entry.data)
    : await (async () => {
        const json = new TextDecoder().decode(entry.data)
        const { resources, missing } = resolveGltfResources(entry.path, json, files)
        if (missing.length) throw missingResourcesError(name, missing)

        let parsed: unknown
        try {
          parsed = JSON.parse(json)
        } catch {
          throw new Error(`${name} is not readable as glTF JSON.`)
        }

        return io.readJSON({
          json: parsed as Parameters<typeof io.readJSON>[0]['json'],
          resources: resources as Parameters<typeof io.readJSON>[0]['resources'],
        })
      })()

  await optimizeDocument(document, {
    encode: encodeTextureOnCanvas,
    onStage: (stage) => onProgress?.({ stage }),
    onTextureProgress: (done, total) => onProgress?.({ stage: 'textures', done, total }),
  })

  const output = await io.writeBinary(document)
  const sizeBefore = files.reduce((total, file) => total + file.data.byteLength, 0)

  return {
    data: output,
    name: name.replace(/\.gltf$/i, '.glb'),
    meta: await readModelMeta(document, sizeBefore, output.byteLength),
  }
}
