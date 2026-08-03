/** The shape every Payload upload doc shares, as far as a URL is concerned. */
export type UploadDoc = {
  url?: string | null
  updatedAt?: string | null
}

/**
 * The URL of an uploaded asset, stamped with the version behind it.
 *
 * A Payload upload keeps its filename when the file is replaced, so the URL on
 * its own cannot tell two versions apart — and both caches that matter key on
 * exactly that string. The browser serves the bytes it already has, and drei's
 * loader cache serves the scene it already parsed, which outlives a soft
 * navigation. Replacing a model then showed the previous one until a hard
 * refresh.
 *
 * `updatedAt` moves for any edit to the doc, not only a new file, so a renamed
 * title costs one re-download. That is the cheap side of the trade.
 */
export function assetUrl(doc: UploadDoc | null | undefined): string | null {
  const url = doc?.url
  if (typeof url !== 'string' || url.length === 0) return null

  const stamp = doc?.updatedAt ? Date.parse(doc.updatedAt) : Number.NaN
  if (!Number.isFinite(stamp)) return url

  return `${url}${url.includes('?') ? '&' : '?'}v=${stamp}`
}
