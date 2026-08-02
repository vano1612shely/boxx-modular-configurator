import { externalReferences, getModelIO } from './optimize-model'

/** One file as the browser handed it over, path relative to the folder picked. */
export type FolderFile = { path: string; data: Uint8Array }

export type PackedModel = { data: Buffer; name: string }

const MODEL_EXTENSIONS = ['.gltf', '.glb']

function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function basename(path: string): string {
  return normalize(path).split('/').pop() ?? path
}

function dirname(path: string): string {
  const parts = normalize(path).split('/')
  parts.pop()
  return parts.join('/')
}

export function findModelEntry(files: ReadonlyArray<FolderFile>): FolderFile {
  const models = files.filter((file) =>
    MODEL_EXTENSIONS.some((ext) => normalize(file.path).toLowerCase().endsWith(ext)),
  )

  if (models.length === 0) {
    throw new Error('No .gltf or .glb in that folder — an .fbx is converted before it is sent.')
  }
  if (models.length > 1) {
    const names = models.map((file) => basename(file.path)).join(', ')
    throw new Error(
      `That folder holds ${models.length} models — ${names}. Pick the folder of one of them.`,
    )
  }

  return models[0]
}

export type ResolvedResources = {
  /** Keyed by the URI exactly as the glTF wrote it — what the reader looks up. */
  resources: Record<string, Uint8Array>
  missing: string[]
}

/** glTF URIs are relative to the glTF and percent-encoded; both spellings are tried. */
export function resolveGltfResources(
  entryPath: string,
  gltfJson: string,
  files: ReadonlyArray<FolderFile>,
): ResolvedResources {
  const base = dirname(entryPath)
  const prefix = base ? `${base}/` : ''

  const byPath = new Map<string, Uint8Array>()
  for (const file of files) {
    const path = normalize(file.path)
    if (!path.startsWith(prefix)) continue
    byPath.set(path.slice(prefix.length), file.data)
  }

  const resources: Record<string, Uint8Array> = {}
  const missing: string[] = []

  for (const uri of externalReferences(gltfJson)) {
    let decoded = uri
    try {
      decoded = decodeURIComponent(uri)
    } catch {
      // Not valid percent-encoding: use the URI literally.
    }

    const found = byPath.get(normalize(uri)) ?? byPath.get(normalize(decoded))
    if (found) resources[uri] = found
    else missing.push(decoded)
  }

  return { resources, missing }
}

export async function packGltfFolder(files: ReadonlyArray<FolderFile>): Promise<PackedModel> {
  const entry = findModelEntry(files)
  const name = basename(entry.path)

  if (name.toLowerCase().endsWith('.glb')) {
    return { data: Buffer.from(entry.data), name }
  }

  const json = Buffer.from(entry.data).toString('utf8')
  const { resources, missing } = resolveGltfResources(entry.path, json, files)

  if (missing.length) {
    const sample = missing.slice(0, 4).join(', ')
    throw new Error(
      `${name} needs ${missing.length} file(s) that were not in the folder — ` +
        `${sample}${missing.length > 4 ? ', …' : ''}.`,
    )
  }

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
