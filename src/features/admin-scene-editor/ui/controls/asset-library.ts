'use client'

import { useCallback, useEffect, useState } from 'react'

/** The two upload collections the scene editor writes to. */
export type AssetCollection = 'textures' | 'models'

export type AssetRef = { id: number; url: string | null; title: string }

/**
 * Everything already uploaded to one collection.
 *
 * Called once per section and passed down, not once per slot: seven surfaces
 * would otherwise open seven identical requests.
 */
export function useAssetLibrary(collection: AssetCollection) {
  const [assets, setAssets] = useState<AssetRef[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true

    const load = async () => {
      const response = await fetch(`/api/${collection}?limit=300&depth=0&sort=-updatedAt`, {
        credentials: 'include',
      })
      if (!response.ok) return

      const page = (await response.json()) as {
        docs: Array<{
          id: number
          title?: string | null
          filename?: string | null
          url?: string | null
        }>
      }
      if (!live) return

      setAssets(
        page.docs.map((doc) => ({
          id: doc.id,
          url: doc.url ?? null,
          title: doc.title || doc.filename || `#${doc.id}`,
        })),
      )
    }

    void load()
    return () => {
      live = false
    }
  }, [collection, version])

  const refresh = useCallback(() => setVersion((current) => current + 1), [])

  return { assets, refresh }
}

/**
 * Reads a stored relationship, whichever shape it is in.
 *
 * The loaded document carries a populated object; a value the editor has just
 * written carries whatever it wrote. Both have to render the same, and a bare
 * id still has to find its URL — hence the library lookup.
 */
export function assetRefOf(value: unknown, library: AssetRef[]): AssetRef | null {
  if (typeof value === 'number') return library.find((item) => item.id === value) ?? null
  if (!value || typeof value !== 'object') return null

  const doc = value as { id?: unknown; url?: unknown; title?: unknown; filename?: unknown }
  if (typeof doc.id !== 'number') return null

  const known = library.find((item) => item.id === doc.id)
  return {
    id: doc.id,
    url: typeof doc.url === 'string' ? doc.url : (known?.url ?? null),
    title:
      (typeof doc.title === 'string' && doc.title) ||
      (typeof doc.filename === 'string' && doc.filename) ||
      known?.title ||
      `#${doc.id}`,
  }
}
