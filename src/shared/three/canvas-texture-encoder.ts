import { fitWithin, TARGET_TEXTURE_MIME, type TextureEncoder } from './gltf-optimize'

/**
 * Whether this browser can do the image half of the pipeline.
 *
 * Both APIs exist in a worker, which is where this runs; a browser without them
 * falls back to uploading the raw file and letting the server do the work.
 */
export function canEncodeTextures(): boolean {
  return typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function'
}

/**
 * The browser's own codecs, standing in for sharp.
 *
 * `convertToBlob` encodes webp through libwebp — the same library sharp uses —
 * so a texture that goes through here and one that goes through the server come
 * out equivalent. The resize happens inside `createImageBitmap` rather than in
 * `drawImage`, because only the former takes a filter worth having.
 */
export const encodeTextureOnCanvas: TextureEncoder = async ({ data, mimeType, max, quality }) => {
  // The buffer is copied: a Uint8Array view over a worker's transferred memory
  // is not something Blob may keep a reference into.
  const blob = new Blob([new Uint8Array(data)], { type: mimeType || 'application/octet-stream' })

  let probe: ImageBitmap
  try {
    probe = await createImageBitmap(blob)
  } catch {
    // A format the browser cannot read — KTX2, DDS, or simply broken. Leave it
    // for the server rather than dropping it.
    return null
  }

  const target = fitWithin(probe.width, probe.height, max)
  let bitmap = probe

  if (target.width !== probe.width || target.height !== probe.height) {
    try {
      bitmap = await createImageBitmap(blob, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: 'high',
      })
      probe.close()
    } catch {
      bitmap = probe
    }
  }

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return null
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const encoded = await canvas.convertToBlob({
    type: TARGET_TEXTURE_MIME,
    quality: quality / 100,
  })

  // Some browsers quietly hand back a PNG when asked for a format they cannot
  // write. Taking that would inflate the file instead of shrinking it.
  if (encoded.type !== TARGET_TEXTURE_MIME) return null

  return {
    data: new Uint8Array(await encoded.arrayBuffer()),
    mimeType: TARGET_TEXTURE_MIME,
  }
}
