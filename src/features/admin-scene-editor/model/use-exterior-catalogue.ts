'use client'

import { useCallback, useEffect, useState } from 'react'

import { assetUrl } from '@/shared/lib'

import type { ExteriorOption } from '@/payload-types'

/** One catalogue entry as the editor uses it. */
export type ExteriorOptionRef = {
  id: number
  title: string
  price: number | null
  /** Resolved here rather than carried as a relationship, so every side that
   *  wants to draw the entry — viewport included — has the file in hand. */
  modelUrl: string | null
}

async function fetchOptions(): Promise<ExteriorOptionRef[]> {
  const response = await fetch('/api/exterior-options?limit=200&depth=1&sort=title', {
    credentials: 'include',
  })
  if (!response.ok) return []

  const page = (await response.json()) as { docs: ExteriorOption[] }

  return page.docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    price: typeof doc.price === 'number' ? doc.price : null,
    modelUrl: typeof doc.model === 'object' ? assetUrl(doc.model) : null,
  }))
}

/**
 * The exterior catalogue: what a spot's choices are picked from.
 *
 * Read a level deep, so each entry arrives with its model file rather than an
 * id the viewport would have to resolve again. The building document is read
 * one level deep too, which populates the option on a choice but leaves the
 * model inside it as a bare id — so this is the only side that can answer
 * where a choice's model lives.
 *
 * One list for the whole editor. The panel and the viewport both need it, and
 * two copies would mean a ramp uploaded in the panel showing up in the list
 * but not on the building.
 */
export function useExteriorCatalogue() {
  const [options, setOptions] = useState<ExteriorOptionRef[]>([])

  useEffect(() => {
    let live = true

    void fetchOptions().then((docs) => {
      if (live) setOptions(docs)
    })

    return () => {
      live = false
    }
  }, [])

  const reload = useCallback(() => {
    void fetchOptions().then(setOptions)
  }, [])

  /**
   * An entry just created here, in the list before the server is asked again.
   *
   * Without it a ramp uploaded from the scene lands on the spot with nothing
   * to draw until the refetch comes back — which is exactly the moment the
   * admin is looking for it.
   */
  const remember = useCallback((option: ExteriorOptionRef) => {
    setOptions((current) =>
      current.some((entry) => entry.id === option.id)
        ? current.map((entry) => (entry.id === option.id ? option : entry))
        : [...current, option],
    )
  }, [])

  return { options, reload, remember }
}
