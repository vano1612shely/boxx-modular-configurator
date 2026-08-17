'use client'

import { useEffect, useState } from 'react'

import type { RoomType } from '@/payload-types'

/** One kind of room, as the editor's pickers need it. */
export type RoomTypeRef = {
  id: number
  name: string
  slug: string
}

/**
 * The kinds of room a building can be made of.
 *
 * One list for the whole editor: rooms and the zones cut out of them are both
 * typed from it, and two copies would mean a type added in one picker missing
 * from the other.
 *
 * The two pickers do not write the same thing, which is worth knowing before
 * reading them. A room's type is a relationship, so it stores the id; a zone
 * lives in a JSON column with no schema of its own, so it stores the key. Both
 * come from here, and the mapping resolves both back to the key.
 */
export function useRoomTypes() {
  const [types, setTypes] = useState<RoomTypeRef[]>([])

  useEffect(() => {
    let live = true

    const load = async () => {
      const response = await fetch('/api/room-types?limit=200&depth=0&sort=name', {
        credentials: 'include',
      })
      if (!response.ok) return

      const page = (await response.json()) as { docs: RoomType[] }
      if (!live) return

      setTypes(page.docs.map((doc) => ({ id: doc.id, name: doc.name, slug: doc.slug })))
    }

    void load()
    return () => {
      live = false
    }
  }, [])

  return types
}

/** The id behind a room's type, whether it came back populated or as an id. */
export function roomTypeIdOf(value: unknown): number | '' {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
  }
  return ''
}
