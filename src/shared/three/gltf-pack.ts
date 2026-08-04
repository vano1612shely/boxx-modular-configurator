/**
 * Folder and URI arithmetic for glTF, with nothing platform-specific in it.
 *
 * The browser packs a picked folder before uploading it and the server packs one
 * that arrives whole; both have to resolve the same relative references the same
 * way, so the resolution lives here rather than twice.
 */

/** One file as the browser handed it over, path relative to the folder picked. */
export type FolderFile = { path: string; data: Uint8Array }

const MODEL_EXTENSIONS = ['.gltf', '.glb']

export function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function basename(path: string): string {
  return normalize(path).split('/').pop() ?? path
}

export function dirname(path: string): string {
  const parts = normalize(path).split('/')
  parts.pop()
  return parts.join('/')
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

/** The message a folder missing its own pieces should fail with. */
export function missingResourcesError(name: string, missing: string[]): Error {
  const sample = missing.slice(0, 4).join(', ')
  return new Error(
    `${name} needs ${missing.length} file(s) that were not in the folder — ` +
      `${sample}${missing.length > 4 ? ', …' : ''}.`,
  )
}
