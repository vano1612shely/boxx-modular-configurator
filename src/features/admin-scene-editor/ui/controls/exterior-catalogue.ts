'use client'

import { useEffect, useState } from 'react'

import type { ExteriorOption } from '@/payload-types'

import type { ExteriorOptionRef } from '../../model/use-scene-editor-model'

/**
 * The exterior catalogue, for the picker that adds a choice to a spot.
 *
 * Read at depth 1 so each part carries its populated model: the parts are copied
 * into the building on add, and the viewport renders the draft, so it needs the
 * file url in hand rather than an id it would have to resolve again.
 */
export function useExteriorCatalogue() {
  const [options, setOptions] = useState<ExteriorOptionRef[]>([])

  useEffect(() => {
    let live = true

    const load = async () => {
      const response = await fetch('/api/exterior-options?limit=200&depth=1&sort=title', {
        credentials: 'include',
      })
      if (!response.ok) return

      const page = (await response.json()) as { docs: ExteriorOption[] }
      if (!live) return

      setOptions(
        page.docs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          price: typeof doc.price === 'number' ? doc.price : null,
          parts: (doc.parts ?? []).map((part) => ({
            model: part.model,
            position: {
              x: part.position?.x ?? 0,
              y: part.position?.y ?? 0,
              z: part.position?.z ?? 0,
            },
            yawDeg: part.yawDeg ?? 0,
            scale: part.scale ?? 1,
          })),
        })),
      )
    }

    void load()
    return () => {
      live = false
    }
  }, [])

  return options
}
