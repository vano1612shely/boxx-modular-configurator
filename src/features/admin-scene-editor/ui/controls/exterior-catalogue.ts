'use client'

import { useEffect, useState } from 'react'

import type { ExteriorOption } from '@/payload-types'

import type { ExteriorOptionRef } from '../../model/use-scene-editor-model'

/**
 * The exterior catalogue, for the picker that adds a choice to a spot.
 *
 * Read at depth 1 so each entry carries its populated model: the viewport
 * renders the draft, so it needs the file url in hand rather than an id it
 * would have to resolve again.
 */
export function useExteriorCatalogue() {
  const [options, setOptions] = useState<ExteriorOptionRef[]>([])

  const load = async () => {
    const response = await fetch('/api/exterior-options?limit=200&depth=1&sort=title', {
      credentials: 'include',
    })
    if (!response.ok) return []

    const page = (await response.json()) as { docs: ExteriorOption[] }

    return page.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      price: typeof doc.price === 'number' ? doc.price : null,
      model: doc.model,
    }))
  }

  useEffect(() => {
    let live = true

    void load().then((docs) => {
      if (live) setOptions(docs)
    })

    return () => {
      live = false
    }
  }, [])

  // Handed back so a newly uploaded ramp shows up in the picker without a
  // reload — the editor creates options without leaving the scene.
  return { options, reload: () => void load().then(setOptions) }
}
