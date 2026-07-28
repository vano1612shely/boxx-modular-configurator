import { APIError, type CollectionBeforeOperationHook } from 'payload'

import { optimizeGlb, type ModelMeta } from '../lib/optimize-model'

const GLB_EXTENSIONS = ['.glb', '.gltf']

export type ProcessedModel = { meta: ModelMeta }

/**
 * Optimizes a model on its way in — when the file comes through us at all.
 *
 * It usually does not. Uploads are signed and sent from the browser straight to
 * the bucket (`clientUploads` in payload.config.ts), because a serverless
 * function cannot receive a file bigger than a few megabytes and models here
 * run to a hundred. In that case there is nothing to read and this steps aside.
 *
 * That leaves this doing real work only in local development, where files still
 * pass through the server. Optimizing a large model is minutes of CPU and a
 * lot of memory, which is a fine thing to spend on a workstation and an
 * impossible thing to spend inside a request — so the pipeline lives in
 * `pnpm optimize:model` and this is a convenience, not the guarantee.
 *
 * A failure here therefore warns and lets the original through. It used to
 * throw a 400, which turned "the optimizer ran out of memory" into "your upload
 * is invalid" — the same rejection an unsupported file gets, and no way to tell
 * them apart from the browser.
 */
export const processModelUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  if (!req.file?.data) return args

  const name = req.file.name.toLowerCase()

  // Still fatal: this one is a real answer to "why was my file refused".
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
    req.payload.logger.warn(
      `Model optimization skipped for "${req.file.name}" (${message}). ` +
        'Storing the file as uploaded — run `pnpm optimize:model` on it if size matters.',
    )
  }

  return args
}
