import { APIError, type CollectionBeforeOperationHook } from 'payload'

import { describeGlb, externalReferences, optimizeGlb, optimizeGltfJson } from '../lib/optimize-model'

const GLB_EXTENSIONS = ['.glb', '.gltf']

export const processModelUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  if (!req.file?.data) return args

  // Access is checked after this hook, not before it — so an anonymous POST
  // to /api/models used to have its file optimised, minutes of CPU and
  // gigabytes of memory, and only then be refused. Nothing is done for a
  // request that is about to be turned away. The Local API has no user
  // either, but it overrides access, and that is what tells the two apart.
  if (!req.user && !args.overrideAccess) return args

  const name = req.file.name.toLowerCase()

  if (!GLB_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new APIError('Only .glb / self-contained .gltf files are supported.', 400)
  }

  // A file the importer takes from the repository's `catalogue/` has been
  // through this pass once, on the machine that cut it, and is stored as it
  // is: the pass again would cost minutes a building for nothing, and anything
  // that re-emits a glb may renumber the nodes every path in the catalogue is
  // written against. It is still measured — the row describes the file.
  if (req.context.storeAsIs && name.endsWith('.glb')) {
    req.context.modelMeta = await describeGlb(req.file.data)
    return args
  }

  if (name.endsWith('.gltf')) {
    const missing = externalReferences(req.file.data.toString('utf8'))
    if (missing.length) {
      const sample = missing.slice(0, 3).join(', ')
      throw new APIError(
        `This .gltf keeps its data in ${missing.length} separate file(s) — ${sample}` +
          `${missing.length > 3 ? ', …' : ''} — and a file input sends only the file you picked. ` +
          'Pack it into one first: run `pnpm optimize:model ' +
          `"${req.file.name}"\` in the folder that holds them, then upload the .glb it writes.`,
        400,
      )
    }
  }

  try {
    const { output, meta } = name.endsWith('.gltf')
      ? await optimizeGltfJson(req.file.data)
      : await optimizeGlb(req.file.data)

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
