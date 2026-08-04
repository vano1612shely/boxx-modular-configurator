import type { FolderFile } from '@/shared/three/gltf-pack'

import { assetUrl } from './asset-url'

export type UploadedModel = { id: number; url: string | null; title: string }

export type UploadStage = 'converting' | 'optimizing' | 'uploading'

export type UploadProgress = {
  stage: UploadStage
  /** Textures encoded so far, while optimising. */
  done?: number
  total?: number
  /** Bytes the upload was reduced to, once optimisation has finished. */
  sizeBefore?: number
  sizeAfter?: number
}

const SENDABLE = /\.(gltf|glb|fbx|bin|jpe?g|png|webp|tga|dds|bmp|gif|avif|ktx2|basis)$/i
const MODEL = /\.(gltf|glb|fbx)$/i

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function pathOf(file: File): string {
  return file.webkitRelativePath || file.name
}

export async function uploadModelFolder(
  picked: ArrayLike<File>,
  options: { title?: string; onProgress?: (progress: UploadProgress) => void } = {},
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

  const report = options.onProgress
  let entries = files
  let entry = models[0]

  if (/\.fbx$/i.test(entry.name)) {
    report?.({ stage: 'converting' })
    // Lazy: the FBX reader and glTF writer are a few hundred KB.
    const { convertFbxToGlb } = await import('@/shared/three/fbx-to-glb')

    const converted = await convertFbxToGlb(
      { path: pathOf(entry), data: await entry.arrayBuffer() },
      files.filter((file) => file !== entry).map((file) => ({ path: pathOf(file), file })),
    )

    entry = new File([converted.data as BlobPart], converted.name, {
      type: 'model/gltf-binary',
    })
    entries = [entry]
  }

  const local = await optimizeLocally(entries, report)
  if (local) {
    report?.({
      stage: 'uploading',
      sizeBefore: local.meta.sizeBefore,
      sizeAfter: local.meta.sizeAfter,
    })
    return createModel(local, options.title)
  }

  // No local pipeline: send the folder whole and let the server pack it.
  report?.({ stage: 'uploading' })
  return packOnServer(entries, entries.map(pathOf), options.title)
}

type LocalResult = Awaited<ReturnType<typeof runLocal>>

async function runLocal(folder: FolderFile[], report?: (progress: UploadProgress) => void) {
  const { optimizeModelInBrowser } = await import('@/shared/three/optimize-model-client')

  return optimizeModelInBrowser(folder, (progress) => {
    if (progress.stage === 'textures') {
      report?.({ stage: 'optimizing', done: progress.done, total: progress.total })
      return
    }
    report?.({ stage: 'optimizing' })
  })
}

/**
 * Returns null when this browser cannot do it, which is the signal to fall back
 * rather than an error worth showing anyone.
 */
async function optimizeLocally(
  files: File[],
  report?: (progress: UploadProgress) => void,
): Promise<LocalResult | null> {
  const { canOptimizeInBrowser, OptimizeUnsupported } = await import(
    '@/shared/three/optimize-model-client'
  )
  if (!canOptimizeInBrowser()) return null

  report?.({ stage: 'optimizing' })

  const folder: FolderFile[] = await Promise.all(
    files.map(async (file) => ({
      path: pathOf(file),
      data: new Uint8Array(await file.arrayBuffer()),
    })),
  )

  try {
    return await runLocal(folder, report)
  } catch (error) {
    if (error instanceof OptimizeUnsupported) return null
    throw error
  }
}

async function createModel(model: LocalResult, title?: string): Promise<UploadedModel> {
  const body = new FormData()
  body.append(
    'file',
    new File([model.data as BlobPart], model.name, { type: 'model/gltf-binary' }),
  )
  // `_payload` is where Payload looks for the JSON half of a multipart request.
  // The source size travels with it so the saving on record is the real one and
  // not what was left after this browser had already done the work.
  body.append(
    '_payload',
    JSON.stringify({
      title: title || model.name.replace(/\.glb$/i, ''),
      meta: { sizeBefore: model.meta.sizeBefore },
    }),
  )

  return post('/api/models', body)
}

async function packOnServer(
  files: File[],
  paths: string[],
  title?: string,
): Promise<UploadedModel> {
  const body = new FormData()
  for (const file of files) body.append('files', file)
  body.append('_payload', JSON.stringify({ paths, title }))

  return post('/api/models/pack', body)
}

async function post(url: string, body: FormData): Promise<UploadedModel> {
  const response = await fetch(url, { method: 'POST', body, credentials: 'include' })

  const json = (await response.json().catch(() => null)) as {
    doc?: {
      id: number
      url?: string | null
      title?: string | null
      filename?: string | null
      updatedAt?: string | null
    }
    errors?: Array<{ message?: string }>
  } | null

  if (!response.ok || !json?.doc) {
    throw new Error(json?.errors?.[0]?.message ?? `Upload failed (${response.status}).`)
  }

  return {
    id: json.doc.id,
    url: assetUrl(json.doc),
    title: json.doc.title || json.doc.filename || `#${json.doc.id}`,
  }
}
