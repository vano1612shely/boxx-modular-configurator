'use client'

import { useEffect, useState } from 'react'

import type { FurniturePackage } from '@/payload-types'

/** One fitted package as the editor names it. */
export type FittedPackageRef = {
  id: number
  title: string
  price: number | null
}

/**
 * The packages a room may be arranged around.
 *
 * Only the fitted ones: every other package is carried in by the visitor and
 * has nothing to arrange. Read at depth 0 — the editor shows a name and a
 * price and never draws the row itself, so populating relationships would be
 * fetching a model file per row to display neither.
 */
async function fetchFitted(): Promise<FittedPackageRef[]> {
  const response = await fetch(
    '/api/furniture-packages?limit=200&depth=0&sort=title&where[fitted][equals]=true',
    { credentials: 'include' },
  )
  if (!response.ok) return []

  const page = (await response.json()) as { docs: FurniturePackage[] }

  return page.docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    price: typeof doc.price === 'number' ? doc.price : null,
  }))
}

export function useFittedCatalogue() {
  const [packages, setPackages] = useState<FittedPackageRef[]>([])

  useEffect(() => {
    let live = true

    void fetchFitted().then((docs) => {
      if (live) setPackages(docs)
    })

    return () => {
      live = false
    }
  }, [])

  return packages
}
