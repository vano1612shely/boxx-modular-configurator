'use client'

import { useCallback, useEffect, useState } from 'react'

export type AssetCollection = 'textures' | 'models'

export type AssetRef = { id: number; url: string | null; title: string }

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

/** Normalizes a stored relationship — a bare id or a populated doc — to an AssetRef. */
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
