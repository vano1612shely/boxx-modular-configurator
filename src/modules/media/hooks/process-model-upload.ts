import { APIError, type CollectionBeforeOperationHook } from 'payload'

import { optimizeGlb, type ModelMeta } from '../lib/optimize-model'

const GLB_EXTENSIONS = ['.glb', '.gltf']

export type ProcessedModel = { meta: ModelMeta }

/**
 * Runs on create/update with a file attached: validates the extension,
 * optimizes the model in place and stashes metadata on req.context
 * so the beforeChange hook can persist it onto the document.
 */
export const processModelUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  if (!req.file?.data) return args

  const name = req.file.name.toLowerCase()

  if (!GLB_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new APIError('Only .glb / self-contained .gltf files are supported.', 400)
  }

  try {
    const { output, meta } = await optimizeGlb(req.file.data)

    req.file.data = output
    req.file.size = output.byteLength
    req.file.name = req.file.name.replace(/\.gltf$/i, '.glb')
    req.file.mimetype = 'model/gltf-binary'

    req.context.modelMeta = meta
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new APIError(`Model optimization failed: ${message}`, 400)
  }

  return args
}
