/**
 * Packing a picked folder into one GLB, on the server.
 *
 * The folder arithmetic itself — which file is the model, which relative URIs it
 * expects, how a path normalises — is not server-specific and lives in
 * `@/shared/three/gltf-pack`, where the browser's own packer reads it too. This
 * file is only the half that needs Node: a `Buffer` and the shared `NodeIO`.
 * Both halves used to carry their own copy of the arithmetic, byte for byte, so
 * a fix to one silently left the other answering differently.
 */
import {
  basename,
  findModelEntry,
  missingResourcesError,
  resolveGltfResources,
  type FolderFile,
} from '@/shared/three/gltf-pack'

import { getModelIO } from './optimize-model'

export type { FolderFile }
export { findModelEntry, resolveGltfResources }

export type PackedModel = { data: Buffer; name: string }

export async function packGltfFolder(files: ReadonlyArray<FolderFile>): Promise<PackedModel> {
  const entry = findModelEntry(files)
  const name = basename(entry.path)

  if (name.toLowerCase().endsWith('.glb')) {
    return { data: Buffer.from(entry.data), name }
  }

  const json = Buffer.from(entry.data).toString('utf8')
  const { resources, missing } = resolveGltfResources(entry.path, json, files)

  if (missing.length) throw missingResourcesError(name, missing)

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(`${name} is not readable as glTF JSON.`)
  }

  const io = await getModelIO()
  const document = await io.readJSON({
    json: parsed as Parameters<typeof io.readJSON>[0]['json'],
    resources: resources as Parameters<typeof io.readJSON>[0]['resources'],
  })

  return {
    data: Buffer.from(await io.writeBinary(document)),
    name: name.replace(/\.gltf$/i, '.glb'),
  }
}
