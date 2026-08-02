export type UploadedModel = { id: number; url: string | null; title: string }

export type UploadStage = 'converting' | 'uploading'

const SENDABLE = /\.(gltf|glb|fbx|bin|jpe?g|png|webp|tga|dds|bmp|gif|avif|ktx2|basis)$/i
const MODEL = /\.(gltf|glb|fbx)$/i

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function pathOf(file: File): string {
  return file.webkitRelativePath || file.name
}

// Paths travel alongside the files in the same order; the server reassembles the
// relative references a glTF makes to its .bin and textures.
export async function uploadModelFolder(
  picked: ArrayLike<File>,
  options: { title?: string; onStage?: (stage: UploadStage) => void } = {},
): Promise<UploadedModel> {
  const files = Array.from(picked).filter((file) => SENDABLE.test(file.name))
  const models = files.filter((file) => MODEL.test(file.name))

  if (!models.length) {
    throw new Error('That folder has no .gltf, .glb or .fbx in it.')
  }
  if (models.length > 1) {
    const names = models.map((file) => basename(pathOf(file))).join(', ')
    throw new Error(
      `That folder holds ${models.length} models — ${names}. Pick the folder of one of them.`,
    )
  }

  const entry = models[0]

  if (/\.fbx$/i.test(entry.name)) {
    options.onStage?.('converting')
    // Lazy: the FBX reader and glTF writer are a few hundred KB.
    const { convertFbxToGlb } = await import('@/shared/three/fbx-to-glb')

    const converted = await convertFbxToGlb(
      { path: pathOf(entry), data: await entry.arrayBuffer() },
      files.filter((file) => file !== entry).map((file) => ({ path: pathOf(file), file })),
    )

    options.onStage?.('uploading')
    return send(
      [new File([converted.data], converted.name, { type: 'model/gltf-binary' })],
      [converted.name],
      options.title,
    )
  }

  options.onStage?.('uploading')
  return send(files, files.map(pathOf), options.title)
}

async function send(files: File[], paths: string[], title?: string): Promise<UploadedModel> {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  // `_payload` is where Payload looks for the JSON half of a multipart request.
  body.append('_payload', JSON.stringify({ paths, title }))

  const response = await fetch('/api/models/pack', {
    method: 'POST',
    body,
    credentials: 'include',
  })

  const json = (await response.json().catch(() => null)) as {
    doc?: { id: number; url?: string | null; title?: string | null; filename?: string | null }
    errors?: Array<{ message?: string }>
  } | null

  if (!response.ok || !json?.doc) {
    throw new Error(json?.errors?.[0]?.message ?? `Upload failed (${response.status}).`)
  }

  return {
    id: json.doc.id,
    url: json.doc.url ?? null,
    title: json.doc.title || json.doc.filename || `#${json.doc.id}`,
  }
}
