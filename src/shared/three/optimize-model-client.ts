import { canEncodeTextures } from './canvas-texture-encoder'
import type { FolderFile } from './gltf-pack'
import type { OptimizedModel, OptimizeProgress } from './optimize-in-browser'

export type { OptimizedModel, OptimizeProgress }

/** Thrown when this browser cannot do the work; the caller falls back to the server. */
export class OptimizeUnsupported extends Error {}

export function canOptimizeInBrowser(): boolean {
  return canEncodeTextures()
}

/**
 * Optimises a picked model in the page rather than in a worker.
 *
 * A worker would be the tidier home, but Turbopack does not compile
 * `new Worker(new URL('./x.ts', import.meta.url))` — it emits the TypeScript
 * file verbatim as a static asset, which the browser cannot run. Rather than
 * carry a second build step for one file, the work stays here.
 *
 * It costs less than it sounds. The expensive half is images, and
 * `createImageBitmap` and `convertToBlob` both hand the decoding and encoding
 * to the browser's own threads — the page is only held for the synchronous
 * glTF passes, which are seconds on a model of hundreds of megabytes.
 */
export async function optimizeModelInBrowser(
  files: FolderFile[],
  onProgress?: (progress: OptimizeProgress) => void,
): Promise<OptimizedModel> {
  if (!canOptimizeInBrowser()) {
    throw new OptimizeUnsupported('This browser cannot optimise models locally.')
  }

  // Lazy: glTF-Transform and the meshopt wasm are a few hundred KB that only an
  // admin uploading a model ever needs.
  const { packAndOptimize } = await import('./optimize-in-browser')

  return packAndOptimize(files, (progress) => {
    onProgress?.(progress)
  })
}
